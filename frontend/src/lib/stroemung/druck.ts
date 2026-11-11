/**
 * Formeln der Druck-Stationen (Kl. 7/8). Alles in SI: Pa, m, m², N, kg/m³.
 * Rohrnetze mit Strömung rechnet `loeser.ts`; hier steht, was ohne Netz geht.
 */
import { G, P_LUFT } from "./modell";

export interface Fluessigkeit { id: string; name: string; dichte: number; /** Dampfdruck bei 20 °C in Pa */ dampfdruck: number }

export const FLUESSIGKEITEN: Fluessigkeit[] = [
  { id: "suess", name: "Süßwasser", dichte: 1000, dampfdruck: 2340 },
  { id: "meer", name: "Meerwasser", dichte: 1025, dampfdruck: 2300 },
  { id: "totes", name: "Totes Meer", dichte: 1240, dampfdruck: 1800 },
  { id: "oel", name: "Speiseöl", dichte: 920, dampfdruck: 1 },
  { id: "hg", name: "Quecksilber", dichte: 13534, dampfdruck: 0.16 },
];

/** Schweredruck p = ρ·g·h. */
export const schweredruck = (dichte: number, tiefe: number) => dichte * G * tiefe;

/** Luftdruck in der Höhe (barometrische Höhenformel, isotherm, Skalenhöhe 8,4 km). */
export const luftdruckInHoehe = (hoehe: number) => P_LUFT * Math.exp(-hoehe / 8400);

/** Boyle-Mariotte: Volumen einer Luftblase, die bei p0 (absolut) das Volumen v0 hatte. */
export const blasenVolumen = (v0: number, p0: number, p: number) => (v0 * p0) / p;

/** Hydraulische Presse: Pascal — überall derselbe Druck, Kraft ∝ Fläche, Weg ∝ 1/Fläche. */
export function presse(a1: number, a2: number, last: number) {
  const druck = last / a2;
  return { druck, kraft: druck * a1, uebersetzung: a2 / a1 };
}

/**
 * Bremse mit Luftblase: Ehe der Druck p (Überdruck) steht, muss der kleine
 * Kolben die Blase zusammendrücken — zusätzlicher Weg in m.
 */
export const blasenWeg = (blase: number, a1: number, druck: number, luft = P_LUFT) =>
  (blase - blasenVolumen(blase, luft, luft + druck)) / a1;

/** Wie hoch eine Säule steigt, wenn oben der Druck um dp sinkt. */
export const saughoehe = (dp: number, dichte: number) => dp / (dichte * G);

/** Höchste Saughöhe: oben bleibt nur der Dampfdruck der Flüssigkeit. */
export const maxSaughoehe = (f: Fluessigkeit, luft = P_LUFT) => saughoehe(luft - f.dampfdruck, f.dichte);
