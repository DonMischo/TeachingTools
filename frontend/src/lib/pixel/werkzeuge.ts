/**
 * Pixel-Studio: Zeichenwerkzeuge und Bildbefehle als reine Rechnung auf Zellen (Uint8Array, w × h).
 * Keine Abhängigkeit vom Zeichnen — der Editor ruft sie auf und zeigt das Ergebnis.
 */
import { hexZuRgb, leereZelle, naechsteFarbe, type Projekt } from "./dokument";

export type Punkt = [number, number];
/** Rechteck in Pixeln */
export interface Rahmen { x: number; y: number; w: number; h: number }

/** Bresenham-Linie, beide Enden eingeschlossen */
export function linie(x0: number, y0: number, x1: number, y1: number): Punkt[] {
  const aus: Punkt[] = [];
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy, x = x0, y = y0;
  for (;;) {
    aus.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return aus;
}

export function rechteck(x0: number, y0: number, x1: number, y1: number, gefuellt: boolean): Punkt[] {
  const [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)], [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)];
  const aus: Punkt[] = [];
  for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++)
    if (gefuellt || x === ax || x === bx || y === ay || y === by) aus.push([x, y]);
  return aus;
}

/** Ellipse im Rechteck (x0,y0)–(x1,y1): Pixel, deren Mitte innen liegt; Umriss = innen mit einem Nachbarn außen */
export function ellipse(x0: number, y0: number, x1: number, y1: number, gefuellt: boolean): Punkt[] {
  const [ax, bx] = [Math.min(x0, x1), Math.max(x0, x1)], [ay, by] = [Math.min(y0, y1), Math.max(y0, y1)];
  const cx = (ax + bx + 1) / 2, cy = (ay + by + 1) / 2, rx = (bx - ax + 1) / 2, ry = (by - ay + 1) / 2;
  const innen = (x: number, y: number) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
  const aus: Punkt[] = [];
  for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) {
    if (!innen(x, y)) continue;
    if (gefuellt || !innen(x - 1, y) || !innen(x + 1, y) || !innen(x, y - 1) || !innen(x, y + 1)) aus.push([x, y]);
  }
  return aus;
}

/** Pinsel der Größe n (Quadrat) um einen Punkt */
export function pinsel(x: number, y: number, n: number): Punkt[] {
  if (n <= 1) return [[x, y]];
  const aus: Punkt[] = [], a = -Math.floor((n - 1) / 2);
  for (let dy = 0; dy < n; dy++) for (let dx = 0; dx < n; dx++) aus.push([x + a + dx, y + a + dy]);
  return aus;
}

/** Spiegelbilder eines Punktes (Symmetrie-Zeichnen) */
export function spiegelpunkte([x, y]: Punkt, w: number, h: number, sx: boolean, sy: boolean): Punkt[] {
  const aus: Punkt[] = [[x, y]];
  if (sx) aus.push([w - 1 - x, y]);
  if (sy) aus.push([x, h - 1 - y]);
  if (sx && sy) aus.push([w - 1 - x, h - 1 - y]);
  return aus;
}

/** Schachbrett-Raster fürs Dithern: nur jeder zweite Pixel */
export const ditherAn = (x: number, y: number) => (x + y) % 2 === 0;

/** setzt Punkte (außerhalb wird ignoriert) */
export function setze(z: Uint8Array, w: number, h: number, pts: Punkt[], wert: number, maske?: (x: number, y: number) => boolean) {
  for (const [x, y] of pts) if (x >= 0 && y >= 0 && x < w && y < h && (!maske || maske(x, y))) z[y * w + x] = wert;
}

/** Füllen: zusammenhängend (4er-Nachbarschaft) oder alle Pixel derselben Farbe */
export function fuellen(z: Uint8Array, w: number, h: number, x: number, y: number, wert: number, global = false) {
  if (x < 0 || y < 0 || x >= w || y >= h) return;
  const alt = z[y * w + x];
  if (alt === wert) return;
  if (global) { for (let i = 0; i < z.length; i++) if (z[i] === alt) z[i] = wert; return; }
  const stapel = [y * w + x];
  while (stapel.length) {
    const i = stapel.pop()!;
    if (z[i] !== alt) continue;
    z[i] = wert;
    const px = i % w;
    if (px > 0) stapel.push(i - 1);
    if (px < w - 1) stapel.push(i + 1);
    if (i >= w) stapel.push(i - w);
    if (i < z.length - w) stapel.push(i + w);
  }
}

// ---- Bildbefehle auf einer Zelle (geben eine neue Zelle zurück)

export function spiegelnH(z: Uint8Array, w: number, h: number) {
  const n = new Uint8Array(z.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) n[y * w + x] = z[y * w + (w - 1 - x)];
  return n;
}
export function spiegelnV(z: Uint8Array, w: number, h: number) {
  const n = new Uint8Array(z.length);
  for (let y = 0; y < h; y++) n.set(z.subarray((h - 1 - y) * w, (h - y) * w), y * w);
  return n;
}
/** um 90° im Uhrzeigersinn: Ergebnis ist h × w */
export function drehen90(z: Uint8Array, w: number, h: number) {
  const n = new Uint8Array(z.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) n[x * h + (h - 1 - y)] = z[y * w + x];
  return n;
}
/** verschieben mit Umlauf (für nahtlose Kacheln) */
export function verschieben(z: Uint8Array, w: number, h: number, dx: number, dy: number) {
  const n = new Uint8Array(z.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    n[(((y + dy) % h + h) % h) * w + (((x + dx) % w + w) % w)] = z[y * w + x];
  return n;
}
/** Umriss: durchsichtige Pixel neben einem belegten bekommen `wert` (mit Ecken: 8er-Nachbarschaft) */
export function umriss(z: Uint8Array, w: number, h: number, wert: number, ecken = false) {
  const n = z.slice();
  const nb: Punkt[] = ecken ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (z[y * w + x]) continue;
    if (nb.some(([dx, dy]) => { const a = x + dx, b = y + dy; return a >= 0 && b >= 0 && a < w && b < h && z[b * w + a] && z[b * w + a] !== wert; })) n[y * w + x] = wert;
  }
  return n;
}
/** Schlagschatten: Kopie in `wert`, um (dx,dy) versetzt, hinter die Pixel gelegt */
export function schatten(z: Uint8Array, w: number, h: number, wert: number, dx = 1, dy = 1) {
  const n = z.slice();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!z[y * w + x]) continue;
    const a = x + dx, b = y + dy;
    if (a >= 0 && b >= 0 && a < w && b < h && !z[b * w + a]) n[b * w + a] = wert;
  }
  return n;
}
export function umfaerben(z: Uint8Array, von: number, nach: number) {
  return z.map(v => v === von ? nach : v);
}

/** Ausschnitt kopieren / einsetzen (0 im Ausschnitt bleibt durchsichtig) */
export function ausschnitt(z: Uint8Array, w: number, x: number, y: number, bw: number, bh: number) {
  const n = new Uint8Array(bw * bh);
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) n[j * bw + i] = z[(y + j) * w + x + i];
  return n;
}
export function einsetzen(z: Uint8Array, w: number, h: number, teil: Uint8Array, bw: number, bh: number, x: number, y: number) {
  for (let j = 0; j < bh; j++) for (let i = 0; i < bw; i++) {
    const v = teil[j * bw + i], a = x + i, b = y + j;
    if (v && a >= 0 && b >= 0 && a < w && b < h) z[b * w + a] = v;
  }
}

// ---- Befehle auf dem ganzen Projekt (ändern es an Ort und Stelle)

export function alleZellen(p: Projekt, f: (z: Uint8Array) => Uint8Array) {
  for (const id of Object.keys(p.zellen)) p.zellen[id] = p.zellen[id].map(f);
}

export function drehenProjekt(p: Projekt) {
  alleZellen(p, z => drehen90(z, p.breite, p.hoehe));
  [p.breite, p.hoehe] = [p.hoehe, p.breite];
}

/** Leinwand vergrößern/verkleinern; anker 0…1 je Achse (0.5 = mittig) */
export function leinwandGroesse(p: Projekt, nb: number, nh: number, ax = 0.5, ay = 0.5) {
  const ox = Math.round((nb - p.breite) * ax), oy = Math.round((nh - p.hoehe) * ay);
  alleZellen(p, z => {
    const n = new Uint8Array(nb * nh);
    for (let y = 0; y < p.hoehe; y++) for (let x = 0; x < p.breite; x++) {
      const a = x + ox, b = y + oy;
      if (a >= 0 && b >= 0 && a < nb && b < nh) n[b * nb + a] = z[y * p.breite + x];
    }
    return n;
  });
  p.breite = nb; p.hoehe = nh;
}

/** Bild skalieren (nächster Nachbar) */
export function skalieren(p: Projekt, nb: number, nh: number) {
  alleZellen(p, z => {
    const n = new Uint8Array(nb * nh);
    for (let y = 0; y < nh; y++) for (let x = 0; x < nb; x++) n[y * nb + x] = z[Math.floor(y * p.hoehe / nh) * p.breite + Math.floor(x * p.breite / nb)];
    return n;
  });
  p.breite = nb; p.hoehe = nh;
}

/** Palettenfarbe entfernen: Pixel dieser Farbe werden durchsichtig, höhere Werte rücken nach */
export function farbeEntfernen(p: Projekt, wert: number) {
  p.palette.splice(wert - 1, 1);
  alleZellen(p, z => z.map(v => v === wert ? 0 : v > wert ? v - 1 : v));
}

/** zwei Palettenfarben tauschen (auch in allen Pixeln) */
export function farbenTauschen(p: Projekt, a: number, b: number) {
  [p.palette[a - 1], p.palette[b - 1]] = [p.palette[b - 1], p.palette[a - 1]];
  alleZellen(p, z => z.map(v => v === a ? b : v === b ? a : v));
}

/**
 * Ein RGBA-Bild in Palettenwerte umsetzen. `neuePalette`: die häufigsten Farben werden die Palette
 * (bis `max`), sonst wird auf die bestehende Palette abgebildet. Halbdurchsichtiges wird durchsichtig.
 */
export function quantisieren(rgba: Uint8ClampedArray | Uint8Array, palette: string[], neuePalette: boolean, max = 32): { zelle: Uint8Array; palette: string[] } {
  const n = rgba.length / 4;
  let pal = palette;
  if (neuePalette) {
    const zahl = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      if (rgba[i * 4 + 3] < 128) continue;
      // auf 5 Bit je Kanal runden, damit Rauschen nicht hunderte Farben ergibt
      const k = ((rgba[i * 4] >> 3) << 10) | ((rgba[i * 4 + 1] >> 3) << 5) | (rgba[i * 4 + 2] >> 3);
      zahl.set(k, (zahl.get(k) ?? 0) + 1);
    }
    pal = [...zahl.entries()].sort((a, b) => b[1] - a[1]).slice(0, max)
      .map(([k]) => "#" + [(k >> 10) & 31, (k >> 5) & 31, k & 31].map(c => ((c << 3) | (c >> 2)).toString(16).padStart(2, "0")).join(""));
    if (!pal.length) pal = palette.length ? palette : ["#000000"];
  }
  const rgb = pal.map(hexZuRgb), zelle = new Uint8Array(n);
  for (let i = 0; i < n; i++) if (rgba[i * 4 + 3] >= 128) zelle[i] = naechsteFarbe(rgb, rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
  return { zelle, palette: pal };
}

/** neues Bild (Frame) hinter `nach` einfügen — leer oder als Kopie */
export function bildEinfuegen(p: Projekt, nach: number, kopie: boolean) {
  p.bilder.splice(nach + 1, 0, { dauer: p.bilder[nach]?.dauer ?? 120 });
  for (const e of p.ebenen) p.zellen[e.id].splice(nach + 1, 0, kopie ? p.zellen[e.id][nach].slice() : leereZelle(p));
  for (const t of p.tags) { if (t.von > nach) t.von++; if (t.bis > nach) t.bis++; }
}
export function bildLoeschen(p: Projekt, k: number) {
  if (p.bilder.length <= 1) return;
  p.bilder.splice(k, 1);
  for (const e of p.ebenen) p.zellen[e.id].splice(k, 1);
  p.tags = p.tags.map(t => ({ ...t, von: t.von > k ? t.von - 1 : t.von, bis: t.bis >= k ? Math.max(0, t.bis - 1) : t.bis }))
    .filter(t => t.von <= t.bis && t.von < p.bilder.length);
}
export function bildVerschieben(p: Projekt, k: number, nach: number) {
  if (nach < 0 || nach >= p.bilder.length) return;
  const [b] = p.bilder.splice(k, 1); p.bilder.splice(nach, 0, b);
  for (const e of p.ebenen) { const [z] = p.zellen[e.id].splice(k, 1); p.zellen[e.id].splice(nach, 0, z); }
}
/** Ebene mit der darunter verschmelzen (Deckkraft wird eingerechnet: unter 50 % verschwindet sie) */
export function ebeneVerschmelzen(p: Projekt, idx: number) {
  if (idx <= 0) return;
  const oben = p.ebenen[idx], unten = p.ebenen[idx - 1];
  if (oben.deckkraft >= 0.5 && oben.sichtbar) p.zellen[unten.id] = p.zellen[unten.id].map((z, k) => {
    const n = z.slice(), o = p.zellen[oben.id][k];
    for (let i = 0; i < n.length; i++) if (o[i]) n[i] = o[i];
    return n;
  });
  p.ebenen.splice(idx, 1);
  delete p.zellen[oben.id];
}
