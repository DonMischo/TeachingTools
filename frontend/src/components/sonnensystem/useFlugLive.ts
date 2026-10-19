"use client";
/**
 * Verbindung zum Live-Raum des Flugs (`/api/sonnensystem/{code}/ws`).
 *
 * Die Flugschleife liest `netz` in jedem Bild — Lagen stecken deshalb in einem
 * Ref, nicht im React-State. Nur die Namensliste (für die Zielauswahl) geht
 * zusätzlich in den State, höchstens einmal je Sekunde.
 *
 * Lagen sind Versätze zum nächsten Himmelskörper (`bei` + `p`), siehe
 * api/routers/sonnensystem.py.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveSocket } from "@/hooks/useLiveSocket";

export type Zugang = { code: string; token?: string | null };

export interface FremdesSchiff {
  key: string;
  name: string;
  lehrkraft: boolean;
  bei: string;
  p: [number, number, number];
  q: [number, number, number, number];
  v: number;
}

export interface FlugNetz {
  /** eigener Schlüssel im Raum (auch Seed fürs eigene Schiff), `null` vor dem Willkommen */
  du(): string | null;
  /** alle anderen, ohne einen selbst */
  andere(): FremdesSchiff[];
  /** eigene Lage melden; gedrosselt auf 10 je Sekunde */
  sendeIch(bei: string, p: number[], q: number[], v: number): void;
}

export function useFlugLive(zugang: Zugang | null) {
  const zustand = useRef({ du: null as string | null, spieler: [] as FremdesSchiff[] });
  const [liste, setListe] = useState<{ key: string; name: string }[]>([]);
  const [du, setDu] = useState<string | null>(null);
  const zuletztListe = useRef(0);
  const zuletztGesendet = useRef(0);

  const pfad = zugang
    ? `/api/sonnensystem/${encodeURIComponent(zugang.code)}/ws${zugang.token ? `?guest_token=${encodeURIComponent(zugang.token)}` : ""}`
    : null;

  const { send, connected } = useLiveSocket(pfad, (n) => {
    const z = zustand.current;
    if (n.typ === "willkommen") {
      z.du = n.du;
      setDu(n.du);
    } else if (n.typ === "stand") {
      z.spieler = n.spieler;
      const jetzt = performance.now();
      if (jetzt - zuletztListe.current > 1000) {
        zuletztListe.current = jetzt;
        const neu = z.spieler.filter(s => s.key !== z.du).map(s => ({ key: s.key, name: s.name }));
        setListe(alt => (JSON.stringify(alt) === JSON.stringify(neu) ? alt : neu));
      }
    }
  });

  useEffect(() => { if (!connected) setListe([]); }, [connected]);

  const netz = useMemo<FlugNetz>(() => ({
    du: () => zustand.current.du,
    andere: () => zustand.current.spieler.filter(s => s.key !== zustand.current.du),
    sendeIch: (bei, p, q, v) => {
      const jetzt = performance.now();
      if (jetzt - zuletztGesendet.current < 100) return;
      zuletztGesendet.current = jetzt;
      send({ typ: "ich", bei, p, q, v });
    },
  }), [send]);

  return { netz: zugang ? netz : null, liste, du, verbunden: connected };
}
