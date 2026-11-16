/**
 * Kleine 2D-Physik für Wurfspiele (Korbwurf, Feuerwehr): Körper unter Schwerkraft
 * und Stöße gegen Strecken (Boden, Brett, Ring, Hindernisse).
 *
 * Ohne Luftwiderstand fliegt ein Körper exakt auf der Parabel – das ist Absicht,
 * damit Term und Flugbahn übereinstimmen. Der Schritt rechnet die Schwerkraft exakt
 * (x + v·t − g/2·t²), nicht per Euler, sonst läuft die Bahn von der Parabel weg.
 */
export const G = 9.81;

export type Koerper = { x: number; y: number; vx: number; vy: number; r: number };
/** Strecke von (x0|y0) nach (x1|y1); mit Länge 0 ein Punkt (z. B. Ringkante). `dicke` zählt zum Radius. */
export type Strecke = { x0: number; y0: number; x1: number; y1: number; art: string; dicke?: number };

export function schritt(k: Koerper, dt: number, g = G) {
  k.x += k.vx * dt;
  k.y += k.vy * dt - (g / 2) * dt * dt;
  k.vy -= g * dt;
}

/** Stößt k gegen s? Dann herausschieben und die Normalgeschwindigkeit mit Stoßzahl e umkehren. */
export function stoss(k: Koerper, s: Strecke, e = 0.6, reibung = 0.85): boolean {
  const dx = s.x1 - s.x0, dy = s.y1 - s.y0, l2 = dx * dx + dy * dy;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((k.x - s.x0) * dx + (k.y - s.y0) * dy) / l2)) : 0;
  const px = s.x0 + t * dx, py = s.y0 + t * dy;
  let nx = k.x - px, ny = k.y - py;
  const abst = Math.hypot(nx, ny), grenze = k.r + (s.dicke ?? 0);
  if (abst >= grenze) return false;
  if (abst < 1e-9) { nx = -dy; ny = dx; const n = Math.hypot(nx, ny) || 1; nx /= n; ny /= n; if (l2 === 0) { nx = 0; ny = 1; } }
  else { nx /= abst; ny /= abst; }
  k.x = px + nx * grenze; k.y = py + ny * grenze;
  const vn = k.vx * nx + k.vy * ny;
  if (vn < 0) {
    const tx = -ny, ty = nx, vt = k.vx * tx + k.vy * ty;
    k.vx = (-e * vn) * nx + reibung * vt * tx;
    k.vy = (-e * vn) * ny + reibung * vt * ty;
  }
  return true;
}

/** Rechteck als vier Strecken. */
export function rechteck(x0: number, y0: number, x1: number, y1: number, art: string): Strecke[] {
  return [
    { x0, y0, x1, y1: y0, art }, { x0: x1, y0, x1, y1, art },
    { x0: x1, y0: y1, x1: x0, y1, art }, { x0, y0: y1, x1: x0, y1: y0, art },
  ];
}

/** Abwurf auf der Parabel y = a(x + d)² + e im Punkt x0: Geschwindigkeit so, dass der Körper genau ihr folgt. */
export function startAufParabel(a: number, d: number, x0: number, g = G): { vx: number; vy: number } | null {
  if (!(a < 0)) return null;
  const vx = Math.sqrt(-g / (2 * a));
  return { vx, vy: 2 * a * (x0 + d) * vx };
}
