/**
 * Kartennetz: Equal Earth (flächentreu, Standard), Mercator, Globus, Robinson oder Winkel-Tripel.
 *
 * MapLibre kann Web-Mercator und den Globus selbst (echte Längen/Breiten). Für die anderen
 * Netze rechnet der Server die Ebenen um (api/karten_projektion.py, ?projektion=…) und liefert
 * »Schein-Längen/Breiten«, die MapLibre als Bild des Netzes zeichnet. Hier steht dieselbe
 * Rechnung für alles, was der Browser selbst platziert (Nummern, Suchtreffer, Ausschnitt,
 * Partikel, Maßstab) — und für die Rasterkacheln (scripts/fetch-karten.mjs lädt diese Datei).
 * Gespeichert wird immer in echten Längen und Breiten.
 *
 * Robinson kommt aus proj4js, Winkel-Tripel ist die Formel aus PROJ (aitoff.cpp) — beide wie
 * auf dem Server über PROJ, damit Namen und Nummern genau auf den Flächen sitzen.
 */
import proj4 from "proj4";
import type { Ausschnitt } from "./satz";

export type Projektion = "equalearth" | "mercator" | "globus" | "robinson" | "winkeltripel";
export const PROJEKTIONEN: { id: Projektion; name: string; text: string }[] = [
  { id: "equalearth", name: "Equal Earth", text: "flächentreu — Länder in richtiger Größe" },
  { id: "robinson", name: "Robinson", text: "Kompromiss — der Klassiker im Schulatlas" },
  { id: "winkeltripel", name: "Winkel-Tripel", text: "Kompromiss — geringste Gesamtverzerrung" },
  { id: "mercator", name: "Mercator", text: "winkeltreu — Polgebiete stark vergrößert" },
  { id: "globus", name: "Globus", text: "die Erde als Kugel — ohne Verzerrung, zum Drehen" },
];

/** Kartennetze, die MapLibre selbst zeichnet: echte Koordinaten, Mercator-Kacheln, nichts umgerechnet */
export const echt = (p: Projektion = "equalearth") => p === "mercator" || p === "globus";

/** Kürzel der Rasterkacheln je Netz mit Schein-Koordinaten: »/karten/<ebene>-<kürzel>/« */
export const KACHEL_KUERZEL: Partial<Record<Projektion, string>> = { equalearth: "ee", robinson: "robinson", winkeltripel: "winkeltripel" };

const GRAD = Math.PI / 180;

/** Ein Netz in Bogenmaß: (λ, φ) → (x, y) und zurück */
type Netz = { vor: (lam: number, phi: number) => [number, number]; zurueck: (x: number, y: number) => [number, number] | null };

// Equal Earth (Šavrič, Patterson, Jenny 2018)
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = Math.sqrt(3) / 2;
const equalEarth: Netz = {
  vor(lam, phi) {
    const t = Math.asin(M * Math.sin(phi));
    const t2 = t * t, t6 = t2 * t2 * t2;
    return [(lam * Math.cos(t)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))), t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2))];
  },
  zurueck(x, y) {
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
    return [(M * x * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2))) / Math.cos(t), Math.asin(s)];
  },
};

// Robinson: proj4js (Portierung von PROJ, gleiche Stützwerte wie pyproj auf dem Server)
const ROBIN = proj4.Proj("+proj=robin +R=1") as unknown as {
  forward: (p: { x: number; y: number }) => { x: number; y: number };
  inverse: (p: { x: number; y: number }) => { x: number; y: number };
};
const robinson: Netz = {
  vor: (lam, phi) => { const q = ROBIN.forward({ x: lam, y: phi }); return [q.x, q.y]; },
  zurueck: (x, y) => { const q = ROBIN.inverse({ x, y }); return [q.x, q.y]; },
};

// Winkel-Tripel: Mittel aus Aitoff und Plattkarte mit Standardparallel arccos(2/π) (PROJ: +proj=wintri)
const COSPHI1 = 2 / Math.PI;
function winkelVor(lam: number, phi: number): [number, number] {
  const c = lam / 2, d = Math.acos(Math.cos(phi) * Math.cos(c));
  const s = d ? d / Math.sin(d) : 1;
  return [(2 * Math.cos(phi) * Math.sin(c) * s + lam * COSPHI1) / 2, (Math.sin(phi) * s + phi) / 2];
}
const winkel: Netz = {
  vor: winkelVor,
  // Keine geschlossene Umkehrung: Newton-Verfahren, Ableitungen als Differenzenquotient
  zurueck(x, y) {
    let lam = (2 * x) / (1 + COSPHI1), phi = y;
    for (let i = 0; i < 25; i++) {
      const [fx, fy] = winkelVor(lam, phi);
      const ex = fx - x, ey = fy - y;
      if (Math.abs(ex) + Math.abs(ey) < 1e-11) break;
      const h = 1e-7;
      const [ax, ay] = winkelVor(lam + h, phi), [bx, by] = winkelVor(lam, phi + h);
      const j11 = (ax - fx) / h, j21 = (ay - fy) / h, j12 = (bx - fx) / h, j22 = (by - fy) / h;
      const det = j11 * j22 - j12 * j21;
      if (!det) break;
      lam -= (ex * j22 - ey * j12) / det;
      phi = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, phi - (ey * j11 - ex * j21) / det));
    }
    return [lam, phi];
  },
};

const NETZE: Partial<Record<Projektion, Netz>> = { equalearth: equalEarth, robinson, winkeltripel: winkel };
/** x am Äquator bei ±180° — dort liegt der Kartenrand (Schein-Länge ±180) */
const XMAX = Object.fromEntries(Object.entries(NETZE).map(([p, n]) => [p, n.vor(Math.PI, 0)[0]])) as Record<string, number>;

/** Echte [Länge, Breite] → Kartenkoordinaten (bei Mercator und Globus unverändert). */
export function vor([lon, lat]: [number, number] | number[], p: Projektion = "equalearth"): [number, number] {
  const n = NETZE[p];
  if (!n) return [lon, lat];
  const xmax = XMAX[p];
  const [x, y] = n.vor(lon * GRAD, Math.max(-90, Math.min(90, lat)) * GRAD);
  return [(x / xmax) * 180, Math.atan(Math.sinh((y * Math.PI) / xmax)) / GRAD];
}

/** Kartenkoordinaten → echte [Länge, Breite]; null außerhalb der Erde. */
export function zurueck([fx, fy]: [number, number] | number[], p: Projektion = "equalearth"): [number, number] | null {
  const n = NETZE[p];
  if (!n) return [fx, fy];
  const xmax = XMAX[p];
  const x = (fx / 180) * xmax, y = (Math.asinh(Math.tan(fy * GRAD)) * xmax) / Math.PI;
  const q = n.zurueck(x, y);
  if (!q || !Number.isFinite(q[0]) || !Number.isFinite(q[1]) || Math.abs(q[0]) > Math.PI + 1e-6) return null;
  // Außerhalb des Umrisses liefern die Umkehrungen irgendetwas (oder klemmen am Pol): Probe
  const [px, py] = n.vor(q[0], q[1]);
  if (Math.abs(px - x) + Math.abs(py - y) > 1e-6 * xmax) return null;
  return [q[0] / GRAD, q[1] / GRAD];
}

/** Rechteck in echten Koordinaten → umschließendes Rechteck auf der Karte (Kanten abgetastet). */
export function ausschnittVor(a: Ausschnitt, p: Projektion): Ausschnitt {
  if (echt(p)) return a;
  const punkte: [number, number][] = [];
  for (let i = 0; i <= 16; i++) {
    const lon = a.west + ((a.ost - a.west) * i) / 16, lat = a.sued + ((a.nord - a.sued) * i) / 16;
    punkte.push(vor([lon, a.sued], p), vor([lon, a.nord], p), vor([a.west, lat], p), vor([a.ost, lat], p));
  }
  return rahmen(punkte);
}

/** Sichtbares Rechteck der Karte → umschließendes Rechteck in echten Koordinaten. */
export function ausschnittZurueck(a: Ausschnitt, p: Projektion): Ausschnitt {
  if (echt(p)) return a;
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

/** Umriss der Erde im Netz (Meer-Fläche; außerhalb bleibt der Seitenhintergrund). */
export function erdUmriss(p: Projektion = "equalearth"): GeoJSON.Feature {
  const rand: [number, number][] = [];
  for (let lat = -90; lat <= 90; lat += 1) rand.push(vor([180, lat], p));
  for (let lat = 90; lat >= -90; lat -= 1) rand.push(vor([-180, lat], p));
  rand.push(rand[0]);
  return { type: "Feature", geometry: { type: "Polygon", coordinates: [rand] }, properties: {} };
}

/** Großkreisabstand in Metern. */
export function abstand([l1, b1]: [number, number], [l2, b2]: [number, number]): number {
  const s = Math.sin(((b2 - b1) * GRAD) / 2) ** 2 + Math.cos(b1 * GRAD) * Math.cos(b2 * GRAD) * Math.sin(((l2 - l1) * GRAD) / 2) ** 2;
  return 2 * 6371008.8 * Math.asin(Math.sqrt(s));
}
