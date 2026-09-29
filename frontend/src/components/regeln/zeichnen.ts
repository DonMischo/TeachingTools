import { FARBEN, type Raster, type Treffer } from "@/lib/regeln/maschine";

/** Zellgröße, damit das Raster in `max` Pixel passt. */
export function zellPx(r: Raster, max = 640): number {
  return Math.max(4, Math.floor(max / Math.max(r.b, r.h)));
}

/**
 * Raster zeichnen; `letzte` (eben angewandt) durchgezogen, `moeglich`
 * (Kandidaten für den nächsten Schritt) gestrichelt umrandet.
 */
export function zeichneRaster(
  ctx: CanvasRenderingContext2D, r: Raster, px: number,
  letzte: Treffer[] = [], moeglich: Treffer[] = [],
) {
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.b; x++) {
      ctx.fillStyle = FARBEN[r.z[y * r.b + x]]?.hex ?? "#ff00ff";
      ctx.fillRect(x * px, y * px, px, px);
    }
  }
  const rahmen = (t: Treffer) => ctx.strokeRect(t.x * px + 1, t.y * px + 1, t.v.aus.b * px - 2, t.v.aus.h * px - 2);
  ctx.lineWidth = Math.max(1, px / 8);
  ctx.strokeStyle = "#38bdf8";
  ctx.setLineDash([Math.max(2, px / 4), Math.max(2, px / 4)]);
  moeglich.slice(0, 400).forEach(rahmen);
  ctx.setLineDash([]);
  ctx.lineWidth = Math.max(2, px / 5);
  ctx.strokeStyle = "#facc15";
  letzte.slice(0, 400).forEach(rahmen);
}
