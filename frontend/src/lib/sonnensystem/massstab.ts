/**
 * Wie groß und wie weit — in Szeneneinheiten.
 *
 * Maßstabsgetreu sieht man vom Sonnensystem fast nichts: bei einem Abstand,
 * der Neptun noch aufs Bild bringt, ist die Erde kleiner als ein Pixel. Deshalb
 * gibt es Stauchungen, und die Oberfläche sagt jeweils dazu, welche gerade gilt.
 *
 * Übersicht: 14 Einheiten je AE. »Gestaucht« zieht die Abstände mit der
 * Quadratwurzel zusammen, »vergrößert« bläht die Radien auf. Mondbahnen sind
 * dort immer ein Vielfaches des (vergrößerten) Planetenradius, logarithmisch —
 * so liegt Phobos nicht im Mars und Iapetus nicht bei Uranus.
 *
 * Flug: eine Einheit sind 1 000 km. Radien stimmen, Abstände sind 60-fach
 * verkürzt und die Sonne 4-fach verkleinert — sonst dauerte der Flug zum
 * Jupiter Stunden und die Sonne verschluckte den Merkur.
 *
 * Was einen Planeten umkreist — Monde, Raumfahrzeuge, die Lagrangepunkte L1
 * und L2 — bekommt seinen Abstand logarithmisch gestaucht. Nur so liegen ISS,
 * GPS, die geostationäre Bahn, Chandra, der Mond und L2 in dieser Reihenfolge
 * auseinander und nicht alle sechs in derselben Pixelreihe.
 */
import { KM_JE_AE, type Koerper } from "./daten";
import type { Vec3 } from "./bahnen";

export type AbstandsModus = "gestaucht" | "echt";
export type GroessenModus = "vergroessert" | "echt";

export const EINHEITEN_JE_AE = 14;

export function uebersichtAbstand(ae: number, modus: AbstandsModus): number {
  return modus === "echt" ? ae * EINHEITEN_JE_AE : Math.sqrt(ae) * EINHEITEN_JE_AE;
}

/** Streckt einen Ortsvektor (AE) auf den Szenenabstand, die Richtung bleibt. */
export function uebersichtOrt(p: Vec3, modus: AbstandsModus): Vec3 {
  const r = Math.hypot(...p);
  if (r === 0) return [0, 0, 0];
  const f = uebersichtAbstand(r, modus) / r;
  return [p[0] * f, p[1] * f, p[2] * f];
}

const ERDRADIUS = 6_371;

export function uebersichtRadius(k: Koerper, modus: GroessenModus): number {
  if (modus === "echt") return (k.radiusKm / KM_JE_AE) * EINHEITEN_JE_AE;
  if (k.art === "stern") return 2.4;
  return Math.max(0.03, 0.3 * Math.pow(k.radiusKm / ERDRADIUS, 0.45));
}

export function uebersichtMondbahn(mond: Koerper, mutter: Koerper, modus: GroessenModus): number {
  const a = mond.mondBahn!.aKm;
  if (modus === "echt") return (a / KM_JE_AE) * EINHEITEN_JE_AE;
  return uebersichtRadius(mutter, modus) * (1.5 + 0.55 * Math.log2(a / mutter.radiusKm));
}

export const FLUG_KM_JE_EINHEIT = 1_000;
export const FLUG_ABSTANDSTEILER = 60;
export const FLUG_SONNENTEILER = 4;

export function flugOrt(p: Vec3): Vec3 {
  const f = KM_JE_AE / FLUG_KM_JE_EINHEIT / FLUG_ABSTANDSTEILER;
  return [p[0] * f, p[1] * f, p[2] * f];
}

/**
 * Zeichengröße eines Raumfahrzeugs: 40 km statt 100 m.
 *
 * Maßstabsgetreu wäre die ISS auch aus einem Kilometer Abstand kleiner als ein
 * Pixel. Sie ist hier also rund 400-fach aufgeblasen — der Steckbrief nennt
 * die echten Maße.
 */
export const FLUG_SATELLIT_RADIUS = 0.04;

export function flugRadius(k: Koerper): number {
  if (k.art === "satellit") return FLUG_SATELLIT_RADIUS;
  const r = k.radiusKm / FLUG_KM_JE_EINHEIT;
  return k.art === "stern" ? r / FLUG_SONNENTEILER : r;
}

/** Abstand um einen Planeten, logarithmisch gestaucht — für alles, was ihn umkreist. */
export function flugBahnRadius(kmVomMittelpunkt: number, mutter: Koerper): number {
  return flugRadius(mutter) * (1.6 + 0.9 * Math.log2(kmVomMittelpunkt / mutter.radiusKm));
}

export function flugMondbahn(mond: Koerper, mutter: Koerper): number {
  return flugBahnRadius(mond.mondBahn!.aKm, mutter);
}
