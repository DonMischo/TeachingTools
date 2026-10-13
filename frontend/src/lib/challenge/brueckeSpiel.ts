/** Geometrie und Ablauf des Brückenbaus (rein): Seitenansicht, Lücken hintereinander, Testfahrt. */

export const LUECKE = 40;
export const UFER = 10;
export const BODEN_Y = 30;
export const HOEHE = 50;
export const SICHT = 60;

export type Ausgang = "haelt" | "biegt" | "bricht";

export const lueckeX = (i: number) => UFER + i * (LUECKE + UFER);
export const weltBreite = (n: number) => Math.max(1, n) * (LUECKE + UFER) + UFER;
/** Linke Kante des Kamerafensters für Lücke i (Lücke mittig). */
export const kameraX = (i: number, n: number) => Math.max(0, Math.min(weltBreite(n) - SICHT, lueckeX(i) - (SICHT - LUECKE) / 2));

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

/** Karren: x relativ zur linken Lückenkante, `fall` = Absturztiefe (nur bei »bricht«), `schirm` = Fallschirm offen. */
export function karren(art: Ausgang, p: number): { x: number; fall: number; schirm: boolean } {
  const lauf = (q: number) => -7 + q * (LUECKE + 14);
  if (art !== "bricht" || p < 0.5) return { x: lauf(p), fall: 0, schirm: false };
  const q = (p - 0.5) / 0.5;
  return { x: lauf(0.5), fall: q * 26, schirm: q > 0.15 };
}
