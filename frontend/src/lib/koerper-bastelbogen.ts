/**
 * Bastelbogen: das flache Netz eines Körpers in Zentimetern, mit
 * Klebelaschen, Schneide- und Falzlinien. Der Druck (PDF) steht in
 * components/koerper/bastelbogenPdf.ts.
 *
 * Polyeder: Jede Kante, die im Netz aufgeschnitten ist, kommt am Rand
 * zweimal vor — genau eine der beiden bekommt eine Lasche, und zwar die, die
 * weniger über andere Teile ragt. Zylinder und Kegel: eine Lasche an der
 * Naht des Mantels und ein Zahnkranz um jeden Kreis.
 */
import { KOERPER, dot, type KoerperKey, type Masse, type V3 } from "@/lib/koerper";
import { faltePolyeder, rolleRund } from "@/lib/koerper-netz";
import type { Pt } from "@/lib/geometrie/skizze";

export type Linie2 = [Pt, Pt];
export type Bastelbogen = {
  teile: { teil: string; pts: Pt[] }[];
  laschen: Pt[][];
  /** durchgezogen: schneiden */
  schnitte: Linie2[];
  /** gestrichelt: falten (Kanten zwischen zwei Flächen und Laschenansätze) */
  falze: Linie2[];
};

const LASCHE = 0.8;
const EPS = 1e-6;
const nah = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y) < 1e-6;
const schwer = (pts: Pt[]): Pt => ({ x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length });

/** Punkt im Vieleck (gerade-ungerade-Regel)? */
export function innen(p: Pt, poly: Pt[]): boolean {
  let drin = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) drin = !drin;
  }
  return drin;
}

/** Trapezförmige Lasche an der Strecke A→B, weg vom Punkt `weg`. */
export function lasche(A: Pt, B: Pt, weg: Pt, breite = LASCHE): Pt[] {
  const dx = B.x - A.x, dy = B.y - A.y, l = Math.hypot(dx, dy) || 1;
  const u = { x: dx / l, y: dy / l };
  let n = { x: -u.y, y: u.x };
  const m = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
  if ((m.x - weg.x) * n.x + (m.y - weg.y) * n.y < 0) n = { x: -n.x, y: -n.y };
  const w = Math.min(breite, l * 0.35), schraeg = w * 0.8;
  return [A, { x: A.x + n.x * w + u.x * schraeg, y: A.y + n.y * w + u.y * schraeg }, { x: B.x + n.x * w - u.x * schraeg, y: B.y + n.y * w - u.y * schraeg }, B];
}

/** Wie stark eine Lasche mit dem schon Gelegten kollidiert: Prüfpunkte in fremden Flächen oder Laschen. */
function stoert(l: Pt[], belegt: Pt[][]): number {
  const proben = [schwer(l), { x: (l[1].x + l[2].x) / 2, y: (l[1].y + l[2].y) / 2 }, l[1], l[2]]
    .map((p, i) => (i < 2 ? p : { x: (p.x * 3 + schwer(l).x) / 4, y: (p.y * 3 + schwer(l).y) / 4 }));
  return proben.reduce((s, p) => s + belegt.filter(f => innen(p, f)).length, 0);
}

export function bastelbogen(key: KoerperKey, m: Masse): Bastelbogen | null {
  const k = KOERPER[key];
  if (k.poly) return polyBogen(key, m);
  const r = k.rund!(m);
  if (r.art !== "mantel") return null;
  return rundBogen(key, m);
}

function polyBogen(key: KoerperKey, m: Masse): Bastelbogen {
  const p = KOERPER[key].poly!(m);
  const flach = faltePolyeder(p, 0);
  const teile = flach.map(f => ({ teil: f.teil, pts: f.pts.map(([x, , z]) => ({ x, y: z })) }));
  type Vork = { fi: number; A: Pt; B: Pt };
  const kanten = new Map<string, Vork[]>();
  p.flaechen.forEach((f, fi) => f.idx.forEach((a, i) => {
    const b = f.idx[(i + 1) % f.idx.length];
    const s = a < b ? `${a}-${b}` : `${b}-${a}`;
    const liste = kanten.get(s) ?? [];
    liste.push({ fi, A: teile[fi].pts[i], B: teile[fi].pts[(i + 1) % f.idx.length] });
    kanten.set(s, liste);
  }));
  const bogen: Bastelbogen = { teile, laschen: [], schnitte: [], falze: [] };
  const belegt = teile.map(t => t.pts);
  for (const [v, w] of kanten.values()) {
    if ((nah(v.A, w.B) && nah(v.B, w.A)) || (nah(v.A, w.A) && nah(v.B, w.B))) {
      bogen.falze.push([v.A, v.B]); // Scharnier: liegt im Netz zwischen zwei Flächen
      continue;
    }
    const kandidaten = [v, w].map(o => ({ o, l: lasche(o.A, o.B, schwer(teile[o.fi].pts)) }));
    const [mit, ohne] = stoert(kandidaten[0].l, belegt) <= stoert(kandidaten[1].l, belegt) ? kandidaten : [kandidaten[1], kandidaten[0]];
    bogen.laschen.push(mit.l);
    belegt.push(mit.l);
    bogen.falze.push([mit.o.A, mit.o.B]);
    bogen.schnitte.push([mit.l[0], mit.l[1]], [mit.l[1], mit.l[2]], [mit.l[2], mit.l[3]], [ohne.o.A, ohne.o.B]);
  }
  return bogen;
}

function rundBogen(key: KoerperKey, m: Masse): Bastelbogen {
  const n = rolleRund(KOERPER[key].rund!(m), 0);
  const { o, x, y } = n.ebene;
  const flach = (p: V3): Pt => {
    const v: V3 = [p[0] - o[0], p[1] - o[1], p[2] - o[2]];
    return { x: dot(v, x), y: dot(v, y) };
  };
  const [u, ob] = n.mantel.map(z => z.map(flach));
  const mantel = [...u, ...[...ob].reverse()];
  const kreise = n.kreise.map(c => ({ teil: c.teil, pts: c.pts.map(flach) }));
  const bogen: Bastelbogen = { teile: [{ teil: "M", pts: mantel }, ...kreise], laschen: [], schnitte: [], falze: [] };
  const belegt: Pt[][] = bogen.teile.map(t => t.pts);
  const linie = (pts: Pt[]) => pts.slice(1).map((p, i): Linie2 => [pts[i], p]);

  // Naht des Mantels: eine der beiden geraden Kanten bekommt die Lasche.
  const mitte = schwer(mantel);
  const naehte: Linie2[] = [[u[0], ob[0]], [u[u.length - 1], ob[ob.length - 1]]];
  const kand = naehte.map(([A, B]) => lasche(A, B, mitte));
  const wahl = stoert(kand[0], belegt) <= stoert(kand[1], belegt) ? 0 : 1;
  const l = kand[wahl];
  bogen.laschen.push(l);
  belegt.push(l);
  bogen.falze.push(naehte[wahl]);
  bogen.schnitte.push([l[0], l[1]], [l[1], l[2]], [l[2], l[3]], naehte[1 - wahl], ...linie(u));
  if (!nah(ob[0], ob[ob.length - 1]) || ob.length < 2) bogen.schnitte.push(...linie(ob));

  // Zahnkranz um die Kreise; Zähne, die in den Mantel ragen würden, fallen weg.
  for (const c of kreise) {
    const M = schwer(c.pts), rr = Math.hypot(c.pts[0].x - M.x, c.pts[0].y - M.y);
    const g = Math.max(2, Math.round(c.pts.length / (2 * Math.PI * rr / 1.1)));
    for (let i = 0; i < c.pts.length; i += g) {
      const A = c.pts[i], B = c.pts[(i + g) % c.pts.length];
      const zahn = lasche(A, B, M, 0.6);
      const zahnMitte = { x: (zahn[1].x + zahn[2].x) / 2, y: (zahn[1].y + zahn[2].y) / 2 };
      const bogenStueck = c.pts.slice(i, i + g + 1).concat(i + g >= c.pts.length ? [c.pts[0]] : []);
      if (innen(zahnMitte, mantel) || innen(schwer(zahn), mantel) || stoert(zahn, belegt.slice(bogen.teile.length)) > 0) {
        bogen.schnitte.push(...linie(bogenStueck));
        continue;
      }
      bogen.laschen.push(zahn);
      belegt.push(zahn);
      bogen.falze.push([A, B]);
      bogen.schnitte.push([zahn[0], zahn[1]], [zahn[1], zahn[2]], [zahn[2], zahn[3]]);
    }
  }
  return bogen;
}

/** Umrandung aller Punkte (cm). */
export function bogenRahmen(b: Bastelbogen) {
  const pts = [...b.teile.flatMap(t => t.pts), ...b.laschen.flat()];
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), breite: Math.max(...xs) - Math.min(...xs) + EPS, hoehe: Math.max(...ys) - Math.min(...ys) + EPS };
}
