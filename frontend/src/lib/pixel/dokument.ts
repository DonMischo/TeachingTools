/**
 * Pixel-Studio: das Dokument und seine Speicherform.
 *
 * Ein Projekt hat eine feste Palette (bis 255 Farben) und Ebenen × Bilder (Frames). Jede Zelle
 * (eine Ebene in einem Bild) ist ein Uint8Array mit einem Wert je Pixel: 0 = durchsichtig,
 * k = palette[k − 1]. Gespeichert wird die Zelle lauflängenkodiert und als Base64 — so bleibt ein
 * typisches Sprite wenige hundert Byte groß.
 *
 * Andere Werkzeuge (Avatare, Blöcke-Programmieren, Spiele) lesen dieselbe Form: `ausDaten` und
 * `zusammensetzen` reichen, um ein Bild zu zeichnen.
 */

import { modifierAnwenden, type Modifier } from "./modifier";

export interface Ebene {
  id: string; name: string; sichtbar: boolean; deckkraft: number;
  /** nicht-destruktive Effekte (Farbe, Umriss), wirken in jedem Bild */
  mods?: Modifier[];
}
export interface Bild { dauer: number }
/** benannter Abschnitt der Zeitleiste, z. B. »laufen« = Bilder 2–5 */
export interface Tag { name: string; von: number; bis: number }

/** gespeicherte Form (JSON) */
export interface PixelDaten {
  v: 1;
  breite: number;
  hoehe: number;
  palette: string[];
  ebenen: Ebene[];
  bilder: Bild[];
  /** je Ebenen-Id: je Bild die kodierte Zelle ("" = leer) */
  zellen: Record<string, string[]>;
  tags: Tag[];
  /** Kachelgröße fürs Raster und die Kachel-Vorschau (0 = aus) */
  kachel: number;
}

/** Arbeitsform im Editor */
export interface Projekt extends Omit<PixelDaten, "zellen"> {
  zellen: Record<string, Uint8Array[]>;
}

export const MAX_SEITE = 256;
export const MAX_BILDER = 64;
export const MAX_EBENEN = 16;
export const MAX_FARBEN = 255;

export const PALETTEN: { id: string; name: string; farben: string[] }[] = [
  { id: "tt16", name: "TT 16", farben: ["#1a1c2c", "#5d275d", "#b13e53", "#ef7d57", "#ffcd75", "#a7f070", "#38b764", "#257179", "#29366f", "#3b5dc9", "#41a6f6", "#73eff7", "#f4f4f4", "#94b0c2", "#566c86", "#333c57"] },
  { id: "retro4", name: "Retro-Grün (4)", farben: ["#0f380f", "#306230", "#8bac0f", "#9bbc0f"] },
  { id: "grau8", name: "Graustufen (8)", farben: ["#000000", "#242424", "#494949", "#6d6d6d", "#929292", "#b6b6b6", "#dbdbdb", "#ffffff"] },
  { id: "figur", name: "Figuren (16)", farben: ["#2b1d14", "#5a3a26", "#8d5a3b", "#c58c62", "#f1c39b", "#ffe3c8", "#3a2a1e", "#6b4423", "#d9a441", "#b52e2e", "#e86a5a", "#2e5fa3", "#6fa8dc", "#3f7d3a", "#ffffff", "#141414"] },
  { id: "natur", name: "Natur (16)", farben: ["#1b2a1f", "#2f4a2a", "#4f7a36", "#86b04a", "#c7d77a", "#6b4b2e", "#9c6d43", "#d1a26a", "#5b5f66", "#8f949b", "#c9ccd1", "#2d5f8a", "#4f97c9", "#a7d7f0", "#f2e6c9", "#fffaf0"] },
];

let zaehler = 0;
export const neueId = () => `e${Date.now().toString(36)}${(zaehler++).toString(36)}`;

export function leereZelle(p: { breite: number; hoehe: number }) { return new Uint8Array(p.breite * p.hoehe); }

export function neuesProjekt(breite: number, hoehe: number, palette: string[] = PALETTEN[0].farben): Projekt {
  const id = neueId();
  const p: Projekt = {
    v: 1, breite, hoehe, palette: [...palette],
    ebenen: [{ id, name: "Ebene 1", sichtbar: true, deckkraft: 1 }],
    bilder: [{ dauer: 120 }], zellen: {}, tags: [], kachel: 0,
  };
  p.zellen[id] = [leereZelle(p)];
  return p;
}

export function klonen(p: Projekt): Projekt {
  return {
    ...p, palette: [...p.palette], ebenen: p.ebenen.map(e => ({ ...e, mods: e.mods?.map(m => ({ ...m })) })), bilder: p.bilder.map(b => ({ ...b })),
    tags: p.tags.map(t => ({ ...t })),
    zellen: Object.fromEntries(Object.entries(p.zellen).map(([k, z]) => [k, z.map(c => c.slice())])),
  };
}

/** belegter Speicher (für die Grenze der Rückgängig-Liste) */
export const groesse = (p: Projekt) => p.breite * p.hoehe * p.bilder.length * p.ebenen.length;

// ---- Kodierung: Lauflänge (Anzahl 1…255, Wert) + Base64

export function kodiere(z: Uint8Array): string {
  if (!z.some(v => v)) return "";
  const aus: number[] = [];
  for (let i = 0; i < z.length;) {
    const v = z[i];
    let n = 1;
    while (i + n < z.length && z[i + n] === v && n < 255) n++;
    aus.push(n, v);
    i += n;
  }
  let s = "";
  for (let i = 0; i < aus.length; i += 0x8000) s += String.fromCharCode(...aus.slice(i, i + 0x8000));
  return btoa(s);
}

export function dekodiere(s: string, laenge: number): Uint8Array {
  const z = new Uint8Array(laenge);
  if (!s) return z;
  const b = atob(s);
  let k = 0;
  for (let i = 0; i + 1 < b.length && k < laenge; i += 2) {
    const n = b.charCodeAt(i), v = b.charCodeAt(i + 1);
    z.fill(v, k, Math.min(laenge, k + n));
    k += n;
  }
  return z;
}

export function zuDaten(p: Projekt): PixelDaten {
  return { ...p, zellen: Object.fromEntries(Object.entries(p.zellen).map(([k, z]) => [k, z.map(kodiere)])) };
}

/** liest gespeicherte Daten tolerant ein: fehlende Zellen werden leer, zu große Werte gekappt */
export function ausDaten(d: PixelDaten): Projekt {
  const breite = Math.max(1, Math.min(MAX_SEITE, d.breite | 0)), hoehe = Math.max(1, Math.min(MAX_SEITE, d.hoehe | 0));
  const bilder = (d.bilder?.length ? d.bilder : [{ dauer: 120 }]).slice(0, MAX_BILDER).map(b => ({ dauer: Math.max(20, b.dauer | 0 || 120) }));
  const ebenen = (d.ebenen?.length ? d.ebenen : [{ id: neueId(), name: "Ebene 1", sichtbar: true, deckkraft: 1 }]).slice(0, MAX_EBENEN);
  const palette = (d.palette ?? []).slice(0, MAX_FARBEN);
  const p: Projekt = { v: 1, breite, hoehe, palette, ebenen, bilder, tags: d.tags ?? [], kachel: d.kachel ?? 0, zellen: {} };
  for (const e of ebenen) {
    p.zellen[e.id] = bilder.map((_, k) => {
      const z = dekodiere(d.zellen?.[e.id]?.[k] ?? "", breite * hoehe);
      for (let i = 0; i < z.length; i++) if (z[i] > palette.length) z[i] = 0;
      return z;
    });
  }
  return p;
}

// ---- Farben

export function hexZuRgb(h: string): [number, number, number] {
  const s = h.replace("#", "");
  const v = parseInt(s.length === 3 ? s.split("").map(c => c + c).join("") : s.slice(0, 6), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
export const rgbZuHex = (r: number, g: number, b: number) => "#" + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, "0")).join("");

/** nächste Palettenfarbe (Wert 1…n) zu einer RGB-Farbe */
export function naechsteFarbe(palette: [number, number, number][], r: number, g: number, b: number): number {
  let best = 1, bd = Infinity;
  for (let k = 0; k < palette.length; k++) {
    const [pr, pg, pb] = palette[k];
    // gewichtet nach Helligkeitsempfinden
    const d = 0.3 * (pr - r) ** 2 + 0.59 * (pg - g) ** 2 + 0.11 * (pb - b) ** 2;
    if (d < bd) { bd = d; best = k + 1; }
  }
  return best;
}

/**
 * Ein Bild aller sichtbaren Ebenen als RGBA (von unten nach oben, mit Deckkraft).
 * `nurEbene` zeigt eine einzelne Ebene, egal ob sichtbar.
 */
export function zusammensetzen(p: Projekt, bild: number, nurEbene?: string, ohneMods = false): Uint8ClampedArray {
  const n = p.breite * p.hoehe, rgba = new Uint8ClampedArray(n * 4);
  const pal = p.palette.map(hexZuRgb);
  for (const e of p.ebenen) {
    if (nurEbene ? e.id !== nurEbene : !e.sichtbar) continue;
    const z = p.zellen[e.id]?.[bild];
    if (!z) continue;
    const a = nurEbene ? 1 : e.deckkraft;
    const mods = ohneMods ? undefined : e.mods?.filter(m => m.an);
    if (mods?.length) {
      // mit Modifiern: Ebene erst für sich, dann darüberlegen
      const eb = ebenenBild(p, e.id, bild, pal);
      modifierAnwenden(eb, p.breite, p.hoehe, mods);
      for (let i = 0; i < n; i++) mische(rgba, i * 4, eb[i * 4], eb[i * 4 + 1], eb[i * 4 + 2], a * eb[i * 4 + 3] / 255);
      continue;
    }
    for (let i = 0; i < n; i++) {
      const v = z[i];
      if (!v) continue;
      const [r, g, b] = pal[v - 1] ?? [255, 0, 255];
      mische(rgba, i * 4, r, g, b, a);
    }
  }
  return rgba;
}

/** eine Ebene als RGBA, ohne Modifier */
export function ebenenBild(p: Projekt, ebene: string, bild: number, pal = p.palette.map(hexZuRgb)): Uint8ClampedArray {
  const z = p.zellen[ebene][bild], eb = new Uint8ClampedArray(z.length * 4);
  for (let i = 0; i < z.length; i++) {
    const v = z[i];
    if (!v) continue;
    const [r, g, b] = pal[v - 1] ?? [255, 0, 255];
    eb[i * 4] = r; eb[i * 4 + 1] = g; eb[i * 4 + 2] = b; eb[i * 4 + 3] = 255;
  }
  return eb;
}

/** Farbe mit Deckkraft a (0…1) über das Ziel legen */
function mische(rgba: Uint8ClampedArray, o: number, r: number, g: number, b: number, a: number) {
  if (a <= 0) return;
  if (a >= 1) { rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = 255; return; }
  const da = rgba[o + 3] / 255, na = a + da * (1 - a);
  rgba[o] = (r * a + rgba[o] * da * (1 - a)) / na;
  rgba[o + 1] = (g * a + rgba[o + 1] * da * (1 - a)) / na;
  rgba[o + 2] = (b * a + rgba[o + 2] * da * (1 - a)) / na;
  rgba[o + 3] = na * 255;
}

/** Bild als Palettenwerte (für GIF): Deckkraft unter 50 % gilt als durchsichtig, Mischfarben → nächste Farbe */
export function zusammensetzenIndex(p: Projekt, bild: number): Uint8Array {
  const rgba = zusammensetzen(p, bild), pal = p.palette.map(hexZuRgb), z = new Uint8Array(p.breite * p.hoehe);
  for (let i = 0; i < z.length; i++) {
    if (rgba[i * 4 + 3] < 128) continue;
    z[i] = naechsteFarbe(pal, rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
  }
  return z;
}
