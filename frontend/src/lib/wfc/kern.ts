/**
 * Wave Function Collapse — der Kern, nach Maxim Gumin
 * (https://github.com/mxgmn/WaveFunctionCollapse, MIT-Lizenz).
 *
 * Jede Zelle ist anfangs eine »Überlagerung« aller Muster. Ein Schritt:
 *   1. Beobachten: die Zelle mit der kleinsten Entropie (am wenigsten
 *      Möglichkeiten, gewichtet) wählen und zufällig — nach Gewicht — auf
 *      ein Muster festlegen (»Kollaps«).
 *   2. Ausbreiten: Nachbarn verlieren alle Muster, die nicht mehr passen;
 *      das kann weiterlaufen (AC-3 mit Stützzählern wie im Original).
 * Bleibt irgendwo keine Möglichkeit, ist das ein Widerspruch — dann neu.
 *
 * Randbedingungen (»festlegen«): Vor dem Start darf man Zellen auf eine
 * Teilmenge der Muster beschränken; die Ausbreitung sorgt dafür, dass alles
 * andere dazu passt.
 */
import { zufall } from "@/lib/regeln/maschine";

/** Richtungen: rechts, unten, links, oben */
export const RICHTUNG: [number, number][] = [[1, 0], [0, 1], [-1, 0], [0, -1]];
export const gegen = (d: number) => (d + 2) % 4;

export interface Modell {
  anzahl: number;
  gewicht: number[];
  /** erlaubt[d][p]: Muster, die in Richtung d neben p stehen dürfen */
  erlaubt: number[][][];
}

export interface Welle {
  b: number;
  h: number;
  periodisch: boolean;
  modell: Modell;
  /** moeglich[i * anzahl + p] */
  moeglich: Uint8Array;
  zahl: Int32Array;
  /** stuetze[(i * anzahl + p) * 4 + d]: wie viele Muster des Nachbarn in Richtung d p noch erlauben */
  stuetze: Int32Array;
  summeW: Float64Array;
  summeWlogW: Float64Array;
  rng: () => number;
  /** Zelle ohne Möglichkeit — dann ist der Lauf gescheitert */
  widerspruch: number | null;
  fertig: boolean;
  /** zuletzt festgelegte Zelle (zum Hervorheben) */
  letzte: number | null;
  schritte: number;
  /** vom Benutzer festgelegte Zellen */
  fest: Set<number>;
}

export function neueWelle(modell: Modell, b: number, h: number, seed: number, periodisch = false): Welle {
  const n = b * h, T = modell.anzahl;
  const w: Welle = {
    b, h, periodisch, modell,
    moeglich: new Uint8Array(n * T).fill(1),
    zahl: new Int32Array(n).fill(T),
    stuetze: new Int32Array(n * T * 4),
    summeW: new Float64Array(n),
    summeWlogW: new Float64Array(n),
    rng: zufall(seed),
    widerspruch: null, fertig: false, letzte: null, schritte: 0,
    fest: new Set(),
  };
  let sw = 0, swl = 0;
  for (let p = 0; p < T; p++) { sw += modell.gewicht[p]; swl += modell.gewicht[p] * Math.log(modell.gewicht[p]); }
  for (let i = 0; i < n; i++) {
    w.summeW[i] = sw;
    w.summeWlogW[i] = swl;
    for (let p = 0; p < T; p++) {
      for (let d = 0; d < 4; d++) w.stuetze[(i * T + p) * 4 + d] = modell.erlaubt[gegen(d)][p].length;
    }
  }
  return w;
}

function nachbar(w: Welle, i: number, d: number): number {
  let x = i % w.b, y = (i - x) / w.b;
  x += RICHTUNG[d][0];
  y += RICHTUNG[d][1];
  if (w.periodisch) { x = (x + w.b) % w.b; y = (y + w.h) % w.h; }
  else if (x < 0 || y < 0 || x >= w.b || y >= w.h) return -1;
  return y * w.b + x;
}

/** Muster p an Zelle i verbieten und die Folgen ausbreiten. */
function verbiete(w: Welle, stapel: number[], i: number, p: number) {
  const T = w.modell.anzahl;
  if (!w.moeglich[i * T + p]) return;
  w.moeglich[i * T + p] = 0;
  for (let d = 0; d < 4; d++) w.stuetze[(i * T + p) * 4 + d] = 0;
  w.zahl[i]--;
  const g = w.modell.gewicht[p];
  w.summeW[i] -= g;
  w.summeWlogW[i] -= g * Math.log(g);
  if (w.zahl[i] === 0 && w.widerspruch === null) w.widerspruch = i;
  stapel.push(i, p);
}

function ausbreiten(w: Welle, stapel: number[]) {
  const T = w.modell.anzahl;
  while (stapel.length && w.widerspruch === null) {
    const p = stapel.pop()!, i = stapel.pop()!;
    for (let d = 0; d < 4; d++) {
      const j = nachbar(w, i, d);
      if (j < 0) continue;
      for (const q of w.modell.erlaubt[d][p]) {
        const k = (j * T + q) * 4 + d;
        if (w.stuetze[k] <= 0) continue;
        w.stuetze[k]--;
        if (w.stuetze[k] === 0) verbiete(w, stapel, j, q);
      }
    }
  }
}

/**
 * Zelle i auf die erlaubten Muster beschränken (Randbedingung).
 * `false`, wenn das sofort einen Widerspruch ergibt.
 */
export function festlegen(w: Welle, i: number, erlaubt: (p: number) => boolean): boolean {
  const T = w.modell.anzahl;
  const stapel: number[] = [];
  for (let p = 0; p < T; p++) if (w.moeglich[i * T + p] && !erlaubt(p)) verbiete(w, stapel, i, p);
  w.fest.add(i);
  ausbreiten(w, stapel);
  return w.widerspruch === null;
}

export function entropie(w: Welle, i: number): number {
  return Math.log(w.summeW[i]) - w.summeWlogW[i] / w.summeW[i];
}

/** Ein Schritt: beobachten + ausbreiten. */
export function schritt(w: Welle): "weiter" | "fertig" | "widerspruch" {
  if (w.widerspruch !== null) return "widerspruch";
  if (w.fertig) return "fertig";
  const T = w.modell.anzahl;
  let beste = -1, min = Infinity;
  for (let i = 0; i < w.zahl.length; i++) {
    if (w.zahl[i] <= 1) continue;
    const e = entropie(w, i) + w.rng() * 1e-6;
    if (e < min) { min = e; beste = i; }
  }
  if (beste < 0) { w.fertig = true; w.letzte = null; return "fertig"; }
  // nach Gewicht ziehen
  let summe = 0;
  for (let p = 0; p < T; p++) if (w.moeglich[beste * T + p]) summe += w.modell.gewicht[p];
  let r = w.rng() * summe, wahl = -1;
  for (let p = 0; p < T; p++) {
    if (!w.moeglich[beste * T + p]) continue;
    r -= w.modell.gewicht[p];
    wahl = p;
    if (r <= 0) break;
  }
  const stapel: number[] = [];
  for (let p = 0; p < T; p++) if (p !== wahl && w.moeglich[beste * T + p]) verbiete(w, stapel, beste, p);
  ausbreiten(w, stapel);
  w.letzte = beste;
  w.schritte++;
  return w.widerspruch !== null ? "widerspruch" : "weiter";
}

/** Das (einzige) Muster einer Zelle, sonst −1 */
export function muster(w: Welle, i: number): number {
  if (w.zahl[i] !== 1) return -1;
  const T = w.modell.anzahl;
  for (let p = 0; p < T; p++) if (w.moeglich[i * T + p]) return p;
  return -1;
}

/** Bis zum Ende; bei Widerspruch bis zu `versuche` Mal mit neuem Zufall (Randbedingungen neu anwenden). */
export function loese(
  bauen: (seed: number) => Welle | null, seed: number, versuche = 20,
): { welle: Welle | null; versuche: number } {
  for (let v = 0; v < versuche; v++) {
    const w = bauen(seed + v * 7919);
    if (!w) continue;
    let s: ReturnType<typeof schritt> = "weiter";
    while (s === "weiter") s = schritt(w);
    if (s === "fertig") return { welle: w, versuche: v + 1 };
  }
  return { welle: null, versuche };
}
