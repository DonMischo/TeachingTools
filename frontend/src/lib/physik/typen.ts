/**
 * Die Grundbegriffe des Physiklabors.
 *
 * Ein »Gerät« ist ein Stück Ausstattung aus dem Vorbereitungsraum: Stativ,
 * Massestück, Linse, Batterie, Kalorimeter. Verbunden werden Geräte nicht
 * beliebig, sondern über **Ports** — so wie man im echten Labor eine Öse an
 * einen Haken hängt und ein Kabel an eine Buchse steckt. Zwei Ports passen
 * zusammen, wenn sie dieselbe Art haben.
 *
 * Die Ports sind zugleich die Stelle, an der die sonst getrennten Rechenwerke
 * (Mechanik, Stromkreis, Optik, Wellen, Wärme) aneinanderstoßen — ein Motor
 * hat einen Strom- und einen Achsen-Port, eine Lampe einen Strom- und einen
 * Licht-Port. Mehr Kopplung als das gibt es bewusst nicht.
 */
import type { Einheit, AnzeigeEinheit } from "./einheiten";

/** Ein Punkt in Weltkoordinaten: Meter, y zeigt nach oben. */
export interface Punkt { x: number; y: number }

/**
 * Wie genau gerechnet wird.
 *
 * `ideal` ist das Schulbuchmodell — reibungsfrei, verlustfrei, dünne Linse,
 * Batterie ohne Innenwiderstand. Nur so bestätigt die Messung die Formel, die
 * die Klasse gerade herleiten soll. `real` schaltet Reibung, Dämpfung,
 * Innenwiderstand und Abbildungsfehler zu — dann weicht die Messung ab, und
 * genau diese Abweichung ist der Unterrichtsgegenstand.
 */
export type Modelltreue = "ideal" | "real";

/** Welche Sorte Verbindung ein Port aufnimmt. */
export type PortArt = "mechanik" | "strom" | "licht" | "welle" | "waerme" | "achse";

export interface Port {
  id: string;
  art: PortArt;
  name: string;
  /** Sitz am Gerät, relativ zu dessen Mittelpunkt, in Metern. */
  pos: Punkt;
  /**
   * Hier wird etwas *aufgestellt*, nicht angehängt.
   *
   * Eine Waagschale trägt von unten: das Gewicht steht darauf, und das
   * nächste kommt obendrauf. An einem Haken ist es andersherum — dort hängt
   * es darunter, und das nächste hängt noch tiefer.
   */
  traegt?: boolean;
  /**
   * Nicht zeichnen und nicht anklickbar.
   *
   * Die Öse eines Massestücks liegt mitten auf dem Stück. Sichtbar und
   * anklickbar war sie vor allem im Weg: man wollte das Gewicht ziehen und
   * erwischte den Anschluss. Als Ziel beim Ziehen zählt sie weiterhin — nur
   * eben, ohne sich in den Vordergrund zu drängen.
   */
  verborgen?: boolean;
  /**
   * Ein Drehlager: was hier aufsitzt, kann kippen. Ein Brett auf dem Keil ist
   * eine Wippe und kein festgeschraubtes Regal.
   */
  dreh?: boolean;
  /**
   * Nur der eigene Anschluss des Geräts — nichts wird hier angehängt. Ein
   * Brett hat keinen Haken, an den eine Murmel schnappen sollte, die man in
   * seine Nähe zieht; sie soll darauf liegen.
   */
  nurEigen?: boolean;
}

/** Ein einstellbarer Wert eines Geräts — immer in SI abgelegt. */
export interface ParameterDef {
  schluessel: string;
  name: string;
  einheit: Einheit;
  /** In welcher Einheit es dasteht und eingetippt wird (SI bleibt gespeichert). */
  anzeige?: AnzeigeEinheit;
  standard: number;
  min: number;
  max: number;
  /** Feste Auswahl statt Regler — gespeichert bleibt trotzdem eine Zahl. */
  optionen?: { wert: number; name: string }[];
  /**
   * Ein Bedienelement: auch im Versuch verstellbar.
   *
   * Im Versuch ist der Aufbau fest — Maße, Massen und Werkstoffe ändern sich
   * nicht mehr. Was man aber auch am echten Gerät während des Versuchs tut,
   * bleibt frei: zielen und spannen, den Schalter umlegen, am Generator
   * drehen.
   */
  bedienung?: boolean;
}

/**
 * Eine Größe, die dieses Gerät auf den Messbus legt.
 *
 * Alles, was sich über die Zeit ändert, meldet sich so an — Pendelwinkel,
 * Knotenspannung, Beleuchtungsstärke, Temperatur. Oszilloskop, Multimeter,
 * Tabelle und CSV-Export lesen nur diese Beschreibung und müssen nicht
 * wissen, welches Rechenwerk den Wert erzeugt hat.
 */
export interface SignalDef {
  schluessel: string;
  name: string;
  einheit: Einheit;
  anzeige?: AnzeigeEinheit;
}

/** Zu welchem Regal des Vorbereitungsraums ein Gerät gehört. */
export type Bereich = "aufbau" | "mechanik" | "strom" | "optik" | "wellen" | "waerme" | "messen";

/** Ein Gerätetyp, wie er im Katalog steht. */
export interface GeraetTyp {
  typ: string;
  name: string;
  icon: string;
  bereich: Bereich;
  /** Umriss in Metern — danach richtet sich, was man anfassen kann. */
  groesse: { b: number; h: number };
  ports: Port[];
  parameter: ParameterDef[];
  signale: SignalDef[];
}

/** Ein aufgestelltes Gerät. */
export interface Geraet {
  id: string;
  typ: string;
  pos: Punkt;
  /** Drehung im Bogenmaß. */
  winkel: number;
  /** Parameterwerte in SI, Schlüssel wie in `ParameterDef`. */
  werte: Record<string, number>;
  /** Überstimmt die Modelltreue der Szene für dieses eine Gerät. */
  treue?: Modelltreue;
}

/** Zeigt auf einen Port eines aufgestellten Geräts. */
export interface PortZeiger { geraet: string; port: string }

export interface Verbindung {
  id: string;
  von: PortZeiger;
  nach: PortZeiger;
}

/** Ein »Aufbau«: was auf der Werkbank steht. Reine Daten, kein Solver. */
export interface Szene {
  version: 1;
  titel: string;
  treue: Modelltreue;
  geraete: Geraet[];
  verbindungen: Verbindung[];
}

/** Ausschnitt der Werkbank, den die Leinwand zeigt. */
export interface Blick {
  /** Weltpunkt in der Mitte der Leinwand, in Metern. */
  mitte: Punkt;
  /** Pixel je Meter. */
  skala: number;
  breite: number;
  hoehe: number;
}
