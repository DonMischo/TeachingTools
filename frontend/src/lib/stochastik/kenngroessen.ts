/**
 * Daten erfassen und beschreiben (Kl. 5/6): Strichliste, Häufigkeiten,
 * Rangliste und die Kenngrößen.
 *
 * Quartile wie im Schulbuch: Die Rangliste wird am Median geteilt; bei
 * ungerader Anzahl gehört der Median zu keiner Hälfte. Das untere Quartil
 * ist der Median der unteren Hälfte, das obere der Median der oberen.
 */

export interface Zeile { wert: string; anzahl: number }

/** Häufigkeitstabelle aus einer Urliste, in Reihenfolge der `kategorien` (sonst nach erstem Auftreten). */
export function haeufigkeiten(urliste: readonly string[], kategorien?: readonly string[]): Zeile[] {
  const z = new Map<string, number>();
  for (const k of kategorien ?? []) z.set(k, 0);
  for (const x of urliste) z.set(x, (z.get(x) ?? 0) + 1);
  return [...z].map(([wert, anzahl]) => ({ wert, anzahl }));
}

/** Strichliste wie auf Papier: »𝍸« ist ein Fünferbündel. Für die Anzeige nur die Zahl der Bündel und den Rest. */
export const striche = (n: number) => ({ buendel: Math.floor(n / 5), rest: n % 5 });

export const rangliste = (xs: readonly number[]) => [...xs].sort((a, b) => a - b);

export const minimum = (xs: readonly number[]) => Math.min(...xs);
export const maximum = (xs: readonly number[]) => Math.max(...xs);
export const spannweite = (xs: readonly number[]) => maximum(xs) - minimum(xs);
export const mittel = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

export function median(xs: readonly number[]): number {
  const r = rangliste(xs);
  const m = Math.floor(r.length / 2);
  return r.length % 2 ? r[m] : (r[m - 1] + r[m]) / 2;
}

/** Alle Werte, die am häufigsten vorkommen (es kann mehrere geben). */
export function modalwerte(xs: readonly (number | string)[]): (number | string)[] {
  const z = new Map<number | string, number>();
  for (const x of xs) z.set(x, (z.get(x) ?? 0) + 1);
  const max = Math.max(...z.values());
  return [...z].filter(([, n]) => n === max).map(([x]) => x);
}

export function haelften(xs: readonly number[]): { unten: number[]; oben: number[] } {
  const r = rangliste(xs);
  const m = Math.floor(r.length / 2);
  return { unten: r.slice(0, m), oben: r.slice(r.length % 2 ? m + 1 : m) };
}

export function quartile(xs: readonly number[]): { q1: number; q3: number } {
  if (xs.length < 2) return { q1: xs[0], q3: xs[0] };
  const { unten, oben } = haelften(xs);
  return { q1: median(unten), q3: median(oben) };
}

export interface Kenngroessen {
  n: number; min: number; max: number; spannweite: number;
  median: number; mittel: number; modal: number[]; q1: number; q3: number;
}

export function kenngroessen(xs: readonly number[]): Kenngroessen {
  const { q1, q3 } = quartile(xs);
  return {
    n: xs.length, min: minimum(xs), max: maximum(xs), spannweite: spannweite(xs),
    median: median(xs), mittel: mittel(xs), modal: modalwerte(xs) as number[], q1, q3,
  };
}

/** Häufigkeitsverteilung → Urliste der Zahlenwerte (für Umfragen mit Zahlantworten). */
export function urlisteAus(verteilung: Record<string, number>): number[] {
  const aus: number[] = [];
  for (const [k, n] of Object.entries(verteilung)) {
    const x = Number(k);
    if (Number.isFinite(x)) for (let i = 0; i < n; i++) aus.push(x);
  }
  return rangliste(aus);
}
