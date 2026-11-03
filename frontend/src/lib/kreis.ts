/**
 * Formeln am Kreis: Umfang, Fläche, Kreisteile (Bogen, Sektor, Segment, Ring)
 * und die Lage einer Geraden zum Kreis. Winkel in Grad. Reine Rechnung,
 * getestet in tests/kreis.test.tsx.
 */
import type { Pt } from "@/lib/geometrie/skizze";

const RAD = Math.PI / 180;

export const umfang = (r: number) => 2 * Math.PI * r;
export const flaeche = (r: number) => Math.PI * r * r;
/** Länge des Kreisbogens zum Mittelpunktswinkel α */
export const bogen = (r: number, alpha: number) => 2 * Math.PI * r * alpha / 360;
/** Fläche des Kreisausschnitts (Sektors) zum Mittelpunktswinkel α */
export const sektor = (r: number, alpha: number) => Math.PI * r * r * alpha / 360;
/** Sehne zum Mittelpunktswinkel α */
export const sehne = (r: number, alpha: number) => 2 * r * Math.sin(alpha * RAD / 2);
/** Dreieck aus Mittelpunkt und Sehne: ½ · r² · sin α (für α > 180° negativ — dann kommt es beim Segment dazu) */
export const sektorDreieck = (r: number, alpha: number) => r * r * Math.sin(alpha * RAD) / 2;
/** Kreisabschnitt (Segment) = Sektor − Dreieck */
export const segment = (r: number, alpha: number) => sektor(r, alpha) - sektorDreieck(r, alpha);
/** Kreisring zwischen Außenradius R und Innenradius r */
export const ring = (R: number, r: number) => Math.PI * (R * R - r * r);

export type Lage = "sekante" | "tangente" | "passante";
export const LAGE_NAME: Record<Lage, string> = { sekante: "Sekante", tangente: "Tangente", passante: "Passante" };

/** Lage einer Geraden mit Abstand `d` vom Mittelpunkt; `eps` lässt beim Ziehen einrasten. */
export function lage(d: number, r: number, eps = 1e-9): Lage {
  if (Math.abs(d - r) <= eps) return "tangente";
  return d < r ? "sekante" : "passante";
}

/** Länge der Sehne, die eine Gerade im Abstand d herausschneidet (0 ohne Schnitt). */
export const sehneImAbstand = (r: number, d: number) => (d < r ? 2 * Math.sqrt(r * r - d * d) : 0);

/**
 * Gerade durch den Lotfußpunkt `f` (vom Mittelpunkt `m` aus), senkrecht zu MF.
 * Liefert die Schnittpunkte mit dem Kreis (0, 1 oder 2) und den Abstand d.
 */
export function schnitt(m: Pt, r: number, f: Pt, eps = 1e-9) {
  const d = Math.hypot(f.x - m.x, f.y - m.y);
  const l = lage(d, r, eps);
  if (l === "passante") return { d, lage: l, punkte: [] as Pt[] };
  if (l === "tangente") return { d, lage: l, punkte: [f] };
  const n = d > 1e-12 ? { x: (f.x - m.x) / d, y: (f.y - m.y) / d } : { x: 0, y: -1 };
  const t = { x: -n.y, y: n.x }, h = Math.sqrt(r * r - d * d);
  return { d, lage: l, punkte: [{ x: f.x + t.x * h, y: f.y + t.y * h }, { x: f.x - t.x * h, y: f.y - t.y * h }] };
}
