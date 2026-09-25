"use client";
/**
 * Verbindung zum Live-Raum der Verkehrs-Simulation (`/api/verkehr/{code}/ws`).
 * Liefert ein `Netz`, das das Spielfeld jedes Bild liest — der Zustand steckt
 * deshalb in einem Ref, nicht im React-State. Nur was die Hülle anzeigt
 * (Spielerliste, Einstellungen) geht zusätzlich in den State, gedrosselt.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveSocket } from "@/hooks/useLiveSocket";
import type { FremderSpieler, Gepackt, Netz } from "@/lib/verkehr/netz";
import type { GestenId } from "@/lib/verkehr/gesten";

export type Zugang = { code: string; token?: string | null };

export function useVerkehrLive(zugang: Zugang | null) {
  const zustand = useRef({
    versatz: 0,
    du: null as string | null,
    taktgeber: null as string | null,
    spieler: [] as FremderSpieler[],
    fahrzeuge: null as Gepackt[] | null,
    taster: new Map<number, number>(),
    beleidigungen: true,
    gesten: new Map<string, { id: GestenId; t: number }>(),
    strafe: null as { bis: number; karmaBis: number } | null,
    zeitVersatz: 0,
  });
  const [liste, setListe] = useState<FremderSpieler[]>([]);
  const [beleidigungen, setBeleidigungen] = useState(true);
  const [lehrkraft, setLehrkraft] = useState(false);
  const [zeitVersatz, setZeitVersatz] = useState(0);
  const zuletztListe = useRef(0);

  const pfad = zugang
    ? `/api/verkehr/${encodeURIComponent(zugang.code)}/ws${zugang.token ? `?guest_token=${encodeURIComponent(zugang.token)}` : ""}`
    : null;

  const { send, connected } = useLiveSocket(pfad, (n) => {
    const z = zustand.current;
    const jetzt = performance.now() / 1000;
    switch (n.typ) {
      case "willkommen":
        z.du = n.du;
        z.versatz = n.uhr - jetzt;
        z.beleidigungen = n.beleidigungen;
        z.zeitVersatz = n.zeitVersatz ?? 0;
        setZeitVersatz(z.zeitVersatz);
        z.taster = new Map(Object.entries(n.taster ?? {}).map(([k, v]) => [Number(k), v as number]));
        setBeleidigungen(n.beleidigungen);
        setLehrkraft(!!n.lehrkraft);
        break;
      case "pong":
        // Halbe Laufzeit abziehen: die Antwort war so lange unterwegs.
        if (typeof n.c === "number") z.versatz = n.uhr + (jetzt - n.c) / 2 - jetzt;
        break;
      case "taktgeber":
        z.taktgeber = n.key;
        break;
      case "stand":
        z.spieler = n.spieler;
        if (jetzt - zuletztListe.current > 1) { zuletztListe.current = jetzt; setListe(n.spieler); }
        break;
      case "verkehr":
        if (z.taktgeber !== z.du) z.fahrzeuge = n.f;
        break;
      case "taster":
        z.taster.set(n.anlage, n.t);
        break;
      case "geste":
        z.gesten.set(n.key, { id: n.id, t: n.t });
        break;
      case "strafe":
        if (n.key === z.du) z.strafe = { bis: n.bis, karmaBis: n.karmaBis };
        break;
      case "einstellungen":
        z.beleidigungen = n.beleidigungen;
        setBeleidigungen(n.beleidigungen);
        z.zeitVersatz = n.zeitVersatz ?? 0;
        setZeitVersatz(z.zeitVersatz);
        break;
    }
  });

  // Uhr nachstellen: alle 10 s ein Ping.
  useEffect(() => {
    if (!connected) return;
    const ping = () => send({ typ: "ping", c: performance.now() / 1000 });
    ping();
    const id = setInterval(ping, 10_000);
    return () => clearInterval(id);
  }, [connected, send]);

  const netz = useMemo<Netz>(() => {
    const z = zustand.current;
    let zuletztIch = 0;
    return {
      uhr: () => performance.now() / 1000 + z.versatz,
      taktgeber: () => z.du !== null && z.taktgeber === z.du,
      ich: () => z.du,
      andere: () => z.spieler.filter((s) => s.key !== z.du),
      fahrzeuge: () => z.fahrzeuge,
      taster: () => z.taster,
      beleidigungen: () => z.beleidigungen,
      gesten: () => z.gesten,
      strafe: () => z.strafe,
      zeitVersatz: () => z.zeitVersatz,
      sendeIch(x, y, w, mitfahrt, farbe, weste) {
        const t = performance.now();
        if (t - zuletztIch < 100) return;
        zuletztIch = t;
        send({ typ: "ich", x, y, w, mitfahrt, farbe, weste });
      },
      sendeGeste: (id) => send({ typ: "geste", id }),
      sendeTaster: (anlage) => send({ typ: "taster", anlage }),
      sendeVerkehr: (f) => send({ typ: "verkehr", f }),
      sendeMeldung: (id, punkte) => send({ typ: "meldung", id, punkte }),
    };
  }, [send]);

  return {
    netz, connected, liste, beleidigungen, lehrkraft, zeitVersatz,
    setzeBeleidigungen: (an: boolean) => send({ typ: "einstellungen", beleidigungen: an }),
    setzeZeitVersatz: (sekunden: number) => send({ typ: "einstellungen", zeitVersatz: sekunden }),
  };
}
