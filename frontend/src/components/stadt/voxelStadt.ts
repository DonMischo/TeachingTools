/** Stadt + Gelände als Voxel-Karte backen (Farbbild = Draufsicht, Höhe = Gelände + Bauten) */
import { hoeheBei, type Gelaende } from "@/lib/gelaende/gelaende";
import type { VoxelKarte } from "@/lib/gelaende/voxel";
import type { Haus } from "@/lib/stadt/haeuser";
import type { Stadt } from "@/lib/stadt/modell";
import { zeichneHoehen, zeichneKarte } from "@/lib/stadt/zeichnen";

/** Überhöhung, damit flaches Land noch Relief zeigt */
const UEBERHOEHUNG = 1.6;

export function backeVoxel(g: Gelaende, s: Stadt, haeuser: Haus[], bild: HTMLCanvasElement, N = 1024): VoxelKarte {
  const farbe = document.createElement("canvas");
  farbe.width = farbe.height = N;
  const fc = farbe.getContext("2d")!;
  zeichneKarte(fc, N, N, { x0: 0, y0: 0, m: N / g.breite }, g, s, { gelaende: bild, haeuser, nurBild: true, symbole: false, namen: false });
  const hc = document.createElement("canvas");
  hc.width = hc.height = N;
  const hx = hc.getContext("2d")!;
  zeichneHoehen(hx, N, g, s, haeuser);
  const bauH = hx.getImageData(0, 0, N, N).data;
  const px = g.breite / N;
  let lo = Infinity;
  for (let k = 0; k < g.hoehe.length; k++) lo = Math.min(lo, g.hoehe[k]);
  if (g.meer !== null) lo = Math.max(lo, g.meer - 2);
  const hoehe = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = j * N + i;
    const boden = Math.max(lo, hoeheBei(g, (i + 0.5) * px, (j + 0.5) * px));
    hoehe[k] = ((boden - lo) * UEBERHOEHUNG + bauH[k * 4]) / px;
  }
  return { n: N, hoehe, farbe: fc.getImageData(0, 0, N, N).data };
}
