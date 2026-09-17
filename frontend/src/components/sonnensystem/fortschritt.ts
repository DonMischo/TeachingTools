/**
 * Was im Flug erforscht, gelöst und erflogen wurde. Lebt nur im Browser
 * (localStorage): die Aufträge sind zum Üben da, nicht für Hauspunkte.
 * Gespeichert wird je Gerät und — über `schluessel` — je Sitzungscode oder Konto.
 *
 * Flug, Galerie und Kodex teilen sich diesen Stand über `useForschung`. Wird
 * er geändert, prüft der Hook gleich die Erfolge und merkt sich neue für eine
 * Einblendung.
 */
import { useCallback, useEffect, useState } from "react";
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
  // Der Schlüssel hängt am Stand, nicht an einem Ref: eine Marke im Ref steht
  // schon auf »geladen«, während der geladene Stand noch in der Warteschlange
  // liegt — der Speicher-Effekt schriebe dann die Leere über die Forschung, und
  // weil StrictMode zweimal montiert, läse der zweite Ladevorgang genau diese
  // Leere zurück. Dasselbe beim Wechsel des Schlüssels (ein Gast meldet sich
  // an): sonst landet der Stand des einen Platzes auf dem anderen.
  const [stand, setStand] = useState<{ fuer: string | null; fortschritt: Fortschritt }>(
    () => ({ fuer: null, fortschritt: LEERER_FORTSCHRITT }),
  );
  const fortschritt = stand.fortschritt;
  const [neu, setNeu] = useState<Erfolg[]>([]);

  // Erst im Browser laden: auf dem Server gibt es kein localStorage.
  useEffect(() => {
    setStand({ fuer: schluessel, fortschritt: ladeFortschritt(schluessel) });
  }, [schluessel]);

  // Gespeichert wird nur, was auch zu diesem Platz geladen wurde.
  useEffect(() => {
    if (stand.fuer !== schluessel) return;
    speichereFortschritt(schluessel, stand.fortschritt);
  }, [schluessel, stand]);

  const aendere = useCallback((fn: (f: Fortschritt) => Fortschritt) => {
    setStand(vorher => {
      const alt = vorher.fortschritt;
      const f = fn(alt);
      if (f === alt) return vorher;
      const erreicht = neueErfolge(f, Object.keys(f.erfolge));
      if (!erreicht.length) return { ...vorher, fortschritt: f };
      const jetzt = Date.now();
      // Die Einblendung außerhalb des Updaters anstoßen — React mag keine Nebenwirkungen darin.
      queueMicrotask(() => setNeu(n => [...n, ...erreicht.filter(e => !n.some(x => x.id === e.id))]));
      const erfolge = { ...f.erfolge, ...Object.fromEntries(erreicht.map(e => [e.id, jetzt])) };
      return { ...vorher, fortschritt: { ...f, erfolge } };
    });
  }, []);

  const zuruecksetzen = useCallback(() => setStand(v => ({ ...v, fortschritt: LEERER_FORTSCHRITT })), []);
  const gesehen = useCallback((id: string) => setNeu(n => n.filter(e => e.id !== id)), []);

  return { fortschritt, aendere, zuruecksetzen, neueErfolge: neu, gesehen };
}
