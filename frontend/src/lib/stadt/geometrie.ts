/** kleine Geometrie in Metern für Stadtpläne */
import type { P } from "@/lib/gelaende/gelaende";
export type { P };

export const abstand = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);

/** Abstand Punkt–Strecke */
export function zurStrecke(p: P, a: P, b: P): { d: number; t: number; q: P } {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0;
  const q = { x: a.x + t * dx, y: a.y + t * dy };
  return { d: abstand(p, q), t, q };
}

/** Abstand Punkt–Linienzug (offen) */
export function zurLinie(p: P, l: P[]): { d: number; q: P; seg: number } {
  let best = { d: Infinity, q: l[0] ?? p, seg: 0 };
  for (let i = 0; i + 1 < l.length; i++) {
    const r = zurStrecke(p, l[i], l[i + 1]);
    if (r.d < best.d) best = { d: r.d, q: r.q, seg: i };
  }
  if (l.length === 1) best = { d: abstand(p, l[0]), q: l[0], seg: 0 };
  return best;
}

/** geschlossener Ring als Linienzug */
export const geschlossen = (poly: P[]) => (poly.length ? [...poly, poly[0]] : poly);

export function inPoly(p: P, poly: P[]): boolean {
  let drin = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) drin = !drin;
  }
  return drin;
}

export function flaeche(poly: P[]): number {
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += (poly[j].x + poly[i].x) * (poly[j].y - poly[i].y);
  return Math.abs(s) / 2;
}

export function schwerpunkt(ps: P[]): P {
  let x = 0, y = 0;
  for (const p of ps) { x += p.x; y += p.y; }
  return { x: x / (ps.length || 1), y: y / (ps.length || 1) };
}

export function laenge(l: P[]): number {
  let s = 0;
  for (let i = 0; i + 1 < l.length; i++) s += abstand(l[i], l[i + 1]);
  return s;
}

/** Punkt in Weg-Länge s entlang des Linienzugs, mit Richtung */
export function punktBei(l: P[], s: number): { p: P; dx: number; dy: number } {
  for (let i = 0; i + 1 < l.length; i++) {
    const d = abstand(l[i], l[i + 1]);
    if (s <= d || i + 2 === l.length) {
      const t = d ? Math.min(1, s / d) : 0;
      const dx = (l[i + 1].x - l[i].x) / (d || 1), dy = (l[i + 1].y - l[i].y) / (d || 1);
      return { p: { x: l[i].x + (l[i + 1].x - l[i].x) * t, y: l[i].y + (l[i + 1].y - l[i].y) * t }, dx, dy };
    }
    s -= d;
  }
  return { p: l[0], dx: 1, dy: 0 };
}

/** Rechteck um die Mitte, gedreht (Bogenmaß) */
export function rechteck(c: P, b: number, h: number, dreh = 0): P[] {
  const cs = Math.cos(dreh), sn = Math.sin(dreh);
  return [[-b / 2, -h / 2], [b / 2, -h / 2], [b / 2, h / 2], [-b / 2, h / 2]].map(([x, y]) => ({ x: c.x + x * cs - y * sn, y: c.y + x * sn + y * cs }));
}

/** Schnittpunkt zweier Strecken oder null */
export function schnitt(a: P, b: P, c: P, d: P): P | null {
  const r = { x: b.x - a.x, y: b.y - a.y }, s = { x: d.x - c.x, y: d.y - c.y };
  const den = r.x * s.y - r.y * s.x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / den;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a.x + t * r.x, y: a.y + t * r.y } : null;
}

/** alle Schnittpunkte zweier Linienzüge */
export function schnitte(l1: P[], l2: P[]): P[] {
  const aus: P[] = [];
  for (let i = 0; i + 1 < l1.length; i++) for (let j = 0; j + 1 < l2.length; j++) {
    const s = schnitt(l1[i], l1[i + 1], l2[j], l2[j + 1]);
    if (s) aus.push(s);
  }
  return aus;
}

/** Richtung einer Strecke als Winkel 0..180° (ungerichtet) */
export function richtung(a: P, b: P): number {
  let w = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  if (w < 0) w += 180;
  if (w >= 180) w -= 180;
  return w;
}

/** kleinster Unterschied zweier ungerichteter Richtungen in Grad (0..90) */
export function winkelAbstand(a: number, b: number): number {
  const d = Math.abs(a - b) % 180;
  return Math.min(d, 180 - d);
}

/** Polygon um den Faktor um seine Mitte vergrößern */
export function skaliere(poly: P[], f: number, c: P = schwerpunkt(poly)): P[] {
  return poly.map(p => ({ x: c.x + (p.x - c.x) * f, y: c.y + (p.y - c.y) * f }));
}

/** Linienzug ausdünnen: Punkte näher als d am Vorgänger fallen weg */
export function ausduennen(l: P[], d: number): P[] {
  if (l.length < 3) return l;
  const aus = [l[0]];
  for (let i = 1; i < l.length - 1; i++) if (abstand(aus[aus.length - 1], l[i]) >= d) aus.push(l[i]);
  aus.push(l[l.length - 1]);
  return aus;
}

/** Linienzug auf ein Rechteck [0, B]² kürzen (nur am Anfang und Ende) */
export function inKarte(l: P[], B: number, rand = 0): P[] {
  const drin = (p: P) => p.x >= -rand && p.y >= -rand && p.x <= B + rand && p.y <= B + rand;
  let a = 0, b = l.length - 1;
  while (a < b && !drin(l[a + 1])) a++;
  while (b > a && !drin(l[b - 1])) b--;
  return l.slice(a, b + 1);
}

/** Linienzug innerhalb eines Polygons halten: zerschneidet ihn an den Rändern */
export function stueckeIn(l: P[], poly: P[]): P[][] {
  const aus: P[][] = [];
  let cur: P[] = [];
  for (const p of l) {
    if (inPoly(p, poly)) cur.push(p);
    else if (cur.length) { if (cur.length > 1) aus.push(cur); cur = []; }
  }
  if (cur.length > 1) aus.push(cur);
  return aus;
}
