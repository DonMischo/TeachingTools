/**
 * Farbcode eines Widerstands (vier Ringe nach IEC 60062): zwei Ziffern,
 * Multiplikator, Toleranz. Gerundet auf zwei gültige Stellen — so wie es auf
 * einem Schulwiderstand auch steht.
 */

export const RINGFARBEN = [
  { name: "schwarz", farbe: "#111111" },
  { name: "braun", farbe: "#7a4a1e" },
  { name: "rot", farbe: "#d32f2f" },
  { name: "orange", farbe: "#f57c00" },
  { name: "gelb", farbe: "#fbc02d" },
  { name: "grün", farbe: "#388e3c" },
  { name: "blau", farbe: "#1976d2" },
  { name: "violett", farbe: "#7b1fa2" },
  { name: "grau", farbe: "#8a8a8a" },
  { name: "weiß", farbe: "#f5f5f5" },
] as const;
const GOLD = { name: "gold", farbe: "#c9a227" };
const SILBER = { name: "silber", farbe: "#c0c0c0" };

export type Ring = { name: string; farbe: string };

export function farbringe(ohm: number): Ring[] {
  if (!(ohm > 0)) return [RINGFARBEN[0], RINGFARBEN[0], RINGFARBEN[0], GOLD];
  let exp = Math.floor(Math.log10(ohm)) - 1;
  let ziffern = Math.round(ohm / 10 ** exp);
  if (ziffern >= 100) { ziffern = Math.round(ziffern / 10); exp++; }
  // Kleiner als 0,1 Ω gibt es mit vier Ringen nicht
  exp = Math.max(-2, Math.min(9, exp));
  const z1 = Math.min(9, Math.floor(ziffern / 10)), z2 = ziffern % 10;
  const mult = exp === -1 ? GOLD : exp === -2 ? SILBER : RINGFARBEN[exp];
  return [RINGFARBEN[z1], RINGFARBEN[z2], mult, GOLD];
}
