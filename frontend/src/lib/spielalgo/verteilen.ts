/**
 * Dinge verteilen: Bäume, Steine, Dörfer. Reiner Zufall klumpt und lässt
 * Löcher. Poisson-Disc (Verfahren von Bridson) hält einen Mindestabstand ein
 * und wirkt trotzdem natürlich. Voronoi teilt die Fläche: Jeder Ort gehört zum
 * nächsten Punkt. Lloyd schiebt jeden Punkt in die Mitte seiner Zelle.
 */

export interface Pt { x: number; y: number }

export function zufallsPunkte(n: number, b: number, h: number, rng: () => number): Pt[] {
  return Array.from({ length: n }, () => ({ x: rng() * b, y: rng() * h }));
}

export interface Poisson {
  b: number;
  h: number;
  r: number;
  /** Versuche je aktivem Punkt, bevor er aufgibt (Bridson: 30) */
  k: number;
  punkte: Pt[];
  /** Punkte, um die herum noch gesucht wird */
  aktiv: number[];
  /** zuletzt untersuchter Punkt und seine Kandidaten */
  mitte: number;
  kandidaten: { p: Pt; ok: boolean }[];
  gitter: Int32Array;
  zelle: number;
  gb: number;
  gh: number;
  ring: number;
  rOrt?: (x: number, y: number) => number;
  /** wie viele Gitterzellen man in jede Richtung prüfen muss */
  spann: number;
}

export interface PoissonExtras {
  /** äußerer Suchring als Vielfaches von r (Bridson: 2) */
  ring?: number;
  /** Abstand je Ort statt fest (z. B. aus Rauschen: Lichtungen und Dickicht); Werte zwischen rMin und r */
  rOrt?: (x: number, y: number) => number;
  rMin?: number;
}

export function neuerPoisson(b: number, h: number, r: number, k = 30, extras: PoissonExtras = {}): Poisson {
  const rMin = extras.rOrt ? Math.min(r, extras.rMin ?? r) : r;
  const zelle = rMin / Math.SQRT2; // so passt höchstens ein Punkt in eine Gitterzelle
  const gb = Math.ceil(b / zelle), gh = Math.ceil(h / zelle);
  return {
    b, h, r, k, punkte: [], aktiv: [], mitte: -1, kandidaten: [], gitter: new Int32Array(gb * gh).fill(-1), zelle, gb, gh,
    ring: extras.ring ?? 2, rOrt: extras.rOrt, spann: Math.ceil(r / zelle),
  };
}

/** Mindestabstand an einem Ort. */
export const abstandBei = (s: Poisson, p: Pt) => (s.rOrt ? s.rOrt(p.x, p.y) : s.r);

function frei(s: Poisson, p: Pt): boolean {
  if (p.x < 0 || p.y < 0 || p.x >= s.b || p.y >= s.h) return false;
  const gx = Math.floor(p.x / s.zelle), gy = Math.floor(p.y / s.zelle), sp = s.spann + 1;
  const rp = abstandBei(s, p);
  for (let y = Math.max(0, gy - sp); y <= Math.min(s.gh - 1, gy + sp); y++) {
    for (let x = Math.max(0, gx - sp); x <= Math.min(s.gb - 1, gx + sp); x++) {
      const i = s.gitter[y * s.gb + x];
      if (i >= 0) {
        const q = s.punkte[i];
        // der größere der beiden Abstände gilt
        const r = Math.max(rp, abstandBei(s, q));
        if ((q.x - p.x) ** 2 + (q.y - p.y) ** 2 < r * r) return false;
      }
    }
  }
  return true;
}

function setze(s: Poisson, p: Pt) {
  const i = s.punkte.push(p) - 1;
  s.gitter[Math.floor(p.y / s.zelle) * s.gb + Math.floor(p.x / s.zelle)] = i;
  s.aktiv.push(i);
}

/** Bridson: ein Schritt = ein aktiver Punkt probiert bis zu k Kandidaten im Ring r..2r. */
export function* poisson(s: Poisson, rng: () => number): Generator<string> {
  setze(s, { x: rng() * s.b, y: rng() * s.h });
  s.mitte = 0;
  yield "Erster Punkt irgendwo. Er ist »aktiv«: Um ihn herum wird nach Platz gesucht.";
  while (s.aktiv.length) {
    const ai = Math.floor(rng() * s.aktiv.length);
    const mi = s.aktiv[ai];
    const m = s.punkte[mi];
    s.mitte = mi;
    s.kandidaten = [];
    let gefunden = false;
    for (let t = 0; t < s.k; t++) {
      const rm = abstandBei(s, m);
      const w = rng() * Math.PI * 2, d = rm * (1 + rng() * (s.ring - 1));
      const p = { x: m.x + Math.cos(w) * d, y: m.y + Math.sin(w) * d };
      const ok = frei(s, p);
      s.kandidaten.push({ p, ok });
      if (ok) { setze(s, p); gefunden = true; break; }
    }
    if (gefunden) {
      yield `Neuer Punkt nach ${s.kandidaten.length} ${s.kandidaten.length === 1 ? "Versuch" : "Versuchen"} im Ring um einen aktiven Punkt (${s.punkte.length} Punkte).`;
    } else {
      s.aktiv.splice(ai, 1);
      yield `${s.k} Versuche ohne Platz: Dieser Punkt ist voll umzingelt und wird inaktiv (noch ${s.aktiv.length} aktiv).`;
    }
  }
  s.mitte = -1;
  s.kandidaten = [];
  return `Fertig: Kein Punkt ist mehr aktiv. ${s.punkte.length} Punkte, keiner näher als ${s.r} am nächsten.`;
}

/** Kleinster Abstand zweier Punkte (für den Vergleich Zufall ↔ Poisson). */
export function minAbstand(p: Pt[]): number {
  let m = Infinity;
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) {
    const d = (p[i].x - p[j].x) ** 2 + (p[i].y - p[j].y) ** 2;
    if (d < m) m = d;
  }
  return Math.sqrt(m);
}

export type Metrik = "euklid" | "manhattan" | "tschebyschow";
const ABSTAND: Record<Metrik, (dx: number, dy: number) => number> = {
  euklid: (dx, dy) => dx * dx + dy * dy,
  manhattan: (dx, dy) => Math.abs(dx) + Math.abs(dy),
  tschebyschow: (dx, dy) => Math.max(Math.abs(dx), Math.abs(dy)),
};

/** Voronoi als Raster: je Pixel der Index des nächsten Punkts (Abstand nach `metrik`). */
export function voronoi(p: Pt[], b: number, h: number, aufl = 1, metrik: Metrik = "euklid"): Int32Array {
  const abst = ABSTAND[metrik];
  const bb = Math.ceil(b / aufl), hh = Math.ceil(h / aufl);
  const z = new Int32Array(bb * hh).fill(-1);
  for (let y = 0; y < hh; y++) for (let x = 0; x < bb; x++) {
    const px = (x + 0.5) * aufl, py = (y + 0.5) * aufl;
    let best = -1, bd = Infinity;
    for (let i = 0; i < p.length; i++) {
      const d = abst(p[i].x - px, p[i].y - py);
      if (d < bd) { bd = d; best = i; }
    }
    z[y * bb + x] = best;
  }
  return z;
}

/** Ein Lloyd-Schritt: jeder Punkt in den Schwerpunkt seiner Voronoi-Zelle. */
export function lloyd(p: Pt[], b: number, h: number, aufl = 2): Pt[] {
  const bb = Math.ceil(b / aufl);
  const v = voronoi(p, b, h, aufl);
  const sx = new Float64Array(p.length), sy = new Float64Array(p.length), n = new Float64Array(p.length);
  for (let i = 0; i < v.length; i++) {
    const k = v[i];
    sx[k] += ((i % bb) + 0.5) * aufl;
    sy[k] += (Math.floor(i / bb) + 0.5) * aufl;
    n[k]++;
  }
  return p.map((q, i) => (n[i] ? { x: sx[i] / n[i], y: sy[i] / n[i] } : q));
}
