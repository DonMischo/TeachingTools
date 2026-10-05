/**
 * Kartenquiz: Typen der Spiel-API (api/routers/karten_quiz.py) und der Kartenstil für Spieler.
 * Spieler sehen Ebenen ohne Namen; ids sind Tokens, geprüft wird auf dem Server.
 */
import type { FeatureCollection } from "geojson";
import type { StyleSpecification } from "maplibre-gl";
import { baueStil, wendeSatzAn, type Ebene, type Kartenart } from "./stil";

export type QuizModus = "benennen" | "finden";

export type QuizAufgabe = {
  nr: number;
  kategorie: string;
  ebene: string;
  /** benennen */
  marke?: string;
  anker?: [number, number] | null;
  /** finden */
  name?: string;
};

export type QuizAntwortStand = { richtig: boolean; versuche: number };
export type QuizStand = { antworten: Record<string, QuizAntwortStand>; richtig: number; erfolge: string[] };

export type QuizSpiel = {
  titel: string;
  einstellungen: { modus: QuizModus; wortbank: boolean; max_punkte: number; ueben?: boolean };
  katalog: Ebene[];
  karte: {
    art: Kartenart;
    region: string;
    ebenen: string[];
    ausschnitt: { west: number; sued: number; ost: number; nord: number } | null;
    auswahl: Record<string, { zeigen: "alle" | "auswahl" }>;
    filter?: Record<string, string[]>;
  };
  spiel: { modus: QuizModus; aufgaben: QuizAufgabe[]; auswahl: Record<string, string[]>; wortbank?: string[] };
  erfolge: { id: string; name: string; icon: string; text?: string }[];
  stand: QuizStand;
  lernen?: QuizLernen;
};

/** Lernstand für die Anzeige: Sicherheit 0–1 je Aufgabennummer */
export type QuizLernen = { sicherheit: Record<string, number>; schwach: number; tage: number };

export type QuizAntwortOut = { richtig: boolean; versuche: number; neue_erfolge: string[]; stand: QuizStand; loesung?: string; lernen?: QuizLernen };

/** Lernhelfer: eine Übungsaufgabe (api/routers/karten_quiz.py::ueben_naechste) */
export type UebenAufgabe = {
  nr: number; richtung: QuizModus; hilfe: "auswahl" | "frei"; kategorie: string; ebene: string; sicherheit: number;
  /** benennen: Objekt zeigen */
  anker?: [number, number] | null; token?: string; optionen?: string[];
  /** finden */
  name?: string; kandidaten?: string[];
};
export type UebenAntwortOut = {
  richtig: boolean; name: string; token: string; sicherheit: number; neue_erfolge: string[]; stand: QuizStand; lernen: QuizLernen;
};

export type QuizUebersicht = {
  aufgaben: number;
  einstellungen: QuizSpiel["einstellungen"];
  je_aufgabe: { nr: number; name: string; kategorie: string; marke: string; richtig: number; versucht: number; sicherheit?: number | null }[];
  teilnehmer: { name: string; klasse: string; richtig: number; beantwortet: number; erfolge: number }[];
  punkte: { class_id: number; klasse: string; teilnehmer: number; quote: number; punkte: number }[];
};

const FARBE_STATUS = { offen: "#e11d48", richtig: "#16a34a", geloest: "#9ca3af" } as const;

/**
 * Stil für die Spielerkarte: keine Namen, Ebenen über den Quiz-Endpunkt,
 * im Modus »benennen« die Marken (grün = gelöst). Im Modus »finden« wird
 * eine aufgelöste Lösung rot umrandet.
 */
export function quizStil(basis: string, s: Pick<QuizSpiel, "katalog" | "karte" | "spiel">, stand: QuizStand,
  loesungen: Record<string, string[]>,
  /** Üben: statt der Quiz-Marken ein »?« am gefragten Objekt, umrandet wird `hervor` */
  uebung?: { anker?: [number, number] | null; ebene: string; hervor: Record<string, string[]> }): StyleSpecification {
  const katalog = { stand: "", ebenen: s.katalog };
  // basis: /api/karten/quiz/<code> (eigenes Spiel) oder /api/karten/quiz/brett/<schlüssel> (Caputh/TaskCrawler)
  const grund = baueStil(katalog, { ebenen: s.karte.ebenen, beschriftung: false, filter: s.karte.filter }, s.karte.art,
    (e) => `${basis}/ebene/${e.id}`);
  const anker: FeatureCollection = { type: "FeatureCollection", features: [] };
  if (uebung) {
    if (uebung.anker) anker.features.push({ type: "Feature", geometry: { type: "Point", coordinates: uebung.anker },
      properties: { marke: "?", farbe: FARBE_STATUS.offen, ebene: uebung.ebene } });
  } else if (s.spiel.modus === "benennen") {
    for (const a of s.spiel.aufgaben) {
      if (!a.anker) continue;
      const st = stand.antworten[String(a.nr)];
      const farbe = st?.richtig ? FARBE_STATUS.richtig : st && st.versuche >= 2 ? FARBE_STATUS.geloest : FARBE_STATUS.offen;
      anker.features.push({ type: "Feature", geometry: { type: "Point", coordinates: a.anker }, properties: { marke: a.marke, farbe, ebene: a.ebene } });
    }
  }
  const auswahl: Record<string, { zeigen: "alle" | "auswahl"; objekte: string[] }> = {};
  for (const [ebene, tokens] of Object.entries(s.spiel.auswahl)) {
    auswahl[ebene] = { zeigen: s.karte.auswahl[ebene]?.zeigen ?? "alle", objekte: tokens };
  }
  // Im »finden«-Modus die aufgedeckten Lösungen rot umranden
  return wendeSatzAn(grund, katalog, { auswahl, nummern: {}, anker, bearbeiten: false, hervor: uebung?.hervor ?? loesungen });
}

/** Eingebettete Kartenfrage (Caputh/TaskCrawler): Brett vom Server, Antworten gesammelt. */
export type KartenBrettDaten = Pick<QuizSpiel, "titel" | "katalog" | "karte" | "spiel"> & { brett: string };
export type KartenAntwort = { antworten: Record<string, string> };
export type KartenLoesung = Record<string, { name: string; marke: string; token: string; ebene: string }>;
