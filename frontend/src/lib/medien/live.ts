"use client";
/**
 * Verbindung zum Live-Raum der Medien-Simulation (`/api/medien/{code}/ws`):
 * Nachrichten in historischen Medien und die Höhlenwand zum Malen und Raten.
 */
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useLiveSocket } from "@/hooks/useLiveSocket";

export type LiveZugang = { code: string; token?: string | null };
export type Art = "morse" | "fax" | "telefon" | "pager" | "sms" | "email" | "qr";
export type LiveSpieler = { key: string; name: string; nummer: string; lehrkraft: boolean };
export type Nachricht = {
  id: string; von: string; vonName: string; vonNummer: string; art: Art;
  inhalt: unknown; antwortAuf?: string | null; t: number;
};
export type WandBild = {
  id: string; von: string; vonName: string; bild: string; t: number;
  geraten: number; richtig: number; meins: boolean;
  loesung: string | null; meinTipp: string | null; meinRichtig: boolean | null;
};

const FEHLER: Record<string, string> = {
  offline: "Die Person ist nicht mehr da.",
  zu_schnell: "Langsam — eine Nachricht pro Sekunde.",
};

export function useMedienLive(zugang: LiveZugang | null) {
  const [du, setDu] = useState<string | null>(null);
  const [nummer, setNummer] = useState<string | null>(null);
  const [lehrkraft, setLehrkraft] = useState(false);
  const [alle, setAlle] = useState<LiveSpieler[]>([]);
  const [posteingang, setPosteingang] = useState<Nachricht[]>([]);
  const [wand, setWand] = useState<WandBild[]>([]);
  const [meldung, setMeldung] = useState<string | null>(null);
  const hoerer = useRef(new Set<(n: Nachricht) => void>());

  const pfad = zugang
    ? `/api/medien/${encodeURIComponent(zugang.code)}/ws${zugang.token ? `?guest_token=${encodeURIComponent(zugang.token)}` : ""}`
    : null;

  const { send, connected } = useLiveSocket(pfad, (n) => {
    switch (n.typ) {
      case "willkommen":
        setDu(n.du);
        setNummer(n.nummer);
        setLehrkraft(!!n.lehrkraft);
        setAlle(n.spieler);
        setWand([...n.wand].reverse());
        break;
      case "spieler":
        setAlle(n.spieler);
        break;
      case "nachricht":
        setPosteingang((p) => [n as Nachricht, ...p].slice(0, 50));
        hoerer.current.forEach((f) => f(n as Nachricht));
        break;
      case "fehler":
        setMeldung(FEHLER[n.grund] ?? "Das hat nicht geklappt.");
        break;
      case "bild":
        setWand((w) => [n.bild, ...w.filter((b) => b.id !== n.bild.id)]);
        break;
      case "aufloesung":
        setWand((w) => w.map((b) => (b.id === n.id
          ? { ...b, loesung: n.loesung, meinRichtig: n.richtig } : b)));
        break;
      case "geraten":
        // Nur zur Anzeige für die Urheber·in; die Zähler kommen separat.
        break;
      case "zaehler":
        setWand((w) => w.map((b) => (b.id === n.id ? { ...b, geraten: n.geraten, richtig: n.richtig } : b)));
        break;
      case "weg":
        setWand((w) => w.filter((b) => b.id !== n.id));
        break;
    }
  });

  const senden = useCallback((an: string, art: Art, inhalt: unknown, antwortAuf?: string) => {
    setMeldung(null);
    send({ typ: "senden", an, art, inhalt, antwortAuf });
  }, [send]);
  const malen = useCallback((bild: string, loesung: string) => { send({ typ: "malen", bild, loesung }); }, [send]);
  const raten = useCallback((id: string, text: string) => {
    // meinTipp gleich vermerken, damit die Karte sofort umspringt.
    setWand((w) => w.map((b) => (b.id === id ? { ...b, meinTipp: text } : b)));
    send({ typ: "raten", id, text });
  }, [send]);
  const loeschen = useCallback((id: string) => { send({ typ: "loeschen", id }); }, [send]);
  const gelesen = useCallback((id: string) => setPosteingang((p) => p.filter((n) => n.id !== id)), []);
  const beiNachricht = useCallback((f: (n: Nachricht) => void) => {
    hoerer.current.add(f);
    return () => { hoerer.current.delete(f); };
  }, []);

  return {
    verbunden: connected, du, nummer, lehrkraft,
    spieler: alle.filter((s) => s.key !== du),
    posteingang, wand, meldung,
    senden, malen, raten, loeschen, gelesen, beiNachricht,
  };
}

export const MedienLiveKontext = createContext<ReturnType<typeof useMedienLive> | null>(null);

export function useMedienLiveKontext() {
  return useContext(MedienLiveKontext);
}
