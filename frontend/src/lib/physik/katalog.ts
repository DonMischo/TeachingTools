/**
 * Das Regal des Vorbereitungsraums: welche Geräte es gibt.
 *
 * Schritt 1a stellt nur das Gerüst hin — Stativ, Massestück, Kraftmesser und
 * eine Lampe. Sie brauchen noch kein Rechenwerk und reichen, um Aufstellen,
 * Verbinden, Speichern und Teilen zu prüfen. Pendel, Hebel und Rollen kommen
 * in 1c/1d dazu, Stromkreise in Phase 2.
 *
 * Ein neues Gerät ist genau ein Eintrag hier plus sein Rechenwerk — die
 * Werkbank, das Speicherformat und die Messgeräte lesen alles aus dieser Liste.
 */
import { bogen } from "./einheiten";
import { FEDER_RUHE } from "./geometrie";
import type { GeraetTyp } from "./typen";

export const KATALOG: GeraetTyp[] = [
  {
    typ: "stativ",
    name: "Stativ",
    icon: "🗼",
    bereich: "aufbau",
    groesse: { b: 0.3, h: 1.2 },
    ports: [{ id: "haken", art: "mechanik", name: "Haken", pos: { x: 0.1, y: 0.55 } }],
    parameter: [
      { schluessel: "hoehe", name: "Höhe", einheit: "m", standard: 1.2, min: 0.4, max: 2 },
    ],
    signale: [],
  },
  {
    typ: "massestueck",
    name: "Massestück",
    icon: "🏋️",
    bereich: "mechanik",
    groesse: { b: 0.08, h: 0.08 },
    ports: [{ id: "oese", art: "mechanik", name: "Öse", pos: { x: 0, y: 0.04 } }],
    parameter: [
      { schluessel: "masse", name: "Masse", einheit: "kg", standard: 0.1, min: 0.001, max: 20 },
    ],
    signale: [],
  },
  {
    typ: "kraftmesser",
    name: "Kraftmesser",
    icon: "🪝",
    bereich: "messen",
    groesse: { b: 0.06, h: 0.3 },
    ports: [
      { id: "oben", art: "mechanik", name: "Aufhängung", pos: { x: 0, y: 0.15 } },
      { id: "unten", art: "mechanik", name: "Haken", pos: { x: 0, y: -0.15 } },
    ],
    parameter: [
      { schluessel: "bereich", name: "Messbereich", einheit: "N", standard: 10, min: 1, max: 100 },
    ],
    signale: [{ schluessel: "kraft", name: "Kraft", einheit: "N" }],
  },
  {
    typ: "lampe",
    name: "Lämpchen",
    icon: "💡",
    bereich: "strom",
    groesse: { b: 0.12, h: 0.12 },
    ports: [
      { id: "plus", art: "strom", name: "+", pos: { x: -0.06, y: 0 } },
      { id: "minus", art: "strom", name: "−", pos: { x: 0.06, y: 0 } },
      { id: "licht", art: "licht", name: "Licht", pos: { x: 0, y: 0.06 } },
    ],
    parameter: [
      { schluessel: "widerstand", name: "Widerstand", einheit: "Ohm", standard: 20, min: 1, max: 1000 },
    ],
    signale: [{ schluessel: "leistung", name: "Leistung", einheit: "W" }],
  },
  {
    typ: "fadenpendel",
    name: "Fadenpendel",
    icon: "🕰️",
    bereich: "mechanik",
    // Der Kasten ist nur die Aufhaengung; Faden und Koerper zeichnet der
    // eigene Zeichner, weil ihre Laenge am Regler haengt.
    groesse: { b: 0.07, h: 0.06 },
    ports: [
      { id: "aufhaengung", art: "mechanik", name: "Aufhängung", pos: { x: 0, y: 0.03 } },
      // Sitz nur als Rueckfalt: wo der Koerper wirklich haengt, rechnet
      // geometrie.ts aus dem laufenden Zustand aus.
      { id: "koerper", art: "mechanik", name: "Pendelkörper", pos: { x: 0, y: -1 } },
    ],
    parameter: [
      { schluessel: "laenge", name: "Fadenlänge", einheit: "m", standard: 1, min: 0.1, max: 3 },
      { schluessel: "masse", name: "Masse", einheit: "kg", standard: 0.2, min: 0.01, max: 5 },
      { schluessel: "startwinkel", name: "Startwinkel", einheit: "rad", anzeige: "grad", standard: bogen(15), min: bogen(-80), max: bogen(80) },
      { schluessel: "daempfung", name: "Reibung", einheit: "1/s", standard: 0.2, min: 0, max: 2 },
    ],
    signale: [
      { schluessel: "winkel", name: "Winkel", einheit: "rad", anzeige: "grad" },
      { schluessel: "geschwindigkeit", name: "Geschwindigkeit", einheit: "m/s" },
    ],
  },
  {
    typ: "federpendel",
    name: "Federpendel",
    icon: "🌀",
    bereich: "mechanik",
    groesse: { b: 0.09, h: 0.06 },
    ports: [
      { id: "aufhaengung", art: "mechanik", name: "Aufhängung", pos: { x: 0, y: 0.03 } },
      { id: "koerper", art: "mechanik", name: "Schwingkörper", pos: { x: 0, y: -FEDER_RUHE } },
    ],
    parameter: [
      { schluessel: "federkonstante", name: "Federhärte", einheit: "N/m", standard: 20, min: 1, max: 200 },
      { schluessel: "masse", name: "Masse", einheit: "kg", standard: 0.2, min: 0.01, max: 5 },
      { schluessel: "startauslenkung", name: "Startauslenkung", einheit: "m", standard: 0.05, min: -0.3, max: 0.3 },
      { schluessel: "daempfung", name: "Reibung", einheit: "1/s", standard: 0.3, min: 0, max: 3 },
    ],
    signale: [
      { schluessel: "auslenkung", name: "Auslenkung", einheit: "m" },
      { schluessel: "kraft", name: "Federkraft", einheit: "N" },
    ],
  },
  {
    typ: "signalgeber",
    name: "Funktionsgenerator",
    icon: "〰️",
    bereich: "messen",
    groesse: { b: 0.24, h: 0.12 },
    ports: [{ id: "aus", art: "strom", name: "Ausgang", pos: { x: 0.12, y: 0 } }],
    parameter: [
      { schluessel: "frequenz", name: "Frequenz", einheit: "Hz", standard: 1, min: 0.1, max: 20 },
      { schluessel: "amplitude", name: "Amplitude", einheit: "V", standard: 5, min: 0.1, max: 12 },
      {
        schluessel: "form", name: "Kurvenform", einheit: "", standard: 0, min: 0, max: 2,
        optionen: [{ wert: 0, name: "Sinus" }, { wert: 1, name: "Rechteck" }, { wert: 2, name: "Dreieck" }],
      },
    ],
    signale: [{ schluessel: "spannung", name: "Spannung", einheit: "V" }],
  },
];

const NACH_TYP = new Map(KATALOG.map(t => [t.typ, t]));

export const geraetTyp = (typ: string): GeraetTyp | undefined => NACH_TYP.get(typ);

/** Der Port eines Typs — oder undefined, wenn es ihn dort nicht gibt. */
export function portVon(typ: string, portId: string) {
  return NACH_TYP.get(typ)?.ports.find(p => p.id === portId);
}

/** Die Voreinstellungen eines Typs als frisches Wertepaket. */
export function standardWerte(typ: string): Record<string, number> {
  const t = NACH_TYP.get(typ);
  if (!t) return {};
  return Object.fromEntries(t.parameter.map(p => [p.schluessel, p.standard]));
}
