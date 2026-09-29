/**
 * Farbskalen für Temperatur, Dichte, Zustand — als [r, g, b] in 0..1.
 */
import { profilWert, schichtBei } from "./schichten";

type Stufe = [number, [number, number, number]];

function skala(stufen: Stufe[], w: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, w));
  for (let i = 1; i < stufen.length; i++) {
    if (x <= stufen[i][0]) {
      const [a, ca] = stufen[i - 1], [b, cb] = stufen[i];
      const f = (x - a) / (b - a || 1);
      return [ca[0] + (cb[0] - ca[0]) * f, ca[1] + (cb[1] - ca[1]) * f, ca[2] + (cb[2] - ca[2]) * f];
    }
  }
  return stufen[stufen.length - 1][1];
}

/** Glut: dunkelrot → orange → gelb → weiß (wie glühendes Metall). */
export const GLUT: Stufe[] = [
  [0, [0.12, 0.05, 0.2]], [0.2, [0.45, 0.06, 0.25]], [0.45, [0.85, 0.2, 0.1]],
  [0.7, [0.98, 0.6, 0.1]], [0.88, [1, 0.9, 0.4]], [1, [1, 1, 0.9]],
];

/** Mantelgestein: kalt braunrot, heiß gelborange. */
export const MANTEL: Stufe[] = [
  [0, [0.3, 0.12, 0.08]], [0.35, [0.62, 0.2, 0.1]], [0.65, [0.86, 0.38, 0.12]], [1, [1, 0.78, 0.3]],
];

const DICHTE: Stufe[] = [
  [0, [0.27, 0.0, 0.33]], [0.25, [0.23, 0.32, 0.55]], [0.5, [0.13, 0.57, 0.55]], [0.75, [0.37, 0.79, 0.38]], [1, [0.99, 0.91, 0.14]],
];

export function glut(w: number) { return skala(GLUT, w); }
export function mantelFarbe(w: number) { return skala(MANTEL, w); }

export type Farbmodus = "schichten" | "temperatur" | "dichte" | "zustand";

export const FARBMODI: { id: Farbmodus; label: string }[] = [
  { id: "schichten", label: "Schichten" },
  { id: "temperatur", label: "Temperatur" },
  { id: "dichte", label: "Dichte" },
  { id: "zustand", label: "fest / flüssig" },
];

const ZUSTAND_FARBE: Record<string, [number, number, number]> = {
  fest: [0.55, 0.58, 0.64],
  plastisch: [0.93, 0.55, 0.2],
  "flüssig": [0.2, 0.62, 0.95],
};

function hex(h: string): [number, number, number] {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Farbe in einer Tiefe je nach Modus. */
export function farbeBei(modus: Farbmodus, tiefe: number): [number, number, number] {
  if (modus === "temperatur") return glut(profilWert("temperatur", tiefe) / 5600);
  if (modus === "dichte") return skala(DICHTE, (profilWert("dichte", tiefe) - 2.6) / (13.1 - 2.6));
  const s = schichtBei(tiefe);
  if (modus === "zustand") return ZUSTAND_FARBE[s.zustand];
  return hex(s.farbe);
}

export function css([r, g, b]: [number, number, number]) {
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
}
