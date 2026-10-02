/**
 * Kartensatz: was die Lehrkraft gespeichert hat (siehe api/routers/karten.py::SatzInhalt).
 * Nur Auswahl und ids — die Ebenen selbst bleiben, wie sie sind.
 */
import type { Kartenart } from "./stil";
import type { EbenenAuswahl } from "./nummern";

export type Ausschnitt = { west: number; sued: number; ost: number; nord: number };

export type SatzInhalt = {
  art: Kartenart;
  /** Region aus REGIONEN (lib/karten/stil.ts); bestimmt Deutschland- oder Welt-Ebenen */
  region: string;
  ebenen: string[];
  beschriftung: boolean;
  ausschnitt: Ausschnitt | null;
  auswahl: Record<string, EbenenAuswahl>;
  /** Größenklassen-Filter je Ebene (Siedlungen) */
  filter?: Record<string, string[]>;
  /** Erfolge im Kartenquiz (leer = je Ebene »alles richtig«) */
  erfolge?: KartenErfolg[];
};

export type KartenErfolg = { id: string; name: string; icon: string; ebenen: string[]; schwelle: number };

export type SuchTreffer = {
  ebene: string; ebene_name: string; bereich: string; id: string; name: string; zusatz: string;
  rang?: string | null; punkt: [number, number] | null;
};

export type KartenSatzKurz = { id: number; titel: string; geteilt: boolean; eigen: boolean; autor: string; aktualisiert_am: string };
export type KartenSatz = KartenSatzKurz & { inhalt: SatzInhalt };
export type KartenSatzIn = { titel: string; geteilt: boolean; inhalt: SatzInhalt };

export const leereAuswahl = (): EbenenAuswahl => ({ zeigen: "alle", objekte: [], nummerierung: "keine" });

/** Ein Objekt an- oder abwählen (Klick auf die Karte). */
export function schalteObjekt(inhalt: SatzInhalt, ebene: string, id: string): SatzInhalt {
  const wahl = inhalt.auswahl[ebene] ?? leereAuswahl();
  const objekte = wahl.objekte.includes(id) ? wahl.objekte.filter((o) => o !== id) : [...wahl.objekte, id];
  return { ...inhalt, auswahl: { ...inhalt.auswahl, [ebene]: { ...wahl, objekte } } };
}

/** Leere Auswahlen nicht mitspeichern. */
export function aufgeraeumt(inhalt: SatzInhalt): SatzInhalt {
  const auswahl = Object.fromEntries(Object.entries(inhalt.auswahl).filter(([, w]) => w.objekte.length));
  // Erfolge zählen nur Ebenen mit Auswahl — sonst lehnt der Server den Satz ab
  const erfolge = (inhalt.erfolge ?? [])
    .map((e) => ({ ...e, ebenen: e.ebenen.filter((x) => x in auswahl) }))
    .filter((e) => e.ebenen.length);
  return { ...inhalt, auswahl, erfolge };
}

export type KartenExportIn = {
  format: "pdf" | "docx" | "odt" | "tex";
  variante: "aufgabe" | "loesung" | "beide";
  titel: string;
  aufgabe: string;
  /** PNG als data-URL (MapLibre-Canvas) */
  karte: string;
  gruppen: { name: string; eintraege: { marke: string; name: string }[] }[];
};
