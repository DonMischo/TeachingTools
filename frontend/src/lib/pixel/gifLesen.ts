/**
 * Pixel-Studio: animiertes GIF lesen. Liefert jedes Bild fertig zusammengesetzt (mit Durchsichtigkeit,
 * Zeilensprung und den Entsorgungsarten 1–3) samt Dauer — und daraus ein Projekt.
 */
import { neuesProjekt, type Projekt } from "./dokument";
import { aufPalette } from "./befehle";

export interface GifBilder { breite: number; hoehe: number; bilder: { rgba: Uint8ClampedArray; dauer: number }[] }

function lzwLesen(daten: Uint8Array, minBits: number, anzahl: number): Uint8Array {
  const aus = new Uint8Array(anzahl), clear = 1 << minBits, ende = clear + 1;
  let breite = minBits + 1, pos = 0, k = 0;
  let praefix = new Int32Array(4096), suffix = new Uint8Array(4096);
  let naechster = ende + 1, alt = -1;
  const reset = () => {
    praefix = new Int32Array(4096); suffix = new Uint8Array(4096);
    for (let i = 0; i < clear; i++) { suffix[i] = i; praefix[i] = -1; }
    naechster = ende + 1; breite = minBits + 1; alt = -1;
  };
  reset();
  const puffer = new Uint8Array(4096);
  while (k < anzahl) {
    if (pos + breite > daten.length * 8) break;
    let code = 0;
    for (let b = 0; b < breite; b++, pos++) code |= ((daten[pos >> 3] >> (pos & 7)) & 1) << b;
    if (code === clear) { reset(); continue; }
    if (code === ende) break;
    let c = code;
    if (alt === -1) { if (code < clear) aus[k++] = code; alt = code; continue; }
    // unbekannter Code: alter Eintrag + sein erstes Zeichen
    const neuerEintrag = code >= naechster;
    if (neuerEintrag) c = alt;
    let n = 0, x = c;
    while (x >= 0 && n < 4096) { puffer[n++] = suffix[x]; x = praefix[x]; }
    const erster = puffer[n - 1];
    for (let i = n - 1; i >= 0 && k < anzahl; i--) aus[k++] = puffer[i];
    if (neuerEintrag && k < anzahl) aus[k++] = erster;
    if (naechster < 4096) {
      praefix[naechster] = alt; suffix[naechster] = erster;
      naechster++;
      if (naechster === (1 << breite) && breite < 12) breite++;
    }
    alt = code;
  }
  return aus;
}

export function gifLesen(b: Uint8Array): GifBilder {
  const kopf = String.fromCharCode(...b.slice(0, 6));
  if (kopf !== "GIF87a" && kopf !== "GIF89a") throw new Error("Das ist keine GIF-Datei.");
  const W = b[6] | (b[7] << 8), H = b[8] | (b[9] << 8), flags = b[10];
  let i = 13, global: number[][] | null = null;
  const tabelle = (n: number) => { const t: number[][] = []; for (let k = 0; k < n; k++) t.push([b[i + k * 3], b[i + k * 3 + 1], b[i + k * 3 + 2]]); i += n * 3; return t; };
  if (flags & 0x80) global = tabelle(1 << ((flags & 7) + 1));
  const leinwand = new Uint8ClampedArray(W * H * 4), bilder: GifBilder["bilder"] = [];
  let dauer = 100, durchsichtig = -1, entsorgung = 0;
  while (i < b.length) {
    const art = b[i++];
    if (art === 0x3b) break;
    if (art === 0x21) {
      const label = b[i++];
      if (label === 0xf9) {
        const f = b[i + 1];
        entsorgung = (f >> 2) & 7;
        dauer = ((b[i + 2] | (b[i + 3] << 8)) * 10) || 100;
        durchsichtig = f & 1 ? b[i + 4] : -1;
      }
      while (b[i]) i += b[i] + 1;
      i++;
      continue;
    }
    if (art !== 0x2c) throw new Error("GIF beschädigt.");
    const x0 = b[i] | (b[i + 1] << 8), y0 = b[i + 2] | (b[i + 3] << 8), w = b[i + 4] | (b[i + 5] << 8), h = b[i + 6] | (b[i + 7] << 8), lf = b[i + 8];
    i += 9;
    const lokal = lf & 0x80 ? tabelle(1 << ((lf & 7) + 1)) : null, zeilensprung = !!(lf & 0x40);
    const farben = lokal ?? global ?? [];
    const minBits = b[i++], teile: number[] = [];
    while (b[i]) { for (let k = 1; k <= b[i]; k++) teile.push(b[i + k]); i += b[i] + 1; }
    i++;
    const idx = lzwLesen(new Uint8Array(teile), minBits, w * h);
    const vorher = entsorgung === 3 ? leinwand.slice() : null;
    // Zeilensprung: Durchgänge 0,8,…; 4,12,…; 2,6,…; 1,3,…
    const zeilen: number[] = [];
    if (zeilensprung) for (const [s, d] of [[0, 8], [4, 8], [2, 4], [1, 2]]) for (let y = s; y < h; y += d) zeilen.push(y);
    else for (let y = 0; y < h; y++) zeilen.push(y);
    zeilen.forEach((y, r) => {
      for (let x = 0; x < w; x++) {
        const v = idx[r * w + x], X = x0 + x, Y = y0 + y;
        if (v === durchsichtig || X >= W || Y >= H || !farben[v]) continue;
        const o = (Y * W + X) * 4;
        leinwand[o] = farben[v][0]; leinwand[o + 1] = farben[v][1]; leinwand[o + 2] = farben[v][2]; leinwand[o + 3] = 255;
      }
    });
    bilder.push({ rgba: leinwand.slice(), dauer });
    if (entsorgung === 2) for (let y = y0; y < Math.min(H, y0 + h); y++) leinwand.fill(0, (y * W + x0) * 4, (y * W + Math.min(W, x0 + w)) * 4);
    else if (entsorgung === 3 && vorher) leinwand.set(vorher);
    dauer = 100; durchsichtig = -1; entsorgung = 0;
  }
  return { breite: W, hoehe: H, bilder };
}

/** Projekt aus einem GIF (höchstens 256×256 und 64 Bilder; Farben werden zur Palette) */
export function gifZuProjekt(g: GifBilder): Projekt {
  if (g.breite > 256 || g.hoehe > 256) throw new Error("Das GIF ist größer als 256×256 Pixel.");
  if (!g.bilder.length) throw new Error("Das GIF enthält keine Bilder.");
  const p = neuesProjekt(g.breite, g.hoehe, []);
  const id = p.ebenen[0].id;
  const liste = g.bilder.slice(0, 64);
  p.zellen[id] = liste.map(x => aufPalette(p, x.rgba));
  p.bilder = liste.map(x => ({ dauer: Math.max(20, x.dauer) }));
  if (!p.palette.length) p.palette.push("#000000");
  return p;
}
