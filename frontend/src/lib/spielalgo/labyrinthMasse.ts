/**
 * Kennzahlen eines fertigen Labyrinths aus `lib/regeln/labyrinth` — damit man
 * die Erzeuger (Backtracker, Prim, Kruskal, Wilson) nicht nur ansieht, sondern
 * vergleicht: Sackgassen, Kreuzungen, Ganglänge und der Weg Start → Ziel.
 */
import { K, type Lab } from "@/lib/regeln/labyrinth";

export interface LabMasse {
  /** Zellen mit genau einem Ausgang */
  sackgassen: number;
  /** Zellen mit drei oder vier Ausgängen */
  kreuzungen: number;
  /** Zellen mit zwei Ausgängen, die geradeaus laufen */
  geraden: number;
  /** kürzester Weg von oben links nach unten rechts in Zellen (−1 = keiner) */
  weg: number;
  /** mittlere Länge eines Ganges zwischen zwei Knoten (Sackgasse/Kreuzung) */
  ganglaenge: number;
}

const offen = (l: Lab, i: number) => l.k[i] !== K.WAND;

/** Ausgänge der Zelle (x|y) in Zellkoordinaten, als Richtungsliste. */
function ausgaenge(l: Lab, x: number, y: number): [number, number][] {
  const R = l.R, cx = 2 * x + 1, cy = 2 * y + 1;
  const a: [number, number][] = [];
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const wx = cx + dx, wy = cy + dy;
    if (wx <= 0 || wy <= 0 || wx >= R - 1 || wy >= R - 1) continue;
    if (offen(l, wy * R + wx)) a.push([dx, dy]);
  }
  return a;
}

export function labyrinthMasse(l: Lab): LabMasse {
  const n = l.n;
  let sackgassen = 0, kreuzungen = 0, geraden = 0, knoten = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const a = ausgaenge(l, x, y);
    if (a.length === 1) sackgassen++;
    else if (a.length >= 3) kreuzungen++;
    else if (a.length === 2 && a[0][0] === -a[1][0] && a[0][1] === -a[1][1]) geraden++;
    if (a.length !== 2) knoten++;
  }
  // Breitensuche Start → Ziel
  const dist = new Int32Array(n * n).fill(-1);
  dist[0] = 0;
  const schlange = [0];
  for (let k = 0; k < schlange.length; k++) {
    const i = schlange[k], x = i % n, y = (i / n) | 0;
    for (const [dx, dy] of ausgaenge(l, x, y)) {
      const j = (y + dy) * n + x + dx;
      if (dist[j] < 0) { dist[j] = dist[i] + 1; schlange.push(j); }
    }
  }
  // Durchgänge zählen: in einem Baum sind es n²−1, Gänge = Kanten zwischen Knoten
  let durchgaenge = 0;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) durchgaenge += ausgaenge(l, x, y).length;
  durchgaenge /= 2;
  const gaenge = Math.max(1, knoten - 1 + (durchgaenge - (n * n - 1)));
  return {
    sackgassen, kreuzungen, geraden,
    weg: dist[n * n - 1] < 0 ? -1 : dist[n * n - 1] + 1,
    ganglaenge: Math.round((durchgaenge / gaenge) * 10) / 10,
  };
}
