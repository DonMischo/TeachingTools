/** Kleine Flächengeometrie in Metern — ohne DOM, ohne Pixi. */

export type P = [number, number];

export function abstandZuStrecke(px: number, py: number, a: P, b: P): { d: number; t: number } {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2));
  const qx = a[0] + t * dx, qy = a[1] + t * dy;
  return { d: Math.hypot(px - qx, py - qy), t };
}

export function imVieleck(px: number, py: number, umriss: P[]): boolean {
  let drin = false;
  for (let i = 0, j = umriss.length - 1; i < umriss.length; j = i++) {
    const [xi, yi] = umriss[i], [xj, yj] = umriss[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) drin = !drin;
  }
  return drin;
}

/** Nächster Punkt auf dem Rand eines Vielecks — zum Hinausschieben aus Gebäuden. */
export function naechsterRandpunkt(px: number, py: number, umriss: P[]): { p: P; d: number } {
  let best: { p: P; d: number } = { p: umriss[0], d: Infinity };
  for (let i = 0; i < umriss.length; i++) {
    const a = umriss[i], b = umriss[(i + 1) % umriss.length];
    const { d, t } = abstandZuStrecke(px, py, a, b);
    if (d < best.d) best = { p: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])], d };
  }
  return best;
}

export type Box = { x0: number; y0: number; x1: number; y1: number };

export function boxVon(punkte: P[]): Box {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of punkte) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

/**
 * Ein grobes Raster, das Dinge nach ihrer Box einsortiert. Eine Abfrage an
 * einem Punkt liefert alle Dinge, deren Box (plus Rand) die Zelle berührt —
 * die genaue Prüfung macht der Aufrufer.
 */
export class Raster<T> {
  private zellen = new Map<number, T[]>();
  constructor(private groesse = 20) {}

  private schluessel(ix: number, iy: number) { return ix * 100_003 + iy; }

  fuege(ding: T, box: Box, rand = 0) {
    const g = this.groesse;
    for (let ix = Math.floor((box.x0 - rand) / g); ix <= Math.floor((box.x1 + rand) / g); ix++)
      for (let iy = Math.floor((box.y0 - rand) / g); iy <= Math.floor((box.y1 + rand) / g); iy++) {
        const k = this.schluessel(ix, iy);
        const liste = this.zellen.get(k);
        if (liste) liste.push(ding); else this.zellen.set(k, [ding]);
      }
  }

  bei(x: number, y: number): readonly T[] {
    return this.zellen.get(this.schluessel(Math.floor(x / this.groesse), Math.floor(y / this.groesse))) ?? [];
  }
}
