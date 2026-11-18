/**
 * Punkte und Sterne für die Stufen von Teil 2, 3 und 4.
 *
 * Drei Dinge zählen: wie viele Aufgaben gelöst sind, wie lange es gedauert
 * hat und wie oft etwas danebenging. Großzügig: die Zeitgrenze ist das
 * Fünffache dessen, was ein zehnjähriges Kind mit etwas Übung braucht.
 *
 *     600 × Anteil gelöst
 *   + 250 × Anteil gelöst — voll bis zur Zeitgrenze, danach linear weniger,
 *           bei der doppelten Grenze nichts mehr
 *   + 150 × Anteil gelöst — minus 25 je Fehlversuch, ab sechs nichts mehr
 *
 * Höchstens 1000 (PUNKTE_TEIL2). Sterne vergibt ergebnis.ts: ab 800 drei,
 * ab 450 zwei, sonst einer. Teil 1 rechnet weiter wie gehabt.
 */
import type { StufeId } from "./ergebnis";

export const FAKTOR = 5;

/** Geschätzte Zeit eines Kindes mit etwas Übung — in Sekunden. */
export const RICHTZEIT_S: Partial<Record<StufeId, number>> = {
  scrollen: 60,
  tastatur: 120,
  explorer: 120,
  fenster: 180,
  datei: 180,
  screenshot: 150,
  suche: 90,
  apps: 180,
  aussehen: 90,
  bedienhilfe: 60,
  taskleiste: 120,
  profil: 90,
  handy: 120,
  appstore: 150,
  berechtigungen: 120,
  privatsphaere: 120,
  risiken: 180,
};

export const GRUND = 600;
export const ZEIT_BONUS = 250;
export const FEHLER_BONUS = 150;
export const ABZUG_JE_FEHLER = 25;

export function zeitgrenzeS(stufe: StufeId): number {
  return (RICHTZEIT_S[stufe] ?? 120) * FAKTOR;
}

/** 3:05 */
export function minuten(sekunden: number): string {
  const s = Math.max(0, Math.round(sekunden));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export type Wertung = {
  stufe: StufeId;
  geloest: number;
  anzahl: number;
  dauerMs: number;
  fehler: number;
};

export function wertung({ stufe, geloest, anzahl, dauerMs, fehler }: Wertung): { punkte: number; details: string[] } {
  const anteil = anzahl > 0 ? Math.min(1, Math.max(0, geloest / anzahl)) : 0;
  const grenze = zeitgrenzeS(stufe);
  const t = dauerMs / 1000;
  const zeitAnteil = Math.min(1, Math.max(0, (2 * grenze - t) / grenze));
  const fehlerAnteil = Math.max(0, FEHLER_BONUS - ABZUG_JE_FEHLER * fehler) / FEHLER_BONUS;
  const punkte = Math.round(anteil * (GRUND + ZEIT_BONUS * zeitAnteil + FEHLER_BONUS * fehlerAnteil));
  return {
    punkte,
    details: [
      `${geloest} von ${anzahl} Aufgaben`,
      `Zeit ${minuten(t)} (Ziel bis ${minuten(grenze)}) · ${fehler} ${fehler === 1 ? "Fehlversuch" : "Fehlversuche"}`,
    ],
  };
}
