/** Regeln des Glücksrads: Rätselwand maskieren, Rad-Felder, Preise. */
export const KONSONANTEN = ["b", "c", "d", "f", "g", "h", "j", "k", "l", "m", "n", "p", "q", "r", "s", "t", "v", "w", "x", "y", "z", "ß"];
export const VOKALE = ["a", "e", "i", "o", "u", "ä", "ö", "ü"];
export const VOKAL_PREIS = 250;
export const GALGEN_MAX = 8;
export const BONUS_JE_BUCHSTABE = 20;
/** Höchstens so viel Geld wird je Rätsel erwartet (für das Maximum der Bestenliste). */
export const MAX_JE_RAETSEL = 5000;

export type Feld = { art: "betrag"; betrag: number } | { art: "bankrott" } | { art: "aussetzen" };
const B = (betrag: number): Feld => ({ art: "betrag", betrag });
const BANKROTT: Feld = { art: "bankrott" };
const AUSSETZEN: Feld = { art: "aussetzen" };
export const RAD: Feld[] = [
  B(100), B(300), B(500), BANKROTT, B(800), B(400), B(1000), B(250),
  B(600), B(150), AUSSETZEN, B(350), B(900), B(450), BANKROTT, B(200),
];

const klein = (z: string) => z.toLowerCase();
/** Ob das Zeichen ein ratbarer Buchstabe ist (A–Z, Ä Ö Ü ß); alles andere steht offen da. */
export const istRatbar = (z: string) => KONSONANTEN.includes(klein(z)) || VOKALE.includes(klein(z));
export const istVokal = (z: string) => VOKALE.includes(klein(z));

/** Wie oft der Buchstabe im Text vorkommt (ohne Beachtung der Groß-/Kleinschreibung). */
export function zaehle(text: string, buchstabe: string): number {
  const b = klein(buchstabe);
  return Array.from(text).filter((z) => klein(z) === b).length;
}

export type Kachel = { zeichen: string; verdeckt: boolean };
/** Text als Wörter aus Kacheln; verdeckt ist nur ein noch nicht aufgedeckter, ratbarer Buchstabe. */
export function maskiere(text: string, aufgedeckt: readonly string[], alles = false): Kachel[][] {
  return text.split(/\s+/).filter(Boolean).map((wort) =>
    Array.from(wort).map((zeichen) => ({ zeichen, verdeckt: !alles && istRatbar(zeichen) && !aufgedeckt.includes(klein(zeichen)) })));
}

/** Anzahl der noch verdeckten Buchstaben-Kacheln. */
export const verdeckte = (text: string, aufgedeckt: readonly string[], alles = false) =>
  maskiere(text, aufgedeckt, alles).flat().filter((k) => k.verdeckt).length;
