/**
 * Farbmodelle: dieselbe Farbe als RGB, Hex, CMYK, HSV und HSL — und zurück.
 * Dazu die Logik des Hex-Farbmischers. Reine Rechnung, der Zufall ist
 * einsteckbar (Tests).
 */
import { schreibe } from "./stellenwert";

export type Rgb = [number, number, number];
type Zufall = () => number;
const ganz = (r: Zufall, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const wahl = <T,>(r: Zufall, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];
const kanal = (x: number) => Math.max(0, Math.min(255, Math.round(x)));

// ── Hex ──────────────────────────────────────────────────────────────────────

export const hexFarbe = (c: Rgb) => "#" + c.map(k => schreibe(k, 16, 2)).join("");

/** »#C80F3A«, »c80f3a« oder die Kurzform »#C83« (jede Ziffer verdoppelt). Ungültiges gibt null. */
export function ausHex(text: string): Rgb | null {
  const t = text.trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(t)) return [0, 1, 2].map(i => parseInt(t[i] + t[i], 16)) as Rgb;
  if (/^[0-9a-f]{6}$/i.test(t)) return [0, 2, 4].map(i => parseInt(t.slice(i, i + 2), 16)) as Rgb;
  return null;
}

/** Lässt sich die Farbe kurz schreiben (#AABBCC → #ABC)? */
export const kurzHex = (c: Rgb) => (c.every(k => k % 17 === 0) ? "#" + c.map(k => schreibe(k / 17, 16)).join("") : null);

// ── CMYK (Druck, Prozent) ────────────────────────────────────────────────────

export type Cmyk = [number, number, number, number];

/** Schwarz zuerst: K deckt das gemeinsame Dunkle ab, C/M/Y nur den Rest. */
export function rgbZuCmyk([r, g, b]: Rgb): Cmyk {
  const k = 1 - Math.max(r, g, b) / 255;
  if (k >= 1) return [0, 0, 0, 100];
  const c = (x: number) => ((1 - x / 255 - k) / (1 - k)) * 100;
  return [c(r), c(g), c(b), k * 100];
}

export const cmykZuRgb = ([c, m, y, k]: Cmyk): Rgb =>
  [c, m, y].map(x => kanal(255 * (1 - x / 100) * (1 - k / 100))) as Rgb;

// ── HSV und HSL (Farbton in Grad, Rest in Prozent) ───────────────────────────

function farbton([r, g, b]: Rgb, max: number, d: number): number {
  if (d === 0) return 0;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return (h * 60 + 360) % 360;
}

export function rgbZuHsv(c: Rgb): [number, number, number] {
  const max = Math.max(...c), d = max - Math.min(...c);
  return [farbton(c, max, d), max ? (d / max) * 100 : 0, (max / 255) * 100];
}

/** Farbton h, Buntheit s, Helligkeit v — der Farbkegel mit Weiß-Grau-Schwarz-Achse. */
export function hsvZuRgb(h: number, s: number, v: number): Rgb {
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return kanal(255 * (v / 100) * (1 - (s / 100) * Math.max(0, Math.min(k, 4 - k, 1))));
  };
  return [f(5), f(3), f(1)];
}

export function rgbZuHsl(c: Rgb): [number, number, number] {
  const max = Math.max(...c), min = Math.min(...c), d = max - min;
  const l = (max + min) / 510;
  const s = d === 0 ? 0 : d / 255 / (1 - Math.abs(2 * l - 1));
  return [farbton(c, max, d), s * 100, l * 100];
}

export function hslZuRgb(h: number, s: number, l: number): Rgb {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return kanal(255 * (l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

/** Gegenfarbe: jeder Kanal 255 minus seinen Wert (wie ein Negativ). */
export const umkehren = (c: Rgb): Rgb => c.map(k => 255 - k) as Rgb;

/** Grauwert, wie das Auge die Helligkeit empfindet (Grün zählt am meisten). */
export const grau = ([r, g, b]: Rgb) => Math.round(0.299 * r + 0.587 * g + 0.114 * b);

// ── Hex-Farbmischer ──────────────────────────────────────────────────────────

/**
 * Stufe 1: je Kanal 00, 80 oder FF. Stufe 2: die Einerstelle ist 0 (A0, 30 …).
 * Stufe 3: alles. Nie ganz Schwarz oder ganz Weiß, das wäre geschenkt.
 */
export function zielFarbe(stufe: 1 | 2 | 3, r: Zufall = Math.random): Rgb {
  for (;;) {
    const k = () => (stufe === 1 ? wahl(r, [0x00, 0x80, 0xff]) : stufe === 2 ? ganz(r, 0, 15) * 16 : ganz(r, 0, 255));
    const c: Rgb = [k(), k(), k()];
    const hex = hexFarbe(c);
    if (hex !== "#000000" && hex !== "#FFFFFF") return c;
  }
}

/** 0 = gleich, 1 = Schwarz gegen Weiß */
export const farbAbstand = (a: Rgb, b: Rgb) =>
  Math.sqrt(a.reduce((s, k, i) => s + (k - b[i]) ** 2, 0)) / Math.sqrt(3 * 255 ** 2);

export const farbSterne = (abstand: number) => (abstand <= 0.02 ? 3 : abstand <= 0.07 ? 2 : abstand <= 0.15 ? 1 : 0);
