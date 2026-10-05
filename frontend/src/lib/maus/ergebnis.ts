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

export type StufeId =
  | "klick" | "doppelklick" | "rechtsklick" | "ziehen" | "markieren" | "kopieren"
  | "scrollen" | "tastatur" | "explorer" | "fenster" | "datei" | "screenshot"
  | "suche" | "apps" | "aussehen" | "bedienhilfe" | "taskleiste" | "profil";

export type Teil = 1 | 2 | 3;

/** Die übenden Stufen je Teil — »Speichern« schließt jeden Teil ab und zählt nicht mit. */
export const TEILE: Record<Teil, StufeId[]> = {
  1: ["klick", "doppelklick", "rechtsklick", "ziehen", "markieren", "kopieren"],
  2: ["scrollen", "tastatur", "explorer", "fenster", "datei"],
  3: ["suche", "apps", "screenshot", "aussehen", "bedienhilfe", "taskleiste", "profil"],
};

/** Jede Stufe von Teil 2 und 3 bringt höchstens so viel — Punkte = 1000 · gelöst / Aufgaben. */
export const PUNKTE_TEIL2 = 1000;

export type StufenErgebnis = {
  punkte: number;
  dauerMs: number;
  /** Kurze Zeilen fürs Blatt, z. B. »Trefferquote 90 %«. */
  details: string[];
};

export type Ergebnisse = Partial<Record<StufeId, StufenErgebnis>>;

export const PUNKTE_RECHTSKLICK = 500;

/** Die Obergrenzen, die auch der Server prüft (api/routers/maus.py). */
export const GRENZEN = { klick: 24000, doppelklick: 13500, ziehen: 6000, gesamt: 70000 } as const;
export type MausModus = keyof typeof GRENZEN;

export const HOECHST: Record<StufeId, number> = {
  klick: hoechstPunkte(KLICK),
  doppelklick: hoechstPunkte(DOPPELKLICK),
  rechtsklick: PUNKTE_RECHTSKLICK,
  ziehen: SPUREN.length * 1000 + 2 * 1000,
  markieren: MARKIER_AUFGABEN.length * PUNKTE_MARKIEREN,
  kopieren: KOPIER_AUFGABEN.length * PUNKTE_KOPIEREN,
  scrollen: PUNKTE_TEIL2,
  tastatur: PUNKTE_TEIL2,
  explorer: PUNKTE_TEIL2,
  fenster: PUNKTE_TEIL2,
  datei: PUNKTE_TEIL2,
  screenshot: PUNKTE_TEIL2,
  suche: PUNKTE_TEIL2,
  apps: PUNKTE_TEIL2,
  aussehen: PUNKTE_TEIL2,
  bedienhilfe: PUNKTE_TEIL2,
  taskleiste: PUNKTE_TEIL2,
  profil: PUNKTE_TEIL2,
};

/**
 * Woran die Sterne gemessen werden. Meist das Höchstmaß — nur bei den
 * Klickspielen nicht: deren Höchstwert verlangt Klicks in null Sekunden auf
 * der höchsten Stufe. Bezug ist dort ein sehr guter Lauf eines Kindes.
 */
export const STERN_BEZUG: Record<StufeId, number> = {
  ...HOECHST,
  klick: 12000,
  doppelklick: 6500,
};

/** 0 = nicht gemacht; sonst 1–3 Sterne (ab 45 % bzw. 80 % des Bezugs). */
export function sterne(stufe: StufeId, punkte: number): 0 | 1 | 2 | 3 {
  if (punkte <= 0) return 0;
  const anteil = punkte / STERN_BEZUG[stufe];
  return anteil >= 0.8 ? 3 : anteil >= 0.45 ? 2 : 1;
}

export function gesamt(ergebnisse: Ergebnisse): number {
  return Object.values(ergebnisse).reduce((s, e) => s + (e?.punkte ?? 0), 0);
}

export function teilSumme(ergebnisse: Ergebnisse, teil: Teil): number {
  return TEILE[teil].reduce((s, id) => s + (ergebnisse[id]?.punkte ?? 0), 0);
}

/** Bestanden heißt: jede Stufe des Teils geschafft, keine übersprungen. */
export function teilBestanden(ergebnisse: Ergebnisse, teil: Teil): boolean {
  return TEILE[teil].every(id => (ergebnisse[id]?.punkte ?? 0) > 0);
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
