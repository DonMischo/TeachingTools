/**
 * Stufe »Welche App?« — reine Helfer ohne Bildschirm.
 *
 * Runde 1: zu einer Aufgabe die passende App finden (APP_AUFGABEN).
 * Runde 2: zu einer Datei die passende App finden (DATEITYPEN).
 */
import { ALLE_APPS, APP_AUFGABEN, DATEITYPEN, type AppId, type Dateityp, type AppAufgabe } from "./windows";

/** Alle Apps außer den System-Kacheln — die trägt man nicht auf sie. */
export const AUSWAHL_APPS: AppId[] = ALLE_APPS.filter(a => a.art !== "system").map(a => a.id);

/** Zieht `n` Einträge aus `liste` in zufälliger, aber für die Runde fester Reihenfolge. */
export function ziehKarten<T>(liste: T[], n: number, zufall: () => number = Math.random): T[] {
  const kopie = liste.slice();
  for (let i = kopie.length - 1; i > 0; i--) {
    const j = Math.floor(zufall() * (i + 1));
    [kopie[i], kopie[j]] = [kopie[j], kopie[i]];
  }
  return kopie.slice(0, Math.min(n, kopie.length));
}

/** Weitere Apps, die ebenfalls richtig gewesen wären — ohne die gerade gewählte. */
export function alternativen(aufgabe: { richtig: AppId[] }, gewaehlt: AppId): AppId[] {
  return aufgabe.richtig.filter(id => id !== gewaehlt);
}

export type AppKarte = { art: "aufgabe"; aufgabe: AppAufgabe } | { art: "datei"; datei: Dateityp };

export function kartenText(karte: AppKarte): string {
  return karte.art === "aufgabe" ? karte.aufgabe.text : karte.datei.beispiel;
}

export function kartenRichtig(karte: AppKarte): AppId[] {
  return karte.art === "aufgabe" ? karte.aufgabe.richtig : karte.datei.richtig;
}

export { APP_AUFGABEN, DATEITYPEN };
