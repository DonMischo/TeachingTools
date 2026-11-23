/**
 * Schrägbild, Zweitafel- und Dreitafelbild.
 *
 * Koordinaten wie in lib/koerper.ts: x nach rechts, y nach oben, z nach vorn
 * (zum Betrachter). Die Risse sind senkrechte Parallelprojektionen:
 *   Aufriss   = Vorderansicht (Blick von vorn, entlang −z)   → (x, y)
 *   Grundriss = Draufsicht   (Blick von oben, entlang −y)    → (x, z), vorn unten
 *   Seitenriss = Ansicht von links (Blick entlang +x)        → (z, y), rechts neben dem Aufriss (vorn liegt rechts)
 * Verdeckte Kanten (bei konvexen Körpern: beide Nachbarflächen abgewandt) werden gestrichelt.
 *
 * Dazu Würfelbauten als Höhenfeld h[x][t] (t = Tiefe, 0 = vorn): Ansichten,
 * Kavalier-Schrägbild und Aufgaben für den Editor.
 */
import { dot, kantenVon, mitte, normale, sub, type Polyeder, type Rund, type V3 } from "./koerper";

export type Riss = "aufriss" | "grundriss" | "seitenriss";
export type P2 = { x: number; y: number };
export type Strich = { a: P2; b: P2; verdeckt: boolean };

/** Blickrichtung (vom Betrachter zum Körper) je Riss */
const BLICK: Record<Riss, V3> = { aufriss: [0, 0, -1], grundriss: [0, -1, 0], seitenriss: [1, 0, 0] };

/** Projektion in die Zeichenebene (x nach rechts, y nach oben) */
export function projiziere(p: V3, r: Riss): P2 {
  if (r === "aufriss") return { x: p[0], y: p[1] };
  if (r === "grundriss") return { x: p[0], y: -p[2] };
  return { x: p[2], y: p[1] };
}

/** Kanten eines konvexen Polyeders im Riss, verdeckte gestrichelt; doppelte (deckungsgleiche) Kanten: sichtbar gewinnt. */
export function rissPoly(poly: Polyeder, r: Riss): Strich[] {
  const c = mitte(poly.ecken);
  const zugewandt = poly.flaechen.map(f => {
    const pts = f.idx.map(i => poly.ecken[i]);
    let n = normale(pts);
    if (dot(n, sub(mitte(pts), c)) < 0) n = [-n[0], -n[1], -n[2]];
    return dot(n, BLICK[r]) < -1e-9;
  });
  const striche: Strich[] = [];
  for (const k of kantenVon(poly)) {
    const a = projiziere(poly.ecken[k.a], r), b = projiziere(poly.ecken[k.b], r);
    if (Math.hypot(a.x - b.x, a.y - b.y) < 1e-9) continue; // Kante zeigt auf den Betrachter: nur ein Punkt
    striche.push({ a, b, verdeckt: !k.flaechen.some(i => zugewandt[i]) });
  }
  return entdopple(striche);
}

const gleichP = (p: P2, q: P2) => Math.abs(p.x - q.x) < 1e-6 && Math.abs(p.y - q.y) < 1e-6;
function entdopple(s: Strich[]): Strich[] {
  const aus: Strich[] = [];
  for (const x of [...s].sort((u, v) => Number(u.verdeckt) - Number(v.verdeckt))) {
    if (aus.some(y => (gleichP(y.a, x.a) && gleichP(y.b, x.b)) || (gleichP(y.a, x.b) && gleichP(y.b, x.a)))) continue;
    aus.push(x);
  }
  return aus;
}

/** Drehkörper im Riss: Umrisslinien und Kreise */
export type RundRiss = { striche: Strich[]; kreise: { m: P2; r: number; verdeckt: boolean }[]; boegen?: { m: P2; r: number; oben: boolean }[] };
export function rissRund(k: Rund, r: Riss): RundRiss {
  if (k.art === "kugel") return { striche: [], kreise: [{ m: { x: 0, y: r === "grundriss" ? 0 : k.r1 }, r: k.r1, verdeckt: false }] };
  if (k.art === "halbkugel") {
    if (r === "grundriss") return { striche: [], kreise: [{ m: { x: 0, y: 0 }, r: k.r1, verdeckt: false }] };
    return { striche: [{ a: { x: -k.r1, y: 0 }, b: { x: k.r1, y: 0 }, verdeckt: false }], kreise: [], boegen: [{ m: { x: 0, y: 0 }, r: k.r1, oben: true }] };
  }
  if (r === "grundriss") {
    const kreise = [{ m: { x: 0, y: 0 }, r: k.r1, verdeckt: false }];
    if (k.r2 > 0 && Math.abs(k.r2 - k.r1) > 1e-9) kreise.push({ m: { x: 0, y: 0 }, r: k.r2, verdeckt: k.r2 > k.r1 });
    return { striche: [], kreise };
  }
  // Aufriss und Seitenriss sehen gleich aus: Trapez (Zylinder: Rechteck, Kegel: Dreieck)
  const s: Strich[] = [
    { a: { x: -k.r1, y: 0 }, b: { x: k.r1, y: 0 }, verdeckt: false },
    { a: { x: k.r1, y: 0 }, b: { x: k.r2, y: k.h }, verdeckt: false },
    { a: { x: -k.r1, y: 0 }, b: { x: -k.r2, y: k.h }, verdeckt: false },
  ];
  if (k.r2 > 0) s.push({ a: { x: -k.r2, y: k.h }, b: { x: k.r2, y: k.h }, verdeckt: false });
  return { striche: s, kreise: [] };
}

// ── Würfelbauten ─────────────────────────────────────────────────────

/** h[x][t]: Höhe des Turms in Spalte x (0 = links), Tiefe t (0 = vorn) */
export type Bau = number[][];
export const leererBau = (breite = 4, tiefe = 3): Bau => Array.from({ length: breite }, () => Array(tiefe).fill(0));
export const wuerfelZahl = (b: Bau) => b.flat().reduce((s, v) => s + v, 0);

/** Ansicht als Raster belegter Felder: [spalte][zeile von unten] */
export type Raster = boolean[][];

export function ansichtVon(b: Bau, r: Riss): Raster {
  const tiefe = b[0]?.length ?? 0;
  const hoehe = Math.max(1, ...b.flat());
  if (r === "aufriss") return b.map(sp => Array.from({ length: hoehe }, (_, y) => sp.some(h => h > y)));
  if (r === "grundriss") return b.map(sp => Array.from({ length: tiefe }, (_, z) => sp[z] > 0)); // Zeile 0 = vorn (unten im Bild)
  // Seitenriss (von links): vorn liegt rechts → Spalte s gehört zur Tiefe t = tiefe − 1 − s
  return Array.from({ length: tiefe }, (_, s) => Array.from({ length: hoehe }, (_, y) => b.some(sp => sp[tiefe - 1 - s] > y)));
}

/** Gleiche Raster? Leere Zeilen oben / Spalten am Rand werden ignoriert. */
export function gleicheAnsicht(a: Raster, b: Raster): boolean {
  const zellen = (r: Raster) => new Set(r.flatMap((sp, x) => sp.map((v, y) => (v ? `${x},${y}` : "")).filter(Boolean)));
  const A = zellen(a), B = zellen(b);
  return A.size === B.size && [...A].every(k => B.has(k));
}

/** Kavalier-Schrägbild: Würfel als drei sichtbare Flächen, hinten zuerst gezeichnet (Maler). Tiefe 45° nach rechts oben, halbe Länge. */
export type Wuerfelflaeche = { pkte: P2[]; art: "vorn" | "oben" | "rechts" };
export function schraegbildBau(b: Bau): Wuerfelflaeche[] {
  const q = 0.5 * Math.SQRT1_2;
  const P = (x: number, y: number, t: number): P2 => ({ x: x + q * t, y: y + q * t });
  const aus: Wuerfelflaeche[] = [];
  const tiefe = b[0]?.length ?? 0;
  for (let t = tiefe - 1; t >= 0; t--) for (let x = 0; x < b.length; x++) for (let y = 0; y < b[x][t]; y++) {
    aus.push({ art: "vorn", pkte: [P(x, y, t), P(x + 1, y, t), P(x + 1, y + 1, t), P(x, y + 1, t)] });
    aus.push({ art: "oben", pkte: [P(x, y + 1, t), P(x + 1, y + 1, t), P(x + 1, y + 1, t + 1), P(x, y + 1, t + 1)] });
    aus.push({ art: "rechts", pkte: [P(x + 1, y, t), P(x + 1, y, t + 1), P(x + 1, y + 1, t + 1), P(x + 1, y + 1, t)] });
  }
  // Reihenfolge: hinten → vorn, unten → oben, links → rechts; innerhalb eines Würfels erst Seiten, dann vorn
  return aus;
}

export type Zufall = () => number;
/** Zufälliger Würfelbau: zusammenhängend genug, Stufe = Größe und Höhe */
export function zufallsBau(r: Zufall = Math.random, stufe: 1 | 2 | 3 = 1): Bau {
  const breite = stufe === 1 ? 3 : 4, tiefe = stufe === 1 ? 2 : 3, maxH = stufe === 3 ? 4 : 3;
  for (;;) {
    const b = leererBau(breite, tiefe).map(sp => sp.map(() => (r() < 0.75 ? 1 + Math.floor(r() * maxH) : 0)));
    if (wuerfelZahl(b) >= breite + 1 && b.every(sp => sp.some(h => h > 0))) return b;
  }
}
