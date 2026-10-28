/**
 * Stellenwertsysteme — Zehner-, Zweier- und Sechzehnersystem. Reine Rechnung:
 * Ziffern zerlegen und zusammensetzen, die Spalten der Stellenwerttafel,
 * Zahlwörter, die Rechenwege fürs Umrechnen und der Aufgabengenerator fürs Üben.
 */

export type Basis = 2 | 10 | 16;

export const BASEN: readonly { basis: Basis; name: string; kurz: string; icon: string }[] = [
  { basis: 10, name: "Zehnersystem", kurz: "Dezimal", icon: "🔟" },
  { basis: 2, name: "Zweiersystem", kurz: "Binär", icon: "💡" },
  { basis: 16, name: "Sechzehnersystem", kurz: "Hexadezimal", icon: "🔣" },
];

export const INDEX: Record<Basis, string> = { 2: "₂", 10: "₁₀", 16: "₁₆" };
const ZEICHEN = "0123456789ABCDEF";
/** schmales geschütztes Leerzeichen für Zifferngruppen */
export const LUECKE = String.fromCharCode(0x202f);

export const ziffer = (d: number) => ZEICHEN[d] ?? "?";

/** Ziffern von n (höchste zuerst), vorne mit Nullen auf `stellen` aufgefüllt. */
export function ziffernVon(n: number, basis: number, stellen = 1): number[] {
  const z: number[] = [];
  let r = Math.floor(n);
  while (r > 0) { z.unshift(r % basis); r = Math.floor(r / basis); }
  while (z.length < stellen) z.unshift(0);
  return z;
}

export const ausZiffern = (z: number[], basis: number) => z.reduce((s, d) => s * basis + d, 0);

function gruppiere(s: string, laenge: number, trenner = LUECKE) {
  const teile: string[] = [];
  for (let i = s.length; i > 0; i -= laenge) teile.unshift(s.slice(Math.max(0, i - laenge), i));
  return teile.join(trenner);
}

/** Ganze Zahl in der Basis, lesbar gruppiert: Dezimal in Dreiern, Binär in Vierern. */
export function schreibe(n: number, basis: Basis, stellen = 1): string {
  const s = ziffernVon(n, basis, stellen).map(ziffer).join("");
  if (basis === 10) return s.length > 4 ? gruppiere(s, 3) : s;
  if (basis === 2) return s.length > 4 ? gruppiere(s, 4, " ") : s;
  return s;
}

/** Dezimalzahl mit Komma und fester Zahl an Nachkommastellen. */
export function dez(x: number, nachkomma = 0): string {
  const e = Math.round(Math.abs(x) * 10 ** nachkomma);
  const ganz = Math.floor(e / 10 ** nachkomma);
  const rest = nachkomma ? "," + String(e % 10 ** nachkomma).padStart(nachkomma, "0") : "";
  return (x < 0 ? "−" : "") + schreibe(ganz, 10) + rest;
}

/** Wie viele Nachkommastellen eine Zahl braucht (höchstens drei). */
export const nachkommaVon = (x: number) => [0, 1, 2, 3].find(k => Math.abs(Math.round(x * 10 ** k) - x * 10 ** k) < 1e-6) ?? 3;

/**
 * Getippte Zahl lesen. Leerzeichen dürfen gruppieren; im Zehnersystem gilt
 * das Komma (Punkte nur als Tausender-Trenner), bei 2 und 16 dürfen 0b/0x/#
 * davorstehen. Ungültiges gibt null.
 */
export function lies(text: string, basis: Basis): number | null {
  let t = text.trim().replace(/[\s_]/g, "");
  if (basis === 16) t = t.replace(/^(0x|#)/i, "");
  if (basis === 2) t = t.replace(/^0b/i, "");
  if (!t) return null;
  if (basis === 10) {
    if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, "");
    return /^\d*\.?\d+$/.test(t) ? Number(t) : null;
  }
  if (!(basis === 2 ? /^[01]+$/ : /^[0-9a-f]+$/i).test(t)) return null;
  return parseInt(t, basis);
}

/** gleich bis auf die dritte Nachkommastelle */
export const gleich = (a: number, b: number) => Math.round(a * 1000) === Math.round(b * 1000);

// ── Spalten der Stellenwerttafel ─────────────────────────────────────────────

export type Spalte = { exp: number; kurz: string; name: string; wert: string; potenz: string; farbe: string };

const DEZ_NAMEN: Record<number, [string, string]> = {
  9: ["Mrd", "Milliarden"], 8: ["HM", "Hundertmillionen"], 7: ["ZM", "Zehnmillionen"], 6: ["M", "Millionen"],
  5: ["HT", "Hunderttausender"], 4: ["ZT", "Zehntausender"], 3: ["T", "Tausender"],
  2: ["H", "Hunderter"], 1: ["Z", "Zehner"], 0: ["E", "Einer"],
  [-1]: ["z", "Zehntel"], [-2]: ["h", "Hundertstel"], [-3]: ["t", "Tausendstel"],
};
/** Dreiergruppen im Zehnersystem: Nachkomma, Einer, Tausender, Millionen, Milliarden */
const DEZ_FARBEN = ["#ec4899", "#3b82f6", "#22c55e", "#f59e0b", "#ef4444"];
/** je Hex-Ziffer eine Farbe; die vier Bits darunter tragen dieselbe */
export const HEX_FARBEN = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6", "#ec4899", "#84cc16"];

const HOCH: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
export const hoch = (n: number) => String(n).split("").map(c => HOCH[c] ?? c).join("");

export function farbe(basis: Basis, exp: number): string {
  if (basis === 10) return DEZ_FARBEN[Math.floor(exp / 3) + 1] ?? DEZ_FARBEN[4];
  if (basis === 16) return HEX_FARBEN[exp % HEX_FARBEN.length];
  return HEX_FARBEN[Math.floor(exp / 4) % HEX_FARBEN.length];
}

/** Stellenwert als Text: 1 000 · 0,01 · 128 · 4 096 */
export function stellenwertText(basis: Basis, exp: number): string {
  if (exp < 0) return dez(10 ** exp, -exp);
  return schreibe(basis ** exp, 10);
}

export function spalte(basis: Basis, exp: number): Spalte {
  const wert = stellenwertText(basis, exp);
  const [kurz, name] = basis === 10
    ? DEZ_NAMEN[exp] ?? [`10${hoch(exp)}`, `10${hoch(exp)}`]
    : [wert, exp === 0 ? "Einer" : `${wert}er`];
  return { exp, kurz, name, wert, potenz: `${basis}${hoch(exp)}`, farbe: farbe(basis, exp) };
}

/** Spalten von links (höchster Stellenwert) nach rechts. */
export const spalten = (basis: Basis, maxExp: number, minExp = 0): Spalte[] =>
  Array.from({ length: maxExp - minExp + 1 }, (_, i) => spalte(basis, maxExp - i));

// ── Rechenwege ───────────────────────────────────────────────────────────────

/** Ziffer mal Stellenwert, alles zusammen ergibt die Zahl im Zehnersystem. */
export function zuDezimalWeg(n: number, basis: number) {
  const z = ziffernVon(n, basis);
  return z.map((d, i) => {
    const stellenwert = basis ** (z.length - 1 - i);
    return { ziffer: d, stellenwert, produkt: d * stellenwert };
  });
}

/** Fortgesetzt durch die Basis teilen; die Reste von unten nach oben gelesen sind die Ziffern. */
export function divisionsWeg(n: number, basis: number) {
  const zeilen: { zahl: number; quotient: number; rest: number }[] = [];
  let zahl = Math.floor(n);
  do {
    zeilen.push({ zahl, quotient: Math.floor(zahl / basis), rest: zahl % basis });
    zahl = Math.floor(zahl / basis);
  } while (zahl > 0);
  return zeilen;
}

/** Von links: wie oft passt der Stellenwert noch in den Rest? */
export function abziehWeg(n: number, basis: number) {
  const z = ziffernVon(n, basis);
  let rest = n;
  return z.map((d, i) => {
    const stellenwert = basis ** (z.length - 1 - i);
    const vorher = rest;
    rest -= d * stellenwert;
    return { stellenwert, ziffer: d, vorher, nachher: rest };
  });
}

/** Vierer-Päckchen: jede Hex-Ziffer mit ihren vier Bits. */
export const paeckchen = (n: number, hexStellen = 1) =>
  ziffernVon(n, 16, hexStellen).map(h => ({ hex: h, bits: ziffernVon(h, 2, 4) }));

/** Welche Stellen sich beim Schritt von a nach b ändern (von rechts gezählt). */
export function geaenderteStellen(a: number, b: number, basis: number, stellen: number): number[] {
  const x = ziffernVon(a, basis, stellen), y = ziffernVon(b, basis, stellen);
  const out: number[] = [];
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    if (x[x.length - 1 - i] !== y[y.length - 1 - i]) out.push(i);
  }
  return out;
}

// ── Zahlwörter ───────────────────────────────────────────────────────────────

const EINER = ["", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun"];
const ZEHNER_ZAHLEN = ["zehn", "elf", "zwölf", "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"];
const ZEHNER = ["", "", "zwanzig", "dreißig", "vierzig", "fünfzig", "sechzig", "siebzig", "achtzig", "neunzig"];

/** 1 … 999; `allein` = am Ende der Zahl (»eins« statt »ein«). */
function bis999(n: number, allein: boolean): string {
  const h = Math.floor(n / 100), r = n % 100;
  let s = h ? EINER[h] + "hundert" : "";
  if (r === 1) s += allein ? "eins" : "ein";
  else if (r < 10) s += EINER[r];
  else if (r < 20) s += ZEHNER_ZAHLEN[r - 10];
  else s += (r % 10 ? EINER[r % 10] + "und" : "") + ZEHNER[Math.floor(r / 10)];
  return s;
}

/** Ganze Zahl als deutsches Zahlwort, bis 999 999 999 999. */
export function zahlwort(n: number): string {
  if (n === 0) return "null";
  const teile: string[] = [];
  const gross = (wert: number, eins: string, viele: string) => {
    if (!wert) return;
    teile.push(wert === 1 ? `eine ${eins}` : `${bis999(wert, false)}${wert % 100 === 1 ? "e" : ""} ${viele}`);
  };
  gross(Math.floor(n / 1e9) % 1000, "Milliarde", "Milliarden");
  gross(Math.floor(n / 1e6) % 1000, "Million", "Millionen");
  const t = Math.floor(n / 1000) % 1000, e = n % 1000;
  const klein = (t ? bis999(t, false) + "tausend" : "") + (e ? bis999(e, true) : "");
  if (klein) teile.push(klein);
  return teile.join(" ");
}

// ── Üben ─────────────────────────────────────────────────────────────────────

export type Stufe = 1 | 2 | 3;
export type UebArt =
  | "ablesen" | "stellenwert" | "zahlwort" | "zerlegt"
  | "binZuDez" | "dezZuBin" | "hexZuDez" | "dezZuHex" | "binHex" | "zaehlen";

export const UEB_ARTEN: readonly { id: UebArt; label: string; gruppe: "dez" | "bin" }[] = [
  { id: "ablesen", label: "🧱 Tafel ablesen", gruppe: "dez" },
  { id: "stellenwert", label: "🎯 Wert einer Ziffer", gruppe: "dez" },
  { id: "zahlwort", label: "🗣️ Zahlwort → Zahl", gruppe: "dez" },
  { id: "zerlegt", label: "🧩 Zerlegt → Zahl", gruppe: "dez" },
  { id: "binZuDez", label: "₂ → ₁₀", gruppe: "bin" },
  { id: "dezZuBin", label: "₁₀ → ₂", gruppe: "bin" },
  { id: "hexZuDez", label: "₁₆ → ₁₀", gruppe: "bin" },
  { id: "dezZuHex", label: "₁₀ → ₁₆", gruppe: "bin" },
  { id: "binHex", label: "₂ ↔ ₁₆", gruppe: "bin" },
  { id: "zaehlen", label: "➕ Weiterzählen", gruppe: "bin" },
];

/** Ziffern in Spalten (exp → Ziffer); leere Spalten bedeuten 0. */
export type TafelBild = { basis: Basis; maxExp: number; minExp: number; ziffern: Record<number, number> };

export type Aufgabe = {
  art: UebArt;
  frage: string;
  /** in welcher Basis geantwortet wird */
  basis: Basis;
  loesung: number;
  tafel?: TafelBild;
  weg: string[];
};

type Zufall = () => number;
const ganz = (r: Zufall, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const wahl = <T,>(r: Zufall, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

/** Zufallszahl mit `stellen` Ziffern, in der gut die Hälfte der Stellen 0 ist (die Falle beim Ablesen). */
function mitNullen(r: Zufall, stellen: number, nullAnteil = 0.35): number {
  const z = [ganz(r, 1, 9)];
  for (let i = 1; i < stellen; i++) z.push(r() < nullAnteil ? 0 : ganz(r, 1, 9));
  return ausZiffern(z, 10);
}

const plus = (teile: string[]) => teile.join(" + ");

function wegZuDez(n: number, basis: Basis): string[] {
  const w = zuDezimalWeg(n, basis).filter(s => s.ziffer);
  return [
    `Stellenwerte: ${zuDezimalWeg(n, basis).map(s => schreibe(s.stellenwert, 10)).join(" | ")}`,
    `${schreibe(n, basis)}${INDEX[basis]} = ${plus(w.map(s => `${basis === 16 ? `${ziffer(s.ziffer)}(=${s.ziffer})` : s.ziffer} · ${schreibe(s.stellenwert, 10)}`)) || "0"}`,
    `= ${plus(w.map(s => schreibe(s.produkt, 10))) || "0"} = ${schreibe(n, 10)}`,
  ];
}

function wegAusDez(n: number, basis: Basis): string[] {
  return [
    ...divisionsWeg(n, basis).map(z => `${schreibe(z.zahl, 10)} : ${basis} = ${schreibe(z.quotient, 10)} Rest ${z.rest}${basis === 16 && z.rest > 9 ? ` (= ${ziffer(z.rest)})` : ""}`),
    `Reste von unten nach oben lesen: ${schreibe(n, basis)}${INDEX[basis]}`,
  ];
}

function bauAblesen(r: Zufall, stufe: Stufe): Aufgabe {
  const komma = stufe === 3 && r() < 0.5;
  const minExp = komma ? -ganz(r, 1, 3) : 0;
  const maxExp = stufe === 1 ? ganz(r, 2, 3) : stufe === 2 ? ganz(r, 4, 6) : komma ? ganz(r, 1, 4) : ganz(r, 6, 9);
  const ziffern: Record<number, number> = {};
  ziffern[maxExp] = ganz(r, 1, 9);
  for (let e = maxExp - 1; e >= minExp; e--) if (r() > 0.4) ziffern[e] = ganz(r, 1, 9);
  if (minExp < 0 && !ziffern[minExp]) ziffern[minExp] = ganz(r, 1, 9);
  const wert = Object.entries(ziffern).reduce((s, [e, d]) => s + d * 10 ** Number(e), 0);
  const nk = -minExp;
  const x = Number(wert.toFixed(nk));
  // die Tafel zeigt nur die belegten Spalten, die Lücken muss man selbst mit 0 füllen
  const breiter = Math.min(9, maxExp + ganz(r, 0, 2));
  return {
    art: "ablesen", basis: 10, loesung: x,
    frage: "Welche Zahl steht in der Stellenwerttafel?",
    tafel: { basis: 10, maxExp: breiter, minExp, ziffern },
    weg: [
      `Leere Spalten zwischen belegten sind Nullen: ${spalten(10, maxExp, minExp).map(s => `${s.kurz} ${ziffern[s.exp] ?? 0}`).join(" · ")}`,
      `Die Zahl: ${dez(x, nk)}`,
    ],
  };
}

function bauStellenwert(r: Zufall, stufe: Stufe): Aufgabe {
  const komma = stufe === 3;
  for (;;) {
    const stellen = stufe === 1 ? ganz(r, 3, 4) : ganz(r, 5, 7);
    const n = mitNullen(r, stellen, 0.2);
    const nk = komma ? ganz(r, 1, 3) : 0;
    const z = ziffernVon(n, 10);
    // eine Ziffer, die nur einmal vorkommt — sonst ist die Frage zweideutig
    const kandidaten = z.map((d, i) => ({ d, i })).filter(({ d }) => d && z.filter(x => x === d).length === 1);
    if (!kandidaten.length) continue;
    const { d, i } = wahl(r, kandidaten);
    const exp = z.length - 1 - i - nk;
    const s = spalte(10, exp);
    const zahl = n / 10 ** nk;
    const wert = d * 10 ** exp;
    return {
      art: "stellenwert", basis: 10, loesung: Number(wert.toFixed(Math.max(0, -exp))),
      frage: `Welchen Wert hat die Ziffer ${d} in ${dez(zahl, nk)}?`,
      weg: [
        `Die ${d} steht bei den ${s.name} (${s.kurz}), Stellenwert ${s.wert}.`,
        `${d} · ${s.wert} = ${dez(wert, Math.max(0, -exp))}`,
      ],
    };
  }
}

function bauZahlwort(r: Zufall, stufe: Stufe): Aufgabe {
  for (;;) {
    const stellen = stufe === 1 ? ganz(r, 3, 4) : stufe === 2 ? ganz(r, 5, 7) : ganz(r, 7, 10);
    const n = mitNullen(r, stellen, 0.45);
    // »zweihunderteine Millionen« klingt schief — solche Zahlen lassen wir aus
    if ([1e6, 1e9].some(g => { const w = Math.floor(n / g) % 1000; return w > 1 && w % 100 === 1; })) continue;
    const wort = zahlwort(n);
    return {
      art: "zahlwort", basis: 10, loesung: n,
      frage: `Schreib als Zahl: »${wort}«`,
      weg: [
        `In Dreiergruppen zerlegen: ${wort.replace(/(milliarden?|millionen?|tausend)/gi, "$1 |")}`,
        `Jede Gruppe dreistellig, fehlende Stellen mit 0 füllen: ${schreibe(n, 10)}`,
      ],
    };
  }
}

function bauZerlegt(r: Zufall, stufe: Stufe): Aufgabe {
  const maxExp = stufe === 1 ? ganz(r, 2, 3) : ganz(r, 4, 7);
  const teile: { exp: number; anzahl: number }[] = [];
  for (let e = maxExp; e >= 0; e--) if (e === maxExp || r() > 0.45) teile.push({ exp: e, anzahl: ganz(r, 1, 9) });
  // Stufe 3: eine Spalte ist überfüllt (z. B. 14 H) und muss gebündelt werden
  if (stufe === 3) { const t = wahl(r, teile.filter(t => t.exp < maxExp).length ? teile.filter(t => t.exp < maxExp) : teile); t.anzahl += 10; }
  const gemischt = stufe === 1 ? teile : [...teile].sort(() => r() - 0.5);
  const n = teile.reduce((s, t) => s + t.anzahl * 10 ** t.exp, 0);
  return {
    art: "zerlegt", basis: 10, loesung: n,
    frage: `Welche Zahl ist ${gemischt.map(t => `${t.anzahl} ${spalte(10, t.exp).kurz}`).join(" + ")}?`,
    weg: [
      `Nach Stellenwert ordnen: ${teile.map(t => `${t.anzahl} · ${spalte(10, t.exp).wert}`).join(" + ")}`,
      ...(stufe === 3 ? ["Was 10 oder mehr ist, wird gebündelt: 10 einer Spalte = 1 der nächsten."] : []),
      `= ${schreibe(n, 10)}`,
    ],
  };
}

function bauBin(r: Zufall, stufe: Stufe, art: "binZuDez" | "dezZuBin"): Aufgabe {
  const bits = stufe === 1 ? 4 : stufe === 2 ? ganz(r, 5, 6) : 8;
  const n = ganz(r, 2 ** (bits - 1), 2 ** bits - 1);
  return art === "binZuDez"
    ? { art, basis: 10, loesung: n, frage: `${schreibe(n, 2)}₂ = ?₁₀`, weg: wegZuDez(n, 2) }
    : { art, basis: 2, loesung: n, frage: `${schreibe(n, 10)}₁₀ = ?₂`, weg: wegAusDez(n, 2) };
}

function bauHex(r: Zufall, stufe: Stufe, art: "hexZuDez" | "dezZuHex"): Aufgabe {
  const n = stufe === 1 ? ganz(r, 16, 255) : stufe === 2 ? ganz(r, 256, 4095) : ganz(r, 4096, 65535);
  return art === "hexZuDez"
    ? { art, basis: 10, loesung: n, frage: `${schreibe(n, 16)}₁₆ = ?₁₀`, weg: wegZuDez(n, 16) }
    : { art, basis: 16, loesung: n, frage: `${schreibe(n, 10)}₁₀ = ?₁₆`, weg: wegAusDez(n, 16) };
}

function bauBinHex(r: Zufall, stufe: Stufe): Aufgabe {
  const hexStellen = stufe === 1 ? 1 : stufe === 2 ? 2 : ganz(r, 3, 4);
  const n = ganz(r, 16 ** (hexStellen - 1), 16 ** hexStellen - 1);
  const p = paeckchen(n, hexStellen);
  const zeile = p.map(x => `${x.bits.join("")} → ${ziffer(x.hex)}`).join(" | ");
  return r() < 0.5
    ? { art: "binHex", basis: 16, loesung: n, frage: `${schreibe(n, 2, hexStellen * 4)}₂ = ?₁₆`,
        weg: ["Von rechts in Vierer-Päckchen teilen, jedes Päckchen ist eine Hex-Ziffer.", zeile, `= ${schreibe(n, 16)}₁₆`] }
    : { art: "binHex", basis: 2, loesung: n, frage: `${schreibe(n, 16)}₁₆ = ?₂`,
        weg: ["Jede Hex-Ziffer wird zu genau vier Bits (8-4-2-1).", zeile, `= ${schreibe(n, 2, hexStellen * 4)}₂`] };
}

/** Start, an dem beim Weiterzählen viel umspringt: hinten stehen lauter größte Ziffern. */
export function uebertragsStart(r: Zufall, basis: Basis, stellen: number): number {
  const neun = ganz(r, 1, Math.max(1, stellen - 1));
  const z = Array.from({ length: stellen }, (_, i) => (i >= stellen - neun ? basis - 1 : ganz(r, 0, basis - 2)));
  return ausZiffern(z, basis);
}

function bauZaehlen(r: Zufall, stufe: Stufe): Aufgabe {
  const basis: Basis = stufe === 1 ? wahl(r, [2, 10] as const) : wahl(r, [2, 16] as const);
  const stellen = basis === 2 ? ganz(r, 4, 6) : ganz(r, 2, 4);
  const start = uebertragsStart(r, basis, stellen);
  const zurueck = stufe === 3 && r() < 0.5;
  // rückwärts zählen wir von start + 1 (hinten lauter Nullen) auf start
  const [von, nach] = zurueck ? [start + 1, start] : [start, start + 1];
  return {
    art: "zaehlen", basis, loesung: nach,
    frage: `Was kommt ${zurueck ? "vor" : "nach"} ${schreibe(von, basis)}${INDEX[basis]}?`,
    weg: [
      zurueck
        ? `Rückwärts: die letzte Ziffer ist 0, also von der nächsten Stelle eins »entbündeln« — die 0 wird zur größten Ziffer ${ziffer(basis - 1)}.`
        : `Die größte Ziffer ist ${ziffer(basis - 1)}. Läuft eine Stelle darüber, wird sie 0 und die nächste Stelle links zählt eins weiter (Übertrag).`,
      `${schreibe(von, basis)} ${zurueck ? "−" : "+"} 1 = ${schreibe(nach, basis)}${INDEX[basis]}`,
    ],
  };
}

export function erzeugeAufgabe(art: UebArt, stufe: Stufe, r: Zufall = Math.random): Aufgabe {
  switch (art) {
    case "ablesen": return bauAblesen(r, stufe);
    case "stellenwert": return bauStellenwert(r, stufe);
    case "zahlwort": return bauZahlwort(r, stufe);
    case "zerlegt": return bauZerlegt(r, stufe);
    case "binZuDez": case "dezZuBin": return bauBin(r, stufe, art);
    case "hexZuDez": case "dezZuHex": return bauHex(r, stufe, art);
    case "binHex": return bauBinHex(r, stufe);
    case "zaehlen": return bauZaehlen(r, stufe);
  }
}

/** true/false, oder null, wenn sich die Eingabe nicht lesen lässt. */
export function pruefe(a: Aufgabe, eingabe: string): boolean | null {
  const x = lies(eingabe, a.basis);
  return x === null ? null : gleich(x, a.loesung);
}

/** Die Lösung so, wie man sie hinschreibt. */
export const loesungText = (a: Aufgabe) =>
  a.basis === 10 ? dez(a.loesung, nachkommaVon(a.loesung)) : schreibe(a.loesung, a.basis) + INDEX[a.basis];
