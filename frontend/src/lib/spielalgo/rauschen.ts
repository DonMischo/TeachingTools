/**
 * Gelände aus Rauschen: Gradientenrauschen (wie Perlin), mehrere Oktaven
 * übereinander (fBm), Domain Warping (die Koordinaten selbst werden
 * verrauscht) und eine Inselmaske. Alles rein und deterministisch je Seed.
 */

export type Rauschen = (x: number, y: number) => number;

/** Gradientenrauschen mit Werten etwa in −1..1. */
export function gradientRauschen(seed: number): Rauschen {
  // Permutation aus dem Seed (eigener kleiner Zufall, damit das Modul allein steht)
  let a = seed >>> 0;
  const rnd = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const gx = new Float32Array(256), gy = new Float32Array(256);
  for (let i = 0; i < 256; i++) { const w = (i / 256) * Math.PI * 2; gx[i] = Math.cos(w); gy[i] = Math.sin(w); }
  const glatt = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    const fx = x - x0, fy = y - y0;
    const X = x0 & 255, Y = y0 & 255;
    const ecke = (ix: number, iy: number, dx: number, dy: number) => {
      const g = perm[perm[X + ix] + Y + iy];
      return gx[g] * dx + gy[g] * dy;
    };
    const u = glatt(fx), v = glatt(fy);
    const n00 = ecke(0, 0, fx, fy), n10 = ecke(1, 0, fx - 1, fy);
    const n01 = ecke(0, 1, fx, fy - 1), n11 = ecke(1, 1, fx - 1, fy - 1);
    const a1 = n00 + u * (n10 - n00), a2 = n01 + u * (n11 - n01);
    return (a1 + v * (a2 - a1)) * 1.4;
  };
}

/** Wertrauschen: an Gitterpunkten ein Zufallswert, dazwischen weich überblendet (wirkt kästchenhafter). */
export function wertRauschen(seed: number): Rauschen {
  const hash = (ix: number, iy: number) => {
    let t = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iy, 0x165667b1) ^ Math.imul(seed + 1, 0x9e3779b9);
    t = Math.imul(t ^ (t >>> 15), 0x85ebca6b);
    t ^= t >>> 13;
    return ((t >>> 0) / 4294967296) * 2 - 1;
  };
  const glatt = (t: number) => t * t * (3 - 2 * t);
  return (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), u = glatt(x - x0), v = glatt(y - y0);
    const a = hash(x0, y0) + u * (hash(x0 + 1, y0) - hash(x0, y0));
    const b = hash(x0, y0 + 1) + u * (hash(x0 + 1, y0 + 1) - hash(x0, y0 + 1));
    return a + v * (b - a);
  };
}

/** Form einer Oktave: glatt (Hügel), Grat (1 − |n|, scharfe Bergrücken) oder Wolken (|n|, runde Kuppen). */
export type Form = "glatt" | "grat" | "wolken";
const FORM: Record<Form, (n: number) => number> = {
  glatt: n => n,
  grat: n => (1 - Math.abs(n)) * 2 - 1,
  wolken: n => Math.abs(n) * 2 - 1,
};

/** Oktaven übereinander: jede doppelt so fein (Lakunarität) und halb so stark (Persistenz). Ergebnis etwa −1..1. */
export function fbm(r: Rauschen, x: number, y: number, oktaven: number, persistenz = 0.5, lakunaritaet = 2, form: Form = "glatt"): number {
  const f = FORM[form];
  let summe = 0, amp = 1, freq = 1, norm = 0;
  for (let o = 0; o < oktaven; o++) {
    summe += amp * f(r(x * freq + o * 17.3, y * freq + o * 31.7));
    norm += amp;
    amp *= persistenz;
    freq *= lakunaritaet;
  }
  return summe / norm;
}

export interface GelaendeOptionen {
  seed: number;
  /** Kantenlänge des Rasters in Pixeln */
  groesse: number;
  /** wie viele Rauschzellen über die Breite passen */
  massstab: number;
  oktaven: number;
  persistenz: number;
  lakunaritaet: number;
  /** Stärke des Domain Warpings (0 = aus) */
  warp: number;
  insel: boolean;
  basis?: "gradient" | "wert";
  form?: Form;
  inselForm?: "kreis" | "quadrat";
}

export const GELAENDE_STANDARD: GelaendeOptionen = {
  seed: 1, groesse: 256, massstab: 4, oktaven: 5, persistenz: 0.5, lakunaritaet: 2, warp: 0, insel: true,
};

/** Höhen 0..1 je Pixel. */
export function gelaende(o: GelaendeOptionen): Float32Array {
  const r = (o.basis === "wert" ? wertRauschen : gradientRauschen)(o.seed);
  const n = o.groesse;
  const z = new Float32Array(n * n);
  for (let py = 0; py < n; py++) for (let px = 0; px < n; px++) {
    let x = (px / n) * o.massstab, y = (py / n) * o.massstab;
    if (o.warp > 0) {
      const qx = fbm(r, x + 5.2, y + 1.3, 4), qy = fbm(r, x + 9.7, y + 2.8, 4);
      x += o.warp * qx;
      y += o.warp * qy;
    }
    let h = (fbm(r, x, y, o.oktaven, o.persistenz, o.lakunaritaet, o.form) + 1) / 2;
    if (o.insel) {
      const dx = (px / n) * 2 - 1, dy = (py / n) * 2 - 1;
      const d = Math.min(1, o.inselForm === "quadrat" ? Math.max(Math.abs(dx), Math.abs(dy)) : Math.sqrt(dx * dx + dy * dy));
      h = h * (1 - d * d) + 0.35 * (1 - d * d) - 0.15 * d;
    }
    z[py * n + px] = Math.max(0, Math.min(1, h));
  }
  return z;
}

/** Eine einzelne Oktave (für die Zerlegung in Schichten), Werte 0..1. */
export function oktave(o: GelaendeOptionen, nr: number): Float32Array {
  const r = (o.basis === "wert" ? wertRauschen : gradientRauschen)(o.seed);
  const f = FORM[o.form ?? "glatt"];
  const n = o.groesse, fr = o.lakunaritaet ** nr;
  const z = new Float32Array(n * n);
  for (let py = 0; py < n; py++) for (let px = 0; px < n; px++) {
    const x = (px / n) * o.massstab, y = (py / n) * o.massstab;
    z[py * n + px] = (f(r(x * fr + nr * 17.3, y * fr + nr * 31.7)) + 1) / 2;
  }
  return z;
}

/** Höhenfarbe wie auf einer Landkarte; `meer` = Meeresspiegel 0..1. */
export function hoehenFarbe(h: number, meer: number): [number, number, number] {
  if (h < meer) {
    const t = h / Math.max(meer, 1e-6);
    return [Math.round(20 + 40 * t), Math.round(60 + 90 * t), Math.round(120 + 90 * t)];
  }
  const t = (h - meer) / Math.max(1 - meer, 1e-6);
  if (t < 0.04) return [222, 206, 150]; // Strand
  if (t < 0.35) return [Math.round(80 - 30 * t), Math.round(160 - 40 * t), 70];
  if (t < 0.6) return [Math.round(60 + 80 * (t - 0.35)), Math.round(120 - 20 * (t - 0.35)), 60];
  if (t < 0.8) return [130, 110, 90];
  return [Math.round(200 + 50 * (t - 0.8)), Math.round(200 + 50 * (t - 0.8)), Math.round(205 + 50 * (t - 0.8))];
}
