/** Heiltrank des Gegners: unvollständige Antworten heilen ihn ein wenig, falsche viel. Nur Anzeige — gewertet wird auf dem Server. */
export const HEIL_TEIL = 0.1;
export const HEIL_DANEBEN = 0.3;

/** Wie viele Lebenspunkte der Gegner zurückbekommt (`max` = volle Lebenspunkte, `verlust` = was ihm gerade fehlt). */
export function heiltrank(a: { treffer: boolean; komplett: boolean }, max: number, verlust: number): number {
  if (a.komplett || verlust <= 0) return 0;
  return Math.min(verlust, Math.max(1, Math.round(max * (a.treffer ? HEIL_TEIL : HEIL_DANEBEN))));
}
