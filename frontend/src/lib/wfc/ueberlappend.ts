/**
 * Overlapping Model: Aus einem kleinen Vorlagebild werden alle N×N-Ausschnitte
 * gelernt (auch gedreht und gespiegelt), gezählt und daraus Nachbarschaften
 * abgeleitet: Zwei Ausschnitte dürfen nebeneinander, wenn sie sich in ihrem
 * Überlappungsbereich gleichen. Eine Zelle der Ausgabe hat die Farbe der
 * linken oberen Ecke ihres Ausschnitts.
 */
import { RICHTUNG, type Modell } from "./kern";

export interface Vorlage {
  id: string;
  name: string;
  text: string;
  /** Zeilen aus Farbbuchstaben der Regelmaschine (FARBEN) */
  zeilen: string[];
}

export interface Muster {
  modell: Modell;
  /** Pixel je Muster (N×N, zeilenweise) */
  pixel: string[];
  n: number;
}

function drehe(p: string, n: number): string {
  let s = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) s += p[(n - 1 - x) * n + y];
  return s;
}

function spiegle(p: string, n: number): string {
  let s = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) s += p[y * n + (n - 1 - x)];
  return s;
}

export function lerneMuster(zeilen: string[], n: number, symmetrie: boolean): Muster {
  const h = zeilen.length, b = zeilen[0].length;
  const zaehler = new Map<string, number>();
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < b; x++) {
      let p = "";
      for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) p += zeilen[(y + dy) % h][(x + dx) % b];
      const lagen = [p];
      if (symmetrie) {
        let r = p;
        for (let k = 0; k < 3; k++) { r = drehe(r, n); lagen.push(r); }
        lagen.push(...lagen.map(q => spiegle(q, n)));
      }
      for (const q of lagen) zaehler.set(q, (zaehler.get(q) ?? 0) + 1);
    }
  }
  const pixel = [...zaehler.keys()];
  const gewicht = pixel.map(p => zaehler.get(p)!);
  // Passen p und q, wenn q um (dx,dy) gegen p verschoben liegt?
  const passt = (p: string, q: string, dx: number, dy: number) => {
    for (let y = Math.max(0, dy); y < Math.min(n, n + dy); y++) {
      for (let x = Math.max(0, dx); x < Math.min(n, n + dx); x++) {
        if (p[y * n + x] !== q[(y - dy) * n + (x - dx)]) return false;
      }
    }
    return true;
  };
  const erlaubt = RICHTUNG.map(([dx, dy]) => pixel.map(p => pixel.flatMap((q, j) => (passt(p, q, dx, dy) ? [j] : []))));
  return { modell: { anzahl: pixel.length, gewicht, erlaubt }, pixel, n };
}

/** Farben, die in der Vorlage vorkommen (für den Festlegen-Pinsel) */
export function farbenDerVorlage(zeilen: string[]): string[] {
  return [...new Set(zeilen.join(""))];
}

export const VORLAGEN: Vorlage[] = [
  {
    id: "hoehlen", name: "Höhlen",
    text: "Runde Höhlen im Fels. WFC lernt: Fels grenzt an Fels oder Rand, nie ein Einzelpixel.",
    zeilen: [
      "DDDDDDDDDDDD",
      "DDAAADDDDDDD",
      "DAAAAADDDAAD",
      "DAAAAADDAAAD",
      "DDAAADDDAAAD",
      "DDDADDDDDADD",
      "DDDADDDDDDDD",
      "DDAAAADDDDDD",
      "DAAAAAADDAAD",
      "DDAAAADDAAAA",
      "DDDDDDDDDAAD",
      "DDDDDDDDDDDD",
    ],
  },
  {
    id: "mauer", name: "Ziegelmauer",
    text: "Ziegel im Verband: Jede Reihe ist gegenüber der darunter um einen halben Stein versetzt.",
    zeilen: [
      "NNNNNWNNNNNW",
      "WWWWWWWWWWWW",
      "NNWNNNNNWNNN",
      "WWWWWWWWWWWW",
      "NNNNNWNNNNNW",
      "WWWWWWWWWWWW",
      "NNWNNNNNWNNN",
      "WWWWWWWWWWWW",
    ],
  },
  {
    id: "wege", name: "Wege",
    text: "Schmale Wege mit Abzweigungen — ähnlich einem Labyrinth, aber mit Kreuzungen.",
    zeilen: [
      "BBBBBBBBBBBB",
      "BWWWWWBWWWWB",
      "BWBBBWBWBBWB",
      "BWBBBWWWBBWB",
      "BWWWBBBBBBWB",
      "BBBWBBWWWWWB",
      "BWWWBBWBBBBB",
      "BWBBBBWWWWWB",
      "BWWWWWWBBBWB",
      "BBBBBBBBBBBB",
    ],
  },
  {
    id: "insel", name: "Inseln",
    text: "Wasser, Strand und Wiese: Zwischen Wasser und Wiese liegt immer Sand.",
    zeilen: [
      "UUUUUUUUUUUU",
      "UUUYYYUUUUUU",
      "UUYYGYYUUUUU",
      "UYYGGGYYUUUU",
      "UYGGGGGYUUUU",
      "UYYGGGYYUUYU",
      "UUYYGYYUUYYY",
      "UUUYYYUUUYGY",
      "UUUUUUUUUYYY",
      "UUUUUUUUUUUU",
    ],
  },
  {
    id: "stadt", name: "Stadtplan",
    text: "Häuserblöcke (grau) zwischen Straßen (weiß), ab und zu ein Park (grün).",
    zeilen: [
      "WWWWWWWWWWWW",
      "WAAAWAAAAWGW",
      "WAAAWAAAAWGW",
      "WAAAWWWWWWWW",
      "WWWWWAAWAAAW",
      "WGGGWAAWAAAW",
      "WGGGWAAWAAAW",
      "WWWWWWWWWWWW",
    ],
  },
];
