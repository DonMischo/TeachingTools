/**
 * Was jedes Bauteil ist und welche Werte es mitbringt.
 *
 * Die Voreinstellungen sind Werte aus dem Schülerexperimentierkasten:
 * 4,5-V-Flachbatterie, Lämpchen 3,5 V / 0,2 A, Spule mit 600 Windungen.
 * Alle Werte in SI-Einheiten.
 */
import type { BauteilArt } from "./modell";

export interface TeilInfo {
  name: string;
  werte: Record<string, number>;
}

/** LED-Farben mit ihrer typischen Durchlassspannung bei 20 mA. */
export const LED_FARBEN = [
  { name: "rot", durchlass: 1.8 },
  { name: "gelb", durchlass: 2.0 },
  { name: "grün", durchlass: 2.2 },
  { name: "blau", durchlass: 3.0 },
  { name: "weiß", durchlass: 3.1 },
] as const;

export const TEILE: Record<BauteilArt, TeilInfo> = {
  batterie: { name: "Batterie", werte: { spannung: 4.5, innenwiderstand: 0.5 } },
  wechselquelle: { name: "Wechselspannung", werte: { spannung: 6, frequenz: 50, innenwiderstand: 0.1 } },
  widerstand: { name: "Widerstand", werte: { widerstand: 100 } },
  lampe: { name: "Lämpchen", werte: { nennspannung: 3.5, nennleistung: 0.7 } },
  motor: { name: "Motor", werte: { ankerwiderstand: 3, konstante: 0.0095, traegheit: 1e-5, reibung: 3e-6 } },
  schalter: { name: "Schalter", werte: { geschlossen: 0 } },
  umschalter: { name: "Umschalter", werte: { stellung: 0 } },
  sicherung: { name: "Sicherung", werte: { nennstrom: 1 } },
  diode: { name: "Diode", werte: { durchlass: 0.7, emission: 1.8 } },
  led: { name: "Leuchtdiode", werte: { farbe: 0, durchlass: 1.8, nennstrom: 0.02, hoechststrom: 0.05 } },
  kondensator: { name: "Kondensator", werte: { kapazitaet: 1e-3 } },
  spule: { name: "Spule", werte: { induktivitaet: 1, widerstand: 2.5 } },
  trafo: { name: "Transformator", werte: { windungen1: 600, windungen2: 300, kopplung: 0.999 } },
  amperemeter: { name: "Strommesser", werte: {} },
  voltmeter: { name: "Spannungsmesser", werte: {} },
};

/** Induktivität einer Trafowicklung mit einer Windung; mit N² skaliert ist 600 Wdg ≈ 1 H. */
export const TRAFO_L_JE_WINDUNG2 = 1 / 360000;
