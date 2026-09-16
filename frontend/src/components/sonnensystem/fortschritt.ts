/**
 * Was im Flug erforscht, gelöst und erflogen wurde. Lebt nur im Browser
 * (localStorage): die Aufträge sind zum Üben da, nicht für Hauspunkte.
 * Gespeichert wird je Gerät und — über `schluessel` — je Sitzungscode oder Konto.
 *
 * Flug, Galerie und Kodex teilen sich diesen Stand über `useForschung`. Wird
 * er geändert, prüft der Hook gleich die Erfolge und merkt sich neue für eine
 * Einblendung.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { LEERE_STATISTIK, neueErfolge, type Erfolg, type Statistik } from "@/lib/sonnensystem/erfolge";

export interface Fortschritt {
  erforscht: string[];
  erledigt: string[];
  statistik: Statistik;
  /** Erfolgs-Id → Zeitpunkt (ms) */
  erfolge: Record<string, number>;
}

export const LEERER_FORTSCHRITT: Fortschritt = { erforscht: [], erledigt: [], statistik: LEERE_STATISTIK, erfolge: {} };

const name = (schluessel: string) => `sonnensystem-forschung-v1:${schluessel}`;
const liste = (x: unknown): string[] => (Array.isArray(x) ? x.filter(v => typeof v === "string") : []);

export function ladeFortschritt(schluessel: string): Fortschritt {
  try {
    const roh = localStorage.getItem(name(schluessel));
    if (!roh) return LEERER_FORTSCHRITT;
    const f = JSON.parse(roh) as Partial<Fortschritt>;
    const s = { ...LEERE_STATISTIK, ...(f.statistik ?? {}) };
    return {
      erforscht: liste(f.erforscht),
      erledigt: liste(f.erledigt),
      statistik: { ...s, umrundet: liste(s.umrundet), abgestuerztAuf: liste(s.abgestuerztAuf) },
      erfolge: f.erfolge && typeof f.erfolge === "object" ? f.erfolge : {},
    };
  } catch {
    return LEERER_FORTSCHRITT;
  }
}

export function speichereFortschritt(schluessel: string, f: Fortschritt) {
  try {
    localStorage.setItem(name(schluessel), JSON.stringify(f));
  } catch { /* privater Modus: dann eben nur für diese Sitzung */ }
}

/** Trägt eine Id in eine Liste ein, ohne doppelt. */
export const mitEintrag = (l: string[], id: string) => (l.includes(id) ? l : [...l, id]);

export function useForschung(schluessel: string) {
  const [fortschritt, setFortschritt] = useState<Fortschritt>(LEERER_FORTSCHRITT);
  const [neu, setNeu] = useState<Erfolg[]>([]);
  const geladen = useRef(false);

  // Erst im Browser laden: auf dem Server gibt es kein localStorage.
  useEffect(() => {
    setFortschritt(ladeFortschritt(schluessel));
    geladen.current = true;
  }, [schluessel]);

  useEffect(() => {
    if (geladen.current) speichereFortschritt(schluessel, fortschritt);
  }, [schluessel, fortschritt]);

  const aendere = useCallback((fn: (f: Fortschritt) => Fortschritt) => {
    setFortschritt(alt => {
      const f = fn(alt);
      if (f === alt) return alt;
      const erreicht = neueErfolge(f, Object.keys(f.erfolge));
      if (!erreicht.length) return f;
      const jetzt = Date.now();
      // Die Einblendung außerhalb des Updaters anstoßen — React mag keine Nebenwirkungen darin.
      queueMicrotask(() => setNeu(n => [...n, ...erreicht.filter(e => !n.some(x => x.id === e.id))]));
      return { ...f, erfolge: { ...f.erfolge, ...Object.fromEntries(erreicht.map(e => [e.id, jetzt])) } };
    });
  }, []);

  const zuruecksetzen = useCallback(() => setFortschritt(LEERER_FORTSCHRITT), []);
  const gesehen = useCallback((id: string) => setNeu(n => n.filter(e => e.id !== id)), []);

  return { fortschritt, aendere, zuruecksetzen, neueErfolge: neu, gesehen };
}
