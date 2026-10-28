/**
 * Logik der vier Stellenwert-Spiele: Bit-Fall, Hex-Farbmischer, Zählwerk-Rennen
 * und Geheimbotschaft. Reine Rechnung, der Zufall ist einsteckbar (Tests).
 */
import { ausZiffern, schreibe, uebertragsStart, ziffernVon, type Basis } from "./stellenwert";

type Zufall = () => number;
const ganz = (r: Zufall, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const wahl = <T,>(r: Zufall, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

// ── Bit-Fall ─────────────────────────────────────────────────────────────────

/** »setzen«: Zahl steht da, Bits schalten. »lesen«: Bits stehen da, Zahl tippen. */
export type FallZeile = { id: number; art: "setzen" | "lesen"; ziel: number; bits: number; anzeige: 10 | 16 };

export const FALL_HOEHE = 7;
/** Sekunden bis zur nächsten Zeile — jede Stufe etwas schneller, nie unter 4 s. */
export const fallTakt = (stufe: number) => Math.max(4, 13 - stufe * 1.2);
/** Alle 5 gelösten Zeilen eine Stufe höher; ab Stufe 3 acht Bits. */
export const fallStufe = (geloest: number) => 1 + Math.floor(geloest / 5);
export const fallBits = (stufe: number) => (stufe < 3 ? 4 : 8);

export function neueZeile(id: number, stufe: number, anzeige: 10 | 16, r: Zufall = Math.random): FallZeile {
  const bits = fallBits(stufe);
  return { id, art: r() < 0.5 ? "setzen" : "lesen", ziel: ganz(r, 1, 2 ** bits - 1), bits, anzeige };
}

/** Punkte für eine gelöste Zeile: mehr Bits und höhere Stufe zählen mehr. */
export const fallPunkte = (z: FallZeile, stufe: number) => z.bits * 2 + stufe * 2;

// ── Hex-Farbmischer ──────────────────────────────────────────────────────────

export type Rgb = [number, number, number];

export const hexFarbe = (c: Rgb) => "#" + c.map(k => schreibe(k, 16, 2)).join("");

/**
 * Stufe 1: je Kanal 00, 80 oder FF. Stufe 2: die Einerstelle ist 0 (A0, 30 …).
 * Stufe 3: alles. Nie ganz Schwarz oder ganz Weiß, das wäre geschenkt.
 */
export function zielFarbe(stufe: 1 | 2 | 3, r: Zufall = Math.random): Rgb {
  for (;;) {
    const kanal = () => (stufe === 1 ? wahl(r, [0x00, 0x80, 0xff]) : stufe === 2 ? ganz(r, 0, 15) * 16 : ganz(r, 0, 255));
    const c: Rgb = [kanal(), kanal(), kanal()];
    const hex = hexFarbe(c);
    if (hex !== "#000000" && hex !== "#FFFFFF") return c;
  }
}

/** 0 = gleich, 1 = Schwarz gegen Weiß */
export const farbAbstand = (a: Rgb, b: Rgb) =>
  Math.sqrt(a.reduce((s, k, i) => s + (k - b[i]) ** 2, 0)) / Math.sqrt(3 * 255 ** 2);

export const farbSterne = (abstand: number) => (abstand <= 0.02 ? 3 : abstand <= 0.07 ? 2 : abstand <= 0.15 ? 1 : 0);

// ── Zählwerk-Rennen ──────────────────────────────────────────────────────────

export type ZaehlRunde = { basis: Basis; stellen: number; start: number; schritt: number };

/** Wie weit die Zahlen im Zehnersystem reichen: Anzahl der Walzen. */
export const DEZ_BEREICHE = [
  { id: "4", label: "bis 1 000", stellen: 4 },
  { id: "7", label: "bis 1 Million", stellen: 7 },
  { id: "10", label: "bis 1 Milliarde", stellen: 10 },
] as const;

/**
 * Zehnersystem: gezählt wird in Stellenwerten (+ 1 H, − 1 T, + 3 Z …).
 * Stufe 1: + 1 E. Stufe 2: ± 1 an irgendeiner Stelle, mit Übertragskette.
 * Stufe 3: + oder − eine Ziffer 2–9 an irgendeiner Stelle.
 */
function zehnerRunde(stufe: 1 | 2 | 3, stellen: number, r: Zufall): ZaehlRunde {
  const exp = stufe === 1 ? 0 : ganz(r, 0, stellen - 2);
  const minus = stufe > 1 && r() < 0.5;
  const anzahl = stufe === 3 ? ganz(r, 2, 9) : 1;
  const schritt = (minus ? -1 : 1) * anzahl * 10 ** exp;
  // Ziffern von rechts: unter exp beliebig, ab exp eine Kette, die beim Rechnen umspringt
  const z = Array.from({ length: stellen }, () => ganz(r, 0, 9));
  const kette = ganz(r, 1, Math.max(1, Math.min(4, stellen - 1 - exp)));
  for (let k = exp; k < exp + kette; k++) z[k] = minus ? 0 : 9;
  if (stufe === 3) z[exp] = minus ? ganz(r, 0, anzahl - 1) : ganz(r, 10 - anzahl, 9);
  // die Stelle hinter der Kette fängt den Übertrag auf — sie darf nicht selbst überlaufen
  z[exp + kette] = minus ? ganz(r, 1, 9) : ganz(r, 0, 8);
  const start = z.reduce((s, d, k) => s + d * 10 ** k, 0);
  return { basis: 10, stellen, start, schritt };
}

/** Schritt im Zehnersystem als Stellenwert: 300 → 3 H */
export function zehnerSchritt(schritt: number) {
  let exp = 0, n = Math.abs(schritt);
  while (n >= 10 && n % 10 === 0) { n /= 10; exp++; }
  return { anzahl: n, exp };
}

/**
 * Stufe 1: +1. Stufe 2: +1 oder −1, gern mit langen Übertragsketten.
 * Stufe 3: + ein Stellenwert (10₂, 100₂, 10₁₆ …) oder eine kleine Zahl.
 * Im Zehnersystem siehe `zehnerRunde`; `dezStellen` = Anzahl der Walzen dort.
 */
export function zaehlRunde(stufe: 1 | 2 | 3, basen: readonly Basis[], r: Zufall = Math.random, dezStellen = 4): ZaehlRunde {
  const basis = wahl(r, basen);
  if (basis === 10) return zehnerRunde(stufe, dezStellen, r);
  const stellen = basis === 2 ? ganz(r, 4, 6) : ganz(r, 3, 4);
  const max = basis ** stellen - 1;
  if (stufe === 1) return { basis, stellen, start: r() < 0.6 ? uebertragsStart(r, basis, stellen) : ganz(r, 0, max - 1), schritt: 1 };
  if (stufe === 2) {
    const s = uebertragsStart(r, basis, stellen);
    return r() < 0.5 ? { basis, stellen, start: s, schritt: 1 } : { basis, stellen, start: s + 1, schritt: -1 };
  }
  const schritt = r() < 0.6 ? basis ** ganz(r, 1, 2) : ganz(r, 2, basis === 2 ? 3 : basis - 1);
  const start = ganz(r, 0, max - schritt);
  return { basis, stellen, start, schritt };
}

export const zaehlZiel = (z: ZaehlRunde) => z.start + z.schritt;

// ── Geheimbotschaft ──────────────────────────────────────────────────────────

export const BOTSCHAFTEN = [
  "HALLO", "GEHEIM", "PIZZA", "MATHE IST TOLL", "DU BIST SPITZE", "TREFFEN UM 3", "BYTE", "CODE GEKNACKT",
  "Hallo Welt", "Hex ist 16", "Bits und Bytes", "Pause!", "Nicht weitersagen", "Wo ist der Schatz?",
  "Agent 007", "Info ist cool", "Kakao bitte", "Morgen frei?", "Der Hund bellt", "Ich bin ein Roboter",
] as const;

/** Was ASCII nicht kennt: Umlaute ausschreiben, Unbekanntes wird »?«. */
export function asciiSicher(text: string): string {
  return text
    .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/Ä/g, "Ae").replace(/Ö/g, "Oe").replace(/Ü/g, "Ue").replace(/ß/g, "ss")
    .split("").map(c => (c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126 ? c : "?")).join("");
}

/** Jedes Zeichen als ein Byte: 8 Bits oder 2 Hex-Ziffern. */
export const codiere = (text: string, basis: 2 | 16) =>
  asciiSicher(text).split("").map(c => schreibe(c.charCodeAt(0), basis, basis === 2 ? 8 : 2).replace(/\s/g, ""));

/** Byte-Folge (durch Leerzeichen getrennt) zurück zu Text; null bei Unlesbarem. */
export function decodiere(code: string, basis: 2 | 16): string | null {
  const teile = code.trim().split(/[\s,;]+/).filter(Boolean);
  if (!teile.length) return null;
  const muster = basis === 2 ? /^[01]{1,8}$/ : /^[0-9a-f]{1,2}$/i;
  if (!teile.every(t => muster.test(t))) return null;
  return teile.map(t => String.fromCharCode(parseInt(t, basis))).join("");
}

/** Bits eines Bytes, um sie als Schalter zu zeigen. */
export const bitsVon = (n: number, bits: number) => ziffernVon(n, 2, bits);
export const ausBits = (b: number[]) => ausZiffern(b, 2);
