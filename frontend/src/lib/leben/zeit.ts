/**
 * Spielkalender. Ein Spieltag ist eine ganze Zahl ab dem Start
 * (1. Juli 2026, Zeugnisübergabe ist vorbei); dazu kommt die Uhrzeit in
 * Stunden. Gerechnet wird in UTC, damit Sommerzeit nichts verschiebt.
 */

export const START = Date.UTC(2026, 6, 1); // 1. Juli 2026
export const DAUER_JAHRE = 5;
export const ENDE_TAG = Math.round((Date.UTC(2031, 6, 1) - START) / 86400000); // 1. Juli 2031 = Spielende

const TAG_MS = 86400000;

export function datum(tag: number): Date {
  return new Date(START + tag * TAG_MS);
}

export function tagVon(jahr: number, monat: number, tagImMonat: number): number {
  return Math.round((Date.UTC(jahr, monat - 1, tagImMonat) - START) / TAG_MS);
}

export function jahrVon(tag: number): number {
  return datum(tag).getUTCFullYear();
}

/** 1–12 */
export function monatVon(tag: number): number {
  return datum(tag).getUTCMonth() + 1;
}

export function tagImMonat(tag: number): number {
  return datum(tag).getUTCDate();
}

/** Laufender Monat seit Spielbeginn (Juli 2026 = 0). */
export function monatsIndex(tag: number): number {
  const d = datum(tag);
  return (d.getUTCFullYear() - 2026) * 12 + d.getUTCMonth() - 6;
}

export function monatsLetzter(tag: number): number {
  const d = datum(tag);
  return tagVon(d.getUTCFullYear(), d.getUTCMonth() + 2, 1) - 1;
}

export function istMonatsletzter(tag: number): boolean {
  return monatsLetzter(tag) === tag;
}

/** 0 = Montag … 6 = Sonntag */
export function wochentag(tag: number): number {
  return (datum(tag).getUTCDay() + 6) % 7;
}

export const WOCHENTAGE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"];
export const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August",
  "September", "Oktober", "November", "Dezember"];

export function datumText(tag: number, lang = false): string {
  const d = datum(tag);
  const t = `${d.getUTCDate()}. ${MONATE[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return lang ? `${WOCHENTAGE[wochentag(tag)]}, ${t}` : t;
}

export function kurzDatum(tag: number): string {
  const d = datum(tag);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
}

export function monatText(tag: number): string {
  const d = datum(tag);
  return `${MONATE[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

export function uhrText(stunde: number): string {
  const h = Math.floor(stunde) % 24;
  const m = Math.floor((stunde - Math.floor(stunde)) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Ostersonntag (Gauß/Anonymous Gregorian) als Spieltag. */
function ostersonntag(jahr: number): number {
  const a = jahr % 19, b = Math.floor(jahr / 100), c = jahr % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const monat = Math.floor((h + l - 7 * m + 114) / 31);
  const tag = ((h + l - 7 * m + 114) % 31) + 1;
  return tagVon(jahr, monat, tag);
}

const FEIERTAGE = new Map<number, Map<number, string>>();

/** Gesetzliche Feiertage in Thüringen (inkl. Weltkindertag und Reformationstag). */
export function feiertage(jahr: number): Map<number, string> {
  const vorhanden = FEIERTAGE.get(jahr);
  if (vorhanden) return vorhanden;
  const o = ostersonntag(jahr);
  const m = new Map<number, string>([
    [tagVon(jahr, 1, 1), "Neujahr"],
    [o - 2, "Karfreitag"],
    [o + 1, "Ostermontag"],
    [tagVon(jahr, 5, 1), "Tag der Arbeit"],
    [o + 39, "Christi Himmelfahrt"],
    [o + 50, "Pfingstmontag"],
    [tagVon(jahr, 9, 20), "Weltkindertag"],
    [tagVon(jahr, 10, 3), "Tag der Deutschen Einheit"],
    [tagVon(jahr, 10, 31), "Reformationstag"],
    [tagVon(jahr, 12, 25), "1. Weihnachtstag"],
    [tagVon(jahr, 12, 26), "2. Weihnachtstag"],
  ]);
  FEIERTAGE.set(jahr, m);
  return m;
}

export function feiertag(tag: number): string | null {
  return feiertage(jahrVon(tag)).get(tag) ?? null;
}

export function istArbeitstag(tag: number): boolean {
  return wochentag(tag) < 5 && !feiertag(tag);
}

/** Alter in vollen Jahren an einem Spieltag. */
export function alterAm(geburtstag: string, tag: number): number {
  const [gj, gm, gt] = geburtstag.split("-").map(Number);
  const d = datum(tag);
  let alter = d.getUTCFullYear() - gj;
  const vorGeburtstag = d.getUTCMonth() + 1 < gm || (d.getUTCMonth() + 1 === gm && d.getUTCDate() < gt);
  if (vorGeburtstag) alter--;
  return alter;
}
