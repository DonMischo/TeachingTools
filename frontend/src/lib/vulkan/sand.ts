/**
 * Ausbruch zum Zusehen: fallender Sand nach dem Vorbild von »Sandspiel«
 * (Max Bittker, github.com/MaxBittker/sandspiel, MIT) — neu in TypeScript
 * geschrieben, kein Code übernommen. Ein grobes Zellgitter liegt über dem
 * Querschnitt; jede Zelle ist leer oder trägt ein Teilchen:
 *
 *   Gas      heiß, steigt in der Säule auf, kühlt ab und verschwindet
 *   Asche    steigt heiß in der Eruptionssäule auf, breitet sich oben als
 *            Schirm aus, treibt mit dem Wind und rieselt langsam herab
 *   Lapilli  Wurfschlacke und Bomben: fliegen auf Wurfparabeln, rollen am Hang
 *   Lava     Lavafontäne (dünnflüssiges Magma), glüht und fällt als Spritzer
 *   Glut     Glutlawine (pyroklastischer Strom): fällt die Säule in sich
 *            zusammen, rast die heiße Wolke den Hang hinab
 *
 * Gelandete Teilchen bleiben kurz liegen und verschwinden dann — die echte
 * Ablagerung rechnet das Vulkanmodell (die Oberfläche wächst mit).
 * Dazu die Aschewolke von oben (Teilchen auf der Karte, treiben mit dem Wind).
 */
import { zufallsquelle } from "@/lib/gelaende/rauschen";

export const LEER = 0, GAS = 1, ASCHE = 2, LAPILLI = 3, LAVA = 4, GLUT = 5;

export interface Quelle {
  /** Schlot in Gitterzellen */
  x: number;
  y: number;
  /** Explosivität 0..1: Menge von Gas und Asche, Höhe der Säule */
  explosiv: number;
  /** Lavafontäne 0..1 */
  lava: number;
  /** Säule bricht zusammen → Glutlawinen */
  glut: boolean;
  /** Schlot im flachen Meer: viel Wasserdampf, die Säule beginnt an der Wasseroberfläche */
  dampf?: boolean;
}

export interface Sand {
  W: number;
  H: number;
  art: Uint8Array;
  /** 0..255: heiß = Auftrieb und Glut */
  hitze: Uint8Array;
  /** Schritte, die das Teilchen schon liegt */
  liegt: Uint8Array;
  vx: Float32Array;
  vy: Float32Array;
  /** Farbstreuung je Teilchen (wie in Sandspiel) */
  ton: Uint8Array;
  /** zuletzt bewegt in Takt … (verhindert Doppelzüge) */
  zug: Uint8Array;
  /** erste feste Zeile je Spalte (Oberfläche) */
  boden: Int16Array;
  /** Wind entlang des Schnitts in Zellen je Schritt (+ = nach rechts) */
  wind: number;
  quelle: Quelle | null;
  /** Höhe der Säule (Zeile, ab der sich der Schirm ausbreitet) */
  schirm: number;
  takt: number;
  zufall: () => number;
  anzahl: number;
}

export function sandStart(W: number, H: number, seed = 1): Sand {
  const N = W * H;
  return {
    W, H, art: new Uint8Array(N), hitze: new Uint8Array(N), liegt: new Uint8Array(N),
    vx: new Float32Array(N), vy: new Float32Array(N), ton: new Uint8Array(N), zug: new Uint8Array(N),
    boden: new Int16Array(W).fill(H), wind: 0, quelle: null, schirm: 0, takt: 1, zufall: zufallsquelle(seed), anzahl: 0,
  };
}

/** Oberfläche setzen; Teilchen, die nun im Boden stecken, verschwinden (überdeckt) */
export function setzeBoden(s: Sand, boden: ArrayLike<number>) {
  for (let i = 0; i < s.W; i++) {
    s.boden[i] = Math.max(0, Math.min(s.H, Math.floor(boden[i])));
    for (let j = s.boden[i]; j < s.H; j++) if (s.art[j * s.W + i]) loeschen(s, j * s.W + i);
  }
}

const fest = (s: Sand, i: number, j: number) => i < 0 || i >= s.W || j >= s.H || j >= s.boden[i];
const frei = (s: Sand, i: number, j: number) => j >= 0 && !fest(s, i, j) && s.art[j * s.W + i] === LEER;

function loeschen(s: Sand, k: number) {
  if (s.art[k]) s.anzahl--;
  s.art[k] = LEER; s.hitze[k] = 0; s.liegt[k] = 0; s.vx[k] = 0; s.vy[k] = 0;
}

function setzen(s: Sand, i: number, j: number, art: number, hitze: number, vx = 0, vy = 0): boolean {
  if (!frei(s, i, j)) return false;
  const k = j * s.W + i;
  s.art[k] = art; s.hitze[k] = hitze; s.vx[k] = vx; s.vy[k] = vy; s.liegt[k] = 0;
  s.ton[k] = (s.zufall() * 255) | 0; s.zug[k] = s.takt;
  s.anzahl++;
  return true;
}

/** Teilchen von k nach (i, j) ziehen; false, wenn dort etwas ist */
function ziehe(s: Sand, k: number, i: number, j: number): number {
  if (!frei(s, i, j)) return -1;
  const q = j * s.W + i;
  s.art[q] = s.art[k]; s.hitze[q] = s.hitze[k]; s.liegt[q] = 0; s.vx[q] = s.vx[k]; s.vy[q] = s.vy[k]; s.ton[q] = s.ton[k];
  s.zug[q] = s.takt;
  s.art[k] = LEER; s.hitze[k] = 0; s.liegt[k] = 0; s.vx[k] = 0; s.vy[k] = 0;
  return q;
}

/** Ausstoß am Schlot für einen Schritt */
function ausstossen(s: Sand) {
  const q = s.quelle;
  if (!q) return;
  const z = s.zufall, x0 = Math.round(q.x), y0 = Math.round(q.y);
  if (q.explosiv > 0.02) {
    const gas = Math.round((3 + 10 * q.explosiv) * (q.dampf ? 3 : 1)), asche = Math.round(6 + 34 * q.explosiv), lap = z() < 0.3 + q.explosiv ? Math.round(1 + 3 * q.explosiv) : 0;
    for (let t = 0; t < gas; t++) setzen(s, x0 + Math.round((z() - 0.5) * 6), y0 - 1 - ((z() * 4) | 0), GAS, 255);
    for (let t = 0; t < asche; t++) setzen(s, x0 + Math.round((z() - 0.5) * 6), y0 - 1 - ((z() * 6) | 0), ASCHE, 200 + ((z() * 55) | 0));
    for (let t = 0; t < lap; t++) {
      const w = (z() - 0.5) * 1.4, v = 1.4 + z() * 2.2 * (0.5 + q.explosiv);
      setzen(s, x0 + Math.round((z() - 0.5) * 2), y0 - 2, LAPILLI, 230, Math.sin(w) * v, -Math.cos(w) * v);
    }
  }
  if (q.lava > 0.02) {
    const anz = Math.round(1 + 4 * q.lava);
    for (let t = 0; t < anz; t++) {
      const w = (z() - 0.5) * 0.6, v = 1 + z() * 1.6 * q.lava;
      setzen(s, x0 + Math.round((z() - 0.5) * 2), y0 - 1, LAVA, 255, Math.sin(w) * v, -Math.cos(w) * v);
    }
  }
  if (q.glut) {
    // Säule bricht zusammen: Glutwolken quellen über den Kraterrand
    for (const r of [-1, 1]) for (let t = 0; t < 2; t++) setzen(s, x0 + r * (3 + ((z() * 3) | 0)), y0 - 2 - ((z() * 3) | 0), GLUT, 255, r, 0);
  }
}

/** Wurfbahn: Teilchen fliegt mit seiner Geschwindigkeit, Schwerkraft zieht */
function fliegen(s: Sand, k: number, i: number, j: number): boolean {
  const z = s.zufall;
  s.vy[k] += 0.16;
  s.vx[k] += (s.wind * 0.3 - s.vx[k]) * 0.01;
  const dx = Math.floor(s.vx[k] + z()), dy = Math.floor(s.vy[k] + z());
  const schritte = Math.max(Math.abs(dx), Math.abs(dy));
  let kk = k;
  for (let t = 1; t <= schritte; t++) {
    const ni = i + Math.round((dx * t) / schritte), nj = j + Math.round((dy * t) / schritte);
    if (nj < 0) { loeschen(s, kk); return true; }
    const q = ziehe(s, kk, ni, nj);
    if (q < 0) {
      // Aufschlag: liegen bleiben
      s.vx[kk] = 0; s.vy[kk] = 0; s.liegt[kk] = 1;
      return true;
    }
    kk = q;
  }
  return true;
}

/** Sandregel: fallen, sonst schräg abrollen; liegt es lange, verschwindet es */
function rieseln(s: Sand, k: number, i: number, j: number, haltbar: number) {
  if (ziehe(s, k, i, j + 1) >= 0) return;
  const r = s.zufall() < 0.5 ? -1 : 1;
  if (ziehe(s, k, i + r, j + 1) >= 0 || ziehe(s, k, i - r, j + 1) >= 0) return;
  if (++s.liegt[k] > haltbar) loeschen(s, k);
}

export function sandSchritt(s: Sand) {
  const { W, H, art, hitze } = s, z = s.zufall, q = s.quelle;
  s.takt = (s.takt % 250) + 1;
  ausstossen(s);
  // der Bildrand schluckt alles: Asche treibt mit dem Wind aus dem Bild, statt sich am Rand zu stauen
  for (let j = 0; j < H; j++) for (const i of [0, W - 1]) if (art[j * W + i]) loeschen(s, j * W + i);
  for (let i = 0; i < W; i++) if (art[i]) loeschen(s, i);
  const ax = q ? q.x : W / 2, ay = q ? q.y : H;
  const links = s.takt % 2 === 0;
  for (let j = 0; j < H; j++) {
    for (let t = 0; t < W; t++) {
      const i = links ? t : W - 1 - t, k = j * W + i, a = art[k];
      if (a === LEER || s.zug[k] === s.takt) continue;
      s.zug[k] = s.takt;
      // Wind schiebt alles Leichte seitwärts — die heiße Säule selbst kaum
      const treibt = a === GAS || a === ASCHE;
      const inSaeule = q !== null && j > s.schirm && hitze[k] > 70 && Math.abs(i - ax) < 4 + (ay - j) * 0.22;
      if (treibt && z() < Math.abs(s.wind) * (inSaeule ? 0.1 : 1) && ziehe(s, k, i + Math.sign(s.wind), j) >= 0) continue;
      if (a === GAS) {
        hitze[k] = Math.max(0, hitze[k] - 3);
        if (hitze[k] === 0) { loeschen(s, k); continue; }
        const r = z() < 0.5 ? -1 : 1;
        if (ziehe(s, k, i, j - 1) < 0 && ziehe(s, k, i + r, j - 1) < 0) ziehe(s, k, i + r, j);
      } else if (a === ASCHE) {
        const heiss = hitze[k] > 70;
        hitze[k] = Math.max(0, hitze[k] - (j < s.schirm + 3 ? 5 : 1));
        const breite = 2 + (ay - j) * 0.22;
        if (heiss && j > s.schirm && Math.abs(i - ax) < breite + 2) {
          // in der Säule: steigt auf, quirlt seitwärts
          const r = z() < 0.5 ? -1 : 1, hoch = z() < 0.5 ? 2 : 1;
          if (ziehe(s, k, i + (z() < 0.25 ? r : 0), j - hoch) < 0 && ziehe(s, k, i + r, j - 1) < 0 && ziehe(s, k, i - r, j - 1) < 0) ziehe(s, k, i + r, j);
        } else if (heiss) {
          // Schirmwolke: breitet sich von der Säule aus
          const r = Math.sign(i - ax) || 1;
          if (z() < 0.6) ziehe(s, k, i + r, j); else if (z() < 0.3) ziehe(s, k, i, j - 1);
        } else if (z() < 0.5) rieseln(s, k, i, j, 5);
        else if (z() < 0.2) ziehe(s, k, i + (z() < 0.5 ? -1 : 1), j);
      } else if (a === LAPILLI || a === LAVA) {
        if (s.liegt[k] === 0) fliegen(s, k, i, j);
        else {
          hitze[k] = Math.max(0, hitze[k] - (a === LAVA ? 6 : 3));
          rieseln(s, k, i, j, a === LAVA ? 10 : 12);
        }
      } else if (a === GLUT) {
        // Glutlawine: schwer, folgt dem Hang, wirbelt Asche auf
        hitze[k] = Math.max(0, hitze[k] - 2);
        if (hitze[k] < 25) { art[k] = ASCHE; continue; }
        if (z() < 0.25) setzen(s, i, j - 1, ASCHE, 150);
        const r = s.vx[k] >= 0 ? 1 : -1;
        let kk = k, ci = i, cj = j;
        for (let n = 0; n < 2; n++) {
          let q2 = ziehe(s, kk, ci, cj + 1);
          if (q2 >= 0) { kk = q2; cj++; continue; }
          q2 = ziehe(s, kk, ci + r, cj + 1);
          if (q2 >= 0) { kk = q2; ci += r; cj++; continue; }
          q2 = ziehe(s, kk, ci + r, cj);
          if (q2 >= 0) { kk = q2; ci += r; continue; }
          q2 = ziehe(s, kk, ci + r, cj - 1);
          if (q2 >= 0) { kk = q2; ci += r; cj--; continue; }
          if (++s.liegt[kk] > 30) { art[kk] = ASCHE; hitze[kk] = 60; }
          break;
        }
      }
    }
  }
}

/** Säule und Wind für den nächsten Schritt einstellen */
export function quelleSetzen(s: Sand, q: Quelle | null, wind: number) {
  s.quelle = q;
  s.wind = Math.max(-0.6, Math.min(0.6, wind));
  if (q) s.schirm = Math.max(4, Math.round(q.y - (q.y * 0.35 + 30) * Math.min(1, q.explosiv * 1.6)));
}

/** RGBA-Bild W×H (für eine Leinwand, die über dem Querschnitt liegt) */
export function sandBild(s: Sand, bild: ImageData) {
  const d = bild.data;
  d.fill(0);
  for (let k = 0; k < s.art.length; k++) {
    const a = s.art[k];
    if (!a) continue;
    const h = s.hitze[k], t = s.ton[k] / 255, o = k * 4;
    let r = 0, g = 0, b = 0, al = 255;
    if (a === GAS) { r = 236; g = 236; b = 240; al = 40 + h * 0.35; }
    else if (a === ASCHE) {
      const v = 70 + (1 - h / 255) * 80 + t * 25;
      r = v + 6; g = v; b = v - 6; al = 215;
    } else if (a === LAPILLI) { r = 96 + t * 40 + h * 0.25; g = 54 + t * 20; b = 40; }
    else if (a === LAVA) { r = 255; g = 90 + h * 0.6 * (0.7 + 0.3 * t); b = 20 + h * 0.15; }
    else if (a === GLUT) { r = 150 + h * 0.4; g = 105 + t * 30; b = 80; al = 235; }
    d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = al;
  }
}

// ---------- Aschewolke auf der Karte ----------

export interface Wolke2D { x: Float32Array; y: Float32Array; vx: Float32Array; vy: Float32Array; leben: Float32Array; n: number; zufall: () => number }

const MAX_WOLKE = 1500;

export function wolkeStart(seed = 2): Wolke2D {
  return { x: new Float32Array(MAX_WOLKE), y: new Float32Array(MAX_WOLKE), vx: new Float32Array(MAX_WOLKE), vy: new Float32Array(MAX_WOLKE), leben: new Float32Array(MAX_WOLKE), n: 0, zufall: zufallsquelle(seed) };
}

/**
 * Ein Schritt: neue Teilchen am Schlot (x, y in Kartenzellen), alle treiben
 * mit dem Wind (Richtung in rad, wohin er weht) und breiten sich aus.
 */
export function wolkeSchritt(w: Wolke2D, x: number, y: number, menge: number, richtung: number, wind: number) {
  const z = w.zufall;
  const wx = Math.sin(richtung) * (0.08 + 0.22 * wind), wy = -Math.cos(richtung) * (0.08 + 0.22 * wind);
  for (let t = 0; t < menge && w.n < MAX_WOLKE; t++) {
    const k = w.n++, a = z() * Math.PI * 2, v = 0.05 + z() * 0.25;
    w.x[k] = x; w.y[k] = y; w.vx[k] = Math.cos(a) * v; w.vy[k] = Math.sin(a) * v; w.leben[k] = 1;
  }
  for (let k = 0; k < w.n; k++) {
    w.vx[k] += (wx - w.vx[k]) * 0.03; w.vy[k] += (wy - w.vy[k]) * 0.03;
    w.x[k] += w.vx[k] + (z() - 0.5) * 0.15; w.y[k] += w.vy[k] + (z() - 0.5) * 0.15;
    w.leben[k] -= 0.006;
    if (w.leben[k] <= 0) {
      const l = --w.n;
      w.x[k] = w.x[l]; w.y[k] = w.y[l]; w.vx[k] = w.vx[l]; w.vy[k] = w.vy[l]; w.leben[k] = w.leben[l];
      k--;
    }
  }
}

/** Wolke auf eine Leinwand zeichnen (Pixel je Kartenzelle: skala) */
export function wolkeZeichnen(ctx: CanvasRenderingContext2D, w: Wolke2D, skala: number) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (let k = 0; k < w.n; k++) {
    const l = w.leben[k], r = (1.2 + (1 - l) * 4) * skala;
    ctx.fillStyle = `rgba(${90 + (1 - l) * 70},${88 + (1 - l) * 66},${86 + (1 - l) * 62},${0.35 * l})`;
    ctx.beginPath(); ctx.arc(w.x[k] * skala, w.y[k] * skala, r, 0, Math.PI * 2); ctx.fill();
  }
}
