/** Geometrie und Ablauf des Brückenbaus (rein): Seitenansicht, Lücken hintereinander, Testfahrt. */

export const MAX_SEGMENTE = 10;
export const SEG = 5;
export const UFER = 10;
export const BODEN_Y = 30;
export const HOEHE = 50;
export const SICHT = 70;

export type Ausgang = "haelt" | "biegt" | "bricht";

/** Segmente je Brücke: bis 10 eine Brücke, darüber min(3, ceil(n/10)) Brücken, gleichmäßig verteilt (größere zuerst). */
export function teileBruecken(n: number): number[] {
  const m = Math.max(1, Math.floor(n));
  const b = m <= MAX_SEGMENTE ? 1 : Math.min(3, Math.ceil(m / MAX_SEGMENTE));
  return Array.from({ length: b }, (_, k) => Math.floor(m / b) + (k < m % b ? 1 : 0));
}
/** Globales Segment i -> Brücke und Segment darin. */
export function segmentOrt(i: number, teile: number[]): { bruecke: number; segment: number } {
  let r = i;
  for (let b = 0; b < teile.length; b++) {
    if (r < teile[b]) return { bruecke: b, segment: r };
    r -= teile[b];
  }
  return { bruecke: teile.length - 1, segment: teile[teile.length - 1] };
}
/** Linke Auflagerkante der Brücke b (zwischen den Brücken liegt eine kleine Insel). */
export const bruckeX = (b: number, teile: number[]) => teile.slice(0, b).reduce((s, t) => s + t * SEG + 2 * UFER, UFER);
export const segmentX = (i: number, teile: number[]) => { const o = segmentOrt(i, teile); return bruckeX(o.bruecke, teile) + o.segment * SEG; };
export const weltBreite = (teile: number[]) => teile.reduce((s, t) => s + t * SEG + 2 * UFER, 0);
/** Linke Kante des Kamerafensters, Brücke b mittig. */
export const kameraX = (b: number, teile: number[]) =>
  Math.max(0, Math.min(weltBreite(teile) - SICHT, bruckeX(b, teile) + (teile[b] * SEG - SICHT) / 2));

export const ausgang = (a: { treffer: boolean; komplett: boolean }): Ausgang => (a.komplett ? "haelt" : a.treffer ? "biegt" : "bricht");

/** Sterne nach Materialeinsatz: Bretter, die in gescheiterten Testfahrten verbaut wurden. */
export const sterne = (verschwendet: number) => (verschwendet <= 0 ? 3 : verschwendet <= 3 ? 2 : 1);

/** Durchhang der Fahrbahn bei Fortschritt p (0..1) der Testfahrt. */
export function durchhang(art: Ausgang, p: number): number {
  const amp = art === "biegt" ? 4.5 : 0.9;
  if (p <= 0.8) return amp * Math.sin((Math.PI * p) / 0.8);
  const q = (p - 0.8) / 0.2;
  return amp * 0.25 * (1 - q) * Math.cos(q * 14);
}

/** Fortschritt, bei dem der Karren die Mitte des letzten Segments erreicht: dort bricht es. */
export const bruch = (len = 40) => (len - SEG / 2 + 7) / (len + 7);

/** Karren: x relativ zur linken Auflagerkante der Brücke, `len` = Fahrstrecke bis Segmentende, `fall` = Absturztiefe (nur bei »bricht«). */
export function karren(art: Ausgang, p: number, len = 40): { x: number; fall: number; schirm: boolean } {
  const lauf = (q: number) => -7 + q * (len + 7);
  const pb = bruch(len);
  if (art !== "bricht" || p < pb) return { x: lauf(p), fall: 0, schirm: false };
  const q = (p - pb) / (1 - pb);
  return { x: lauf(pb), fall: q * 26, schirm: q > 0.15 };
}

/** Globale Segmentindizes der Brücke b, vom Ufer aus. */
export function strecke(b: number, teile: number[]): number[] {
  const start = teile.slice(0, b).reduce((s, t) => s + t, 0);
  return Array.from({ length: teile[b] ?? 0 }, (_, k) => start + k);
}
