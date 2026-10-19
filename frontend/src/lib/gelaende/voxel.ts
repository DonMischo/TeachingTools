/**
 * Voxel-Flug über ein Höhen- und ein Farbbild, nach dem Algorithmus von
 * »Voxel Space« (NovaLogic, Comanche 1992), wie ihn Sebastian Macke
 * erklärt (github.com/s-macke/VoxelSpace, MIT). Neu geschrieben; die
 * Comanche-Karten aus dem Repo werden nicht benutzt.
 *
 * Je Bildspalte von vorn nach hinten: Höhe abtasten, auf den Schirm
 * projizieren und nur zeichnen, was über dem bisher Gezeichneten liegt
 * (Y-Puffer). Kein Dreieck, keine GPU.
 *
 * Erweiterung: Springt die Höhe von einer Abtastung zur nächsten nach oben,
 * ist das eine Wand (Hausfassade, Kliff) — sie bekommt die Farbe aus
 * `wand` (oder eine dunklere Dachfarbe) und angedeutete Fensterreihen.
 */

export interface VoxelKarte {
  /** Kantenlänge in Pixeln (Zweierpotenz) */
  n: number;
  /** Höhe je Pixel in Kartenpixeln (gleicher Maßstab wie x/y) */
  hoehe: Float32Array;
  /** RGBA */
  farbe: Uint8ClampedArray;
  /** RGBA der Wände (Fassaden); Alpha 0 = keine eigene Wandfarbe */
  wand?: Uint8ClampedArray;
  /** Kartenpixel je Meter Höhe — für Stockwerke; ohne Angabe keine Fenster */
  proMeter?: number;
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

const DUNST = [214, 226, 236];

export function voxelBild(k: VoxelKarte, kam: Kamera, bild: ImageData, himmel: [number, number, number] = [150, 190, 232]) {
  const W = bild.width, H = bild.height, d = bild.data;
  const { n, hoehe, farbe, wand } = k;
  // Himmel mit Verlauf zum Dunst am Horizont
  const hor = kam.horizont * H;
  for (let y = 0; y < H; y++) {
    const t = Math.max(0, Math.min(1, (y / Math.max(1, hor + H * 0.15)) ** 1.5));
    const r = himmel[0] + (DUNST[0] - himmel[0]) * t, g = himmel[1] + (DUNST[1] - himmel[1]) * t, b = himmel[2] + (DUNST[2] - himmel[2]) * t;
    for (let x = 0; x < W; x++) { const o = (y * W + x) * 4; d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255; }
  }
  const ypuf = new Int32Array(W).fill(H);
  const vorH = new Float32Array(W).fill(-1e9);
  const sin = Math.sin(kam.winkel), cos = Math.cos(kam.winkel);
  const skala = W * 0.5;
  const stock = k.proMeter ? 3.1 * k.proMeter : 0;
  let dz = 0.5;
  for (let z = 1; z < kam.weite; z += dz) {
    const lx = -cos * z + sin * z, ly = -sin * z - cos * z;
    const rx = cos * z + sin * z, ry = sin * z - cos * z;
    const sx = (rx - lx) / W, sy = (ry - ly) / W;
    let px = kam.x + lx, py = kam.y + ly;
    const nb = Math.min(1, z / kam.weite) ** 1.6;
    const inv = skala / z;
    for (let x = 0; x < W; x++) {
      const ix = px | 0, iy = py | 0;
      px += sx; py += sy;
      if (ix < 0 || iy < 0 || ix >= n || iy >= n) continue;
      const q = iy * n + ix;
      const hq = hoehe[q];
      const ys = ((kam.hoehe - hq) * inv + hor) | 0;
      const sprung = hq - vorH[x];
      vorH[x] = hq;
      if (ys >= ypuf[x]) continue;
      const o4 = q * 4;
      const r0 = farbe[o4], g0 = farbe[o4 + 1], b0 = farbe[o4 + 2];
      const bis = ypuf[x];
      const von = Math.max(0, ys);
      // Wand, wenn die Höhe sprunghaft steigt: oben ein Streifen Dach, darunter Fassade
      // Dachschrägen steigen weniger als eine Abtastweite — echte Wände mehr
      const istWand = sprung > Math.max(1.5, dz * 1.1) && bis - von > 2;
      let wr = r0 * 0.72, wg = g0 * 0.72, wb = b0 * 0.72;
      if (istWand && wand && wand[o4 + 3] > 128) { wr = wand[o4]; wg = wand[o4 + 1]; wb = wand[o4 + 2]; }
      const dach = istWand ? Math.min(bis - von, 1 + ((inv * 0.6) | 0)) : bis - von;
      // Fenster nur an höheren Häusern (ab etwa 4 Stockwerken)
      const fenster = istWand && stock > 0 && sprung > stock * 3.5 ? stock * inv : 0;
      for (let y = von; y < bis; y++) {
        let r = r0, g = g0, b = b0;
        if (y - von >= dach) {
          r = wr; g = wg; b = wb;
          // Fensterreihen: dunkle Bänder je Stockwerk, nur nah genug
          if (fenster > 4) {
            const f = ((y - ys) % fenster) / fenster;
            if (f > 0.35 && f < 0.7 && (x & 3) !== 0) { r *= 0.62; g *= 0.66; b *= 0.74; }
          }
        }
        const o = (y * W + x) * 4;
        d[o] = r + (DUNST[0] - r) * nb; d[o + 1] = g + (DUNST[1] - g) * nb; d[o + 2] = b + (DUNST[2] - b) * nb;
      }
      ypuf[x] = von;
    }
    dz = 0.5 + z * 0.006;
  }
}

/** Höhe unter der Kamera (für Bodenabstand) */
export function bodenHoehe(k: VoxelKarte, x: number, y: number): number {
  const ix = Math.max(0, Math.min(k.n - 1, Math.floor(x))), iy = Math.max(0, Math.min(k.n - 1, Math.floor(y)));
  return k.hoehe[iy * k.n + ix];
}

/**
 * Licht einbacken: Farbe × (Umgebung + Sonne · Neigung zur Sonne), Sonne aus
 * Südwesten. Macht Dachseiten, Baumkronen und Hänge plastisch.
 */
export function lichtEinbacken(k: VoxelKarte, staerke = 0.5, ohne?: Uint8Array) {
  const { n, hoehe, farbe } = k;
  const L = [-0.55, 0.45, 0.7], ll = Math.hypot(L[0], L[1], L[2]);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const q = j * n + i;
    if (ohne && ohne[q]) continue;
    const dx = (hoehe[j * n + Math.min(n - 1, i + 1)] - hoehe[j * n + Math.max(0, i - 1)]) / 2;
    const dy = (hoehe[Math.min(n - 1, j + 1) * n + i] - hoehe[Math.max(0, j - 1) * n + i]) / 2;
    const nl = Math.hypot(dx, dy, 1);
    const l = Math.max(0, (-dx * L[0] - dy * L[1] + L[2]) / (nl * ll));
    const f = 1 - staerke + staerke * 1.35 * l;
    farbe[q * 4] *= f; farbe[q * 4 + 1] *= f; farbe[q * 4 + 2] *= f;
  }
}
