/**
 * Pixel-Studio: Befehle auf einer Ebene — Inseln finden und ordnen, in Bilder zerlegen, Sprite-Sheets
 * zerschneiden, Modifier einbacken, Pixel innerhalb eines Bereichs schieben.
 * »Insel« = zusammenhängende belegte Pixel (auch über Ecken).
 */
import { ebenenBild, hexZuRgb, leereZelle, naechsteFarbe, neuesProjekt, rgbZuHex, MAX_FARBEN, type Projekt } from "./dokument";
import { modifierAnwenden } from "./modifier";
import type { Rahmen } from "./werkzeuge";

/** Inseln als umschließende Rechtecke, sortiert von oben links (zeilenweise) */
export function inseln(z: Uint8Array, w: number, h: number): Rahmen[] {
  const gesehen = new Uint8Array(z.length), aus: Rahmen[] = [];
  for (let s = 0; s < z.length; s++) {
    if (!z[s] || gesehen[s]) continue;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    const stapel = [s];
    gesehen[s] = 1;
    while (stapel.length) {
      const i = stapel.pop()!, x = i % w, y = (i - x) / w;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const a = x + dx, b = y + dy;
        if (a < 0 || b < 0 || a >= w || b >= h) continue;
        const j = b * w + a;
        if (z[j] && !gesehen[j]) { gesehen[j] = 1; stapel.push(j); }
      }
    }
    aus.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 });
  }
  // gleiche Zeile (überlappend in y), dann von links
  return aus.sort((a, b) => (a.y + a.h <= b.y ? -1 : b.y + b.h <= a.y ? 1 : a.x - b.x));
}

/** Pixel im Rechteck einer Insel als eigene kleine Zelle (ragt eine Nachbarinsel hinein, kommt sie mit) */
function inselPixel(z: Uint8Array, w: number, r: Rahmen): Uint8Array {
  const n = new Uint8Array(r.w * r.h);
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) n[y * r.w + x] = z[(r.y + y) * w + r.x + x];
  return n;
}

/**
 * Inseln in ein Raster packen (Zellen so groß wie die größte Insel plus Abstand), zeilenweise von oben
 * links. null, wenn sie nicht auf die Leinwand passen.
 */
export function inselnOrdnen(z: Uint8Array, w: number, h: number, abstand = 1): Uint8Array | null {
  const liste = inseln(z, w, h);
  if (!liste.length) return z.slice();
  const zw = Math.max(...liste.map(r => r.w)) + abstand, zh = Math.max(...liste.map(r => r.h)) + abstand;
  const spalten = Math.max(1, Math.floor((w + abstand) / zw));
  if (Math.ceil(liste.length / spalten) * zh - abstand > h) return null;
  const n = new Uint8Array(z.length);
  liste.forEach((r, k) => {
    const teil = inselPixel(z, w, r), ox = (k % spalten) * zw, oy = Math.floor(k / spalten) * zh;
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) if (teil[y * r.w + x]) n[(oy + y) * w + ox + x] = teil[y * r.w + x];
  });
  return n;
}

/** neues Projekt: jede Insel ein Bild, alle so groß wie die größte, unten mittig ausgerichtet */
export function inselnZuBildern(p: Projekt, ebene: string, bild: number, dauer = 120): Projekt | null {
  const z = p.zellen[ebene][bild], liste = inseln(z, p.breite, p.hoehe);
  if (!liste.length) return null;
  const bw = Math.max(...liste.map(r => r.w)), bh = Math.max(...liste.map(r => r.h));
  const q = neuesProjekt(bw, bh, p.palette);
  const id = q.ebenen[0].id;
  q.bilder = liste.slice(0, 64).map(() => ({ dauer }));
  q.zellen[id] = liste.slice(0, 64).map(r => {
    const teil = inselPixel(z, p.breite, r), n = leereZelle(q), ox = Math.floor((bw - r.w) / 2), oy = bh - r.h;
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) n[(oy + y) * bw + ox + x] = teil[y * r.w + x];
    return n;
  });
  return q;
}

/** Sprite-Sheet zerschneiden: Zellen zw × zh zeilenweise zu Bildern (leere Zellen auf Wunsch weg) */
export function sheetZuBildern(z: Uint8Array, w: number, h: number, palette: string[], zw: number, zh: number, leereWeg = true, dauer = 120): Projekt | null {
  const q = neuesProjekt(zw, zh, palette), id = q.ebenen[0].id, bilder: Uint8Array[] = [];
  for (let y = 0; y + zh <= h; y += zh) for (let x = 0; x + zw <= w; x += zw) {
    const n = new Uint8Array(zw * zh);
    for (let j = 0; j < zh; j++) for (let i = 0; i < zw; i++) n[j * zw + i] = z[(y + j) * w + x + i];
    if (!leereWeg || n.some(v => v)) bilder.push(n);
  }
  if (!bilder.length) return null;
  q.zellen[id] = bilder.slice(0, 64);
  q.bilder = q.zellen[id].map(() => ({ dauer }));
  return q;
}

/**
 * RGBA-Bilder auf die Palette bringen: vorhandene Farben treffen genau, neue kommen dazu, solange
 * Platz ist (255), sonst die ähnlichste. Ändert p.palette.
 */
export function aufPalette(p: Projekt, rgba: Uint8ClampedArray): Uint8Array {
  const index = new Map<string, number>(p.palette.map((c, k) => [c.toLowerCase(), k + 1]));
  const z = new Uint8Array(rgba.length / 4);
  for (let i = 0; i < z.length; i++) {
    if (rgba[i * 4 + 3] < 128) continue;
    const c = rgbZuHex(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    let v = index.get(c);
    if (v === undefined) {
      if (p.palette.length < MAX_FARBEN) { p.palette.push(c); v = p.palette.length; index.set(c, v); }
      else v = naechsteFarbe(p.palette.map(hexZuRgb), rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    }
    z[i] = v;
  }
  return z;
}

/** Modifier einer Ebene in alle Bilder einbacken und entfernen */
export function einbacken(p: Projekt, ebene: string) {
  const e = p.ebenen.find(x => x.id === ebene);
  const mods = e?.mods?.filter(m => m.an);
  if (!e || !mods?.length) { if (e) e.mods = []; return; }
  p.zellen[ebene] = p.zellen[ebene].map((_, k) => {
    const rgba = ebenenBild(p, ebene, k);
    modifierAnwenden(rgba, p.breite, p.hoehe, mods);
    return aufPalette(p, rgba);
  });
  e.mods = [];
}

/** Pixel innerhalb eines Bereichs um (dx, dy) schieben; was hinausfällt, kommt gegenüber wieder herein */
export function bereichSchieben(z: Uint8Array, w: number, r: Rahmen, dx: number, dy: number) {
  const teil = new Uint8Array(r.w * r.h);
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++)
    teil[(((y + dy) % r.h + r.h) % r.h) * r.w + (((x + dx) % r.w + r.w) % r.w)] = z[(r.y + y) * w + r.x + x];
  for (let y = 0; y < r.h; y++) z.set(teil.subarray(y * r.w, (y + 1) * r.w), (r.y + y) * w + r.x);
}
