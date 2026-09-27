/**
 * Der komplette Spielstand von »Rock your Life« — reine Daten, damit er sich
 * als JSON speichern, herunterladen und wieder laden lässt.
 */
import type { Abschluss, Fach } from "./berufe";
import type { Bescheid, Angaben, Lohnsteuerbescheinigung } from "./steuer";

export const SPIELSTAND_VERSION = 1;

export type BeduerfnisName = "hunger" | "energie" | "hygiene" | "sozial" | "spass" | "gesundheit" | "ordnung";
export type Beduerfnisse = Record<BeduerfnisName, number>; // 0..100, 100 = bestens

export type Zeugnis = {
  abschluss: Abschluss;
  /** Abschlusszeugnisse in Thüringen haben keine Kopfnoten und keine Fehltage. */
  noten: Partial<Record<Fach, number>>;
};

export type Figur = {
  name: string;
  geburtstag: string; // JJJJ-MM-TT
  /** Fiktive Nummern — »zugeteilt«, damit Formulare echte Felder haben. */
  steuerId: string;
  svNummer: string;
  iban: string;
  kirche: boolean;
  krankenkasse: string;
  kvZusatz: number;
  avatar: string; // Emoji
  farbe: string;
};

export type Herkunft = {
  /** Wo die Eltern wohnen — entscheidet über BAB (Entfernung zum Betrieb). */
  eltern: "erfurt" | "land";
  elternEinkommen: "niedrig" | "mittel" | "hoch";
  /** Was mit dem Kindergeld passiert (die Familienkasse zahlt an die Eltern). */
  kindergeld: "weiter" | "halb" | "eltern";
};

export type KleidungsTeil = "alltag" | "unterwaesche" | "schuhe" | "jacke" | "schick" | "sport";

export type AutoStand = {
  modell: string;
  baujahr: number;
  km: number;
  wert: number;
  verbrauch: number; // Liter/100 km
  tuevBis: number; // Spieltag
  zustand: number; // 0..100
  gekauft: number;
};

export type Wohnform = "eltern" | "wg" | "wohnung" | "azubiwohnheim" | "unterkunft";

export type Wohnung = {
  id: string;
  form: Wohnform;
  titel: string;
  adresse: string;
  stadtteil: string;
  qm: number;
  zimmer: number;
  kalt: number;
  nebenkosten: number; // Vorauszahlung Betriebskosten
  heizung: number; // Vorauszahlung Heizkosten
  kaution: number;
  genossenschaftsanteile: number;
  ebk: boolean; // Einbauküche vorhanden
  ablöse?: number;
  etage: number;
  fahrzeitArbeit: number; // Minuten ÖPNV
  entfernungKm: number;
  einzug: number; // Spieltag
  /** Kostgeld an die Eltern (nur Wohnform "eltern"). */
  kostgeld?: number;
  moebliert?: boolean;
  /** Stromzähler: kWh seit letzter Ablesung. */
  kwh: number;
};

export type Buchung = {
  id: number;
  tag: number;
  betrag: number; // + Eingang, − Ausgang
  kategorie: Kategorie;
  text: string;
};

export type Kategorie =
  | "lohn" | "kindergeld" | "bab" | "wohngeld" | "erstattung" | "verkauf" | "sonstiges_ein" | "eltern"
  | "miete" | "nebenkosten" | "strom" | "internet" | "handy" | "versicherung" | "rundfunk" | "mobilitaet"
  | "lebensmittel" | "drogerie" | "moebel" | "freizeit" | "ausgehen" | "kleidung" | "gesundheit"
  | "abos" | "bank" | "schulden" | "strafen" | "arbeit" | "kaution" | "geschenke" | "sparen" | "sonstiges";

export type VorratPosten = {
  produkt: string;
  variante: "eigen" | "marke" | "bio";
  /** Restmenge als Anteil der Packung (1 = voll). */
  rest: number;
  gekauft: number;
  haltbarBis: number;
};

export type MoebelPosten = {
  id: string; // Möbel-Id aus moebel.json
  uid: number;
  gebraucht: boolean;
  defekt: boolean;
  preis: number;
  gekauft: number;
  /** Position im Raumbild (cm), vom Spieler verschiebbar. */
  x?: number;
  y?: number;
  gedreht?: boolean;
};

export type Vertrag = {
  uid: number;
  angebot: string; // Id aus vertraege.ts
  art: VertragsArt;
  name: string;
  monatlich: number;
  /** Zahlweise: monatlich oder jährlich (Betrag = Jahresbeitrag am Starttag). */
  jaehrlich?: boolean;
  start: number;
  mindestBis: number;
  gekuendigtZum?: number;
  /** Einmalige Gebühren beim Abschluss (Anschluss, Aufnahme). */
  zahltag: number;
  /** Internet: Anschluss erst ab diesem Tag geschaltet. */
  aktivAb?: number;
};

export type VertragsArt =
  | "strom" | "internet" | "handy" | "haftpflicht" | "hausrat" | "bu" | "unfall" | "handyversicherung"
  | "rechtsschutz" | "zahnzusatz" | "streaming" | "musik" | "gaming" | "fitness" | "ticket" | "konto" | "zeitung" | "verein";

export type Kredit = {
  uid: number;
  art: "ratenkauf" | "bnpl" | "dispo" | "privat";
  text: string;
  rest: number;
  rate: number;
  zins: number; // effektiv p.a. in Prozent
  faellig: number; // nächster Fälligkeitstag
  mahnstufe: number;
};

export type JobStand = {
  beruf: string;
  betrieb: string;
  start: number;
  ende?: number;
  art: "ausbildung" | "schulisch" | "helfer" | "freiwillig" | "fachkraft" | "wehrdienst" | "ausland" | "eq";
  /** Monatsbrutto nach der Ausbildung (Fachkraft) — sonst wird es berechnet. */
  brutto?: number;
  urlaubstage: number;
  urlaubGenommen: number;
  probezeitBis: number;
  /** 0..100 — wie zufrieden der Betrieb ist. */
  leistung: number;
  abmahnungen: number;
  krankTage: number;
  fehlTage: number;
  /** Zwischenprüfung/Abschlussprüfung: Punkte 0..100, sobald abgelegt. */
  zwischenpruefung?: number;
  abschlusspruefung?: number;
  /** Letzter Tag, an dem gearbeitet wurde. */
  zuletzt?: number;
  /** Heute schon erledigt (Arbeit/Berufsschule). */
  heuteErledigt?: number;
};

export type BewerbungsStatus = "versendet" | "test" | "gespraech" | "zusage" | "absage" | "angenommen" | "abgelehnt";
export type Bewerbung = {
  uid: number;
  beruf: string;
  betrieb: string;
  tag: number;
  status: BewerbungsStatus;
  /** Wann sich der Betrieb meldet bzw. der Termin ist. */
  naechsterTag: number;
  qualitaet: number; // Anschreiben 0..1
  punkte?: number; // Test/Gespräch 0..1
  startTag?: number; // Ausbildungsbeginn bei Zusage
  /** Bewerbung als Fachkraft: angebotenes Monatsbrutto. */
  brutto?: number;
  /** Gilt die Bewerbung erst für den nächsten Jahrgang (Frist verpasst)? */
  jahrgang?: number;
};

export type AntragArt =
  | "anmeldung" | "bab" | "wohngeld" | "kindergeld" | "rundfunk_befreiung" | "rundfunk_anmeldung"
  | "krankenkasse" | "konto" | "nachsendeauftrag" | "steuer" | "wbs" | "schuldnerberatung" | "alg" | "buergergeld";

export type Antrag = {
  uid: number;
  art: AntragArt;
  gestellt: number;
  status: "entwurf" | "eingereicht" | "rueckfrage" | "bewilligt" | "abgelehnt";
  /** Beschied/Antwort am … */
  antwortTag: number;
  betrag?: number;
  bisTag?: number;
  fehler?: string[];
  daten?: Record<string, string | number | boolean>;
  grund?: string;
};

export type Dokument = {
  uid: number;
  art: "zeugnis" | "lohnabrechnung" | "mietvertrag" | "ausbildungsvertrag" | "arbeitsvertrag" | "bescheid"
    | "rechnung" | "mahnung" | "vertrag" | "lohnsteuerbescheinigung" | "brief" | "au" | "quittung" | "kuendigung";
  titel: string;
  tag: number;
  text?: string;
  daten?: Record<string, unknown>;
};

export type Brief = {
  uid: number;
  tag: number;
  von: string;
  betreff: string;
  text: string;
  gelesen: boolean;
  /** Verknüpfte Aktion (z. B. Ereignis, Rechnung). */
  aktion?: { art: "ereignis"; id: string } | { art: "rechnung"; betrag: number; kategorie: Kategorie; faellig: number; bezahlt?: boolean; mahnstufe?: number };
};

export type OffenesEreignis = {
  id: string;
  tag: number;
  /** Vom Ereignis beim Auslösen festgelegte Zahlen (Kosten etc.). */
  werte?: Record<string, number | string>;
};

export type LogArt = "start" | "beruf" | "bewerbung" | "wohnung" | "kauf" | "vertrag" | "antrag" | "ereignis"
  | "geld" | "monat" | "steuer" | "party" | "gesundheit" | "arbeit" | "schulden" | "ende" | "system";

export type LogEintrag = {
  tag: number;
  stunde: number;
  art: LogArt;
  text: string;
  betrag?: number;
};

export type Monatsbilanz = {
  monat: number; // monatsIndex
  ein: Partial<Record<Kategorie, number>>;
  aus: Partial<Record<Kategorie, number>>;
  brutto: number;
  steuern: number;
  sv: number;
  kontoEnde: number;
  beduerfnisse: Beduerfnisse;
};

export type Ernaehrungstag = {
  tag: number;
  kcal: number;
  protein: number;
  obstGemuese: number;
  zucker: number;
  auswaerts: number; // Mahlzeiten gekauft statt selbst
};

export type Jahressteuer = Lohnsteuerbescheinigung;

export type Spielstand = {
  version: number;
  id: string;
  seed: number;
  rng: number;
  tag: number;
  stunde: number;
  /** Wo die Figur gerade ist. */
  ort: "zuhause" | "unterwegs";
  figur: Figur;
  zeugnis: Zeugnis;
  herkunft: Herkunft;
  beduerfnisse: Beduerfnisse;
  ernaehrung: Ernaehrungstag[];
  /** kcal-Bedarf pro Tag (hängt vom Job ab). */
  kcalBedarf: number;
  /** Heute schon gegessen (kcal) — wird am Tagesende ausgewertet. */
  heute: Omit<Ernaehrungstag, "tag">;
  vorrat: VorratPosten[];
  wohnung: Wohnung;
  moebel: MoebelPosten[];
  konto: { stand: number; dispo: number; buchungen: Buchung[] };
  sparkonto: number;
  bargeld: number;
  kredite: Kredit[];
  vertraege: Vertrag[];
  job: JobStand | null;
  jobHistorie: JobStand[];
  bewerbungen: Bewerbung[];
  antraege: Antrag[];
  dokumente: Dokument[];
  post: Brief[];
  offen: OffenesEreignis[];
  zuletztEreignis: Record<string, number>;
  steuerjahre: Record<number, Jahressteuer>;
  steuererklaerungen: Record<number, { angaben: Angaben; bescheid: Bescheid; abgegeben: number; erstattetAm?: number }>;
  log: LogEintrag[];
  bilanzen: Monatsbilanz[];
  /** Laufender Monat (wird am Monatsende in `bilanzen` geschoben). */
  laufend: Monatsbilanz;
  /** Kater, Krankheit, Verletzung … */
  zustand: { kater?: number; krank?: { bis: number; au: boolean; art: string }; promille?: number };
  /** Freie Merker für Ereignisse und Erfolge. */
  flags: Record<string, number | boolean | string>;
  /** Wann die Wäsche zuletzt gewaschen, geputzt, geduscht wurde … */
  zuletzt: Record<string, number>;
  /** Zähler für eindeutige Ids. */
  naechsteUid: number;
  /** Sitzung (für Lehrer-Übersicht) — nur Metadaten. */
  gemeldetBis?: number;
  beendet?: boolean;
  /** Kleidung: Zustand je Teil 0..100 und Qualität (Haltbarkeit) der zuletzt gekauften Ware. */
  kleidung: Record<KleidungsTeil, { zustand: number; guete: number }>;
  /** Frisur 0..100 (100 = frisch vom Friseur). */
  frisur: number;
  /** Das eigene Smartphone. */
  handy: { modell: string; zustand: number; gekauft: number };
  /** Führerschein und Auto. */
  auto: AutoStand | null;
  fahrschule: { angemeldet: number; theorie?: number; praxis?: number; kosten: number; versuche: number } | null;
  /** Unterschriebener nächster Job, der erst später beginnt (Kündigungsfrist, Ausbildungsstart). */
  naechsterJob: JobStand | null;
  /** Wohnung, die während einer Unterkunft (FÖJ-Station, Kaserne, Ausland) weiterläuft. */
  heimatWohnung: Wohnung | null;
};
