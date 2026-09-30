/**
 * Leviathan – Kunst des Regierens: Datentypen.
 *
 * Alle Größen laufen von 0 bis 100. Bei `klima`, `desinformation` und
 * `korruption` ist hoch schlecht, bei allen anderen gut.
 * Entwurf und Quellen: docs/leviathan-recherche.md
 */

/** Die sechs Bereiche, in die man Aktionspunkte steckt. */
export type Hebel = "wirtschaft" | "energie" | "bildung" | "soziales" | "rechtsstaat" | "familie";

/** Größen, die nur reagieren. */
export type Folge =
  | "klima" | "gleichheit" | "vertrauen" | "zusammenhalt" | "desinformation"
  | "demokratie" | "staatskapazitaet" | "korruption";

export type Groesse = Hebel | Folge;

export const HEBEL: Hebel[] = ["wirtschaft", "energie", "bildung", "soziales", "rechtsstaat", "familie"];
export const FOLGEN: Folge[] = [
  "klima", "gleichheit", "vertrauen", "zusammenhalt", "desinformation",
  "demokratie", "staatskapazitaet", "korruption",
];
export const GROESSEN: Groesse[] = [...HEBEL, ...FOLGEN];

/** Größen, bei denen ein hoher Wert schlecht ist. */
export const HOCH_SCHLECHT: ReadonlySet<Groesse> = new Set<Groesse>(["klima", "desinformation", "korruption"]);

export type Werte = Record<Groesse, number>;

export type TypId = "nordisch" | "industrie" | "polarisiert" | "wahlautokratie" | "schwellenland"
  | "rohstoff" | "entwicklungsstaat" | "fragil" | "kueste";

export type Krisenstufe = "ruhig" | "normal" | "stuermisch" | "zusammenbruch";

export type Zone = "abwesend" | "gefesselt" | "despotisch";

export interface Bevoelkerung {
  /** Millionen Menschen je Altersgruppe: 0–19, 20–64, 65+. */
  jung: number;
  erwerb: number;
  alt: number;
  /** Geburten je Frau. */
  tfr: number;
}

/** Wer regiert: eine gewöhnliche Regierung oder ein Autokrat/Populist. */
export interface Regierung {
  autokrat: boolean;
  /** Runde, seit der der Autokrat regiert (für den schleichenden Wirtschafts-Malus). */
  seit: number;
  /** Einparteienstaat: Wahlen gibt es erst ab Demokratie 40. */
  geschlossen: boolean;
}

export interface Meldung {
  runde: number;
  ereignis: string;
  titel: string;
  text: string;
  icon: string;
  positiv?: boolean;
  quelle?: string;
  /** Was sich dadurch geändert hat, lesbar für die Nachrichtenleiste. */
  folgen?: string;
}

export interface Einstellungen {
  krise: Krisenstufe;
  runden: number;
  /** Die Schüler:innen sehen die Krisenstufe. */
  sichtbar: boolean;
  /** Ereignis-Ids, die nicht vorkommen sollen (heikle Themen). */
  aus: string[];
  /** Feste Ereignisse: Runde → Ereignis-Id. */
  drehbuch: { runde: number; ereignis: string }[];
}

export const STANDARD_EINSTELLUNGEN: Einstellungen = {
  krise: "normal",
  runden: 12,
  sichtbar: true,
  aus: [],
  drehbuch: [],
};

export interface Schnappschuss {
  runde: number;
  jahr: number;
  w: Werte;
  lq: number;
  bev: Bevoelkerung;
  position: number;
  zone: Zone;
  ap: number;
  schulden: number;
  autokrat: boolean;
  schleifen: string[];
}

export type Status = "laeuft" | "zusammengebrochen" | "wiederaufbau" | "fertig";

export interface Zustand {
  typ: TypId;
  land: string;
  einst: Einstellungen;
  seed: number;
  /** Zustand des Zufallsgenerators. */
  rng: number;
  runde: number;
  w: Werte;
  bev: Bevoelkerung;
  /** Lebensqualität (Sammelgröße) und ihr vorübergehender Schock-Anteil. */
  lq: number;
  lqSchock: number;
  schulden: number;
  /** Summe aller Aktionspunkte, die je in die Energiewende gingen (Lernkurve). */
  energieKumuliert: number;
  regierung: Regierung;
  /** Überschrittene Kipppunkte (Klimalast-Schwellen). */
  kipppunkte: number[];
  /** Hebel, die für n Runden gesperrt sind. */
  gesperrt: Partial<Record<Hebel, number>>;
  /** Wirkungen, die über mehrere Runden laufen. */
  laufend: { id: string; titel: string; runden: number; wirkung: Partial<Werte> }[];
  /** Aktionspunkte, die nächste Runde fehlen (−) oder dazukommen (+). */
  apKorrektur: number;
  /** Runde der letzten Finanz- bzw. Wirtschaftskrise (für den Wahlausgang). */
  letzteFinanzkrise: number;
  letzteKrise: number;
  letzteKatastrophe: number;
  /** Deepfake vor der nächsten Wahl. */
  deepfake: boolean;
  /** Anzahl Runden in Folge mit kritischem Wert. */
  kritisch: number;
  status: Status;
  /** Runde, in der das Land zusammenbrach. */
  zusammenbruch: number | null;
  verlauf: Schnappschuss[];
  meldungen: Meldung[];
  /** Ereignisse, die einmalig sind und schon vorkamen. */
  gewesen: string[];
}

/** Die Verteilung der Aktionspunkte einer Runde. */
export type Verteilung = Record<Hebel, number> & { kredit: number };
