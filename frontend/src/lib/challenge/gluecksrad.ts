/** Regeln des Glücksrads (umgedreht): Die Rätselwand verdeckt den Etappentitel; jede richtig beantwortete Frage deckt ihren Anteil der Buchstaben auf. */
import { hashText, mische, rng } from "./zufall";

export const KONSONANTEN = ["b", "c", "d", "f", "g", "h", "j", "k", "l", "m", "n", "p", "q", "r", "s", "t", "v", "w", "x", "y", "z", "ß"];
export const VOKALE = ["a", "e", "i", "o", "u", "ä", "ö", "ü"];
/** Galgenteile; zwei je verlorenem Leben, voll beim letzten. */
export const GALGEN_MAX = 6;
/** Münzen je Stärke einer Frage; Kombo gibt die Hälfte dazu. */
export const MUENZEN_JE_STAERKE = 100;

const klein = (z: string) => z.toLowerCase();
/** Ob das Zeichen ein ratbarer Buchstabe ist (A–Z, Ä Ö Ü ß); alles andere steht offen da. */
export const istRatbar = (z: string) => KONSONANTEN.includes(klein(z)) || VOKALE.includes(klein(z));

export type Kachel = { zeichen: string; verdeckt: boolean };
/** Text als Wörter aus Kacheln; verdeckt ist nur ein noch nicht aufgedeckter, ratbarer Buchstabe. */
export function maskiere(text: string, aufgedeckt: readonly string[], alles = false): Kachel[][] {
  return text.split(/\s+/).filter(Boolean).map((wort) =>
    Array.from(wort).map((zeichen) => ({ zeichen, verdeckt: !alles && istRatbar(zeichen) && !aufgedeckt.includes(klein(zeichen)) })));
}

/** Anzahl der noch verdeckten Buchstaben-Kacheln. */
export const verdeckte = (text: string, aufgedeckt: readonly string[], alles = false) =>
  maskiere(text, aufgedeckt, alles).flat().filter((k) => k.verdeckt).length;

/**
 * Verteilt die verschiedenen Buchstaben des Textes auf die Fragen (gemischt, aber fest je Text, reihum):
 * jede Frage bekommt ihren Anteil; sind es mehr Fragen als Buchstaben, bleiben manche leer.
 */
export function verteile(text: string, ids: readonly string[]): Record<string, string[]> {
  const buchstaben = [...new Set(Array.from(text).filter(istRatbar).map(klein))];
  const reihe = mische(buchstaben, rng(hashText(text)));
  const sortiert = [...ids].sort();
  const anteil: Record<string, string[]> = Object.fromEntries(sortiert.map((id) => [id, []]));
  reihe.forEach((b, i) => { if (sortiert.length) anteil[sortiert[i % sortiert.length]].push(b); });
  return anteil;
}

/** Aufgedeckte Buchstaben: ganze Anteile der gelösten Fragen, die erste Hälfte bei Teiltreffern. */
export function aufgedeckt(anteil: Record<string, string[]>, geloest: readonly string[], teil: readonly string[] = []): string[] {
  return Object.entries(anteil).flatMap(([id, b]) => (geloest.includes(id) ? b : teil.includes(id) ? b.slice(0, Math.ceil(b.length / 2)) : []));
}

/** Galgenteile aus den verlorenen Leben (Start mit `start` Leben). */
export const galgenTeile = (leben: number, start = 3) => Math.max(0, Math.min(GALGEN_MAX, Math.round(((start - leben) / start) * GALGEN_MAX)));
