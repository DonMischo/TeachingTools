"use client";
/**
 * Lässt einen DLA-Haufen im Hauptfaden wachsen: je Bild ~14 ms rechnen, dann
 * zeichnen. So bleibt die Seite bedienbar, und man sieht beim Wachsen zu.
 */
import { useEffect, useRef, useState } from "react";
import { Dla, dimension, type Dimension, type Saat } from "@/lib/dla/kern";

export interface Einstellung {
  anzahl: number;
  haftung: number;
  saat: Saat;
}

export interface Stand {
  anzahl: number;
  rmax: number;
  sekunden: number;
  fertig: boolean;
  dim: Dimension | null;
}

const LEER: Stand = { anzahl: 0, rmax: 0, sekunden: 0, fertig: false, dim: null };

/**
 * `zeichne(dla, neu)` läuft jedes Bild; `neu` ist true beim ersten Bild eines
 * frischen Haufens. `lauf` hochzählen startet neu mit anderem Zufall.
 */
export function useWachstum(dim: 2 | 3, e: Einstellung, lauf: number, zeichne: (dla: Dla, neu: boolean) => void) {
  const [dla, setDla] = useState<Dla | null>(null);
  const [laeuft, setLaeuft] = useState(true);
  const [stand, setStand] = useState<Stand>(LEER);
  const zeichneRef = useRef(zeichne);
  useEffect(() => { zeichneRef.current = zeichne; });

  useEffect(() => {
    setDla(new Dla({ dim, kapazitaet: e.anzahl, haftung: e.haftung, saat: e.saat, zufall: (Math.random() * 2 ** 32) >>> 0 }));
    setLaeuft(true);
    setStand(LEER);
  }, [dim, e.anzahl, e.haftung, e.saat, lauf]);

  useEffect(() => {
    if (!dla) return;
    let raf = 0, erst = true, letzte = 0, letzteDim = 0, gemeldet = -1, dimWert: Dimension | null = null;
    let sekunden = stand.sekunden;
    const tick = () => {
      if (laeuft && !dla.voll) {
        const t = performance.now();
        dla.wachse(dla.kapazitaet, t + 14);
        sekunden += (performance.now() - t) / 1000;
      }
      zeichneRef.current(dla, erst);
      erst = false;
      const jetzt = performance.now();
      if (dla.anzahl !== gemeldet && (jetzt - letzte > 150 || dla.voll)) {
        // Die Dimension sortiert alle Abstände — höchstens einmal je Sekunde
        if (jetzt - letzteDim > 1000 || dla.voll) { dimWert = dimension(dla); letzteDim = jetzt; }
        setStand({ anzahl: dla.anzahl, rmax: dla.rmax, sekunden, fertig: dla.voll, dim: dimWert });
        letzte = jetzt;
        gemeldet = dla.anzahl;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // stand.sekunden nur als Startwert beim Fortsetzen
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dla, laeuft]);

  return { dla, stand, laeuft, setLaeuft };
}
