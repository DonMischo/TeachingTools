/**
 * Wo steht was? Keplerbahnen für Planeten und Monde.
 *
 * Alle Rückgaben sind ekliptikale Koordinaten (J2000): x zeigt zum
 * Frühlingspunkt, z senkrecht aus der Ebene der Erdbahn. Planeten in AE vom
 * Sonnenmittelpunkt, Monde in km vom Mittelpunkt ihres Planeten.
 */
import type { Bahnelemente, Koerper } from "./daten";
import mondbahnen from "./mondbahnen.json";

export type Vec3 = [number, number, number];

export const J2000 = 2_451_545.0;

/** Bahnelemente der Monde von JPL Horizons, relativ zu ihrem Planeten. */
interface Mondelemente {
  a: number; e: number; i: number; knoten: number; periapsis: number;
  /** Mittlere Länge zur Epoche und ihre Rate, Grad bzw. Grad je Tag */
  L0: number; nL: number;
  probe: number[];
}
export const MONDBAHNEN = mondbahnen as { epoche: number; probeJd: number; monde: Record<string, Mondelemente> };
const GRAD = Math.PI / 180;

export function julianischerTag(datum: Date): number {
  return datum.getTime() / 86_400_000 + 2_440_587.5;
}

export function datumAusJd(jd: number): Date {
  return new Date((jd - 2_440_587.5) * 86_400_000);
}

/** Löst die Keplergleichung E − e·sin E = M (Bogenmaß) nach E. */
export function loeseKepler(M: number, e: number): number {
  // Erst auf −180 … 180 holen: bei Chandra sind seit J2000 über 3 600 Umläufe
  // aufgelaufen, und mit einer mittleren Anomalie von 22 000 findet das
  // Newton-Verfahren nichts mehr.
  const m = Math.atan2(Math.sin(M), Math.cos(M));
  // Startwert nach Danby. Bei stark exzentrischen Bahnen ist die Ableitung
  // nahe der Periapsis winzig (1 − e), ein voller Newton-Schritt springt dann
  // aus dem Bereich heraus und irrt danach umher — deshalb die Begrenzung.
  let E = e < 0.8 ? m : m + Math.sign(m) * 0.85 * e;
  for (let n = 0; n < 60; n++) {
    const d = (E - e * Math.sin(E) - m) / (1 - e * Math.cos(E));
    E -= Math.max(-1, Math.min(1, d));
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

/**
 * Stellung eines Mondes relativ zu seinem Planeten, in km (ekliptikal, J2000).
 *
 * Die Bahnelemente kommen von JPL Horizons (siehe scripts/fetch-mondbahnen.mjs)
 * und werden mit ihrer mittleren Bewegung fortgeschrieben. Damit steht jeder
 * Mond dort, wo er wirklich steht — auch Tritons rückläufige und die fast
 * polaren Bahnen der Uranusmonde ergeben sich von selbst.
 *
 * Gerechnet wird mit der mittleren Länge: die momentanen Elemente schwanken,
 * die über ein Jahr gemessene Rate läuft dagegen sauber rund. Die abgeleiteten
 * Umlaufzeiten treffen die Lehrbuchwerte auf drei Stellen. Störungen bleiben
 * ungerechnet, über Jahrzehnte wächst der Fehler also langsam.
 *
 * Für unseren Mond steht die genauere Kurzformel aus Meeus da — bei ihm sieht
 * man die Phase, und die muss zum Datum passen.
 */
export function mondVersatz(mond: Koerper, mutter: Koerper, jd: number): Vec3 {
  if (mond.id === "mond") {
    const d = jd - J2000;
    const L = (218.316 + 13.176396 * d) * GRAD;
    const M = (134.963 + 13.064993 * d) * GRAD;
    const F = (93.272 + 13.229350 * d) * GRAD;
    const lon = L + 6.289 * GRAD * Math.sin(M);
    const lat = 5.128 * GRAD * Math.sin(F);
    const r = 385_001 - 20_905 * Math.cos(M);
    return [r * Math.cos(lat) * Math.cos(lon), r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat)];
  }
  const b = MONDBAHNEN.monde[mond.id];
  if (!b) throw new Error(`Keine Bahnelemente für ${mond.id}`);
  // Mittlere Anomalie = mittlere Länge − Periapsis − Knoten.
  const M = ((b.L0 + b.nL * (jd - MONDBAHNEN.epoche) - b.periapsis - b.knoten) % 360) * GRAD;
  const E = loeseKepler(Math.atan2(Math.sin(M), Math.cos(M)), b.e);
  return ellipsenPunkt(b.a, b.e, b.i * GRAD, b.periapsis * GRAD, b.knoten * GRAD, E);
}

/**
 * Wo ein Raumfahrzeug gerade steht, in km relativ zum Planetenmittelpunkt.
 *
 * Anders als bei den Monden sind das keine gemessenen Bahnelemente, sondern
 * die Lehrbuchwerte: Halbachse, Exzentrizität, Neigung und Umlaufzeit. Wo
 * genau ein Satellit heute über der Erde steht, ändert sich ohnehin täglich —
 * was zählt, ist die Höhe, die Neigung und das Tempo.
 *
 * Gekippt wird zweimal: erst um die Bahnneigung gegen den Äquator, dann um die
 * Achsneigung des Planeten. Das zweite Kippen folgt dem Vorzeichen, mit dem
 * szene.ts die Kugel aufstellt — nur so läuft ein geostationärer Satellit auch
 * wirklich über dem gezeichneten Äquator mit.
 */
export function satellitVersatz(sat: Koerper, mutter: Koerper, jd: number): Vec3 {
  const b = sat.satBahn!;
  // Geostationär: derselbe Winkel wie die Drehung des Planeten, also steht er still.
  const u = b.geostationaer
    ? ((jd * 24) / mutter.rotationStunden!) * 2 * Math.PI + b.phase * GRAD
    : ((jd - J2000) * 1440 * 2 * Math.PI) / b.umlaufMinuten + b.phase * GRAD;
  const E = loeseKepler(u, b.e);
  const x = b.aKm * (Math.cos(E) - b.e);
  const y = b.aKm * Math.sqrt(1 - b.e * b.e) * Math.sin(E);
  // Bahnebene: x in der Äquatorebene, y um Neigung plus Achsneigung gekippt.
  const w = (b.neigung + (mutter.achsneigung ?? 0)) * GRAD;
  return [x, y * Math.cos(w), y * Math.sin(w)];
}

export function abstand(a: Vec3, b: Vec3): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}
