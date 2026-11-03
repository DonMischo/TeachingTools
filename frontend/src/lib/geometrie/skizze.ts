/**
 * Skizze: eine kleine Beschreibungssprache für Geometrie-Bilder in Einheiten
 * (y zeigt nach unten wie im SVG). `components/geometrie/Skizze.tsx` skaliert
 * sie ins Bild, beschriftet Strecken außen und malt Winkelbögen und
 * Rechter-Winkel-Zeichen. Gedacht für alle Geometrie-Sims; wer mehr braucht
 * (Kreisbögen, Körper), ergänzt hier einen Teil.
 */
export type Pt = { x: number; y: number };

export type Flaeche = { pts: Pt[]; farbe?: string; deckkraft?: number; ausgespart?: boolean };
export type Strecke = { a: Pt; b: Pt; text?: string; art?: "seite" | "hilfe" | "gesucht" | "unsichtbar" };
export type Winkel = { p: Pt; von: Pt; bis: Pt; text?: string; recht?: boolean };
export type Kreis = { m: Pt; r: number; farbe?: string; deckkraft?: number; gestrichelt?: boolean };
export type Marke = { p: Pt; text: string; groesse?: number };

export type Skizze = {
  flaechen?: Flaeche[];
  strecken?: Strecke[];
  winkel?: Winkel[];
  kreise?: Kreis[];
  /** Eckpunktnamen, Symbole (Emoji) oder freie Beschriftung */
  marken?: Marke[];
  /** Einheitsraster unterlegen (Kästchen zählen) */
  raster?: boolean;
  /** »Skizze nicht maßstäblich« dazuschreiben */
  nichtMassstaeblich?: boolean;
};

export function allePunkte(s: Skizze): Pt[] {
  const pts: Pt[] = [];
  for (const f of s.flaechen ?? []) pts.push(...f.pts);
  for (const st of s.strecken ?? []) pts.push(st.a, st.b);
  for (const k of s.kreise ?? []) pts.push({ x: k.m.x - k.r, y: k.m.y - k.r }, { x: k.m.x + k.r, y: k.m.y + k.r });
  for (const m of s.marken ?? []) pts.push(m.p);
  return pts;
}

export function rahmen(s: Skizze) {
  const pts = allePunkte(s);
  if (!pts.length) return { minX: 0, minY: 0, breite: 1, hoehe: 1 };
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  return { minX, minY, breite: Math.max(...xs) - minX || 1, hoehe: Math.max(...ys) - minY || 1 };
}

export function schwerpunkt(pts: Pt[]): Pt {
  const n = pts.length || 1;
  return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n };
}

/**
 * Wohin die Beschriftung einer Strecke rückt: senkrecht zur Strecke, weg von
 * `innen` (dem Schwerpunkt der Figur). Liefert die Einheitsnormale.
 */
export function aussen(a: Pt, b: Pt, innen: Pt): Pt {
  const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
  let n = { x: -dy / l, y: dx / l };
  const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  if ((m.x - innen.x) * n.x + (m.y - innen.y) * n.y < 0) n = { x: -n.x, y: -n.y };
  return n;
}

/** Winkel bei `p` zwischen den Richtungen nach `von` und `bis`, in Grad (0–180). */
export function winkelBei(p: Pt, von: Pt, bis: Pt): number {
  const a = Math.atan2(von.y - p.y, von.x - p.x), b = Math.atan2(bis.y - p.y, bis.x - p.x);
  let d = Math.abs(a - b) * 180 / Math.PI;
  if (d > 180) d = 360 - d;
  return d;
}

/** Abkürzungen für Generatoren */
export const P = (x: number, y: number): Pt => ({ x, y });
export const rechteck = (x: number, y: number, b: number, h: number): Pt[] => [P(x, y), P(x + b, y), P(x + b, y + h), P(x, y + h)];
/** Die Seiten eines Vielecks als Strecken, mit Texten in Reihenfolge AB, BC, … (leer = ohne). */
export function seiten(pts: Pt[], texte: (string | undefined)[] = []): Strecke[] {
  return pts.map((a, i) => ({ a, b: pts[(i + 1) % pts.length], text: texte[i] || undefined }));
}
/** Eckpunktnamen A, B, C, … an ein Vieleck. */
export function ecken(pts: Pt[], namen = "ABCDEFGH"): Marke[] {
  return pts.map((p, i) => ({ p, text: namen[i] }));
}
