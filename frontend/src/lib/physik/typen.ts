/**
 * Die Grundbegriffe des Physiklabors.
 *
 * Was hier steht, teilen sich der Baukasten (`kern/`) und die Anzeige: der
 * Punkt in Metern, der Ausschnitt der Werkbank, die Beschreibung eines
 * einstellbaren Werts und die Frage, wie genau gerechnet wird. Alles Weitere
 * — was ein Teil ist, was ein Verbinder tut — steht in `kern/modell.ts`, denn
 * es hängt am Baukasten und nicht am Labor im Allgemeinen.
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

/** Ein einstellbarer Wert — immer in SI abgelegt. */
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

/** Ausschnitt der Werkbank, den die Leinwand zeigt. */
export interface Blick {
  /** Weltpunkt in der Mitte der Leinwand, in Metern. */
  mitte: Punkt;
  /** Pixel je Meter. */
  skala: number;
  breite: number;
  hoehe: number;
}
