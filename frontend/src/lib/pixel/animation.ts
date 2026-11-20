/**
 * Pixel-Studio: Bewegung aus einem Bild erzeugen. Aus dem aktuellen Bild entstehen N Bilder, in denen
 * die gewählten Ebenen verschoben, gedreht, gestaucht, ausgeblendet … werden; die übrigen Ebenen
 * bleiben stehen (Hintergrund). Alles mit nächstem Nachbarn, damit keine neuen Farben entstehen.
 */
import type { Projekt } from "./dokument";

export type Bewegung = "verschieben" | "huepfen" | "wackeln" | "drehen" | "pulsieren" | "atmen" | "blinken" | "ausblenden" | "einblenden" | "farbzyklus";

export const BEWEGUNGEN: { id: Bewegung; icon: string; label: string; text: string }[] = [
  { id: "verschieben", icon: "➡️", label: "Verschieben", text: "Gleitet um dx/dy; mit »Umlauf« kommt es auf der anderen Seite wieder herein (Wasser, Wolken, Förderband)." },
  { id: "huepfen", icon: "🦘", label: "Hüpfen", text: "Springt hoch und landet wieder, unten kurz gestaucht." },
  { id: "wackeln", icon: "〰️", label: "Wackeln", text: "Zittert hin und her (Treffer, Kälte, Ärger)." },
  { id: "drehen", icon: "🔄", label: "Drehen", text: "Dreht sich um die Mitte (Münze, Rad, Stern)." },
  { id: "pulsieren", icon: "💓", label: "Pulsieren", text: "Wird größer und kleiner (Herz, Leuchten, Auswahl)." },
  { id: "atmen", icon: "😮‍💨", label: "Atmen", text: "Hebt und senkt sich leicht von unten (Figur im Stand)." },
  { id: "blinken", icon: "✨", label: "Blinken", text: "Wechselt zwischen sichtbar und unsichtbar." },
  { id: "ausblenden", icon: "🌫️", label: "Ausblenden", text: "Verschwindet Pixel für Pixel im Dither-Muster." },
  { id: "einblenden", icon: "🌅", label: "Einblenden", text: "Taucht Pixel für Pixel im Dither-Muster auf." },
  { id: "farbzyklus", icon: "🌈", label: "Farbzyklus", text: "Die Palettenfarben von … bis rotieren (Wasserfall, Lava, Neon)." },
];

export interface BewegungsOptionen {
  art: Bewegung;
  bilder: number;
  dx: number;
  dy: number;
  umlauf: boolean;
  /** Pixel (Hüpfhöhe, Wackelweite) */
  weite: number;
  /** Grad für »drehen« */
  winkel: number;
  /** 0…1 für pulsieren/atmen */
  staerke: number;
  farbVon: number;
  farbBis: number;
}

export const STANDARD_BEWEGUNG: BewegungsOptionen = { art: "huepfen", bilder: 8, dx: 8, dy: 0, umlauf: true, weite: 4, winkel: 360, staerke: 0.2, farbVon: 1, farbBis: 4 };

/** 4×4-Bayer-Schwellen (0…15) fürs Dither-Blenden */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Zelle um ganze Pixel versetzen; mit Umlauf kommt Hinausgeschobenes gegenüber wieder herein */
export function versetzt(z: Uint8Array, w: number, h: number, dx: number, dy: number, umlauf: boolean) {
  const n = new Uint8Array(z.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let a = x + dx, b = y + dy;
    if (umlauf) { a = ((a % w) + w) % w; b = ((b % h) + h) % h; }
    else if (a < 0 || b < 0 || a >= w || b >= h) continue;
    n[b * w + a] = z[y * w + x];
  }
  return n;
}

/** Skalieren um einen Ankerpunkt (ax, ay in Pixeln), nächster Nachbar */
export function skaliertUm(z: Uint8Array, w: number, h: number, sx: number, sy: number, ax: number, ay: number) {
  const n = new Uint8Array(z.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const qx = Math.floor((x + 0.5 - ax) / sx + ax), qy = Math.floor((y + 0.5 - ay) / sy + ay);
    if (qx >= 0 && qy >= 0 && qx < w && qy < h) n[y * w + x] = z[qy * w + qx];
  }
  return n;
}

/** Drehen um die Bildmitte (Grad, im Uhrzeigersinn), nächster Nachbar */
export function gedreht(z: Uint8Array, w: number, h: number, grad: number) {
  const n = new Uint8Array(z.length), r = grad * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), mx = w / 2, my = h / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x + 0.5 - mx, py = y + 0.5 - my;
    const qx = Math.floor(c * px + s * py + mx), qy = Math.floor(-s * px + c * py + my);
    if (qx >= 0 && qy >= 0 && qx < w && qy < h) n[y * w + x] = z[qy * w + qx];
  }
  return n;
}

/** unterste belegte Zeile + 1 (für Anker »unten«); leer → h */
function boden(z: Uint8Array, w: number, h: number) {
  for (let y = h - 1; y >= 0; y--) for (let x = 0; x < w; x++) if (z[y * w + x]) return y + 1;
  return h;
}

/** Bild k von n der Bewegung aus der Zelle z */
export function bewegungsBild(z: Uint8Array, w: number, h: number, o: BewegungsOptionen, k: number): Uint8Array {
  const n = Math.max(1, o.bilder), t = k / n, tEnde = n > 1 ? k / (n - 1) : 1;
  switch (o.art) {
    case "verschieben": return versetzt(z, w, h, Math.round(o.dx * t), Math.round(o.dy * t), o.umlauf);
    case "huepfen": {
      const hoch = Math.round(o.weite * Math.sin(Math.PI * t));
      const unten = boden(z, w, h);
      // am Boden (erstes Bild) kurz gestaucht
      const basis = k === 0 && n > 2 ? skaliertUm(z, w, h, 1.15, 0.85, w / 2, unten) : z;
      return versetzt(basis, w, h, 0, -hoch, false);
    }
    case "wackeln": return versetzt(z, w, h, k % 2 === 0 ? 0 : (k % 4 === 1 ? o.weite : -o.weite), 0, false);
    case "drehen": return gedreht(z, w, h, o.winkel * t);
    case "pulsieren": { const f = 1 + o.staerke * Math.sin(2 * Math.PI * t); return skaliertUm(z, w, h, f, f, w / 2, h / 2); }
    case "atmen": { const f = 1 + o.staerke * 0.5 * Math.sin(2 * Math.PI * t); return skaliertUm(z, w, h, 1, f, w / 2, boden(z, w, h)); }
    case "blinken": return t < 0.5 ? z.slice() : new Uint8Array(z.length);
    case "ausblenden": case "einblenden": {
      const sicht = o.art === "ausblenden" ? 1 - tEnde : tEnde, nz = new Uint8Array(z.length);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        if (z[i] && BAYER[(y & 3) * 4 + (x & 3)] < Math.round(sicht * 16)) nz[i] = z[i];
      }
      return nz;
    }
    case "farbzyklus": {
      const a = Math.min(o.farbVon, o.farbBis), b = Math.max(o.farbVon, o.farbBis), m = b - a + 1;
      const schritt = Math.round(t * m);
      return z.map(v => v >= a && v <= b ? a + (((v - a + schritt) % m) + m) % m : v);
    }
  }
}

/**
 * Die Bewegung ins Projekt schreiben: Bild `bild` wird Bild 1 der Bewegung, dahinter kommen n − 1 neue
 * Bilder. Gewählte Ebenen bewegen sich, die übrigen werden kopiert. Ein Tag mit dem Namen der Bewegung
 * markiert die Bilder.
 */
export function bewegungEinfuegen(p: Projekt, bild: number, ebenen: string[], o: BewegungsOptionen, dauer: number, tag: string) {
  const n = Math.max(2, Math.min(o.bilder, 64 - p.bilder.length + 1));
  const quelle = Object.fromEntries(p.ebenen.map(e => [e.id, p.zellen[e.id][bild].slice()]));
  p.bilder.splice(bild + 1, 0, ...Array.from({ length: n - 1 }, () => ({ dauer })));
  p.bilder[bild].dauer = dauer;
  for (const e of p.ebenen) {
    const neu = Array.from({ length: n }, (_, k) => ebenen.includes(e.id) ? bewegungsBild(quelle[e.id], p.breite, p.hoehe, { ...o, bilder: n }, k) : quelle[e.id].slice());
    p.zellen[e.id].splice(bild, 1, ...neu);
  }
  for (const t of p.tags) { if (t.von > bild) t.von += n - 1; if (t.bis >= bild) t.bis += n - 1; }
  p.tags.push({ name: tag, von: bild, bis: bild + n - 1 });
  return n;
}

