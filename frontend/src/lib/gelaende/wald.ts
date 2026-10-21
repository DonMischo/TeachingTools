/**
 * Wald: wächst auf Hängen und in Flecken, nicht im Wasser und nicht auf
 * nassen Auen-Wiesen (dort nur Auwald am Ufer). Werte 0..1 je Zelle.
 */
import { fbm, perlin } from "./rauschen";
import type { Gelaende } from "./gelaende";

export function waldMaske(g: Pick<Gelaende, "n" | "zelle" | "hoehe" | "wasser" | "aue" | "abstandWasser" | "wahl">): Float32Array {
  const { n, zelle, hoehe, wasser, aue } = g;
  const r = perlin(g.wahl.seed + 333);
  const w = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    if (wasser[k]) continue;
    const hl = hoehe[j * n + Math.max(0, i - 1)], hr = hoehe[j * n + Math.min(n - 1, i + 1)];
    const ho = hoehe[Math.max(0, j - 1) * n + i], hu = hoehe[Math.min(n - 1, j + 1) * n + i];
    const neigung = (Math.hypot(hr - hl, hu - ho) / (2 * zelle)) * 100;
    const x = (i + 0.5) * zelle, y = (j + 0.5) * zelle;
    const fleck = fbm(r, x / 700, y / 700, 4);
    // steile Hänge bewaldet (schlecht zu beackern), Ebenen eher Feld
    let v = fleck * 1.4 + Math.min(1, neigung / 25) * 0.9 - 0.35;
    if (aue[k]) v = g.abstandWasser[k] < 18 ? 0.6 : -1;
    w[k] = Math.max(0, Math.min(1, v * 2));
  }
  return w;
}
