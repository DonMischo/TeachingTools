/**
 * Was jedes Bauteil ist und welche Werte es mitbringt.
 *
 * Die Voreinstellungen sind Werte aus dem Schülerexperimentierkasten:
 * 4,5-V-Flachbatterie, Lämpchen 3,5 V / 0,2 A, Spule mit 600 Windungen.
 * Alle Werte in SI-Einheiten.
 */
import type { BauteilArt } from "./modell";

/** Ein einstellbarer Wert, wie er im Inspektor erscheint. */
export interface Feld {
  schluessel: string;
  label: string;
  einheit: string;
  /** Anzeige = SI-Wert / faktor, z. B. µF: faktor 1e-6. */
  faktor: number;
  min: number;
  max: number;
}

export interface TeilInfo {
  name: string;
  werte: Record<string, number>;
  felder?: Feld[];
}

const feld = (schluessel: string, label: string, einheit: string, faktor: number, min: number, max: number): Feld =>
  ({ schluessel, label, einheit, faktor, min, max });

/** LED-Farben mit ihrer typischen Durchlassspannung bei 20 mA. */
export const LED_FARBEN = [
  { name: "rot", durchlass: 1.8 },
  { name: "gelb", durchlass: 2.0 },
  { name: "grün", durchlass: 2.2 },
  { name: "blau", durchlass: 3.0 },
  { name: "weiß", durchlass: 3.1 },
] as const;

export const TEILE: Record<BauteilArt, TeilInfo> = {
  batterie: {
    name: "Batterie", werte: { spannung: 4.5, innenwiderstand: 0.5 },
    felder: [feld("spannung", "Spannung", "V", 1, 0, 400), feld("innenwiderstand", "Innenwiderstand", "Ω", 1, 0.001, 100)],
  },
  wechselquelle: {
    name: "Wechselspannung", werte: { spannung: 6, frequenz: 50, innenwiderstand: 0.1 },
    felder: [feld("spannung", "Effektivwert", "V", 1, 0, 400), feld("frequenz", "Frequenz", "Hz", 1, 0.1, 10000),
      feld("innenwiderstand", "Innenwiderstand", "Ω", 1, 0.001, 100)],
  },
  widerstand: { name: "Widerstand", werte: { widerstand: 100 }, felder: [feld("widerstand", "Widerstand", "Ω", 1, 0.01, 1e7)] },
  lampe: {
    name: "Lämpchen", werte: { nennspannung: 3.5, nennleistung: 0.7 },
    felder: [feld("nennspannung", "Nennspannung", "V", 1, 0.5, 400), feld("nennleistung", "Nennleistung", "W", 1, 0.01, 200)],
  },
  motor: {
    name: "Motor", werte: { ankerwiderstand: 3, konstante: 0.0095, traegheit: 1e-5, reibung: 3e-6 },
    felder: [feld("ankerwiderstand", "Ankerwiderstand", "Ω", 1, 0.1, 1000)],
  },
  schalter: { name: "Schalter", werte: { geschlossen: 0 } },
  umschalter: { name: "Umschalter", werte: { stellung: 0 } },
  sicherung: { name: "Sicherung", werte: { nennstrom: 1 }, felder: [feld("nennstrom", "Nennstrom", "A", 1, 0.01, 20)] },
  diode: { name: "Diode", werte: { durchlass: 0.7, emission: 1.8 } },
  led: { name: "Leuchtdiode", werte: { farbe: 0, durchlass: 1.8, nennstrom: 0.02, hoechststrom: 0.05 } },
  kondensator: { name: "Kondensator", werte: { kapazitaet: 1e-3 }, felder: [feld("kapazitaet", "Kapazität", "µF", 1e-6, 0.001, 100000)] },
  spule: {
    name: "Spule", werte: { induktivitaet: 1, widerstand: 2.5 },
    felder: [feld("induktivitaet", "Induktivität", "mH", 1e-3, 0.01, 100000), feld("widerstand", "Wicklungswiderstand", "Ω", 1, 0, 1000)],
  },
  trafo: {
    name: "Transformator", werte: { windungen1: 600, windungen2: 300, kopplung: 0.999 },
    felder: [feld("windungen1", "Windungen primär", "", 1, 1, 24000), feld("windungen2", "Windungen sekundär", "", 1, 1, 24000)],
  },
  amperemeter: { name: "Strommesser", werte: {} },
  voltmeter: { name: "Spannungsmesser", werte: {} },
};

/** Induktivität einer Trafowicklung mit einer Windung; mit N² skaliert ist 600 Wdg ≈ 1 H. */
export const TRAFO_L_JE_WINDUNG2 = 1 / 360000;
