/** Höhengitter + Farbbild → Voxel-Karte (Zweierpotenz, bilinear vergrößert) */
import type { VoxelKarte } from "@/lib/gelaende/voxel";

export function voxelAusGitter(h: ArrayLike<number>, farbe: Uint8ClampedArray, n: number, zelle: number, N: number, ueberhoehung = 1.6, boden = -Infinity): VoxelKarte {
  let lo = Infinity;
  for (let k = 0; k < n * n; k++) lo = Math.min(lo, Math.max(boden, h[k]));
  const px = (n * zelle) / N, f = n / N;
  const hoehe = new Float32Array(N * N), rgba = new Uint8ClampedArray(N * N * 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = Math.min(n - 1.001, Math.max(0, (i + 0.5) * f - 0.5)), y = Math.min(n - 1.001, Math.max(0, (j + 0.5) * f - 0.5));
    const a = Math.floor(x), b = Math.floor(y), u = x - a, v = y - b, k = b * n + a;
    const w = [(1 - u) * (1 - v), u * (1 - v), (1 - u) * v, u * v], ks = [k, k + 1, k + n, k + n + 1];
    let hh = 0;
    for (let q = 0; q < 4; q++) hh += w[q] * Math.max(boden, h[ks[q]]);
    const o = j * N + i;
    hoehe[o] = ((hh - lo) * ueberhoehung) / px;
    for (let c = 0; c < 3; c++) { let s = 0; for (let q = 0; q < 4; q++) s += w[q] * farbe[ks[q] * 4 + c]; rgba[o * 4 + c] = s; }
    rgba[o * 4 + 3] = 255;
  }
  return { n: N, hoehe, farbe: rgba };
}
