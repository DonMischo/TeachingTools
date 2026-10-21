/**
 * Reproduzierbarer Zufall und Gradientenrauschen (Perlin) für Gelände.
 * Grundlage für Stadtentwicklung und Erosion — reine Rechnung, ohne DOM.
 */

/** kleiner, reproduzierbarer Zufall (mulberry32) */
export function zufallsquelle(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rauschen = (x: number, y: number) => number;

const GRAD = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071]];

/** 2D-Perlin-Rauschen, Werte etwa in [-1, 1] */
export function perlin(seed: number): Rauschen {
  const z = zufallsquelle(seed);
  const p = new Uint8Array(512);
  const q = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(z() * (i + 1));
    [q[i], q[j]] = [q[j], q[i]];
  }
  for (let i = 0; i < 512; i++) p[i] = q[i & 255];
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  const g = (h: number, x: number, y: number) => { const d = GRAD[h & 7]; return d[0] * x + d[1] * y; };
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const aa = p[p[X] + Y], ab = p[p[X] + Y + 1], ba = p[p[X + 1] + Y], bb = p[p[X + 1] + Y + 1];
    const u = fade(xf), v = fade(yf);
    const x1 = g(aa, xf, yf) + u * (g(ba, xf - 1, yf) - g(aa, xf, yf));
    const x2 = g(ab, xf, yf - 1) + u * (g(bb, xf - 1, yf - 1) - g(ab, xf, yf - 1));
    return 1.414 * (x1 + v * (x2 - x1));
  };
}

/** fraktales Rauschen (fBm): Oktaven mit doppelter Frequenz und halber Stärke */
export function fbm(r: Rauschen, x: number, y: number, oktaven = 5, gain = 0.5): number {
  let s = 0, a = 1, f = 1, norm = 0;
  for (let o = 0; o < oktaven; o++) {
    s += a * r(x * f + o * 17.3, y * f - o * 9.1);
    norm += a;
    a *= gain;
    f *= 2;
  }
  return s / norm;
}

/** Grat-Rauschen: scharfe Kämme wie im Hochgebirge, Werte in [0, 1] */
export function grat(r: Rauschen, x: number, y: number, oktaven = 5): number {
  let s = 0, a = 0.5, f = 1, norm = 0;
  for (let o = 0; o < oktaven; o++) {
    const n = 1 - Math.abs(r(x * f + o * 31.7, y * f + o * 7.7));
    s += a * n * n;
    norm += a;
    a *= 0.5;
    f *= 2;
  }
  return s / norm;
}
