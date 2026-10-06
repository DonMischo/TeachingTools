/**
 * Diffusionsbegrenzte Aggregation (DLA, Witten & Sander 1981).
 *
 * Ein Teilchen startet knapp außerhalb des Haufens und irrt zufällig umher.
 * Kommt es einem festen Teilchen näher als `ANZIEHUNG`, bleibt es mit der
 * Wahrscheinlichkeit `haftung` hängen — und zwar im Abstand `ABSTAND` zu
 * seinem Nachbarn (dem »Elternteil«). Sonst irrt es weiter.
 *
 * Die Parameter (Abstand 1, Anziehung 3, kleinster Schritt 1) und die Idee,
 * in leerem Raum weit zu springen, stammen aus dlaf von Michael Fogleman
 * (github.com/fogleman/dlaf, MIT). Statt eines k-d-Baums nehmen wir Gitter:
 * Ein feines Gitter (Zellgröße = Anziehung) mit Listen für die genaue Suche,
 * dazu eine Leiter grober Belegt-Gitter, die sagen »hier ringsum ist nichts« —
 * dann darf der Wanderer gefahrlos so weit springen.
 *
 * Das feine Gitter ist eine Hash-Tabelle ohne Schlüssel: Kollisionen liefern
 * nur zusätzliche Kandidaten. Die groben Gitter sind dicht und wachsen mit dem
 * Haufen — als Hash-Tabelle meldeten sie wegen Kollisionen fast überall
 * »belegt«, und der Wanderer kroch in Einerschritten.
 *
 * Ein Zufallsweg trifft eine Kugel um seinen Startpunkt gleichverteilt; der
 * Sprung auf diese Kugel ändert also nichts an der Physik, nur am Tempo.
 */

export const ABSTAND = 1;
export const ANZIEHUNG = 3;
const MIN_SCHRITT = 1;
/**
 * Zellgrößen der Belegt-Gitter: Ist eine Zelle samt Nachbarn leer, ist nichts
 * näher als die Zellgröße. Die feinen Zwischenstufen (6, 12 …) lohnen sich vor
 * allem in 3D, wo der Haufen locker ist und kaum eine grobe Zelle leer bleibt.
 */
const STUFEN = [4, 6, 8, 12, 16, 24, 32, 48, 64, 128];

export type Saat = "punkt" | "linie" | "kreis";

export interface DlaOptionen {
  dim: 2 | 3;
  /** Höchstzahl der Teilchen (einschließlich Saat). */
  kapazitaet: number;
  /** Haftwahrscheinlichkeit 0 < p ≤ 1. */
  haftung: number;
  saat: Saat;
  zufall?: number;
  /** Nur kleine Schritte (für die Zeitlupe) — sonst springt der Wanderer im leeren Raum. */
  ohneSpruenge?: boolean;
}

/** kleiner, reproduzierbarer Zufall (mulberry32) */
export function zufallsquelle(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function zweierpotenz(n: number): number {
  let p = 1024;
  while (p < n) p <<= 1;
  return p;
}

function hash(cx: number, cy: number, cz: number): number {
  return (Math.imul(cx, 73856093) ^ Math.imul(cy, 19349663) ^ Math.imul(cz, 83492791)) >>> 0;
}

/** dichtes Belegt-Gitter einer Zellgröße um den Ursprung; wird beim Wachsen neu gebaut */
class Belegung {
  private halb = 0;
  private n = 0;
  private daten = new Uint8Array(0);
  readonly g: number;
  readonly dim: 2 | 3;
  constructor(g: number, dim: 2 | 3) {
    this.g = g;
    this.dim = dim;
  }

  deckt(r: number): boolean {
    return (this.halb - 2) * this.g > r;
  }

  neu(r: number, pos: Float32Array, anzahl: number) {
    this.halb = Math.ceil((r * 1.3 + 8) / this.g) + 2;
    this.n = 2 * this.halb;
    this.daten = new Uint8Array(this.dim === 3 ? this.n ** 3 : this.n ** 2);
    for (let i = 0; i < anzahl; i++) this.setze(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
  }

  setze(x: number, y: number, z: number) {
    const g = this.g, h = this.halb, n = this.n;
    const cx = Math.floor(x / g) + h, cy = Math.floor(y / g) + h, cz = this.dim === 3 ? Math.floor(z / g) + h : 0;
    this.daten[(cz * n + cy) * n + cx] = 1;
  }

  /** Abstand, bis zu dem sicher nichts liegt, wenn die Nachbarschaft leer ist */
  sicher(x: number, y: number, z: number): number {
    const g = this.g;
    const rand = (v: number) => { const r = v - Math.floor(v / g) * g; return Math.min(r, g - r); };
    return g + Math.min(rand(x), rand(y), this.dim === 3 ? rand(z) : g);
  }

  /** Zelle des Punkts samt Nachbarn leer? Außerhalb des Gitters liegt nichts. */
  leer(x: number, y: number, z: number): boolean {
    const g = this.g, h = this.halb, n = this.n, d = this.daten;
    const cx = Math.floor(x / g) + h, cy = Math.floor(y / g) + h;
    const cz = this.dim === 3 ? Math.floor(z / g) + h : 0;
    const dz = this.dim === 3 ? 1 : 0;
    const nz = this.dim === 3 ? n : 1;
    for (let c = cz - dz; c <= cz + dz; c++) {
      if (c < 0 || c >= nz) continue;
      for (let b = cy - 1; b <= cy + 1; b++) {
        if (b < 0 || b >= n) continue;
        const zeile = (c * n + b) * n;
        for (let a = cx - 1; a <= cx + 1; a++) if (a >= 0 && a < n && d[zeile + a]) return false;
      }
    }
    return true;
  }
}

export class Dla {
  readonly dim: 2 | 3;
  readonly kapazitaet: number;
  readonly haftung: number;
  readonly saat: Saat;
  readonly ohneSpruenge: boolean;
  /** x, y, z je Teilchen (z = 0 in 2D) — direkt als three.js-Puffer nutzbar */
  readonly pos: Float32Array;
  /** Index des Teilchens, an dem es hängt; −1 = Wurzel */
  readonly eltern: Int32Array;
  anzahl = 0;
  saatAnzahl = 0;
  /** größter Abstand eines Teilchens vom Ursprung */
  rmax = 0;
  /** gezählte Wanderschritte (für die Anzeige) */
  schritte = 0;
  /** Position des aktuellen Wanderers */
  readonly wanderer = [0, 0, 0];
  private aktiv = false;
  private stufe = 0;
  private readonly rnd: () => number;
  private readonly kopf: Int32Array;
  private readonly naechstes: Int32Array;
  private readonly kopfMaske: number;
  private readonly grob: Belegung[];

  constructor(o: DlaOptionen) {
    this.dim = o.dim;
    this.kapazitaet = o.kapazitaet;
    this.haftung = Math.min(1, Math.max(0.001, o.haftung));
    this.saat = o.saat;
    this.ohneSpruenge = !!o.ohneSpruenge;
    this.rnd = zufallsquelle(o.zufall ?? 1);
    this.pos = new Float32Array(o.kapazitaet * 3);
    this.eltern = new Int32Array(o.kapazitaet);
    const k = zweierpotenz(o.kapazitaet * 4);
    this.kopf = new Int32Array(k).fill(-1);
    this.kopfMaske = k - 1;
    this.naechstes = new Int32Array(o.kapazitaet);
    this.grob = STUFEN.map(g => new Belegung(g, o.dim));
    this.saeen();
  }

  get voll(): boolean {
    return this.anzahl >= this.kapazitaet;
  }

  private saeen() {
    if (this.saat === "punkt") {
      this.hinzu(0, 0, 0, -1);
    } else if (this.saat === "linie") {
      const l = this.dim === 2 ? 60 : 40;
      for (let x = -l; x <= l && !this.voll; x += ABSTAND) this.hinzu(x, 0, 0, x === -l ? -1 : this.anzahl - 1);
    } else {
      const r = this.dim === 2 ? 80 : 50;
      const n = Math.round((2 * Math.PI * r) / ABSTAND);
      for (let i = 0; i < n && !this.voll; i++) {
        const w = (2 * Math.PI * i) / n;
        this.hinzu(r * Math.cos(w), r * Math.sin(w), 0, i === 0 ? -1 : this.anzahl - 1);
      }
    }
    this.saatAnzahl = this.anzahl;
  }

  private hinzu(x: number, y: number, z: number, eltern: number) {
    const i = this.anzahl++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.eltern[i] = eltern;
    const f = this.zelle(x, y, z, ANZIEHUNG) & this.kopfMaske;
    this.naechstes[i] = this.kopf[f];
    this.kopf[f] = i;
    const r = Math.hypot(x, y, z);
    if (r > this.rmax) this.rmax = r;
    for (const b of this.grob) {
      if (b.deckt(r)) b.setze(x, y, z);
      else b.neu(this.rmax, this.pos, this.anzahl);
    }
  }

  private zelle(x: number, y: number, z: number, g: number): number {
    return hash(Math.floor(x / g), Math.floor(y / g), Math.floor(z / g));
  }

  /** nächstes Teilchen innerhalb der Anziehung, sonst −1 */
  private naechster(): [number, number] {
    const [x, y, z] = this.wanderer;
    const g = ANZIEHUNG;
    const cx = Math.floor(x / g), cy = Math.floor(y / g), cz = Math.floor(z / g);
    const dz = this.dim === 3 ? 1 : 0;
    let best = -1, bestD = ANZIEHUNG * ANZIEHUNG;
    const pos = this.pos;
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++)
        for (let c = -dz; c <= dz; c++) {
          for (let i = this.kopf[hash(cx + a, cy + b, cz + c) & this.kopfMaske]; i >= 0; i = this.naechstes[i]) {
            const ex = pos[i * 3] - x, ey = pos[i * 3 + 1] - y, ez = pos[i * 3 + 2] - z;
            const d = ex * ex + ey * ey + ez * ez;
            if (d < bestD) { bestD = d; best = i; }
          }
        }
    return [best, Math.sqrt(bestD)];
  }

  private zufallsrichtung(): [number, number, number] {
    if (this.dim === 2) {
      const w = this.rnd() * 2 * Math.PI;
      return [Math.cos(w), Math.sin(w), 0];
    }
    const z = this.rnd() * 2 - 1;
    const w = this.rnd() * 2 * Math.PI;
    const s = Math.sqrt(1 - z * z);
    return [s * Math.cos(w), s * Math.sin(w), z];
  }

  private bewege(l: number) {
    const [a, b, c] = this.zufallsrichtung();
    this.wanderer[0] += a * l;
    this.wanderer[1] += b * l;
    this.wanderer[2] += c * l;
    this.schritte++;
  }

  private starte() {
    const r = this.rmax + ANZIEHUNG + 2;
    const [a, b, c] = this.zufallsrichtung();
    this.wanderer[0] = a * r;
    this.wanderer[1] = b * r;
    this.wanderer[2] = c * r;
    this.aktiv = true;
  }

  /** Ein Zug des Wanderers. Gibt true zurück, wenn dabei ein Teilchen angewachsen ist. */
  schritt(): boolean {
    if (this.voll) return false;
    if (!this.aktiv) this.starte();
    const w = this.wanderer;
    const d = Math.hypot(w[0], w[1], w[2]);
    // Zu weit weg: neu starten. In der Zeitlupe enger, damit der Wanderer im Bild bleibt.
    if (d > (this.ohneSpruenge ? this.rmax + 20 : Math.max(this.rmax * 2, this.rmax + 60))) {
      this.starte();
      return false;
    }
    if (!this.ohneSpruenge) {
      if (d > this.rmax + ANZIEHUNG + MIN_SCHRITT) {
        this.bewege(Math.max(MIN_SCHRITT, d - this.rmax - ANZIEHUNG));
        return false;
      }
      // Jede leere Stufe ist sicher; gesucht wird ab der Stufe vom letzten Mal.
      const g = this.grob;
      let s = this.stufe;
      if (g[s].leer(w[0], w[1], w[2])) {
        while (s + 1 < g.length && g[s + 1].leer(w[0], w[1], w[2])) s++;
      } else {
        do s--; while (s >= 0 && !g[s].leer(w[0], w[1], w[2]));
      }
      if (s >= 0) {
        this.stufe = s;
        this.bewege(g[s].sicher(w[0], w[1], w[2]) - ANZIEHUNG);
        return false;
      }
      this.stufe = 0;
    }
    const [i, abstand] = this.naechster();
    if (i >= 0 && this.rnd() < this.haftung) {
      const px = this.pos[i * 3], py = this.pos[i * 3 + 1], pz = this.pos[i * 3 + 2];
      const f = abstand > 1e-9 ? ABSTAND / abstand : 0;
      let nx = px + (w[0] - px) * f, ny = py + (w[1] - py) * f, nz = pz + (w[2] - pz) * f;
      if (f === 0) { const [a, b, c] = this.zufallsrichtung(); nx = px + a; ny = py + b; nz = pz + c; }
      this.hinzu(nx, ny, nz, i);
      this.aktiv = false;
      return true;
    }
    this.bewege(MIN_SCHRITT);
    return false;
  }

  /** Wächst bis zur Kapazität, bis `bis` Teilchen da sind oder die Uhr `frist` (performance.now) erreicht. */
  wachse(bis = this.kapazitaet, frist = Infinity): number {
    const vorher = this.anzahl;
    const ziel = Math.min(bis, this.kapazitaet);
    let n = 0;
    while (this.anzahl < ziel) {
      this.schritt();
      if ((++n & 1023) === 0 && performance.now() > frist) break;
    }
    return this.anzahl - vorher;
  }
}

// ── Fraktale Dimension ──────────────────────────────────────────────────────

export interface Dimension {
  /** Stützpunkte (r, N(r)) — N = Teilchen im Abstand ≤ r vom Ursprung */
  punkte: { r: number; n: number }[];
  /** Steigung im log-log-Bild */
  d: number;
}

/**
 * Masse-Radius-Methode: N(r) ~ r^D. Gezählt wird nur im Inneren
 * (bis zur halben Ausdehnung), dort wächst nichts mehr nach.
 */
export function dimension(dla: Dla): Dimension | null {
  const n = dla.anzahl - dla.saatAnzahl;
  if (n < 200 || dla.saat !== "punkt") return null;
  const r = new Float32Array(dla.anzahl);
  for (let i = 0; i < dla.anzahl; i++) r[i] = Math.hypot(dla.pos[i * 3], dla.pos[i * 3 + 1], dla.pos[i * 3 + 2]);
  r.sort();
  const rmin = 4 * ANZIEHUNG, rgross = dla.rmax * 0.5;
  if (rgross < rmin * 2) return null;
  const punkte: { r: number; n: number }[] = [];
  const stufen = 12;
  let j = 0;
  for (let k = 0; k <= stufen; k++) {
    const rr = rmin * Math.pow(rgross / rmin, k / stufen);
    while (j < r.length && r[j] <= rr) j++;
    punkte.push({ r: rr, n: j });
  }
  const xs = punkte.map(p => Math.log(p.r)), ys = punkte.map(p => Math.log(p.n));
  const mx = xs.reduce((s, v) => s + v, 0) / xs.length, my = ys.reduce((s, v) => s + v, 0) / ys.length;
  let z = 0, q = 0;
  for (let i = 0; i < xs.length; i++) { z += (xs[i] - mx) * (ys[i] - my); q += (xs[i] - mx) ** 2; }
  return { punkte, d: z / q };
}

// ── Farben ──────────────────────────────────────────────────────────────────

/** Verlauf vom Kern (tiefblau) über Türkis zu den Spitzen (gold). */
const VERLAUF: [number, number, number, number][] = [
  [0, 0.12, 0.25, 0.75],
  [0.3, 0.1, 0.55, 0.9],
  [0.55, 0.2, 0.75, 0.75],
  [0.8, 0.75, 0.72, 0.45],
  [1, 0.98, 0.84, 0.55],
];

export function farbe(t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < VERLAUF.length; i++) {
    if (x <= VERLAUF[i][0]) {
      const a = VERLAUF[i - 1], b = VERLAUF[i];
      const f = (x - a[0]) / (b[0] - a[0]);
      return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f];
    }
  }
  return [VERLAUF[4][1], VERLAUF[4][2], VERLAUF[4][3]];
}
