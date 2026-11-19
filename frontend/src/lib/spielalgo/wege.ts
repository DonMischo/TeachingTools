/**
 * Wegsuche auf einem Raster mit Geländekosten: Dijkstra, A* und Greedy
 * (gierige Bestensuche) als Generatoren, die nach jeder untersuchten Zelle
 * anhalten. Dazu ein Flowfield: einmal vom Ziel aus rechnen, dann kennt jede
 * Zelle ihre Richtung — praktisch für viele Figuren mit demselben Ziel.
 */

export type Suche = "dijkstra" | "astar" | "greedy";

export interface Feld {
  b: number;
  h: number;
  /** Kosten je Zelle: 0 = Wand (unpassierbar), 1 = Weg, mehr = Sumpf/Wald */
  kosten: Uint8Array;
}

export const ZUSTAND = { NEU: 0, OFFEN: 1, FERTIG: 2 } as const;

export interface SuchStand {
  g: Float64Array;
  vorher: Int32Array;
  zustand: Uint8Array;
  aktuell: number;
  weg: number[];
  besucht: number;
  /** Gesamtkosten des gefundenen Wegs, −1 = keiner */
  wegKosten: number;
  gefunden: boolean;
}

export function neueSuche(f: Feld): SuchStand {
  const n = f.b * f.h;
  return {
    g: new Float64Array(n).fill(Infinity), vorher: new Int32Array(n).fill(-1), zustand: new Uint8Array(n),
    aktuell: -1, weg: [], besucht: 0, wegKosten: -1, gefunden: false,
  };
}

/** Kleiner Binärheap nach Priorität. */
class Heap {
  private a: number[] = [];
  private p: number[] = [];
  get laenge() { return this.a.length; }
  rein(x: number, prio: number) {
    const a = this.a, p = this.p;
    let i = a.push(x) - 1;
    p.push(prio);
    while (i > 0) {
      const e = (i - 1) >> 1;
      if (p[e] <= prio) break;
      a[i] = a[e]; p[i] = p[e];
      i = e;
    }
    a[i] = x; p[i] = prio;
  }
  raus(): number {
    const a = this.a, p = this.p;
    const top = a[0];
    const x = a.pop()!, px = p.pop()!;
    if (a.length) {
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i, mp = px;
        if (l < a.length && p[l] < mp) { m = l; mp = p[l]; }
        if (r < a.length && p[r] < mp) { m = r; mp = p[r]; }
        if (m === i) break;
        a[i] = a[m]; p[i] = p[m];
        i = m;
      }
      a[i] = x; p[i] = px;
    }
    return top;
  }
}

export function nachbarn4(f: Feld, i: number): number[] {
  const x = i % f.b, y = (i / f.b) | 0, r: number[] = [];
  if (x > 0) r.push(i - 1);
  if (x < f.b - 1) r.push(i + 1);
  if (y > 0) r.push(i - f.b);
  if (y < f.h - 1) r.push(i + f.b);
  return r;
}

export function* suche(f: Feld, start: number, ziel: number, art: Suche, s: SuchStand): Generator<string> {
  const zx = ziel % f.b, zy = (ziel / f.b) | 0;
  // Luftlinie in Kästchen (Manhattan, passt zu 4 Richtungen)
  const hh = (i: number) => Math.abs((i % f.b) - zx) + Math.abs(((i / f.b) | 0) - zy);
  const prio = (i: number) => art === "dijkstra" ? s.g[i] : art === "greedy" ? hh(i) : s.g[i] + hh(i) * (1 + 1e-6);
  const offen = new Heap();
  s.g[start] = 0;
  s.zustand[start] = ZUSTAND.OFFEN;
  offen.rein(start, prio(start));
  yield "Start in die offene Liste gelegt.";
  while (offen.laenge) {
    const i = offen.raus();
    if (s.zustand[i] === ZUSTAND.FERTIG) continue; // veralteter Eintrag
    s.zustand[i] = ZUSTAND.FERTIG;
    s.aktuell = i;
    s.besucht++;
    if (i === ziel) {
      for (let k = ziel; k >= 0; k = s.vorher[k]) s.weg.unshift(k);
      s.gefunden = true;
      s.wegKosten = s.g[ziel];
      return `Ziel erreicht: ${s.weg.length} Felder, Kosten ${s.wegKosten}, ${s.besucht} Felder untersucht.`;
    }
    for (const j of nachbarn4(f, i)) {
      const k = f.kosten[j];
      if (!k || s.zustand[j] === ZUSTAND.FERTIG) continue;
      const g = s.g[i] + k;
      if (g < s.g[j]) {
        s.g[j] = g;
        s.vorher[j] = i;
        s.zustand[j] = ZUSTAND.OFFEN;
        offen.rein(j, prio(j));
      }
    }
    yield art === "dijkstra" ? `Feld mit den kleinsten bisherigen Kosten (${s.g[i]}) untersucht.`
      : art === "greedy" ? `Feld, das dem Ziel am nächsten scheint (Luftlinie ${hh(i)}), untersucht.`
      : `Feld mit kleinstem f = g + h = ${s.g[i]} + ${hh(i)} untersucht.`;
  }
  return "Kein Weg: Das Ziel ist eingemauert.";
}

/** Richtungen für das Flowfield (8 Nachbarn). */
export const RICHTUNGEN: [number, number][] = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

export interface Flowfield {
  /** Kosten bis zum Ziel je Zelle (Infinity = unerreichbar) */
  dist: Float64Array;
  /** Index in RICHTUNGEN, −1 = Ziel oder unerreichbar */
  richtung: Int8Array;
}

/** Dijkstra vom Ziel aus über das ganze Feld, dann je Zelle der steilste Abstieg. */
export function flowfield(f: Feld, ziel: number): Flowfield {
  const n = f.b * f.h;
  const dist = new Float64Array(n).fill(Infinity);
  const heap = new Heap();
  dist[ziel] = 0;
  heap.rein(ziel, 0);
  const fertig = new Uint8Array(n);
  while (heap.laenge) {
    const i = heap.raus();
    if (fertig[i]) continue;
    fertig[i] = 1;
    for (const j of nachbarn4(f, i)) {
      // wie bei der Suche: bezahlt wird beim Betreten einer Zelle — von j nach i also kosten[i]
      if (!f.kosten[j]) continue;
      const d = dist[i] + f.kosten[i];
      if (d < dist[j]) { dist[j] = d; heap.rein(j, d); }
    }
  }
  const richtung = new Int8Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (i === ziel || dist[i] === Infinity) continue;
    const x = i % f.b, y = (i / f.b) | 0;
    let best = -1, bd = dist[i];
    RICHTUNGEN.forEach(([dx, dy], r) => {
      const a = x + dx, b = y + dy;
      if (a < 0 || b < 0 || a >= f.b || b >= f.h) return;
      // diagonal nur, wenn beide Ecken frei sind (keine Wandecken schneiden)
      if (dx && dy && (!f.kosten[y * f.b + a] || !f.kosten[b * f.b + x])) return;
      const d = dist[b * f.b + a];
      if (d < bd) { bd = d; best = r; }
    });
    richtung[i] = best;
  }
  return { dist, richtung };
}

/** Einer Zelle im Flowfield bis zum Ziel folgen (für Tests und Figuren). */
export function folge(f: Feld, ff: Flowfield, start: number, max = 10_000): number[] {
  const weg = [start];
  let i = start;
  while (ff.richtung[i] >= 0 && weg.length < max) {
    const [dx, dy] = RICHTUNGEN[ff.richtung[i]];
    i += dy * f.b + dx;
    weg.push(i);
  }
  return weg;
}
