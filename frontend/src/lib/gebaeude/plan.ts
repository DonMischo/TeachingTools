/**
 * Grundriss eines Gebäudes mit Stockwerken — gewachsen aus den Regeln des
 * Regel-Labors.
 *
 * Jedes Stockwerk ist ein Labyrinth aus der Wachstumsregel `WBB=WAW`: von
 * einer weißen Kreuzung aus wächst der Flur zwei Felder weit ins Schwarze;
 * das Stück dazwischen wird grau, damit nur Kreuzungen weiterwachsen. Das
 * ergibt einen Baum mit vielen kurzen Sackgassen — und jede Sackgasse ist
 * ein Zimmer mit genau einer Tür. Die weiteste Sackgasse wird das
 * Treppenhaus; das Stockwerk darüber beginnt genau dort.
 *
 * Reine Rechnung ohne Zeichnen und ohne Wissen über Exitgames: Wer das
 * Gebäude nutzt (Exitgame, später Verkehr oder Rock your Life), sagt nur,
 * wie viele Zimmer jedes Stockwerk braucht.
 */
import { laufeDurch, programm, starte } from "@/lib/regeln/maschine";

export type Punkt = [number, number];

export const REGELN = "eins: WBB=WAW";

export interface Raum {
  /** Rasterfeld des Zimmers (Sackgasse) */
  x: number;
  y: number;
  /** das Flurfeld davor — hier steht die Tür */
  tuer: Punkt;
}

export interface Stockwerk {
  /** true = begehbar */
  boden: boolean[];
  start: Punkt;
  /** Treppe nach oben bzw. Ausgang im obersten Stock */
  ziel: Punkt;
  raeume: Raum[];
}

export interface Plan {
  /** Seitenlänge des Rasters (für alle Stockwerke gleich, damit sie übereinanderpassen) */
  R: number;
  stockwerke: Stockwerk[];
}

const NACHBARN: Punkt[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function begehbar(R: number, st: Stockwerk, [x, y]: Punkt): boolean {
  return x >= 0 && y >= 0 && x < R && y < R && st.boden[y * R + x];
}

/** Abstände (in Feldern) von `von` zu allen begehbaren Feldern; −1 = unerreichbar. */
export function abstaende(R: number, st: Stockwerk, von: Punkt): Int32Array {
  const d = new Int32Array(R * R).fill(-1);
  d[von[1] * R + von[0]] = 0;
  const schlange: Punkt[] = [von];
  for (let i = 0; i < schlange.length; i++) {
    const [x, y] = schlange[i];
    for (const [dx, dy] of NACHBARN) {
      const p: Punkt = [x + dx, y + dy];
      if (begehbar(R, st, p) && d[p[1] * R + p[0]] < 0) {
        d[p[1] * R + p[0]] = d[y * R + x] + 1;
        schlange.push(p);
      }
    }
  }
  return d;
}

/** Kürzester Weg (ohne das Startfeld, mit dem Zielfeld); leer, wenn keiner. */
export function weg(R: number, st: Stockwerk, von: Punkt, nach: Punkt): Punkt[] {
  if (!begehbar(R, st, nach)) return [];
  const d = abstaende(R, st, nach);
  if (d[von[1] * R + von[0]] < 0) return [];
  const aus: Punkt[] = [];
  let p = von;
  while (p[0] !== nach[0] || p[1] !== nach[1]) {
    const hier = d[p[1] * R + p[0]];
    p = NACHBARN.map(([dx, dy]) => [p[0] + dx, p[1] + dy] as Punkt)
      .find(q => begehbar(R, st, q) && d[q[1] * R + q[0]] === hier - 1)!;
    aus.push(p);
  }
  return aus;
}

/** Ein Stockwerk wachsen lassen; `null`, wenn es nicht genug Sackgassen gibt. */
function stockwerk(R: number, start: Punkt, zimmer: number, seed: number): Stockwerk | null {
  const p = programm(REGELN);
  const lauf = starte(p, { b: R, h: R, grund: "B" }, seed);
  lauf.raster.z[start[1] * R + start[0]] = "W";
  laufeDurch(p, lauf);
  const st: Stockwerk = { boden: lauf.raster.z.map(c => c !== "B"), start, ziel: start, raeume: [] };

  // Sackgassen: Kreuzungsfelder mit genau einem offenen Nachbarn
  const d = abstaende(R, st, start);
  const sackgassen: { p: Punkt; tuer: Punkt; d: number }[] = [];
  for (let y = 1; y < R; y += 2) {
    for (let x = 1; x < R; x += 2) {
      if (x === start[0] && y === start[1]) continue;
      const offen = NACHBARN.map(([dx, dy]) => [x + dx, y + dy] as Punkt).filter(q => begehbar(R, st, q));
      if (offen.length === 1) sackgassen.push({ p: [x, y], tuer: offen[0], d: d[y * R + x] });
    }
  }
  if (sackgassen.length < zimmer + 1) return null;
  sackgassen.sort((a, b) => a.d - b.d);
  const ziel = sackgassen.pop()!;
  st.ziel = ziel.p;
  // Gleichmäßig verteilt auswählen, nach Entfernung sortiert: Zimmer 1 liegt am nächsten.
  for (let i = 0; i < zimmer; i++) {
    const s = sackgassen[Math.floor(((i + 0.5) * sackgassen.length) / zimmer)];
    st.raeume.push({ x: s.p[0], y: s.p[1], tuer: s.tuer });
  }
  return st;
}

/**
 * Baut das Gebäude: `zimmer[i]` Zimmer im Stockwerk i. Gleicher Seed,
 * gleiches Gebäude — die ganze Klasse läuft durch dasselbe Haus.
 */
export function bauePlan(zimmer: number[], seed: number): Plan {
  const meiste = Math.max(1, ...zimmer);
  // Etwa jede dritte Kreuzung wird eine Sackgasse; großzügig anfangen.
  let n = Math.max(4, Math.ceil(Math.sqrt((meiste + 2) * 3.2)));
  for (; n <= 25; n++) {
    const R = 2 * n + 1;
    const stockwerke: Stockwerk[] = [];
    let start: Punkt = [1, 1];
    for (let i = 0; i < zimmer.length; i++) {
      // Mehrere Versuche je Größe, bevor das Haus wächst
      let st: Stockwerk | null = null;
      for (let v = 0; v < 6 && !st; v++) st = stockwerk(R, start, zimmer[i], seed * 131 + i * 17 + v);
      if (!st) break;
      stockwerke.push(st);
      start = st.ziel;
    }
    if (stockwerke.length === zimmer.length) return { R, stockwerke };
  }
  throw new Error("Gebäude zu groß");
}
