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
  einstellungen: { modus: QuizModus; wortbank: boolean; max_punkte: number };
  katalog: Ebene[];
  karte: {
    art: Kartenart;
    region: string;
    ebenen: string[];
    ausschnitt: { west: number; sued: number; ost: number; nord: number } | null;
    auswahl: Record<string, { zeigen: "alle" | "auswahl" }>;
  };
  spiel: { modus: QuizModus; aufgaben: QuizAufgabe[]; auswahl: Record<string, string[]>; wortbank?: string[] };
  erfolge: { id: string; name: string; icon: string }[];
  stand: QuizStand;
};

export type QuizAntwortOut = { richtig: boolean; versuche: number; neue_erfolge: string[]; stand: QuizStand; loesung?: string };

export type QuizUebersicht = {
  aufgaben: number;
  einstellungen: QuizSpiel["einstellungen"];
  je_aufgabe: { nr: number; name: string; kategorie: string; marke: string; richtig: number; versucht: number }[];
  teilnehmer: { name: string; klasse: string; richtig: number; beantwortet: number; erfolge: number }[];
  punkte: { class_id: number; klasse: string; teilnehmer: number; quote: number; punkte: number }[];
};

const FARBE_STATUS = { offen: "#e11d48", richtig: "#16a34a", geloest: "#9ca3af" } as const;

/**
 * Stil für die Spielerkarte: keine Namen, Ebenen über den Quiz-Endpunkt,
 * im Modus »benennen« die Marken (grün = gelöst). Im Modus »finden« wird
 * eine aufgelöste Lösung rot umrandet.
 */
export function quizStil(code: string, s: QuizSpiel, stand: QuizStand, loesungen: Record<string, string[]>): StyleSpecification {
  const katalog = { stand: "", ebenen: s.katalog };
  const grund = baueStil(katalog, { ebenen: s.karte.ebenen, beschriftung: false }, s.karte.art,
    (e) => `/api/karten/quiz/${encodeURIComponent(code)}/ebene/${e.id}`);
  const anker: FeatureCollection = { type: "FeatureCollection", features: [] };
  if (s.spiel.modus === "benennen") {
    for (const a of s.spiel.aufgaben) {
      if (!a.anker) continue;
      const st = stand.antworten[String(a.nr)];
      const farbe = st?.richtig ? FARBE_STATUS.richtig : st && st.versuche >= 2 ? FARBE_STATUS.geloest : FARBE_STATUS.offen;
      anker.features.push({ type: "Feature", geometry: { type: "Point", coordinates: a.anker }, properties: { marke: a.marke, farbe } });
    }
  }
  const auswahl: Record<string, { zeigen: "alle" | "auswahl"; objekte: string[] }> = {};
  for (const [ebene, tokens] of Object.entries(s.spiel.auswahl)) {
    auswahl[ebene] = { zeigen: s.karte.auswahl[ebene]?.zeigen ?? "alle", objekte: tokens };
  }
  // Im »finden«-Modus die aufgedeckten Lösungen rot umranden
  return wendeSatzAn(grund, katalog, { auswahl, nummern: {}, anker, bearbeiten: false, hervor: loesungen });
}
