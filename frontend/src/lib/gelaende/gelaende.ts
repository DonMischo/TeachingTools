/**
 * Gelände als Höhenfeld in Metern: Landschaftsarten, Zufallswürfel, Fluss
 * mit Furt und Aue, Küste, Burgberg. Geteilt von »stadt« und »erosion«.
 *
 * Koordinaten in Metern, Ursprung oben links, x nach Osten, y nach Süden
 * (Norden ist oben). Zelle (i, j) hat die Mitte ((i + .5)·zelle, (j + .5)·zelle).
 */
import { fbm, grat, perlin, zufallsquelle } from "./rauschen";

export type P = { x: number; y: number };

export const LANDSCHAFTEN = [
  { id: "flusstal", icon: "🏞️", label: "Flusstal", text: "Breites Tal mit Fluss, Aue, Furt und einem Hügel am Ufer." },
  { id: "kueste", icon: "🌊", label: "Küste", text: "Meer an einer Seite, ein Fluss mündet hinein." },
  { id: "huegel", icon: "⛰️", label: "Hügelland", text: "Bewegtes Gelände, nur ein Bach." },
  { id: "ebene", icon: "🌾", label: "Ebene", text: "Fast flach, ein Fluss mäandert hindurch — wie die Prärie." },
  { id: "gebirge", icon: "🏔️", label: "Gebirgstal", text: "Steile Hänge, wenig Platz im engen Tal." },
] as const;
export type Landschaft = (typeof LANDSCHAFTEN)[number]["id"];

export interface GelaendeWahl {
  art: Landschaft;
  seed: number;
  /** Fluss an/aus */
  fluss: boolean;
  /** Stärke der Hügel, 0..2 (1 = normal) */
  relief: number;
}

export interface Gelaende {
  wahl: GelaendeWahl;
  /** Zellen je Kante */
  n: number;
  /** Meter je Zelle */
  zelle: number;
  /** Kantenlänge der Karte in Metern */
  breite: number;
  /** Höhe über NN in Metern */
  hoehe: Float32Array;
  /** 0 Land, 1 Fluss, 2 Meer, 3 See */
  wasser: Uint8Array;
  /** 1 = Aue (überschwemmt bei Hochwasser) */
  aue: Uint8Array;
  /** Abstand zum nächsten Wasser in Metern */
  abstandWasser: Float32Array;
  /** Mittellinie des Flusses (Meter), in Fließrichtung */
  flussLinie: P[];
  /** flache, schmale Stelle im Fluss */
  furt: P | null;
  /** Hügel nahe am Fluss (Burgberg) */
  berg: P | null;
  /** Meeresspiegel in Metern oder null ohne Meer */
  meer: number | null;
}

export const STANDARD_N = 512;
export const STANDARD_ZELLE = 6;

/** Würfelt eine Landschaft aus — für den Knopf »🎲 Zufall« */
export function wuerfle(seed = Math.floor(Math.random() * 1e9)): GelaendeWahl {
  const z = zufallsquelle(seed);
  const art = LANDSCHAFTEN[Math.floor(z() * LANDSCHAFTEN.length)].id;
  return { art, seed, fluss: z() > 0.12, relief: Math.round((0.6 + z() * 0.9) * 10) / 10 };
}

const glatt = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Abstand Punkt–Strecke und Lage t ∈ [0,1] auf der Strecke */
function zurStrecke(px: number, py: number, a: P, b: P): [number, number] {
  const dx = b.x - a.x, dy = b.y - a.y;
  const l2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l2));
  const x = a.x + t * dx - px, y = a.y + t * dy - py;
  return [Math.hypot(x, y), t];
}

interface Talform { amp: number; basis: number; talBreite: number; flussBreite: number; meander: number; }

const FORM: Record<Landschaft, Talform> = {
  flusstal: { amp: 55, basis: 150, talBreite: 520, flussBreite: 34, meander: 260 },
  kueste: { amp: 35, basis: 40, talBreite: 380, flussBreite: 40, meander: 200 },
  huegel: { amp: 90, basis: 220, talBreite: 220, flussBreite: 10, meander: 180 },
  ebene: { amp: 6, basis: 210, talBreite: 300, flussBreite: 30, meander: 380 },
  gebirge: { amp: 420, basis: 700, talBreite: 320, flussBreite: 22, meander: 140 },
};

export function erzeuge(wahl: GelaendeWahl, n = STANDARD_N, zelle = STANDARD_ZELLE): Gelaende {
  const z = zufallsquelle(wahl.seed);
  const r1 = perlin(wahl.seed), r2 = perlin(wahl.seed + 101), r3 = perlin(wahl.seed + 202);
  const breite = n * zelle;
  const form = FORM[wahl.art];
  const amp = form.amp * wahl.relief;
  const hoehe = new Float32Array(n * n);
  const wasser = new Uint8Array(n * n);
  const aue = new Uint8Array(n * n);
  const mitte = breite / 2;

  // Grundrelief
  const skala = 1 / 900;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = (i + 0.5) * zelle, y = (j + 0.5) * zelle;
    const h = wahl.art === "gebirge"
      ? grat(r1, x * skala, y * skala, 6) * 1.6 - 0.5
      : fbm(r1, x * skala, y * skala, 6);
    hoehe[j * n + i] = form.basis + amp * h;
  }

  // Küste: Meer an einer zufälligen Kante, Land steigt landeinwärts
  let meer: number | null = null;
  let meerRichtung: P | null = null;
  if (wahl.art === "kueste") {
    meer = 0;
    const w = Math.floor(z() * 4) * Math.PI / 2;
    meerRichtung = { x: Math.round(Math.cos(w)), y: Math.round(Math.sin(w)) };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * zelle - mitte, y = (j + 0.5) * zelle - mitte;
      // Weg landeinwärts: 0 an der Küstenlinie
      const s = -(x * meerRichtung.x + y * meerRichtung.y) + breite * 0.28 + 260 * fbm(r3, (x + y) / 1400, (x - y) / 1400, 3);
      const k = j * n + i;
      hoehe[k] = s < 0 ? -6 + s * 0.02 : Math.min(hoehe[k], 4 + s * 0.08 + Math.max(0, hoehe[k] - 40) * glatt(0, 600, s));
    }
  }

  // Fluss: mäandernde Mittellinie quer über die Karte
  const flussLinie: P[] = [];
  let furt: P | null = null, berg: P | null = null;
  if (wahl.fluss) {
    const winkel = meerRichtung ? Math.atan2(meerRichtung.y, meerRichtung.x) : z() * Math.PI * 2;
    const u = { x: Math.cos(winkel), y: Math.sin(winkel) }, v = { x: -u.y, y: u.x };
    const versatz = (z() - 0.5) * breite * 0.25;
    const L = breite * 1.6;
    for (let s = -L / 2; s <= L / 2; s += 16) {
      const m = form.meander * (1.8 * fbm(r2, s / 1500, 3.7, 3) + 0.5 * Math.sin(s / 700 + wahl.seed)) + versatz;
      flussLinie.push({ x: mitte + u.x * s + v.x * m, y: mitte + u.y * s + v.y * m });
    }
    // Wasserstand fällt in Fließrichtung
    const tiefstes = meer !== null ? 0 : form.basis - amp * 0.6;
    const pegel = (t: number) => tiefstes + (meer !== null ? 18 : 14) * (1 - t);
    const tFurt = 0.42 + z() * 0.16;
    const segs = flussLinie.length - 1;
    // Abstand zur Mittellinie: erst auf einem groben Gitter (24 m), dann fein
    // nur in Flussnähe nachrechnen — sonst kostet das bei 512² über eine Sekunde
    const rand = form.talBreite + 40;
    const G = 24, m = Math.ceil(breite / G) + 1;
    const grobD = new Float32Array(m * m).fill(Infinity), grobS = new Int32Array(m * m).fill(-1);
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
      const x = i * G, y = j * G;
      let best = Infinity, sb = -1;
      for (let q = 0; q < segs; q++) {
        const a = flussLinie[q], b = flussLinie[q + 1];
        if ((Math.abs(a.x - x) > rand && Math.abs(b.x - x) > rand) || (Math.abs(a.y - y) > rand && Math.abs(b.y - y) > rand)) continue;
        const [d] = zurStrecke(x, y, a, b);
        if (d < best) { best = d; sb = q; }
      }
      grobD[j * m + i] = best; grobS[j * m + i] = sb;
    }
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const x = (i + 0.5) * zelle, y = (j + 0.5) * zelle;
      const gi = Math.min(m - 1, Math.round(x / G)), gj = Math.min(m - 1, Math.round(y / G));
      const s0 = grobS[gj * m + gi];
      if (s0 < 0 || grobD[gj * m + gi] > rand + G) continue;
      let best = Infinity, tb = 0;
      for (let q = Math.max(0, s0 - 6); q <= Math.min(segs - 1, s0 + 6); q++) {
        const [d, t] = zurStrecke(x, y, flussLinie[q], flussLinie[q + 1]);
        if (d < best) { best = d; tb = (q + t) / segs; }
      }
      if (best === Infinity) continue;
      const k = j * n + i;
      const p = pegel(tb);
      const enge = 1 - 0.45 * Math.exp(-((tb - tFurt) ** 2) / 0.0004);
      const fb = form.flussBreite * (0.85 + 0.3 * fbm(r3, tb * 9, 1.3, 2)) * enge;
      const auenBreite = wahl.art === "gebirge" ? fb * 2 : form.talBreite * 0.45;
      // Talform: flacher Boden, dann Hänge hinauf zum Grundrelief
      const boden = p + 1.5 + 2.5 * glatt(fb / 2, auenBreite, best);
      const w = glatt(auenBreite * 0.7, form.talBreite, best);
      if (meer === null || hoehe[k] > 0) hoehe[k] = Math.min(hoehe[k], boden + (hoehe[k] - boden) * w);
      if (best < fb / 2) {
        const tiefe = Math.exp(-((tb - tFurt) ** 2) / 0.0004) > 0.5 ? 0.4 : 2.5;
        hoehe[k] = p - tiefe * (1 - (best / (fb / 2)) ** 2);
        wasser[k] = 1;
      } else if (best < auenBreite && hoehe[k] < p + 3.2) aue[k] = 1;
    }
    const iF = Math.round(tFurt * segs);
    furt = { ...flussLinie[iF] };
    // Burgberg: Kuppe neben dem Fluss, ein Stück flussabwärts der Furt
    if (wahl.art !== "kueste" || z() > 0.3) {
      const iB = Math.min(segs, iF + Math.round(segs * 0.05));
      const a = flussLinie[iB], b = flussLinie[Math.min(segs, iB + 1)];
      const nx = -(b.y - a.y), ny = b.x - a.x, nl = Math.hypot(nx, ny) || 1;
      const seite = z() > 0.5 ? 1 : -1;
      const ab = form.talBreite * 0.55 + 60;
      berg = { x: a.x + seite * nx / nl * ab, y: a.y + seite * ny / nl * ab };
      const hb = Math.max(25, amp * 0.6), rb = 130;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const k = j * n + i;
        if (wasser[k]) continue;
        const d2 = ((i + 0.5) * zelle - berg.x) ** 2 + ((j + 0.5) * zelle - berg.y) ** 2;
        if (d2 > (rb * 3) ** 2) continue;
        const plus = hb * Math.exp(-d2 / (2 * rb * rb));
        hoehe[k] += plus;
        if (plus > 2) aue[k] = 0;
      }
      if (berg.x < 0 || berg.y < 0 || berg.x > breite || berg.y > breite) berg = null;
    }
  }

  if (meer !== null) for (let k = 0; k < n * n; k++) if (hoehe[k] < meer) { wasser[k] = 2; aue[k] = 0; }

  const g: Gelaende = { wahl, n, zelle, breite, hoehe, wasser, aue, abstandWasser: new Float32Array(0), flussLinie, furt, berg, meer };
  g.abstandWasser = abstaendeZumWasser(g);
  return g;
}

/** Chamfer-Abstandstransformation (3-4) zum nächsten Wasser, in Metern */
export function abstaendeZumWasser(g: Pick<Gelaende, "n" | "zelle" | "wasser">): Float32Array {
  const { n, zelle, wasser } = g;
  const d = new Float32Array(n * n);
  const INF = 1e9;
  for (let k = 0; k < n * n; k++) d[k] = wasser[k] ? 0 : INF;
  const a = 1, b = Math.SQRT2;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    let v = d[k];
    if (i > 0) v = Math.min(v, d[k - 1] + a);
    if (j > 0) {
      v = Math.min(v, d[k - n] + a);
      if (i > 0) v = Math.min(v, d[k - n - 1] + b);
      if (i < n - 1) v = Math.min(v, d[k - n + 1] + b);
    }
    d[k] = v;
  }
  for (let j = n - 1; j >= 0; j--) for (let i = n - 1; i >= 0; i--) {
    const k = j * n + i;
    let v = d[k];
    if (i < n - 1) v = Math.min(v, d[k + 1] + a);
    if (j < n - 1) {
      v = Math.min(v, d[k + n] + a);
      if (i < n - 1) v = Math.min(v, d[k + n + 1] + b);
      if (i > 0) v = Math.min(v, d[k + n - 1] + b);
    }
    d[k] = v;
  }
  for (let k = 0; k < n * n; k++) d[k] = d[k] >= INF ? 99999 : d[k] * zelle;
  return d;
}

/** Zellindex zu einem Punkt in Metern (am Rand festgeklemmt) */
export function zellIndex(g: Pick<Gelaende, "n" | "zelle">, x: number, y: number): number {
  const i = Math.max(0, Math.min(g.n - 1, Math.floor(x / g.zelle)));
  const j = Math.max(0, Math.min(g.n - 1, Math.floor(y / g.zelle)));
  return j * g.n + i;
}

/** Höhe an beliebiger Stelle, bilinear */
export function hoeheBei(g: Pick<Gelaende, "n" | "zelle" | "hoehe">, x: number, y: number): number {
  const { n, zelle, hoehe } = g;
  const fx = Math.max(0, Math.min(n - 1.001, x / zelle - 0.5)), fy = Math.max(0, Math.min(n - 1.001, y / zelle - 0.5));
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j;
  const k = j * n + i;
  return (hoehe[k] * (1 - u) + hoehe[k + 1] * u) * (1 - v) + (hoehe[k + n] * (1 - u) + hoehe[k + n + 1] * u) * v;
}

/** Neigung in Prozent (Höhenunterschied je 100 m) */
export function neigungBei(g: Pick<Gelaende, "n" | "zelle" | "hoehe">, x: number, y: number): number {
  const s = g.zelle;
  const dx = (hoeheBei(g, x + s, y) - hoeheBei(g, x - s, y)) / (2 * s);
  const dy = (hoeheBei(g, x, y + s) - hoeheBei(g, x, y - s)) / (2 * s);
  return Math.hypot(dx, dy) * 100;
}

export function istWasser(g: Gelaende, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= g.breite || y >= g.breite) return false;
  return g.wasser[zellIndex(g, x, y)] > 0;
}

export function inAue(g: Gelaende, x: number, y: number): boolean {
  return g.aue[zellIndex(g, x, y)] === 1;
}

export function wasserAbstand(g: Gelaende, x: number, y: number): number {
  return g.abstandWasser[zellIndex(g, x, y)];
}
