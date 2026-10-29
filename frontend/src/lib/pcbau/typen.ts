/**
 * PC-Werkstatt: Geräte als reine Daten. Jedes Gerät hat eine Zeichenfläche
 * (800 × 600) für die Realansicht und einen Schaltplan (800 × 520). Teile
 * liegen dort als Rechteck, Anschlüsse (Ports) relativ zu ihrem Teil.
 */

export type Rect = { x: number; y: number; w: number; h: number };

export type Kategorie =
  | "rechnen" | "speicher" | "laufwerk" | "strom" | "platine" | "anschluss"
  | "gehaeuse" | "kuehlung" | "grafik" | "funk" | "sinne" | "extern";

/** Eine Entscheidung beim Einbauen. Falsche Antworten rächen sich erst beim Einschalten. */
export type Frage = {
  frage: string;
  optionen: { text: string; richtig: boolean; erklaerung: string }[];
};

export type Port = { id: string; x: number; y: number; name: string };

export type Teil = {
  id: string;
  name: string;
  /** Ein Satz: wozu das Teil da ist (auch Quizfrage im Erkennen-Modus). */
  kurz: string;
  /** Zwei, drei Sätze für die Infokarte. */
  info: string;
  kategorie: Kategorie;
  rect: Rect;
  /** Schlüssel in der Zeichnungs-Tabelle der Komponenten. */
  zeichnung: string;
  /** Schon im Gerät, liegt nicht in der Teilekiste. */
  fest?: boolean;
  /** Sitzt auf diesem Teil: nur sichtbar, wenn es eingebaut ist. */
  auf?: string;
  /** Muss vorher eingebaut sein. */
  braucht?: string[];
  /** Fürs Funktionieren nicht nötig. */
  optional?: boolean;
  frage?: Frage;
  ports?: Port[];
  /** Mittelpunkt im Schaltplan; ohne Angabe kein Kasten. */
  schema?: { x: number; y: number };
  /** Im Erkennen-Modus nicht abgefragt (etwa das Gehäuse selbst). */
  nichtAbfragen?: boolean;
};

export type KabelStil = "strom" | "sata" | "flach" | "dünn" | "hdmi" | "usb" | "usbc" | "lan";

export type Kabel = {
  id: string;
  name: string;
  info: string;
  stil: KabelStil;
  /** Je Ende die Ports, an die es passt. */
  enden: [string[], string[]];
  frage?: Frage;
  optional?: boolean;
  /** Stützpunkte für den Verlauf in der Realansicht. */
  ueber?: [number, number][];
  /** Welche Kästen der Schaltplan verbindet (sonst die Teile der Ports). */
  schema?: [string, string];
  /** Strom oder Daten — Farbe im Schaltplan. */
  art: "strom" | "daten";
};

export type Verbindung = { von: string; nach: string; name: string; art: "strom" | "daten" | "waerme" };

export type Bedingung =
  | { fehlt: string }
  | { drin: string }
  | { falsch: string }
  /** Einige, aber nicht alle eingebaut. */
  | { teilweise: string[] }
  /** Keines eingebaut. */
  | { keins: string[] };

export type Stufe = "aus" | "kaputt" | "fehler" | "warnung";

export type Pruefung = {
  /** Alle Bedingungen müssen zutreffen. */
  wenn: Bedingung[];
  stufe: Stufe;
  titel: string;
  text: string;
  /** Piepcode: L = lang, K = kurz, z. B. "L K K". */
  piep?: string;
  /** Was auf dem Bildschirm steht. */
  bildschirm?: string[];
};

export type Kennzahl = "takt" | "kerne" | "ram" | "speicher" | "watt";

export type Geraet = {
  id: string;
  name: string;
  icon: string;
  untertitel: string;
  /** Zusammenbauen möglich (sonst nur Erkennen). */
  bauen: boolean;
  teile: Teil[];
  kabel: Kabel[];
  verbindungen: Verbindung[];
  pruefungen: Pruefung[];
  start: { titel: string; text: string; bildschirm: string[] };
  /** Farben der Realansicht. */
  buehne: string;
  /** Kabel des PC-Lautsprechers: ohne ihn bleiben Piepcodes stumm. */
  lautsprecher?: string;
  kennzahlen: Record<Kennzahl, number> & { jahr: number; notiz: string };
};

/** Stand eines Zusammenbaus. */
export type Bau = {
  drin: string[];
  /** Kabel-ID → gesteckte Ports. */
  stecker: Record<string, string[]>;
  /** Teil-/Kabel-ID → gewählte Option. */
  antworten: Record<string, number>;
};

export const LEER: Bau = { drin: [], stecker: {}, antworten: {} };
