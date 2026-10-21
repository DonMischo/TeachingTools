/**
 * Günstigster Weg über das Gelände (A* auf einem groben Gitter): Steigungen
 * kosten, Wasser kostet viel (Brücke), eine Furt wenig. So laufen alte
 * Straßen um Hügel herum und queren den Fluss an der flachen Stelle.
 */
import { hoeheBei, istWasser, type Gelaende } from "@/lib/gelaende/gelaende";
import { abstand, ausduennen, type P } from "./geometrie";

export interface WegKosten {
  /** Kosten je % Steigung */
  steigung: number;
  /** Kosten je Meter Wasser (Brücke) */
  wasser: number;
  /** zusätzliche Kosten an p (z. B. Altstadt meiden) */
  extra?: (p: P) => number;
  /** Rasterweite in m */
  raster?: number;
}

export function weg(g: Gelaende, von: P, nach: P, k: WegKosten): P[] {
  const r = k.raster ?? 24;
  const m = Math.ceil(g.breite / r) + 1;
  const idx = (p: P) => Math.max(0, Math.min(m - 1, Math.round(p.y / r))) * m + Math.max(0, Math.min(m - 1, Math.round(p.x / r)));
  const pos = (i: number): P => ({ x: (i % m) * r, y: Math.floor(i / m) * r });
  const start = idx(von), ziel = idx(nach);
  const kosten = new Float64Array(m * m).fill(Infinity);
  const vor = new Int32Array(m * m).fill(-1);
  const zu = new Uint8Array(m * m);
  // binärer Heap
  const heap: [number, number][] = [];
  const push = (f: number, i: number) => {
    heap.push([f, i]);
    let c = heap.length - 1;
    while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = 2 * c + 1, rr = l + 1;
        let s = c;
        if (l < heap.length && heap[l][0] < heap[s][0]) s = l;
        if (rr < heap.length && heap[rr][0] < heap[s][0]) s = rr;
        if (s === c) break;
        [heap[s], heap[c]] = [heap[c], heap[s]]; c = s;
      }
    }
    return top;
  };
  const hz = pos(ziel);
  kosten[start] = 0;
  push(0, start);
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  while (heap.length) {
    const [, i] = pop();
    if (zu[i]) continue;
    zu[i] = 1;
    if (i === ziel) break;
    const p = pos(i);
    const hp = hoeheBei(g, p.x, p.y);
    const ix = i % m, iy = Math.floor(i / m);
    for (const [dx, dy] of NB) {
      const jx = ix + dx, jy = iy + dy;
      if (jx < 0 || jy < 0 || jx >= m || jy >= m) continue;
      const j = jy * m + jx;
      if (zu[j]) continue;
      const q = pos(j);
      const d = abstand(p, q);
      const st = (Math.abs(hoeheBei(g, q.x, q.y) - hp) / d) * 100;
      let c = d * (1 + k.steigung * st * st / 10);
      if (istWasser(g, q.x, q.y)) c += d * k.wasser;
      if (k.extra) c += d * k.extra(q);
      const neu = kosten[i] + c;
      if (neu < kosten[j]) {
        kosten[j] = neu;
        vor[j] = i;
        push(neu + abstand(q, hz), j);
      }
    }
  }
  const pfad: P[] = [];
  for (let i = ziel; i >= 0; i = vor[i]) { pfad.push(pos(i)); if (i === start) break; }
  pfad.reverse();
  if (!pfad.length) return [von, nach];
  pfad[0] = von;
  pfad[pfad.length - 1] = nach;
  return glaetten(ausduennen(pfad, r * 1.5));
}

/** Chaikin-Glättung, Enden bleiben fest */
export function glaetten(l: P[], runden = 2): P[] {
  let a = l;
  for (let r = 0; r < runden; r++) {
    if (a.length < 3) return a;
    const b: P[] = [a[0]];
    for (let i = 0; i + 1 < a.length; i++) {
      const p = a[i], q = a[i + 1];
      b.push({ x: p.x * 0.75 + q.x * 0.25, y: p.y * 0.75 + q.y * 0.25 }, { x: p.x * 0.25 + q.x * 0.75, y: p.y * 0.25 + q.y * 0.75 });
    }
    b.push(a[a.length - 1]);
    a = b;
  }
  return a;
}

/** Punkt am Kartenrand in Richtung w (Bogenmaß) von c aus */
export function randPunkt(c: P, w: number, B: number): P {
  const dx = Math.cos(w), dy = Math.sin(w);
  let t = Infinity;
  if (dx > 1e-9) t = Math.min(t, (B - c.x) / dx);
  if (dx < -1e-9) t = Math.min(t, -c.x / dx);
  if (dy > 1e-9) t = Math.min(t, (B - c.y) / dy);
  if (dy < -1e-9) t = Math.min(t, -c.y / dy);
  return { x: c.x + dx * t, y: c.y + dy * t };
}
