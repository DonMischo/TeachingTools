/**
 * Pixel-Studio: Ausgabe als GIF (eigener Kodierer, LZW) und Sprite-Sheet-Aufteilung.
 * Das PNG entsteht im Browser über ein Canvas (siehe components/pixel/leinwand.ts).
 */
import { hexZuRgb, zusammensetzenIndex, type Projekt } from "./dokument";

/** LZW-Kodierung nach GIF-Art: Codes variabler Breite, als Unterblöcke ≤ 255 Byte */
function lzw(pixel: Uint8Array, minBits: number): number[] {
  const clear = 1 << minBits, ende = clear + 1;
  let breite = minBits + 1, naechster = ende + 1;
  let tabelle = new Map<string, number>();
  const bytes: number[] = [];
  let puffer = 0, bits = 0;
  const schreib = (code: number) => {
    puffer |= code << bits; bits += breite;
    while (bits >= 8) { bytes.push(puffer & 255); puffer >>= 8; bits -= 8; }
  };
  schreib(clear);
  let w = String(pixel[0]);
  for (let i = 1; i < pixel.length; i++) {
    const k = pixel[i], wk = w + "," + k;
    if (tabelle.has(wk)) { w = wk; continue; }
    schreib(w.includes(",") ? tabelle.get(w)! : Number(w));
    if (naechster < 4096) {
      tabelle.set(wk, naechster++);
      // der Leser hinkt einen Eintrag hinterher: erst ab 2^breite + 1 Einträgen wird breiter gelesen
      if (naechster > (1 << breite) && breite < 12) breite++;
    } else {
      schreib(clear);
      tabelle = new Map(); breite = minBits + 1; naechster = ende + 1;
    }
    w = String(k);
  }
  schreib(w.includes(",") ? tabelle.get(w)! : Number(w));
  schreib(ende);
  if (bits > 0) bytes.push(puffer & 255);
  const aus: number[] = [];
  for (let i = 0; i < bytes.length; i += 255) {
    const teil = bytes.slice(i, i + 255);
    aus.push(teil.length, ...teil);
  }
  aus.push(0);
  return aus;
}

/**
 * Animiertes GIF aller Bilder (oder nur `von`…`bis`), vergrößert um `zoom`. Wert 0 der Palette ist
 * durchsichtig; die Bilddauer wird auf Hundertstel gerundet. Schleife endlos.
 */
export function gif(p: Projekt, zoom = 1, von = 0, bis = p.bilder.length - 1): Uint8Array {
  const w = p.breite * zoom, h = p.hoehe * zoom;
  let tiefe = 1;
  while ((1 << tiefe) < p.palette.length + 1) tiefe++;
  const groesse = 1 << tiefe, minBits = Math.max(2, tiefe);
  const out: number[] = [];
  const wort = (v: number) => out.push(v & 255, (v >> 8) & 255);
  out.push(..."GIF89a".split("").map(c => c.charCodeAt(0)));
  wort(w); wort(h);
  out.push(0x80 | ((tiefe - 1) << 4) | (tiefe - 1), 0, 0);
  for (let k = 0; k < groesse; k++) {
    const [r, g, b] = k === 0 ? [0, 0, 0] : hexZuRgb(p.palette[k - 1] ?? "#000000");
    out.push(r, g, b);
  }
  // Endlosschleife (NETSCAPE2.0)
  out.push(0x21, 0xff, 11, ..."NETSCAPE2.0".split("").map(c => c.charCodeAt(0)), 3, 1, 0, 0, 0);
  for (let k = von; k <= bis; k++) {
    const z = zusammensetzenIndex(p, k);
    const gross = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) gross[y * w + x] = z[Math.floor(y / zoom) * p.breite + Math.floor(x / zoom)];
    // Steuerblock: Dauer, durchsichtig = 0, alte Pixel vor dem nächsten Bild löschen (Entsorgung 2)
    out.push(0x21, 0xf9, 4, (2 << 2) | 1);
    wort(Math.max(2, Math.round(p.bilder[k].dauer / 10)));
    out.push(0, 0);
    out.push(0x2c); wort(0); wort(0); wort(w); wort(h); out.push(0);
    out.push(minBits, ...lzw(gross, minBits));
  }
  out.push(0x3b);
  return new Uint8Array(out);
}

/** Lage der Bilder in einem Sprite-Sheet (Raster mit `spalten` Spalten) plus Beschreibung als JSON */
export function spriteSheet(p: Projekt, spalten = p.bilder.length) {
  const s = Math.max(1, Math.min(spalten, p.bilder.length)), zeilen = Math.ceil(p.bilder.length / s);
  const bilder = p.bilder.map((b, k) => ({ x: (k % s) * p.breite, y: Math.floor(k / s) * p.hoehe, w: p.breite, h: p.hoehe, dauer: b.dauer }));
  return { breite: s * p.breite, hoehe: zeilen * p.hoehe, bilder, tags: p.tags.map(t => ({ ...t })) };
}
