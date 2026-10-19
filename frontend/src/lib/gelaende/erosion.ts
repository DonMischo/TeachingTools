/**
 * Wassererosion auf dem Gitter, nach der »Simulation« aus
 * terrain-erosion-3-ways von Daniel Andrino (github.com/dandrino, MIT),
 * neu in TypeScript geschrieben. Je Schritt:
 *   Regen → Gefälle → Abtrag oder Ablagerung je nach Transportkraft
 *   → Wasser und Schlamm fließen bergab → zu steile Hänge rutschen
 *   (thermische Erosion) → Verdunstung.
 * Ränder sind offen: Wasser fließt hinaus. Meer schluckt Wasser, Schlamm
 * setzt sich dort ab (Delta).
 *
 * Eigene Ergänzungen: Jahreszeiten (Regenzeit lässt Flüsse anschwellen),
 * Zufluss von außen am Oberlauf des Flusses (gräbt sein Bett weiter), und
 * neue Flüsse, wo sich dauerhaft Wasser sammelt (gleitendes Mittel).
 */
import { zufallsquelle } from "./rauschen";
import type { Gelaende } from "./gelaende";

export interface ErosionsParameter {
  /** Regen je Schritt, 1 = Vorbild */
  regen: number;
  /** Lösekraft, 1 = Vorbild */
  loesen: number;
  /** Böschungswinkel für Rutschen, 1 = Vorbild (kleiner = mehr Rutschen) */
  boeschung: number;
  /** Verdunstung, 1 = Vorbild */
  verdunstung: number;
  /** Stärke der Jahreszeiten 0..1 (0 = immer gleich viel Regen) */
  jahreszeiten: number;
  /** Zufluss am Oberlauf des Flusses, 0 = keiner */
  zufluss: number;
}

export const STANDARD_EROSION: ErosionsParameter = { regen: 1, loesen: 1, boeschung: 1, verdunstung: 1, jahreszeiten: 0.8, zufluss: 1 };

/** Schritte je Jahr (Regenzeit + Trockenzeit) */
export const JAHR = 80;

export interface Erosion {
  n: number;
  /** Höhe in Rechen-Einheiten (Kartenbreite = 200) */
  h: Float64Array;
  wasser: Float64Array;
  schlamm: Float64Array;
  tempo: Float64Array;
  /** Meter je Rechen-Einheit und Höhe der Null: wie im Vorbild läuft die
   *  Rechnung auf Höhen 0..1 bei Kartenbreite 200 — echte Meter wären für
   *  die Konstanten viel zu steil, alles würde nur zerfließen. */
  einheit: number;
  null: number;
  /** Meer in Rechen-Einheiten oder null */
  meer: number | null;
  /** Ausgangshöhe in Metern, zum Vergleich */
  start: Float32Array;
  schritte: number;
  zufall: () => number;
  /** Zellen, an denen der Fluss von außen in die Karte kommt */
  quellen: number[];
  /** gleitendes Mittel der Wassermenge — zeigt, wo dauerhaft Wasser fließt */
  abfluss: Float64Array;
  // Arbeitsfelder
  gx: Float64Array; gy: Float64Array; dh: Float64Array; tmp: Float64Array; tmp2: Float64Array;
}

const BREITE = 200;

export function erosionStart(g: Gelaende, seed = g.wahl.seed): Erosion {
  const n = g.n, N = n * n;
  let lo = Infinity, hi = -Infinity;
  for (let k = 0; k < N; k++) { lo = Math.min(lo, g.hoehe[k]); hi = Math.max(hi, g.hoehe[k]); }
  const einheit = Math.max(1, hi - lo);
  const h = new Float64Array(N);
  for (let k = 0; k < N; k++) h[k] = (g.hoehe[k] - lo) / einheit;
  return {
    n, h, wasser: new Float64Array(N), schlamm: new Float64Array(N), tempo: new Float64Array(N),
    einheit, null: lo, meer: g.meer === null ? null : (g.meer - lo) / einheit, start: Float32Array.from(g.hoehe), schritte: 0,
    zufall: zufallsquelle(seed ^ 0x5eed),
    quellen: quellZellen(g), abfluss: new Float64Array(N),
    gx: new Float64Array(N), gy: new Float64Array(N), dh: new Float64Array(N), tmp: new Float64Array(N), tmp2: new Float64Array(N),
  };
}

/** Oberlauf: der erste Punkt der Flusslinie in der Karte, 3×3 Zellen */
function quellZellen(g: Gelaende): number[] {
  const p = g.flussLinie.find(q => q.x > g.zelle && q.y > g.zelle && q.x < g.breite - g.zelle && q.y < g.breite - g.zelle);
  if (!p) return [];
  const i = Math.floor(p.x / g.zelle), j = Math.floor(p.y / g.zelle), aus: number[] = [];
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const ii = i + a, jj = j + b;
    if (ii >= 0 && jj >= 0 && ii < g.n && jj < g.n) aus.push(jj * g.n + ii);
  }
  return aus;
}

/** Regen-Faktor der Jahreszeit (1 = Mittel) und ob gerade Regenzeit ist */
export function jahreszeit(e: Pick<Erosion, "schritte">, p: Pick<ErosionsParameter, "jahreszeiten"> = STANDARD_EROSION) {
  const phase = (e.schritte % JAHR) / JAHR;
  const faktor = Math.max(0.15, 1 + p.jahreszeiten * Math.sin(phase * Math.PI * 2));
  return { phase, faktor, regenzeit: phase < 0.5 && p.jahreszeiten > 0 };
}

/** zentrale Differenz mit festgeklemmtem Rand */
function gefaelle(a: Float64Array, n: number, gx: Float64Array, gy: Float64Array) {
  for (let j = 0; j < n; j++) {
    const jo = j > 0 ? j - 1 : 0, ju = j < n - 1 ? j + 1 : n - 1;
    for (let i = 0; i < n; i++) {
      const il = i > 0 ? i - 1 : 0, ir = i < n - 1 ? i + 1 : n - 1;
      gx[j * n + i] = 0.5 * (a[j * n + ir] - a[j * n + il]);
      gy[j * n + i] = 0.5 * (a[ju * n + i] - a[jo * n + i]);
    }
  }
}

function bilinear(a: Float64Array, n: number, x: number, y: number): number {
  const fx = Math.max(0, Math.min(n - 1.0001, x)), fy = Math.max(0, Math.min(n - 1.0001, y));
  const i = Math.floor(fx), j = Math.floor(fy), u = fx - i, v = fy - j, k = j * n + i;
  return (a[k] * (1 - u) + a[k + 1] * u) * (1 - v) + (a[k + n] * (1 - u) + a[k + n + 1] * u) * v;
}

/** verteilt jeden Wert auf die vier Zellen um (Zelle + Richtung); was hinausfällt, ist weg */
function verschiebe(a: Float64Array, n: number, gx: Float64Array, gy: Float64Array, aus: Float64Array) {
  aus.fill(0);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i, w = a[k];
    if (w === 0) continue;
    const x = i + gx[k], y = j + gy[k];
    const i0 = Math.floor(x), j0 = Math.floor(y), u = x - i0, v = y - j0;
    const leg = (ii: number, jj: number, f: number) => {
      if (ii >= 0 && jj >= 0 && ii < n && jj < n) aus[jj * n + ii] += w * f;
    };
    leg(i0, j0, (1 - u) * (1 - v));
    leg(i0 + 1, j0, u * (1 - v));
    leg(i0, j0 + 1, (1 - u) * v);
    leg(i0 + 1, j0 + 1, u * v);
  }
  a.set(aus);
}

const KERN = (() => {
  const s = 1.5, r = 4, k: number[] = [];
  let sum = 0;
  for (let i = -r; i <= r; i++) { const w = Math.exp(-(i * i) / (2 * s * s)); k.push(w); sum += w; }
  return k.map(w => w / sum);
})();

function weichzeichnen(a: Float64Array, n: number, tmp: Float64Array, aus: Float64Array) {
  const r = (KERN.length - 1) / 2;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let s = 0;
    for (let q = -r; q <= r; q++) s += KERN[q + r] * a[j * n + Math.max(0, Math.min(n - 1, i + q))];
    tmp[j * n + i] = s;
  }
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    let s = 0;
    for (let q = -r; q <= r; q++) s += KERN[q + r] * tmp[Math.max(0, Math.min(n - 1, j + q)) * n + i];
    aus[j * n + i] = s;
  }
}

/** ein Zeitschritt; gibt den Zustand zurück (verändert ihn an Ort und Stelle) */
export function erosionSchritt(e: Erosion, p: ErosionsParameter = STANDARD_EROSION): Erosion {
  const { n, h, wasser, schlamm, tempo, gx, gy, dh, tmp, tmp2, zufall } = e;
  const N = n * n;
  const zw = BREITE / n;
  const regen = 0.0008 * zw * zw * p.regen;
  const verdunstung = 0.0005 * p.verdunstung;
  const minDelta = 0.05;
  const boeschung = 0.03 * p.boeschung;
  const schwere = 30;
  const kapazitaet = 50;
  const loesen = 0.25 * p.loesen;
  const ablagern = 0.001;

  const jz = jahreszeit(e, p).faktor;
  for (let k = 0; k < N; k++) wasser[k] += zufall() * regen * jz;
  // Zufluss von außen: so viel wie der Regen auf ein Zwanzigstel der Karte
  if (e.quellen.length && p.zufluss > 0) {
    const q = (N * regen * 0.5 * 0.05 * p.zufluss * jz) / e.quellen.length;
    for (const k of e.quellen) wasser[k] += q;
  }

  // Richtung des steilsten Anstiegs, normiert; auf flachem Grund zufällig
  gefaelle(h, n, gx, gy);
  for (let k = 0; k < N; k++) {
    const l = Math.hypot(gx[k], gy[k]);
    if (l < 1e-10) { const w = zufall() * Math.PI * 2; gx[k] = Math.cos(w); gy[k] = Math.sin(w); }
    else { gx[k] /= l; gy[k] /= l; }
  }
  // Höhenunterschied zur Nachbarstelle bergab
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    dh[k] = h[k] - bilinear(h, n, i - gx[k], j - gy[k]);
  }
  for (let k = 0; k < N; k++) {
    const d = dh[k];
    const kap = (Math.max(d, minDelta) / zw) * tempo[k] * wasser[k] * kapazitaet;
    let ab: number;
    if (d < 0) ab = Math.min(d, schlamm[k]);
    else if (schlamm[k] > kap) ab = ablagern * (schlamm[k] - kap);
    else ab = loesen * (schlamm[k] - kap);
    ab = Math.max(-d, ab);
    schlamm[k] -= ab;
    h[k] += ab;
  }
  // bergab fließen: die Richtung ist −Gefälle
  for (let k = 0; k < N; k++) { gx[k] = -gx[k]; gy[k] = -gy[k]; }
  verschiebe(schlamm, n, gx, gy, tmp);
  verschiebe(wasser, n, gx, gy, tmp);

  // Rutschen: wo es steiler als die Böschung ist, glätten
  gefaelle(h, n, gx, gy);
  weichzeichnen(h, n, tmp, tmp2);
  for (let k = 0; k < N; k++) {
    if (Math.hypot(gx[k], gy[k]) / zw > boeschung) h[k] = tmp2[k];
  }

  for (let k = 0; k < N; k++) {
    tempo[k] = schwere * dh[k] / zw;
    wasser[k] *= 1 - verdunstung;
    e.abfluss[k] = e.abfluss[k] * 0.985 + wasser[k] * 0.015;
  }
  if (e.meer !== null) for (let k = 0; k < N; k++) if (h[k] < e.meer) {
    wasser[k] = 0;
    h[k] += schlamm[k];
    schlamm[k] = 0;
  }
  e.schritte++;
  return e;
}

/** Schritte für ein »fertiges« Gelände, wie im Vorbild 1,4 × Kantenlänge */
export const erosionsSchritte = (n: number) => Math.round(1.4 * n);

/**
 * Zellen, in denen dauerhaft viel Wasser fließt (neue Flüsse): das
 * gleitende Mittel liegt weit über dem Mittel der Karte.
 */
export function neueFluesse(e: Erosion, schwelle = 10): Uint8Array {
  const N = e.n * e.n, aus = new Uint8Array(N);
  if (e.schritte < JAHR / 2) return aus;
  let mittel = 0;
  for (let k = 0; k < N; k++) mittel += e.abfluss[k];
  mittel /= N;
  if (!(mittel > 0)) return aus;
  for (let k = 0; k < N; k++) if (e.abfluss[k] > mittel * schwelle && (e.meer === null || e.h[k] >= e.meer)) aus[k] = 1;
  return aus;
}

/**
 * Senken füllen (Priority-Flood, Barnes et al. 2014): Wie hoch stünde
 * Wasser, das nirgends abfließen kann? Rand und Meer sind Abflüsse.
 * Gibt den Wasserspiegel je Zelle zurück (≥ Höhe).
 */
export function spiegel(h: ArrayLike<number>, n: number, meer: number | null): Float64Array {
  const N = n * n, F = new Float64Array(N), zu = new Uint8Array(N);
  const heap: number[] = [];
  const kleiner = (a: number, b: number) => F[a] < F[b];
  const push = (k: number) => {
    heap.push(k);
    let c = heap.length - 1;
    while (c > 0) { const q = (c - 1) >> 1; if (!kleiner(heap[c], heap[q])) break; [heap[c], heap[q]] = [heap[q], heap[c]]; c = q; }
  };
  const pop = () => {
    const top = heap[0], last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = 2 * c + 1, r = l + 1;
        let m = c;
        if (l < heap.length && kleiner(heap[l], heap[m])) m = l;
        if (r < heap.length && kleiner(heap[r], heap[m])) m = r;
        if (m === c) break;
        [heap[m], heap[c]] = [heap[c], heap[m]]; c = m;
      }
    }
    return top;
  };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const k = j * n + i;
    F[k] = h[k];
    if (i === 0 || j === 0 || i === n - 1 || j === n - 1 || (meer !== null && h[k] < meer)) { zu[k] = 1; push(k); }
  }
  while (heap.length) {
    const k = pop(), i = k % n, j = (k - i) / n;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue;
      const q = jj * n + ii;
      if (zu[q]) continue;
      zu[q] = 1;
      F[q] = Math.max(h[q], F[k]);
      push(q);
    }
  }
  return F;
}

/**
 * Gewässer nach der Erosion: 1 = Fluss (dauerhaft viel Wasser), 3 = See
 * (Senke, in der sich Wasser sammelt — läuft sie über, geht der Fluss weiter).
 */
export function gewaesser(e: Erosion): Uint8Array {
  const N = e.n * e.n, aus = neueFluesse(e);
  if (e.schritte < JAHR / 2) return aus;
  const F = spiegel(e.h, e.n, e.meer);
  let mittel = 0;
  for (let k = 0; k < N; k++) mittel += e.abfluss[k];
  mittel /= N;
  // Senke tiefer als 1,5 m und viel Zufluss: ein See
  const tief = 1.5 / e.einheit;
  const nass = new Uint8Array(N);
  for (let k = 0; k < N; k++) if (F[k] - e.h[k] > tief && e.abfluss[k] > mittel * 4) nass[k] = 1;
  // ganze Senke füllen, wenn ein Teil davon nass ist (Flutfüllung über gleichen Spiegel)
  const st: number[] = [];
  for (let k = 0; k < N; k++) if (nass[k]) st.push(k);
  while (st.length) {
    const k = st.pop()!, i = k % e.n, j = (k - i) / e.n;
    aus[k] = 3;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= e.n || jj >= e.n) continue;
      const q = jj * e.n + ii;
      if (aus[q] !== 3 && !nass[q] && F[q] - e.h[q] > tief * 0.3 && Math.abs(F[q] - F[k]) < 1e-9) { nass[q] = 1; st.push(q); }
    }
  }
  // Pfützen unter 20 Zellen sind keine Seen
  const gesehen = new Uint8Array(N);
  for (let k = 0; k < N; k++) {
    if (aus[k] !== 3 || gesehen[k]) continue;
    const teil: number[] = [k];
    gesehen[k] = 1;
    for (let t = 0; t < teil.length; t++) {
      const q = teil[t], i = q % e.n, j = (q - i) / e.n;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= e.n || jj >= e.n) continue;
        const r = jj * e.n + ii;
        if (aus[r] === 3 && !gesehen[r]) { gesehen[r] = 1; teil.push(r); }
      }
    }
    if (teil.length < 20) for (const q of teil) aus[q] = 0;
  }
  return aus;
}

/** schreibt die erodierten Höhen (und neue Flüsse) in ein (kopiertes) Gelände zurück */
export function aufGelaende(e: Erosion, g: Gelaende, mitFluessen = true): Gelaende {
  const hoehe = new Float32Array(e.h.length);
  for (let k = 0; k < hoehe.length; k++) hoehe[k] = e.null + e.h[k] * e.einheit;
  const wasser = Uint8Array.from(g.wasser);
  if (mitFluessen) { const f = gewaesser(e); for (let k = 0; k < f.length; k++) if (f[k] && !wasser[k]) wasser[k] = f[k]; }
  if (g.meer !== null) for (let k = 0; k < hoehe.length; k++) wasser[k] = hoehe[k] < g.meer ? 2 : wasser[k] === 2 ? 0 : wasser[k];
  return { ...g, hoehe, wasser };
}

/** Höhenänderung in Metern gegenüber dem Start (+ = abgelagert) */
export function aenderung(e: Erosion): Float32Array {
  const d = new Float32Array(e.h.length);
  for (let k = 0; k < d.length; k++) d[k] = e.null + e.h[k] * e.einheit - e.start[k];
  return d;
}
