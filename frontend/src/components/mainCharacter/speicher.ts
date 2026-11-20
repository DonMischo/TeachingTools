/**
 * Der eigene Charakter bleibt nur in diesem Browser (localStorage), nie auf
 * dem Server. Schlüssel je Konto bzw. je Gast, wie bei den anderen Simulationen.
 */
import { KLASSEN, NEUTRAL, type KlasseId, type Plan, type Profil } from "@/lib/mainCharacter";
import type { Auswertung } from "@/lib/mainCharacterFragebogen";

export type Schritt = "start" | "fragebogen" | "bogen" | "spiel";

export interface Charakter {
  spitzname: string;
  /** Index der Antwort je Frage, null = offen */
  antworten: (number | null)[];
  klasse: KlasseId;
  profil: Profil;
  /** eigener Wochenplan; null = Plan der Klasse */
  plan: Plan | null;
  vorschlag: Pick<Auswertung, "klasse" | "punkte" | "staerken" | "baustellen"> | null;
  schritt: Schritt;
}

export const LEER: Charakter = {
  spitzname: "", antworten: [], klasse: "checker", profil: NEUTRAL, plan: null, vorschlag: null, schritt: "start",
};

const schluessel = (s: string) => `hp_main_character_${s}`;

export function laden(s: string): Charakter {
  try {
    const roh = localStorage.getItem(schluessel(s));
    if (!roh) return LEER;
    const c = { ...LEER, ...JSON.parse(roh) } as Charakter;
    return KLASSEN[c.klasse] ? c : LEER;
  } catch {
    return LEER;
  }
}

export function speichern(s: string, c: Charakter): void {
  try {
    localStorage.setItem(schluessel(s), JSON.stringify(c));
  } catch {
    /* privater Modus o. Ä.: dann eben ohne Speichern */
  }
}

export function loeschen(s: string): void {
  try { localStorage.removeItem(schluessel(s)); } catch { /* egal */ }
}
