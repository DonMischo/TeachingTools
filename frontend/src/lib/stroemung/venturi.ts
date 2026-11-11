/**
 * Venturi-Rohr: Kontinuität (A·v = const) und Bernoulli (p + ½ρv² = const).
 * Gegeben sind Volumenstrom, die beiden Durchmesser und der Druck am Auslass;
 * im Diffusor hinter der Engstelle geht ein Teil des Druckgewinns verloren.
 */
import { G, querschnitt } from "./modell";

/** Anteil des Druckabfalls in der Engstelle, der hinterher nicht zurückkommt. */
export const VERLUST = 0.15;

export function venturi(q: number, d1: number, d2: number, dichte: number, pAuslass: number) {
  const v1 = q / querschnitt(d1);
  const v2 = q / querschnitt(d2);
  const dp = 0.5 * dichte * (v2 * v2 - v1 * v1);
  const p1 = pAuslass + VERLUST * dp;
  return { v1, v2, dp, p1, p2: p1 - dp, p3: pAuslass };
}

/** Steighöhe in einem Saugröhrchen an der Engstelle (Zerstäuber), 0 wenn dort Überdruck ist. */
export const steighoehe = (p2: number, dichteFluessigkeit: number) => Math.max(0, -p2 / (dichteFluessigkeit * G));
