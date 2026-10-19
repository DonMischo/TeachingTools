/**
 * Voxel-Flug über ein Höhen- und ein Farbbild, nach dem Algorithmus von
 * »Voxel Space« (NovaLogic, Comanche 1992), wie ihn Sebastian Macke
 * erklärt (github.com/s-macke/VoxelSpace, MIT). Neu geschrieben; die
 * Comanche-Karten aus dem Repo werden nicht benutzt.
 *
 * Je Bildspalte von vorn nach hinten: Höhe abtasten, auf den Schirm
 * projizieren und nur zeichnen, was über dem bisher Gezeichneten liegt
 * (Y-Puffer). Kein Dreieck, keine GPU.
 */

export interface VoxelKarte {
  /** Kantenlänge in Pixeln (Zweierpotenz) */
  n: number;
  /** Höhe je Pixel in Kartenpixeln (gleicher Maßstab wie x/y) */
  hoehe: Float32Array;
  /** RGBA */
  farbe: Uint8ClampedArray;
}

export interface Kamera {
  x: number;
  y: number;
  /** Blickrichtung in Bogenmaß (0 = Norden, im Uhrzeigersinn) */
  winkel: number;
  /** Flughöhe in Kartenpixeln */
  hoehe: number;
  /** Horizontlinie als Anteil der Bildhöhe */
  horizont: number;
  /** Sichtweite in Kartenpixeln */
  weite: number;
}

export function voxelBild(k: VoxelKarte, kam: Kamera, bild: ImageData, himmel: [number, number, number] = [176, 208, 236]) {
  const W = bild.width, H = bild.height, d = bild.data;
  const { n, hoehe, farbe } = k;
  const maske = n - 1;
  // Himmel mit Verlauf
  for (let y = 0; y < H; y++) {
    const t = y / H;
    const r = himmel[0] + (232 - himmel[0]) * t, g = himmel[1] + (238 - himmel[1]) * t, b = himmel[2] + (240 - himmel[2]) * t;
    for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255; }
  }
  const ypuf = new Int32Array(W).fill(H);
  const sin = Math.sin(kam.winkel), cos = Math.cos(kam.winkel);
  const hor = kam.horizont * H;
  const skala = H * 0.9;
  let dz = 1;
  for (let z = 1; z < kam.weite; z += dz) {
    // linker und rechter Rand der Sichtlinie in dieser Entfernung (90° Blickfeld)
    const lx = -cos * z + sin * z, ly = -sin * z - cos * z;
    const rx = cos * z + sin * z, ry = sin * z - cos * z;
    const sx = (rx - lx) / W, sy = (ry - ly) / W;
    let px = kam.x + lx, py = kam.y + ly;
    const nebel = Math.min(1, z / kam.weite);
    const nb = nebel * nebel;
    for (let x = 0; x < W; x++) {
      const ix = Math.floor(px), iy = Math.floor(py);
      px += sx; py += sy;
      if (ix < 0 || iy < 0 || ix >= n || iy >= n) continue;
      const q = (iy & maske) * n + (ix & maske);
      const ys = Math.floor((kam.hoehe - hoehe[q]) / z * skala + hor);
      if (ys >= ypuf[x]) continue;
      const o4 = q * 4;
      const r = farbe[o4] + (232 - farbe[o4]) * nb, g = farbe[o4 + 1] + (238 - farbe[o4 + 1]) * nb, b = farbe[o4 + 2] + (240 - farbe[o4 + 2]) * nb;
      for (let y = Math.max(0, ys); y < ypuf[x]; y++) {
        const o = (y * W + x) * 4;
        d[o] = r; d[o + 1] = g; d[o + 2] = b;
      }
      ypuf[x] = Math.max(0, ys);
    }
    dz += 0.005 * z / 4 + 0.002;
  }
}

/** Höhe unter der Kamera (für Bodenabstand) */
export function bodenHoehe(k: VoxelKarte, x: number, y: number): number {
  const ix = Math.max(0, Math.min(k.n - 1, Math.floor(x))), iy = Math.max(0, Math.min(k.n - 1, Math.floor(y)));
  return k.hoehe[iy * k.n + ix];
}
