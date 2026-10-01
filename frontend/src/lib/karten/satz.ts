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
  return { ...inhalt, auswahl };
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
