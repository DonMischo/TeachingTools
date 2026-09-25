/**
 * Wegsuche wie in Diablo 2: Man klickt irgendwohin, die Figur nimmt den
 * besten Weg drumherum. Ein Raster über der Gegend (frei/besetzt, dazu
 * Kosten je Zelle — Fahrbahn ist »teuer«, also lieber Gehweg), A* mit acht
 * Nachbarn, danach geglättet: Wegpunkte fallen weg, solange man von einem
 * zum übernächsten frei durchsieht. Kein Pixi.
 */
import type { P } from "./geometrie";
import type { Stadt } from "./stadt";

const WURZEL2 = Math.SQRT2;

export class Raster {
  readonly frei: Uint8Array;
  readonly kosten: Float32Array;

  /**
   * `x0/y0`: linke obere Ecke in Metern, `spalten × zeilen` Zellen zu `zelle` Metern.
   * `istFrei(x, y)` für die Zellmitte; `kostenBei` ≥ 1 (1 = normal).
   */
  constructor(
    readonly x0: number, readonly y0: number, readonly spalten: number, readonly zeilen: number, readonly zelle: number,
    istFrei: (x: number, y: number) => boolean, kostenBei: (x: number, y: number) => number = () => 1,
  ) {
    this.frei = new Uint8Array(spalten * zeilen);
    this.kosten = new Float32Array(spalten * zeilen);
    for (let j = 0; j < zeilen; j++) for (let i = 0; i < spalten; i++) {
      const [x, y] = this.mitte(j * spalten + i);
      const k = j * spalten + i;
      this.frei[k] = istFrei(x, y) ? 1 : 0;
      this.kosten[k] = this.frei[k] ? Math.max(1, kostenBei(x, y)) : Infinity;
    }
  }

  /** Zelle zu einem Punkt, -1 außerhalb. */
  zelleVon(x: number, y: number): number {
    const i = Math.floor((x - this.x0) / this.zelle), j = Math.floor((y - this.y0) / this.zelle);
    if (i < 0 || j < 0 || i >= this.spalten || j >= this.zeilen) return -1;
    return j * this.spalten + i;
  }

  mitte(k: number): P {
    return [this.x0 + ((k % this.spalten) + 0.5) * this.zelle, this.y0 + (Math.floor(k / this.spalten) + 0.5) * this.zelle];
  }

  /** Frei und nicht zusätzlich gesperrt (etwa durch andere Menschen)? */
  begehbar(x: number, y: number, gesperrt?: (k: number) => boolean): boolean {
    const k = this.zelleVon(x, y);
    return k >= 0 && this.frei[k] === 1 && !gesperrt?.(k);
  }

  /** Nächste begehbare Zelle zu einem Punkt (Ringsuche), -1 wenn nichts in `maxRing` Zellen. */
  naechsteFreie(x: number, y: number, gesperrt?: (k: number) => boolean, maxRing = 40): number {
    const i0 = Math.floor((x - this.x0) / this.zelle), j0 = Math.floor((y - this.y0) / this.zelle);
    let best = -1, bestD = Infinity;
    for (let r = 0; r <= maxRing; r++) {
      for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) {
        if (Math.max(Math.abs(i - i0), Math.abs(j - j0)) !== r) continue;
        if (i < 0 || j < 0 || i >= this.spalten || j >= this.zeilen) continue;
        const k = j * this.spalten + i;
        if (!this.frei[k] || gesperrt?.(k)) continue;
        const [mx, my] = this.mitte(k);
        const d = Math.hypot(mx - x, my - y);
        if (d < bestD) { bestD = d; best = k; }
      }
      // Im nächsten Ring kann nichts Näheres mehr kommen, sobald wir etwas haben.
      if (best >= 0 && bestD <= r * this.zelle) break;
    }
    return best;
  }

  /** Sieht man von a frei nach b (alle halbe Zelle geprüft)? */
  sicht(a: P, b: P, gesperrt?: (k: number) => boolean): boolean {
    const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.ceil(d / (this.zelle * 0.5)));
    let letzteKosten = -1;
    for (let s = 0; s <= n; s++) {
      const x = a[0] + ((b[0] - a[0]) * s) / n, y = a[1] + ((b[1] - a[1]) * s) / n;
      const k = this.zelleVon(x, y);
      if (k < 0 || !this.frei[k] || gesperrt?.(k)) return false;
      // Nicht über teurere Zellen abkürzen, als der Weg selbst ging (sonst quert man die Straße schräg).
      if (letzteKosten >= 0 && this.kosten[k] > letzteKosten && this.kosten[k] > 1) return false;
      letzteKosten = Math.max(letzteKosten, this.kosten[k]);
    }
    return true;
  }

  /**
   * Bester Weg von `von` nach `nach`: Liste von Wegpunkten (ohne den Start),
   * der letzte ist das Ziel oder — wenn das Ziel besetzt ist — der nächste
   * freie Punkt davor. `null`, wenn es gar keinen Weg gibt.
   */
  suche(von: P, nach: P, gesperrt?: (k: number) => boolean): P[] | null {
    let start = this.zelleVon(von[0], von[1]);
    if (start < 0 || !this.frei[start]) start = this.naechsteFreie(von[0], von[1]);
    if (start < 0) return null;
    let ziel = this.zelleVon(nach[0], nach[1]);
    const zielFrei = ziel >= 0 && this.frei[ziel] === 1 && !gesperrt?.(ziel);
    if (!zielFrei) ziel = this.naechsteFreie(nach[0], nach[1], gesperrt);
    if (ziel < 0) return null;
    const endpunkt: P = zielFrei ? [nach[0], nach[1]] : [...this.mitte(ziel)];
    if (start === ziel) return [endpunkt];

    const n = this.spalten * this.zeilen;
    const g = new Float32Array(n).fill(Infinity);
    const vor = new Int32Array(n).fill(-1);
    const zu = new Uint8Array(n);
    const heap = new Haufen();
    const [zx, zy] = [ziel % this.spalten, Math.floor(ziel / this.spalten)];
    const h = (k: number) => {
      const dx = Math.abs((k % this.spalten) - zx), dy = Math.abs(Math.floor(k / this.spalten) - zy);
      return (Math.max(dx, dy) + (WURZEL2 - 1) * Math.min(dx, dy)) * this.zelle;
    };
    g[start] = 0;
    heap.rein(start, h(start));
    // Das Startfeld darf besetzt sein (man steht ja selbst darauf).
    const offen = (k: number) => this.frei[k] === 1 && (k === ziel || !gesperrt?.(k));
    while (heap.groesse) {
      const k = heap.raus();
      if (zu[k]) continue;
      zu[k] = 1;
      if (k === ziel) break;
      const i = k % this.spalten, j = Math.floor(k / this.spalten);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= this.spalten || nj >= this.zeilen) continue;
        const m = nj * this.spalten + ni;
        if (zu[m] || !offen(m)) continue;
        // Nicht über Ecken schneiden
        if (di && dj && (!offen(j * this.spalten + ni) || !offen(nj * this.spalten + i))) continue;
        const schritt = (di && dj ? WURZEL2 : 1) * this.zelle * (this.kosten[k] + this.kosten[m]) / 2;
        const ng = g[k] + schritt;
        if (ng < g[m]) { g[m] = ng; vor[m] = k; heap.rein(m, ng + h(m)); }
      }
    }
    if (vor[ziel] < 0) {
      // Ziel unerreichbar (etwa ein Laden mitten im Haus, dahinter ein Hof): der
      // erreichte Punkt, der am nächsten dran ist — A* hat dann alles abgesucht.
      let best = -1, bd = Infinity;
      for (let k = 0; k < n; k++) if (zu[k] && k !== start) {
        const [mx, my] = this.mitte(k);
        const d = Math.hypot(mx - nach[0], my - nach[1]);
        if (d < bd) { bd = d; best = k; }
      }
      if (best < 0) return null;
      ziel = best;
      endpunkt[0] = this.mitte(best)[0]; endpunkt[1] = this.mitte(best)[1];
    }
    const zellen: number[] = [];
    for (let k = ziel; k !== start; k = vor[k]) zellen.push(k);
    zellen.reverse();
    const roh: P[] = zellen.map((k) => this.mitte(k));
    roh[roh.length - 1] = endpunkt;
    // Glätten: vom letzten gesetzten Punkt so weit springen, wie man frei sieht.
    const weg: P[] = [];
    let von2: P = von;
    let i = 0;
    while (i < roh.length) {
      let j = roh.length - 1;
      while (j > i && !this.sicht(von2, roh[j], gesperrt)) j--;
      weg.push(roh[j]);
      von2 = roh[j];
      i = j + 1;
    }
    return weg;
  }
}

/** Kleiner Min-Haufen für A*. */
class Haufen {
  private k: number[] = [];
  private w: number[] = [];
  get groesse() { return this.k.length; }
  rein(k: number, w: number) {
    this.k.push(k); this.w.push(w);
    let i = this.k.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.w[p] <= this.w[i]) break;
      this.tausch(i, p); i = p;
    }
  }
  raus(): number {
    const oben = this.k[0];
    const lk = this.k.pop()!, lw = this.w.pop()!;
    if (this.k.length) {
      this.k[0] = lk; this.w[0] = lw;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < this.k.length && this.w[l] < this.w[m]) m = l;
        if (r < this.k.length && this.w[r] < this.w[m]) m = r;
        if (m === i) break;
        this.tausch(i, m); i = m;
      }
    }
    return oben;
  }
  private tausch(a: number, b: number) {
    [this.k[a], this.k[b]] = [this.k[b], this.k[a]];
    [this.w[a], this.w[b]] = [this.w[b], this.w[a]];
  }
}

/**
 * Menschen im Gedränge: jeder hat einen Radius; wer läuft, folgt seinem Weg,
 * wer steht, wird beiseitegeschoben, wenn jemand durch will. Wer lange
 * feststeckt, sucht einen neuen Weg um die anderen herum.
 */
export type Mensch = {
  id: string; x: number; y: number; r: number;
  /** Gehtempo m/s. */
  tempo: number;
  /** Noch abzulaufende Wegpunkte; leer = steht. */
  weg: P[];
  /** Sitzt oder ist festgesetzt: wird nicht geschoben. */
  fest?: boolean;
  /** Seit wann dieser Mensch nicht vorankommt. */
  klemmt?: number;
  /** Wohin er zuletzt wollte (für eine neue Suche beim Klemmen). */
  ziel?: P;
  /** Wurde in diesem Schritt geschoben (für »Lass mich mal durch«). */
  geschoben?: number;
  /** Blickrichtung. */
  winkel?: number;
};

/**
 * Alle einen Schritt weiter. `raster` bestimmt Wände; `gesperrtFuer(m)` kann
 * zusätzlich Zellen sperren (etwa geschlossene Türen). Gibt zurück, wer wen
 * geschoben hat.
 */
export function gedraenge(menschen: Mensch[], dt: number, raster: Raster, t: number): { schieber: string; geschoben: string }[] {
  const schuebe: { schieber: string; geschoben: string }[] = [];
  const frei = (x: number, y: number) => raster.begehbar(x, y);
  // 1. Laufen
  for (const m of menschen) {
    if (m.fest || !m.weg.length) continue;
    const [zx, zy] = m.weg[0];
    const dx = zx - m.x, dy = zy - m.y, d = Math.hypot(dx, dy);
    const s = Math.min(d, m.tempo * dt);
    if (d < 0.05) { m.weg.shift(); continue; }
    const bx = m.x, by = m.y;
    const nx = m.x + (dx / d) * s, ny = m.y + (dy / d) * s;
    m.winkel = Math.atan2(dy, dx);
    // Blockiert ein anderer, der läuft und entgegenkommt? Rechts ausweichen.
    const vorAus = menschen.find((o) => o !== m && Math.hypot(o.x - nx, o.y - ny) < o.r + m.r - 0.02);
    if (vorAus && !vorAus.fest && vorAus.weg.length) {
      const rx = -dy / d, ry = dx / d;
      const ax = m.x + rx * s * 0.8 + (dx / d) * s * 0.3, ay = m.y + ry * s * 0.8 + (dy / d) * s * 0.3;
      if (frei(ax, ay)) { m.x = ax; m.y = ay; }
    } else if (vorAus && !vorAus.fest && !vorAus.weg.length) {
      // Wer steht, wird beiseitegeschoben — quer zu meiner Richtung, auf die freie Seite.
      const rx = -dy / d, ry = dx / d;
      const seite = (vorAus.x - m.x) * rx + (vorAus.y - m.y) * ry >= 0 ? 1 : -1;
      const px = vorAus.x + rx * seite * s * 1.2 + (dx / d) * s * 0.4, py = vorAus.y + ry * seite * s * 1.2 + (dy / d) * s * 0.4;
      const qx = vorAus.x - rx * seite * s * 1.2 + (dx / d) * s * 0.4, qy = vorAus.y - ry * seite * s * 1.2 + (dy / d) * s * 0.4;
      if (frei(px, py) && !stoesst(menschen, vorAus, px, py)) { vorAus.x = px; vorAus.y = py; vorAus.geschoben = t; schuebe.push({ schieber: m.id, geschoben: vorAus.id }); }
      else if (frei(qx, qy) && !stoesst(menschen, vorAus, qx, qy)) { vorAus.x = qx; vorAus.y = qy; vorAus.geschoben = t; schuebe.push({ schieber: m.id, geschoben: vorAus.id }); }
      else {
        // Kein Platz zur Seite (enger Gang): dann rückt er weiter durch.
        const vx = vorAus.x + (dx / d) * s * 1.1, vy = vorAus.y + (dy / d) * s * 1.1;
        if (frei(vx, vy) && !stoesst(menschen, vorAus, vx, vy)) { vorAus.x = vx; vorAus.y = vy; vorAus.geschoben = t; schuebe.push({ schieber: m.id, geschoben: vorAus.id }); }
      }
      if (frei(nx, ny) && !stoesst(menschen, m, nx, ny)) { m.x = nx; m.y = ny; }
    } else if (!vorAus && frei(nx, ny)) { m.x = nx; m.y = ny; }
    else if (vorAus) {
      // An einem, der nicht weicht (sitzt), entlanggleiten: nur den Anteil der
      // Richtung nehmen, der nicht auf ihn zu zeigt.
      const ox = m.x - vorAus.x, oy = m.y - vorAus.y, ol = Math.hypot(ox, oy) || 1;
      const ux = dx / d, uy = dy / d, auf = ux * (ox / ol) + uy * (oy / ol);
      let gx = ux - auf * (ox / ol), gy = uy - auf * (oy / ol);
      const gl = Math.hypot(gx, gy);
      if (gl < 0.05) { gx = -oy / ol; gy = ox / ol; } else { gx /= gl; gy /= gl; }
      const sx = m.x + gx * s, sy = m.y + gy * s;
      if (frei(sx, sy) && !stoesst(menschen, m, sx, sy)) { m.x = sx; m.y = sy; }
    }
    // Vorankommen prüfen
    const weiter = Math.hypot(m.x - bx, m.y - by) > s * 0.3;
    if (weiter) m.klemmt = undefined;
    else m.klemmt ??= t;
    // Lange geklemmt: neuer Weg um die anderen herum.
    if (m.klemmt !== undefined && t - m.klemmt > 0.8) {
      const ziel = m.ziel ?? m.weg[m.weg.length - 1];
      // Andere sperren, so weit wie beide zusammen breit sind.
      const besetzt = new Set<number>();
      for (const o of menschen) if (o !== m) {
        const rr = o.r + m.r + 0.08, z = raster.zelle;
        for (let yy = o.y - rr; yy <= o.y + rr; yy += z) for (let xx = o.x - rr; xx <= o.x + rr; xx += z) {
          if (Math.hypot(xx - o.x, yy - o.y) > rr) continue;
          const k = raster.zelleVon(xx, yy);
          if (k >= 0) besetzt.add(k);
        }
      }
      const neu = raster.suche([m.x, m.y], ziel, (k) => besetzt.has(k));
      if (neu) m.weg = neu;
      m.klemmt = t;
    }
  }
  // 2. Überlappungen auflösen: wer steht, weicht; Sitzende nie.
  for (let i = 0; i < menschen.length; i++) for (let j = i + 1; j < menschen.length; j++) {
    const a = menschen[i], b = menschen[j];
    const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 0.001, zuNah = a.r + b.r - d;
    if (zuNah <= 0.01) continue;
    const ax = dx / d, ay = dy / d;
    // Anteil: der Laufende schiebt, der Stehende wird geschoben.
    const aLaeuft = a.weg.length > 0, bLaeuft = b.weg.length > 0;
    let fa = a.fest ? 0 : b.fest ? 1 : aLaeuft === bLaeuft ? 0.5 : aLaeuft ? 0.2 : 0.8;
    let fb = 1 - fa;
    if (b.fest) { fa = 1; fb = 0; }
    if (a.fest && b.fest) continue;
    const nax = a.x - ax * zuNah * fa, nay = a.y - ay * zuNah * fa;
    const nbx = b.x + ax * zuNah * fb, nby = b.y + ay * zuNah * fb;
    if (fa && frei(nax, nay)) { a.x = nax; a.y = nay; }
    if (fb && frei(nbx, nby)) { b.x = nbx; b.y = nby; }
  }
  return schuebe;
}

function stoesst(menschen: Mensch[], m: Mensch, x: number, y: number) {
  return menschen.some((o) => o !== m && Math.hypot(o.x - x, o.y - y) < o.r + m.r - 0.02);
}

/**
 * Raster der Stadt zwischen zwei Punkten (mit Rand): Häuser sind zu, die
 * Fahrbahn ist teuer außer an Überwegen, Gleise noch teurer — so geht die
 * Figur beim Klicken über Gehwege und quert an Zebrastreifen und Ampeln.
 */
export function stadtRaster(stadt: Stadt, a: P, b: P, rand = 25, zelle = 0.5): Raster {
  // Am festen Gitter ausrichten, damit sich die Zellen merken lassen.
  const x0 = Math.floor((Math.min(a[0], b[0]) - rand) / zelle) * zelle, y0 = Math.floor((Math.min(a[1], b[1]) - rand) / zelle) * zelle;
  const spalten = Math.min(500, Math.ceil((Math.max(a[0], b[0]) + rand - x0) / zelle));
  const zeilen = Math.min(500, Math.ceil((Math.max(a[1], b[1]) + rand - y0) / zelle));
  let jeZelle = KOSTEN.get(stadt);
  if (!jeZelle) { jeZelle = new Map(); KOSTEN.set(stadt, jeZelle); }
  let gemerkt = jeZelle.get(zelle);
  if (!gemerkt) { gemerkt = new Map(); jeZelle.set(zelle, gemerkt); }
  const kosten = (x: number, y: number) => {
    const k = Math.round(x / zelle) * 1_000_003 + Math.round(y / zelle);
    let v = gemerkt!.get(k);
    if (v === undefined) {
      const u = stadt.untergrund(x, y);
      v = u.art === "haus" ? 0 : u.art === "fahrbahn" ? (u.querung && u.querung.art !== "querung" ? 1.5 : 8)
        : u.art === "gleis" ? 12 : u.art === "radweg" ? 2.5 : 1;
      gemerkt!.set(k, v);
    }
    return v;
  };
  return new Raster(x0, y0, spalten, zeilen, zelle, (x, y) => kosten(x, y) > 0, kosten);
}

/** Kosten je Zelle (0 = Haus), je Stadt einmal gerechnet. */
const KOSTEN = new WeakMap<Stadt, Map<number, Map<number, number>>>();
