/**
 * Geländefarben mit Schummerung (Licht aus Nordwest), als RGBA-Puffer n×n.
 */
import type { Gelaende } from "./gelaende";

type RGB = [number, number, number];

const STUFEN: [number, RGB][] = [
  [0, [118, 160, 92]],
  [0.3, [152, 178, 104]],
  [0.55, [186, 172, 120]],
  [0.75, [160, 132, 104]],
  [0.9, [150, 146, 142]],
  [1, [240, 240, 244]],
];

function verlauf(t: number): RGB {
  t = Math.max(0, Math.min(1, t));
  for (let s = 1; s < STUFEN.length; s++) {
    const [b, cb] = STUFEN[s];
    if (t <= b) {
      const [a, ca] = STUFEN[s - 1], u = (t - a) / (b - a);
      return [ca[0] + (cb[0] - ca[0]) * u, ca[1] + (cb[1] - ca[1]) * u, ca[2] + (cb[2] - ca[2]) * u];
    }
  }
  return STUFEN[STUFEN.length - 1][1];
}

export interface FarbOptionen {
  /** Aue grünlich hervorheben */
  aue?: boolean;
  /** Wassermenge je Zelle (Erosion), zeigt Rinnsale */
  wasserMenge?: Float64Array;
  /** feste Höhenspanne für den Farbverlauf (m), sonst aus dem Gelände */
  spanne?: [number, number];
  /** Höhenlinien alle … Meter (0 = aus) */
  linien?: number;
}

export function gelaendeFarben(g: Pick<Gelaende, "n" | "zelle" | "hoehe" | "wasser" | "aue">, o: FarbOptionen = {}): Uint8ClampedArray {
  const { n, zelle, hoehe, wasser, aue } = g;
  let lo = Infinity, hi = -Infinity;
  if (o.spanne) [lo, hi] = o.spanne;
  else for (let k = 0; k < n * n; k++) if (!wasser[k]) { lo = Math.min(lo, hoehe[k]); hi = Math.max(hi, hoehe[k]); }
  if (!(hi > lo)) { lo = 0; hi = 1; }
  // Farbverlauf nur über die tatsächliche Spanne, aber flaches Land bleibt grün
  const spanne = Math.max(hi - lo, 60);
  const px = new Uint8ClampedArray(n * n * 4);
  // Wassermenge relativ zum Mittel: nur, wo sich Wasser sammelt, wird es blau
  let mittel = 0;
  if (o.wasserMenge) { for (let k = 0; k < n * n; k++) mittel += o.wasserMenge[k]; mittel = mittel / (n * n) || 1; }
  const L = [-0.6, -0.6, 0.53];
  const ll = Math.hypot(L[0], L[1], L[2]);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    const hl = hoehe[j * n + Math.max(0, i - 1)], hr = hoehe[j * n + Math.min(n - 1, i + 1)];
    const ho = hoehe[Math.max(0, j - 1) * n + i], hu = hoehe[Math.min(n - 1, j + 1) * n + i];
    // Normale, leicht überhöht, damit flaches Land noch Relief zeigt
    const nx = -(hr - hl) / (2 * zelle) * 3, ny = -(hu - ho) / (2 * zelle) * 3, nz = 1;
    const nl = Math.hypot(nx, ny, nz);
    const licht = Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / (nl * ll));
    const s = 0.55 + 0.6 * licht;
    let c: RGB;
    if (wasser[k]) {
      const tief = Math.min(1, Math.max(0, -hoehe[k] / 20));
      c = wasser[k] === 2 ? [70 - 30 * tief, 130 - 40 * tief, 190 - 30 * tief] : [80, 140, 200];
    } else {
      c = verlauf((hoehe[k] - lo) / spanne);
      if (o.aue && aue[k]) c = [c[0] * 0.8, c[1] * 0.95 + 14, c[2] * 0.8];
      c = [c[0] * s, c[1] * s, c[2] * s];
      if (o.linien) {
        const a = Math.floor(hoehe[k] / o.linien);
        if (Math.floor(hr / o.linien) !== a || Math.floor(hu / o.linien) !== a) c = [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8];
      }
    }
    if (o.wasserMenge && !wasser[k]) {
      const w = Math.min(1, Math.max(0, (o.wasserMenge[k] / mittel - 2) / 6));
      c = [c[0] + (60 - c[0]) * w, c[1] + (120 - c[1]) * w, c[2] + (210 - c[2]) * w];
    }
    px[k * 4] = c[0]; px[k * 4 + 1] = c[1]; px[k * 4 + 2] = c[2]; px[k * 4 + 3] = 255;
  }
  return px;
}
