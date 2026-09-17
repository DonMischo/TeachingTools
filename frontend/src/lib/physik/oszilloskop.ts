/**
 * Rechnerei des Oszilloskops — ohne Leinwand, damit sie prüfbar bleibt.
 *
 * Der Auslöser (Trigger) ist der Grund, warum ein Oszilloskop überhaupt
 * lesbar ist: gezeichnet wird nicht ab dem Anfang der Messung, sondern ab der
 * letzten steigenden Flanke durch einen Pegel. Erst dadurch steht eine
 * Schwingung still, statt über den Schirm zu wandern.
 */

/**
 * Index der letzten steigenden Flanke durch `pegel` — oder 0, wenn es keine
 * gibt. Gesucht wird von hinten, damit das Bild am jüngsten Durchgang hängt.
 */
export function flankenIndex(v: number[], pegel: number): number {
  for (let i = v.length - 1; i > 0; i--) {
    if (v[i - 1] < pegel && v[i] >= pegel) return i;
  }
  return 0;
}

/**
 * Wertebereich mit etwas Luft — nie auf einen Punkt zusammengefallen, sonst
 * teilt die Achsenrechnung durch null und der Schirm bleibt leer.
 */
export function spanne(v: number[]): { min: number; max: number } {
  if (!v.length) return { min: -1, max: 1 };
  let min = Infinity, max = -Infinity;
  for (const x of v) {
    if (!Number.isFinite(x)) continue;
    if (x < min) min = x;
    if (x > max) max = x;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: -1, max: 1 };
  const luft = (max - min) * 0.1 || Math.abs(max) * 0.1 || 1;
  return { min: min - luft, max: max + luft };
}

/** Die Messwerte der letzten `dauer` Sekunden, ab der Auslöseflanke. */
export function ausschnitt(
  verlauf: { t: number[]; v: number[] } | undefined,
  dauer: number,
  pegel: number | null,
): { t: number[]; v: number[] } {
  if (!verlauf?.t.length) return { t: [], v: [] };
  const ende = verlauf.t[verlauf.t.length - 1];
  let von = verlauf.t.findIndex(t => t >= ende - dauer);
  if (von < 0) von = 0;

  if (pegel !== null) {
    const fenster = verlauf.v.slice(von);
    const flanke = flankenIndex(fenster, pegel);
    // Nur nach vorn verschieben, wenn danach noch genug zum Zeichnen bleibt.
    if (flanke > 0 && fenster.length - flanke > 8) von += flanke;
  }

  return { t: verlauf.t.slice(von), v: verlauf.v.slice(von) };
}
