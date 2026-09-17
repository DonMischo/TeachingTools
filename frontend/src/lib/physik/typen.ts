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
