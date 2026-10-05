/**
 * Equal Earth für die Rasterkacheln — gleiche Rechnung wie src/lib/karten/projektion.ts
 * und api/karten_projektion.py: Schein-Länge/Breite (Web-Mercator) → echte Länge/Breite.
 */
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
const XMAX = Math.PI / (M * A1);
const GRAD = Math.PI / 180;

/** Kartenkoordinaten → echte [Länge, Breite]; null außerhalb der Erde. */
export function eeZurueck(fx, fy) {
  const x = (fx / 180) * XMAX, y = (Math.asinh(Math.tan(fy * GRAD)) * XMAX) / Math.PI;
  let t = y;
  for (let i = 0; i < 12; i++) {
    const t2 = t * t, t6 = t2 * t2 * t2;
    const d = (t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)) - y) / (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2));
    t -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  const s = Math.sin(t) / M;
  if (Math.abs(s) > 1) return null;
  const t2 = t * t, t6 = t2 * t2 * t2;
  const lon = ((M * x * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))) / Math.cos(t)) / GRAD;
  if (Math.abs(lon) > 180) return null;
  return [lon, Math.asin(s) / GRAD];
}
