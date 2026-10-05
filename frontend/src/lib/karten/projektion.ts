/**
 * Kartennetz: Equal Earth (flächentreu, Standard) oder Mercator.
 *
 * MapLibre kann nur Web-Mercator. Für Equal Earth rechnet der Server die
 * Ebenen um (api/karten_projektion.py, ?projektion=equalearth) und liefert
 * »Schein-Längen/Breiten«, die MapLibre als Equal-Earth-Bild zeichnet. Hier
 * steht dieselbe Rechnung für alles, was der Browser selbst platziert
 * (Nummern, Suchtreffer, Ausschnitt, Partikel, Maßstab). Gespeichert wird
 * immer in echten Längen und Breiten.
 */
import type { Ausschnitt } from "./satz";

export type Projektion = "equalearth" | "mercator";
export const PROJEKTIONEN: { id: Projektion; name: string; text: string }[] = [
  { id: "equalearth", name: "Equal Earth", text: "flächentreu — Länder in richtiger Größe" },
  { id: "mercator", name: "Mercator", text: "winkeltreu — Polgebiete stark vergrößert" },
];

const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
const XMAX = Math.PI / (M * A1);
const GRAD = Math.PI / 180;

/** Echte [Länge, Breite] → Kartenkoordinaten (bei Mercator unverändert). */
export function vor([lon, lat]: [number, number] | number[], p: Projektion = "equalearth"): [number, number] {
  if (p === "mercator") return [lon, lat];
  const t = Math.asin(M * Math.sin(Math.max(-90, Math.min(90, lat)) * GRAD));
  const t2 = t * t, t6 = t2 * t2 * t2;
  const x = (lon * GRAD * Math.cos(t)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
  const y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
  return [(x / XMAX) * 180, Math.atan(Math.sinh((y * Math.PI) / XMAX)) / GRAD];
}

/** Kartenkoordinaten → echte [Länge, Breite]; null außerhalb der Erde (Equal Earth). */
export function zurueck([fx, fy]: [number, number] | number[], p: Projektion = "equalearth"): [number, number] | null {
  if (p === "mercator") return [fx, fy];
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
  if (Math.abs(lon) > 180.0001) return null;
  return [lon, Math.asin(s) / GRAD];
}

/** Rechteck in echten Koordinaten → umschließendes Rechteck auf der Karte (Kanten abgetastet). */
export function ausschnittVor(a: Ausschnitt, p: Projektion): Ausschnitt {
  if (p === "mercator") return a;
  const punkte: [number, number][] = [];
  for (let i = 0; i <= 16; i++) {
    const lon = a.west + ((a.ost - a.west) * i) / 16, lat = a.sued + ((a.nord - a.sued) * i) / 16;
    punkte.push(vor([lon, a.sued], p), vor([lon, a.nord], p), vor([a.west, lat], p), vor([a.ost, lat], p));
  }
  return rahmen(punkte);
}

/** Sichtbares Rechteck der Karte → umschließendes Rechteck in echten Koordinaten. */
export function ausschnittZurueck(a: Ausschnitt, p: Projektion): Ausschnitt {
  if (p === "mercator") return a;
  const punkte: [number, number][] = [];
  for (let i = 0; i <= 16; i++) for (let j = 0; j <= 16; j++) {
    const q = zurueck([a.west + ((a.ost - a.west) * i) / 16, a.sued + ((a.nord - a.sued) * j) / 16], p);
    if (q) punkte.push(q);
  }
  return punkte.length ? rahmen(punkte) : { west: -180, sued: -90, ost: 180, nord: 90 };
}

function rahmen(punkte: [number, number][]): Ausschnitt {
  const xs = punkte.map((q) => q[0]), ys = punkte.map((q) => q[1]);
  return { west: Math.min(...xs), sued: Math.min(...ys), ost: Math.max(...xs), nord: Math.max(...ys) };
}

/** Umriss der Erde in Equal Earth (Meer-Fläche; außerhalb bleibt der Seitenhintergrund). */
export function erdUmriss(): GeoJSON.Feature {
  const rand: [number, number][] = [];
  for (let lat = -90; lat <= 90; lat += 2) rand.push(vor([180, lat]));
  for (let lat = 90; lat >= -90; lat -= 2) rand.push(vor([-180, lat]));
  rand.push(rand[0]);
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [rand] }, properties: {} };
}

/** Großkreisabstand in Metern. */
export function abstand([l1, b1]: [number, number], [l2, b2]: [number, number]): number {
  const s = Math.sin(((b2 - b1) * GRAD) / 2) ** 2 + Math.cos(b1 * GRAD) * Math.cos(b2 * GRAD) * Math.sin(((l2 - l1) * GRAD) / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(s));
}
