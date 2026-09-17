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
import { HEBEL_ANSCHLAG } from "./mechanik";
import type { GeraetTyp } from "./typen";

export const KATALOG: GeraetTyp[] = [
  {
    typ: "stativ",
    name: "Stativ",
    icon: "🗼",
    bereich: "aufbau",
    groesse: { b: 0.3, h: 1.2 },
    // Der Haken sitzt am Ende des Auslegers; wo genau, rechnet geometrie.ts.
    ports: [{ id: "haken", art: "mechanik", name: "Haken", pos: { x: 0.35, y: 0.6 } }],
    parameter: [
      { schluessel: "hoehe", name: "Höhe", einheit: "m", standard: 1.2, min: 0.4, max: 2 },
      { schluessel: "armLaenge", name: "Ausleger", einheit: "m", standard: 0.35, min: 0.1, max: 0.8 },
    ],
    signale: [],
  },
  {
    typ: "massestueck",
    name: "Massestück",
    icon: "🏋️",
    bereich: "mechanik",
    groesse: { b: 0.08, h: 0.08 },
    ports: [
      { id: "oese", art: "mechanik", name: "Öse oben", pos: { x: 0, y: 0.04 } },
      // Schlitzgewichte haben unten einen zweiten Haken — daran haengt das naechste.
      { id: "unten", art: "mechanik", name: "Haken unten", pos: { x: 0, y: -0.04 } },
    ],
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
    signale: [
      { schluessel: "spannung", name: "Spannung", einheit: "V" },
      { schluessel: "strom", name: "Strom", einheit: "A" },
      { schluessel: "leistung", name: "Leistung", einheit: "W" },
    ],
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
      // 1,10 m an einem 1,20-m-Stativ lässt den Körper dicht über dem Boden
      // durchlaufen. Bei 1,00 m schwang er in 15 cm Höhe — über jedem Stapel
      // hinweg, den man ihm in den Weg stellt, ohne dass man sah, warum.
      { schluessel: "laenge", name: "Fadenlänge", einheit: "m", standard: 1.1, min: 0.1, max: 3 },
      // Keine eigene Masse: das Pendel ist Faden und Haken. Was schwingt, hängt
      // man an — dadurch ist die Masse etwas, das man auf den Tisch legt und
      // anfasst, statt eine Zahl am Regler.
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
    typ: "hebel",
    name: "Hebel",
    icon: "🔺",
    bereich: "mechanik",
    groesse: { b: 0.1, h: 0.1 },
    ports: [
      // Die Arme schwenken mit; wo sie wirklich sind, rechnet geometrie.ts aus.
      { id: "links", art: "mechanik", name: "linker Arm", pos: { x: -0.3, y: 0 } },
      { id: "rechts", art: "mechanik", name: "rechter Arm", pos: { x: 0.3, y: 0 } },
    ],
    parameter: [
      { schluessel: "armLinks", name: "linker Arm", einheit: "m", standard: 0.3, min: 0.05, max: 0.6 },
      { schluessel: "armRechts", name: "rechter Arm", einheit: "m", standard: 0.3, min: 0.05, max: 0.6 },
      { schluessel: "balkenMasse", name: "Balken", einheit: "kg", standard: 0.4, min: 0.05, max: 3 },
      { schluessel: "startneigung", name: "Startneigung", einheit: "rad", anzeige: "grad", standard: 0, min: -HEBEL_ANSCHLAG, max: HEBEL_ANSCHLAG },
      { schluessel: "daempfung", name: "Reibung", einheit: "1/s", standard: 1.5, min: 0, max: 6 },
    ],
    signale: [
      { schluessel: "winkel", name: "Neigung", einheit: "rad", anzeige: "grad" },
      { schluessel: "momentLinks", name: "Moment links", einheit: "Nm" },
      { schluessel: "momentRechts", name: "Moment rechts", einheit: "Nm" },
    ],
  },
  {
    typ: "waage",
    name: "Balkenwaage",
    icon: "⚖️",
    bereich: "messen",
    groesse: { b: 0.1, h: 0.1 },
    ports: [
      // Schalen tragen: was man darauf stellt, steht darauf.
      { id: "links", art: "mechanik", name: "linke Schale", pos: { x: -0.3, y: 0 }, traegt: true },
      { id: "rechts", art: "mechanik", name: "rechte Schale", pos: { x: 0.3, y: 0 }, traegt: true },
    ],
    parameter: [
      { schluessel: "armLinks", name: "linker Arm", einheit: "m", standard: 0.3, min: 0.05, max: 0.6 },
      { schluessel: "armRechts", name: "rechter Arm", einheit: "m", standard: 0.3, min: 0.05, max: 0.6 },
      { schluessel: "balkenMasse", name: "Balken", einheit: "kg", standard: 0.4, min: 0.05, max: 3 },
      { schluessel: "startneigung", name: "Startneigung", einheit: "rad", anzeige: "grad", standard: 0, min: -HEBEL_ANSCHLAG, max: HEBEL_ANSCHLAG },
      { schluessel: "daempfung", name: "Reibung", einheit: "1/s", standard: 2.5, min: 0, max: 8 },
    ],
    signale: [
      { schluessel: "masseLinks", name: "Masse links", einheit: "kg" },
      { schluessel: "masseRechts", name: "Masse rechts", einheit: "kg" },
      { schluessel: "winkel", name: "Neigung", einheit: "rad", anzeige: "grad" },
    ],
  },
  {
    typ: "flaschenzug",
    name: "Flaschenzug",
    icon: "⛓️",
    bereich: "mechanik",
    groesse: { b: 0.14, h: 0.18 },
    ports: [
      { id: "zug", art: "mechanik", name: "Zugseil", pos: { x: -0.07, y: 0.09 } },
      { id: "last", art: "mechanik", name: "Last", pos: { x: 0.04, y: -0.09 } },
    ],
    parameter: [
      {
        schluessel: "rollen", name: "tragende Seile", einheit: "", standard: 2, min: 1, max: 6,
        optionen: [
          { wert: 1, name: "1 — feste Rolle" },
          { wert: 2, name: "2 — lose Rolle" },
          { wert: 3, name: "3 Seile" },
          { wert: 4, name: "4 Seile" },
          { wert: 5, name: "5 Seile" },
          { wert: 6, name: "6 Seile" },
        ],
      },
    ],
    signale: [
      { schluessel: "zugkraft", name: "Zugkraft", einheit: "N" },
      { schluessel: "last", name: "Last", einheit: "N" },
    ],
  },
  {
    typ: "schiefeebene",
    name: "Schiefe Ebene",
    icon: "🛝",
    bereich: "mechanik",
    groesse: { b: 0.12, h: 0.12 },
    ports: [
      { id: "koerper", art: "mechanik", name: "Kiste", pos: { x: 0, y: 0 } },
    ],
    parameter: [
      { schluessel: "winkel", name: "Neigung", einheit: "rad", anzeige: "grad", standard: bogen(30), min: bogen(0), max: bogen(60) },
      { schluessel: "masse", name: "Masse der Kiste", einheit: "kg", standard: 0.5, min: 0.01, max: 10 },
      { schluessel: "laenge", name: "Länge", einheit: "m", standard: 1, min: 0.2, max: 2.5 },
      { schluessel: "startweg", name: "Startpunkt", einheit: "m", standard: 0, min: 0, max: 2.5 },
      { schluessel: "reibungszahl", name: "Reibungszahl", einheit: "", standard: 0.2, min: 0, max: 1 },
    ],
    signale: [
      { schluessel: "hangabtrieb", name: "Hangabtriebskraft", einheit: "N" },
      { schluessel: "normalkraft", name: "Normalkraft", einheit: "N" },
      { schluessel: "weg", name: "Weg", einheit: "m" },
      { schluessel: "geschwindigkeit", name: "Geschwindigkeit", einheit: "m/s" },
    ],
  },
  {
    typ: "batterie",
    name: "Batterie",
    icon: "🔋",
    bereich: "strom",
    groesse: { b: 0.16, h: 0.1 },
    ports: [
      { id: "plus", art: "strom", name: "+", pos: { x: -0.08, y: 0 } },
      { id: "minus", art: "strom", name: "−", pos: { x: 0.08, y: 0 } },
    ],
    parameter: [
      { schluessel: "spannung", name: "Spannung", einheit: "V", standard: 4.5, min: 0.5, max: 24 },
      { schluessel: "innenwiderstand", name: "Innenwiderstand", einheit: "Ohm", standard: 0.5, min: 0, max: 20 },
    ],
    signale: [
      { schluessel: "spannung", name: "Klemmenspannung", einheit: "V" },
      { schluessel: "strom", name: "Strom", einheit: "A" },
    ],
  },
  {
    typ: "widerstand",
    name: "Widerstand",
    icon: "▭",
    bereich: "strom",
    groesse: { b: 0.16, h: 0.07 },
    ports: [
      { id: "a", art: "strom", name: "links", pos: { x: -0.08, y: 0 } },
      { id: "b", art: "strom", name: "rechts", pos: { x: 0.08, y: 0 } },
    ],
    parameter: [
      { schluessel: "widerstand", name: "Widerstand", einheit: "Ohm", standard: 100, min: 1, max: 10000 },
    ],
    signale: [
      { schluessel: "spannung", name: "Spannung", einheit: "V" },
      { schluessel: "strom", name: "Strom", einheit: "A" },
    ],
  },
  {
    typ: "schalter",
    name: "Schalter",
    icon: "🔘",
    bereich: "strom",
    groesse: { b: 0.14, h: 0.08 },
    ports: [
      { id: "a", art: "strom", name: "links", pos: { x: -0.07, y: 0 } },
      { id: "b", art: "strom", name: "rechts", pos: { x: 0.07, y: 0 } },
    ],
    parameter: [
      {
        schluessel: "geschlossen", name: "Stellung", einheit: "", standard: 1, min: 0, max: 1,
        optionen: [{ wert: 1, name: "geschlossen" }, { wert: 0, name: "offen" }],
      },
    ],
    signale: [],
  },
  {
    typ: "voltmeter",
    name: "Voltmeter",
    icon: "Ⓥ",
    bereich: "messen",
    groesse: { b: 0.12, h: 0.12 },
    ports: [
      { id: "a", art: "strom", name: "+", pos: { x: -0.06, y: 0 } },
      { id: "b", art: "strom", name: "−", pos: { x: 0.06, y: 0 } },
    ],
    parameter: [],
    signale: [{ schluessel: "spannung", name: "Spannung", einheit: "V" }],
  },
  {
    typ: "amperemeter",
    name: "Amperemeter",
    icon: "Ⓐ",
    bereich: "messen",
    groesse: { b: 0.12, h: 0.12 },
    ports: [
      { id: "a", art: "strom", name: "links", pos: { x: -0.06, y: 0 } },
      { id: "b", art: "strom", name: "rechts", pos: { x: 0.06, y: 0 } },
    ],
    parameter: [],
    signale: [{ schluessel: "strom", name: "Strom", einheit: "A" }],
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
