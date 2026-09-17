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
