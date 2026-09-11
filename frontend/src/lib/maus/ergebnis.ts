/**
 * Ergebnisse der Stufen, die Summe für die Bestenliste — und der Abgleich, ob
 * die Datei, die ein Kind aus dem Explorer zurückzieht, wirklich sein
 * Führerschein ist.
 *
 * Die Datei wird dafür nur im Browser gelesen; hochgeladen wird nichts.
 * »Bild speichern unter …« legt die Bytes des Bildes unverändert ab, deshalb
 * reicht eine Prüfsumme über den Inhalt. Bewusst kein `crypto.subtle`: das
 * gibt es nur auf https oder localhost, und ein Schulserver im eigenen Netz
 * läuft oft über http — dann erschiene gar kein Führerschein. Sicher muss die
 * Summe nicht sein, nur wiedererkennbar. Die Summen der letzten Blätter
 * liegen im localStorage — lädt jemand zwischen Speichern und Zurückziehen die
 * Seite neu, entsteht ein neues Blatt, und das alte soll trotzdem zählen.
 */
import { DOPPELKLICK, KLICK, hoechstPunkte } from "./klickspiele";
import { KOPIER_AUFGABEN, MARKIER_AUFGABEN, PUNKTE_KOPIEREN, PUNKTE_MARKIEREN } from "./text";
import { SPUREN } from "./spur";

export type StufeId = "klick" | "doppelklick" | "rechtsklick" | "ziehen" | "markieren" | "kopieren";

export type StufenErgebnis = {
  punkte: number;
  dauerMs: number;
  /** Kurze Zeilen fürs Blatt, z. B. »Trefferquote 90 %«. */
  details: string[];
};

export type Ergebnisse = Partial<Record<StufeId, StufenErgebnis>>;

export const PUNKTE_RECHTSKLICK = 500;

/** Die Obergrenzen, die auch der Server prüft (api/routers/maus.py). */
export const GRENZEN = { klick: 24000, doppelklick: 13500, ziehen: 6000, gesamt: 50000 } as const;
export type MausModus = keyof typeof GRENZEN;

export const HOECHST: Record<StufeId, number> = {
  klick: hoechstPunkte(KLICK),
  doppelklick: hoechstPunkte(DOPPELKLICK),
  rechtsklick: PUNKTE_RECHTSKLICK,
  ziehen: SPUREN.length * 1000 + 2 * 1000,
  markieren: MARKIER_AUFGABEN.length * PUNKTE_MARKIEREN,
  kopieren: KOPIER_AUFGABEN.length * PUNKTE_KOPIEREN,
};

export function gesamt(ergebnisse: Ergebnisse): number {
  return Object.values(ergebnisse).reduce((s, e) => s + (e?.punkte ?? 0), 0);
}

export function sekunden(ms: number): string {
  return `${(ms / 1000).toFixed(1).replace(".", ",")} s`;
}

/** Zwei FNV-1a-Durchläufe mit verschiedenem Startwert, dazu die Länge. */
export function pruefsumme(daten: ArrayBuffer): string {
  const bytes = new Uint8Array(daten);
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < bytes.length; i++) {
    a = Math.imul(a ^ bytes[i], 0x01000193);
    b = Math.imul(b ^ bytes[i], 0x01000193) ^ (b >>> 13);
  }
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, "0");
  return `${bytes.length.toString(16)}-${hex(a)}${hex(b)}`;
}

const SCHLUESSEL = "hp_maus_blaetter";
// Jede Namensänderung zeichnet ein neues Blatt — ein früher gespeichertes soll trotzdem zählen.
const BEHALTEN = 20;

export function merkeBlatt(hash: string): void {
  try {
    const alt = bekannteBlaetter().filter(h => h !== hash);
    localStorage.setItem(SCHLUESSEL, JSON.stringify([hash, ...alt].slice(0, BEHALTEN)));
  } catch {}
}

export function bekannteBlaetter(): string[] {
  try {
    const liste = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? "[]");
    return Array.isArray(liste) ? liste.filter(h => typeof h === "string") : [];
  } catch {
    return [];
  }
}

/** Sieht der Dateiname so aus, als hätte ihn niemand vergeben? */
export function nichtssagenderName(dateiname: string): boolean {
  const stamm = dateiname.replace(/\.[^.]+$/, "").toLowerCase();
  return /^(download|unbenannt|bild|image)(\s*\(\d+\))?$/.test(stamm)
    || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(stamm);
}
