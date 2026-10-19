/**
 * Stadt + Gelände als Voxel-Karte backen:
 *   Farbe  = Draufsicht der Karte, Bäume, eingebackenes Licht
 *   Höhe   = Gelände (überhöht) + Häuser mit Satteldach + Bäume, Wasser eben
 *   Wand   = Fassadenfarben
 * Die Leinwand kommt von außen (Browser: document.createElement, Tests: @napi-rs/canvas).
 */
import { hoeheBei, type Gelaende } from "@/lib/gelaende/gelaende";
import { zufallsquelle } from "@/lib/gelaende/rauschen";
import { lichtEinbacken, type VoxelKarte } from "@/lib/gelaende/voxel";
import { waldMaske } from "@/lib/gelaende/wald";
import type { Haus } from "./haeuser";
import type { Stadt } from "./modell";
import { zeichneHoehen, zeichneKarte, zeichneWaende } from "./zeichnen";

type Leinwand = { getContext(t: "2d"): CanvasRenderingContext2D | null };
export type LeinwandFabrik = (w: number, h: number) => Leinwand;

/** Überhöhung des Geländes, damit flaches Land noch Relief zeigt (Häuser bleiben maßstäblich) */
export const UEBERHOEHUNG = 1.6;

export function backeVoxel(g: Gelaende, s: Stadt, haeuser: Haus[], bild: CanvasImageSource, leinwand: LeinwandFabrik, N = 2048, wasser?: CanvasImageSource): VoxelKarte {
  const px = g.breite / N;
  const fc = leinwand(N, N).getContext("2d")!;
  zeichneKarte(fc, N, N, { x0: 0, y0: 0, m: N / g.breite }, g, s, { gelaende: bild, wasser, haeuser, nurBild: true, symbole: false, namen: false });
  const farbe = fc.getImageData(0, 0, N, N).data;
  const hx = leinwand(N, N).getContext("2d")!;
  zeichneHoehen(hx, N, g, s, haeuser);
  const roh = hx.getImageData(0, 0, N, N).data;
  const wx = leinwand(N, N).getContext("2d")!;
  zeichneWaende(wx, N, g, s, haeuser);
  const wand = wx.getImageData(0, 0, N, N).data;

  // Kantenglättung entfernen: an Hauskanten mischt das Canvas Höhe und Boden,
  // das gäbe Zacken — Minimum über das Kreuz aus Nachbarn
  const bau = new Float32Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const q = j * N + i;
    const v = roh[q * 4];
    if (!v) continue;
    bau[q] = Math.min(v, roh[(j * N + Math.max(0, i - 1)) * 4], roh[(j * N + Math.min(N - 1, i + 1)) * 4], roh[(Math.max(0, j - 1) * N + i) * 4], roh[(Math.min(N - 1, j + 1) * N + i) * 4]);
  }

  // Boden: Gelände, Wasser als ebene Fläche (Ufer-Minimum)
  let lo = Infinity;
  for (let k = 0; k < g.hoehe.length; k++) lo = Math.min(lo, g.hoehe[k]);
  if (g.meer !== null) lo = Math.max(lo, g.meer - 2);
  const spiegel = new Float32Array(g.n * g.n).fill(NaN);
  for (let j = 0; j < g.n; j++) for (let i = 0; i < g.n; i++) {
    const k = j * g.n + i;
    if (!g.wasser[k]) continue;
    if (g.wasser[k] === 2 && g.meer !== null) { spiegel[k] = g.meer; continue; }
    let m = Infinity;
    for (let b = -4; b <= 4; b++) for (let a = -4; a <= 4; a++) {
      const ii = i + a, jj = j + b;
      if (ii < 0 || jj < 0 || ii >= g.n || jj >= g.n) continue;
      const kk = jj * g.n + ii;
      if (!g.wasser[kk]) m = Math.min(m, g.hoehe[kk]);
    }
    spiegel[k] = Number.isFinite(m) ? m - 0.6 : g.hoehe[k];
  }
  const hoehe = new Float32Array(N * N);
  const nass = new Uint8Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const q = j * N + i, x = (i + 0.5) * px, y = (j + 0.5) * px;
    const gi = Math.min(g.n - 1, Math.floor(x / g.zelle)), gj = Math.min(g.n - 1, Math.floor(y / g.zelle));
    const sp = spiegel[gj * g.n + gi];
    let boden = Math.max(lo, hoeheBei(g, x, y));
    if (!Number.isNaN(sp)) { boden = Math.max(lo, sp); nass[q] = 1; }
    hoehe[q] = ((boden - lo) * UEBERHOEHUNG + bau[q]) / px;
  }

  // Bäume: Wald außerhalb der Stadt, auf einem verwackelten Raster
  const wald = waldMaske(g);
  const z = zufallsquelle(g.wahl.seed + 77);
  const abst = Math.max(2, Math.round(7 / px));
  for (let j = 0; j < N; j += abst) for (let i = 0; i < N; i += abst) {
    const cx = i + z() * abst, cy = j + z() * abst;
    const ii = Math.min(N - 1, cx | 0), jj = Math.min(N - 1, cy | 0), q = jj * N + ii;
    if (nass[q] || wand[q * 4 + 3] > 0 || bau[q] > 0) { z(); z(); continue; }
    const w = wald[Math.min(g.n - 1, Math.floor((cy * px) / g.zelle)) * g.n + Math.min(g.n - 1, Math.floor((cx * px) / g.zelle))];
    const zuf = z(), hz = z();
    if (zuf > w) continue;
    const r = (3.2 + hz * 2.6) / px, hBaum = (6 + hz * 6) / px;
    const gr = 0.75 + zuf * 0.3;
    for (let b = -Math.ceil(r); b <= Math.ceil(r); b++) for (let a = -Math.ceil(r); a <= Math.ceil(r); a++) {
      const xi = ii + a, yi = jj + b;
      if (xi < 0 || yi < 0 || xi >= N || yi >= N) continue;
      const d2 = (a * a + b * b) / (r * r);
      if (d2 > 1) continue;
      const o = yi * N + xi;
      if (nass[o] || wand[o * 4 + 3] > 0) continue;
      const krone = hoehe[q] + hBaum * (0.3 + 0.7 * Math.sqrt(1 - d2));
      if (krone <= hoehe[o]) continue;
      hoehe[o] = krone;
      farbe[o * 4] = 52 * gr; farbe[o * 4 + 1] = 98 * gr; farbe[o * 4 + 2] = 46 * gr;
    }
  }

  const karte: VoxelKarte = { n: N, hoehe, farbe, wand, proMeter: 1 / px };
  lichtEinbacken(karte, 0.45, nass);
  return karte;
}
