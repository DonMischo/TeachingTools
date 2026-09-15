/**
 * Wo steht was? Keplerbahnen für Planeten, vereinfachte Kreise für Monde.
 *
 * Alle Rückgaben sind ekliptikale Koordinaten (J2000): x zeigt zum
 * Frühlingspunkt, z senkrecht aus der Ebene der Erdbahn. Planeten in AE vom
 * Sonnenmittelpunkt, Monde in km vom Mittelpunkt ihres Planeten.
 */
import type { Bahnelemente, Koerper } from "./daten";

export type Vec3 = [number, number, number];

export const J2000 = 2_451_545.0;
const GRAD = Math.PI / 180;

export function julianischerTag(datum: Date): number {
  return datum.getTime() / 86_400_000 + 2_440_587.5;
}

export function datumAusJd(jd: number): Date {
  return new Date((jd - 2_440_587.5) * 86_400_000);
}

/** Löst die Keplergleichung E − e·sin E = M (Bogenmaß) nach E. */
export function loeseKepler(M: number, e: number): number {
  let E = e < 0.8 ? M : Math.PI;
  for (let n = 0; n < 30; n++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

/** Elemente zum Zeitpunkt jd, Winkel im Bogenmaß. */
function elementeZu(b: Bahnelemente, jd: number) {
  const T = (jd - J2000) / 36_525;
  const a = b.a + b.da * T;
  const e = b.e + b.de * T;
  const i = (b.i + b.di * T) * GRAD;
  const L = (b.L + b.dL * T) * GRAD;
  const varpi = (b.varpi + b.dvarpi * T) * GRAD;
  const Omega = (b.Omega + b.dOmega * T) * GRAD;
  return { a, e, i, L, omega: varpi - Omega, Omega, M: L - varpi };
}

/** Punkt auf der Bahnellipse zur exzentrischen Anomalie E, gedreht in die Ekliptik. */
function ellipsenPunkt(a: number, e: number, i: number, omega: number, Omega: number, E: number): Vec3 {
  const xs = a * (Math.cos(E) - e);
  const ys = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(omega), sw = Math.sin(omega);
  const cO = Math.cos(Omega), sO = Math.sin(Omega);
  const ci = Math.cos(i), si = Math.sin(i);
  return [
    (cw * cO - sw * sO * ci) * xs + (-sw * cO - cw * sO * ci) * ys,
    (cw * sO + sw * cO * ci) * xs + (-sw * sO + cw * cO * ci) * ys,
    sw * si * xs + cw * si * ys,
  ];
}

export function heliozentrisch(b: Bahnelemente, jd: number): Vec3 {
  const el = elementeZu(b, jd);
  const M = Math.atan2(Math.sin(el.M), Math.cos(el.M));
  return ellipsenPunkt(el.a, el.e, el.i, el.omega, el.Omega, loeseKepler(M, el.e));
}

/** Die ganze Bahn als geschlossener Linienzug (letzter Punkt = erster). */
export function bahnPunkte(b: Bahnelemente, jd: number, n = 256): Vec3[] {
  const el = elementeZu(b, jd);
  return Array.from({ length: n + 1 }, (_, k) =>
    ellipsenPunkt(el.a, el.e, el.i, el.omega, el.Omega, (2 * Math.PI * k) / n));
}

/** Umlaufzeit aus der großen Halbachse (drittes Keplergesetz), in Tagen. */
export function umlaufTage(b: Bahnelemente): number {
  return 365.25 * Math.pow(b.a, 1.5);
}

/** Kleine, stabile Zahl je Mond — die Startstellung auf seiner Bahn. */
function startwinkel(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 3600;
  return (h / 10) * GRAD;
}

/** Dreht um die x-Achse — so sind Planetenachse und Mondbahnen gekippt. */
export function kippe([x, y, z]: Vec3, grad: number): Vec3 {
  const c = Math.cos(grad * GRAD), s = Math.sin(grad * GRAD);
  return [x, y * c - z * s, y * s + z * c];
}

/**
 * Stellung eines Mondes relativ zu seinem Planeten, in km.
 *
 * Unser Mond nach der Kurzformel aus Meeus (auf etwa ein Grad genau), damit
 * die Mondphasen zum Datum passen. Alle anderen laufen auf Kreisen in der
 * Äquatorebene ihres Planeten.
 */
export function mondVersatz(mond: Koerper, mutter: Koerper, jd: number): Vec3 {
  const d = jd - J2000;
  if (mond.id === "mond") {
    const L = (218.316 + 13.176396 * d) * GRAD;
    const M = (134.963 + 13.064993 * d) * GRAD;
    const F = (93.272 + 13.229350 * d) * GRAD;
    const lon = L + 6.289 * GRAD * Math.sin(M);
    const lat = 5.128 * GRAD * Math.sin(F);
    const r = 385_001 - 20_905 * Math.cos(M);
    return [r * Math.cos(lat) * Math.cos(lon), r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat)];
  }
  const bahn = mond.mondBahn!;
  const winkel = startwinkel(mond.id) + (2 * Math.PI * d) / bahn.umlaufTage;
  const inEbene: Vec3 = kippe([bahn.aKm * Math.cos(winkel), bahn.aKm * Math.sin(winkel), 0], bahn.neigung);
  return kippe(inEbene, mutter.achsneigung);
}

export function abstand(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
