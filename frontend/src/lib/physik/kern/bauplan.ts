/**
 * Baupläne: einmal gebaut, immer wieder hinstellbar.
 *
 * Ein Bauplan ist nichts anderes als ein kleiner Aufbau, dessen Teile um den
 * Ursprung herum liegen. Beim Einfügen bekommt jedes Teil eine neue Id und
 * alles wird an die Stelle verschoben, auf die man tippt — auch die Punkte an
 * der Wand, sonst hinge ein eingefügtes Pendel an der Wand des Vorbilds.
 *
 * Die mitgelieferten Pläne sind genau die Maschinen, die in den Tests laufen:
 * Was im Schrank steht, ist damit nie eine Behauptung, sondern geprüft.
 */
import { bogen } from "../einheiten";
import type { Punkt } from "../typen";
import {
  amTeil, fuegeTeilHinzu, neuerAufbau, verbinde, wand,
  type Aufbau, type Ende, type TeilArt,
} from "./modell";
import { standardWerteTeil } from "./teile";

export interface Bauplan {
  id: string;
  name: string;
  icon: string;
  /** Ein Satz, der sagt, was man damit zeigen kann. */
  beschreibung: string;
  aufbau: Aufbau;
  /**
   * Der Plan gehört auf den Boden — etwa ein Trebuchet, dessen Stein dort
   * liegt. Beim Einfügen folgt er dem Finger dann nur zur Seite und behält
   * seine Höhe; sonst versänke der Stein im Boden und die Maschine klemmte.
   */
  amBoden?: boolean;
}

/** Legt ein Teil mit den Standardwerten und ein paar eigenen hin. */
function teil(a: Aufbau, art: TeilArt, pos: Punkt, werte: Record<string, number> = {}, winkel = 0) {
  return fuegeTeilHinzu(a, art, pos, { ...standardWerteTeil(art), ...werte }, winkel);
}

/**
 * Verschiebt einen Aufbau so, dass sein Aufhängepunkt im Ursprung liegt.
 *
 * Aufhängepunkt ist die Mitte oben: einen Bauplan setzt man dorthin, wo er an
 * der Wand hängen soll, nicht dorthin, wo sein Schwerpunkt landet.
 */
export function umDenUrsprung(aufbau: Aufbau): Aufbau {
  if (!aufbau.teile.length) return aufbau;
  // Die Wandpunkte zählen mit: beim Pendel ist der Haken an der Wand der
  // oberste Punkt, und *er* soll dort landen, wo man hintippt — nicht das
  // Gewicht, das einen Meter darunter hängt.
  const punkte = [
    ...aufbau.teile.map(t => t.pos),
    ...aufbau.verbinder.flatMap(v => [v.a, v.b]).filter(e => e.teil === null).map(e => e.punkt),
  ];
  const xs = punkte.map(p => p.x), ys = punkte.map(p => p.y);
  const um = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: Math.max(...ys) };
  return verschiebe(aufbau, { x: -um.x, y: -um.y });
}

function verschiebe(aufbau: Aufbau, um: Punkt): Aufbau {
  const ende = (e: Ende): Ende => (e.teil === null ? { teil: null, punkt: { x: e.punkt.x + um.x, y: e.punkt.y + um.y } } : e);
  return {
    ...aufbau,
    teile: aufbau.teile.map(t => ({ ...t, pos: { x: t.pos.x + um.x, y: t.pos.y + um.y } })),
    verbinder: aufbau.verbinder.map(v => ({ ...v, a: ende(v.a), b: ende(v.b) })),
  };
}

/**
 * Fügt einen Bauplan in einen Aufbau ein — an der Stelle, auf die getippt wurde.
 *
 * Die Ids werden neu vergeben; sonst träfe das zweite eingefügte Pendel auf
 * die Teile des ersten.
 */
export function fuegeBauplanEin(aufbau: Aufbau, plan: Bauplan, ursprung: Punkt): { aufbau: Aufbau; neu: string[] } {
  const versetzt = verschiebe(plan.aufbau, { x: ursprung.x, y: plan.amBoden ? 0 : ursprung.y });
  let s = aufbau;
  const neueId = new Map<string, string>();
  for (const t of versetzt.teile) {
    const r = fuegeTeilHinzu(s, t.art, t.pos, t.werte, t.winkel);
    neueId.set(t.id, r.id);
    s = r.aufbau;
  }
  const ende = (e: Ende): Ende => (e.teil === null ? e : { teil: neueId.get(e.teil) ?? e.teil, punkt: e.punkt });
  for (const v of versetzt.verbinder) {
    s = verbinde(s, v.art, ende(v.a), ende(v.b), v.werte).aufbau;
  }
  return { aufbau: s, neu: [...neueId.values()] };
}

// ── Die mitgelieferten Pläne ─────────────────────────────────────────────────

/** Ein Gewicht an einem Seil an der Wand: schwingt mit 2π√(L/g). */
function pendel(): Aufbau {
  const laenge = 1;
  let a = neuerAufbau();
  const m = teil(a, "massestueck", { x: 0, y: 2 - laenge }, { masse: 0.5 });
  a = verbinde(m.aufbau, "seil", wand({ x: 0, y: 2 }), amTeil(m.id), { laenge: 0 }).aufbau;
  return a;
}

/** Brett auf einer Achse: kippt zur schwereren Seite, schleudert die leichtere fort. */
function wippe(): Aufbau {
  let a = neuerAufbau();
  const brett = teil(a, "brett", { x: 0, y: 0.12 }, { laenge: 1, dicke: 0.02 });
  a = verbinde(brett.aufbau, "achse", amTeil(brett.id), wand({ x: 0, y: 0.12 })).aufbau;
  a = teil(a, "klotz", { x: -0.42, y: 0.16 }, { breite: 0.05, hoehe: 0.05, tiefe: 0.05 }).aufbau;
  return a;
}

/** Scheibe mit Motor, Seil vom Rand: hebt um Halbmesser mal Drehwinkel. */
function winde(): Aufbau {
  const r = 0.1;
  let a = neuerAufbau();
  const trommel = teil(a, "scheibe", { x: 0, y: 2 }, { durchmesser: r * 2, dicke: 0.03 });
  a = verbinde(trommel.aufbau, "achse", amTeil(trommel.id), wand({ x: 0, y: 2 }),
    { reibung: 0, motorMoment: 60, drehzahl: 1.5 }).aufbau;
  const last = teil(a, "massestueck", { x: r, y: 1 }, { masse: 2 });
  a = verbinde(last.aufbau, "seil", amTeil(trommel.id, { x: r, y: 0 }), amTeil(last.id),
    { laenge: 0, wickelt: 1, wickelrichtung: 1 }).aufbau;
  return a;
}

/**
 * Trebuchet: Stange auf einer Achse, Gegengewicht am kurzen Arm, Schlinge am
 * langen. Die Schlinge gibt frei, wenn der Arm weit genug herum ist.
 */
function trebuchet(): Aufbau {
  const kurz = 0.8, lang = 2.4, hoehe = 2.6, neigung = -0.35, schlinge = 1.2;
  const mitte = (lang - kurz) / 2;
  let a = neuerAufbau();
  const arm = teil(a, "stange", { x: 0, y: hoehe }, { laenge: kurz + lang, durchmesser: 0.04, stoff: 0 }, neigung);
  a = arm.aufbau;
  a = verbinde(a, "achse", amTeil(arm.id, { x: -mitte, y: 0 }), wand({ x: 0, y: hoehe })).aufbau;

  const kurzEnde = { x: -kurz * Math.cos(neigung), y: hoehe - kurz * Math.sin(neigung) };
  const gg = teil(a, "massestueck", { x: kurzEnde.x, y: kurzEnde.y - 0.3 }, { masse: 200 });
  a = verbinde(gg.aufbau, "achse", amTeil(arm.id, { x: -mitte - kurz, y: 0 }), amTeil(gg.id, { x: 0, y: 0.3 })).aufbau;

  const langEnde = { x: lang * Math.cos(neigung), y: hoehe + lang * Math.sin(neigung) };
  const stein = teil(a, "kugel", { x: langEnde.x + schlinge * 0.9, y: 0.03 }, { durchmesser: 0.06, stoff: 1 });
  a = verbinde(stein.aufbau, "seil", amTeil(arm.id, { x: -mitte + lang, y: 0 }), amTeil(stein.id),
    { laenge: schlinge, loestBeiWinkel: bogen(90) }).aufbau;
  return a;
}

export const BAUPLAENE: Bauplan[] = [
  {
    id: "pendel", name: "Pendel", icon: "🕰️",
    beschreibung: "Gewicht am Seil — schwingt mit 2π√(L/g).",
    aufbau: umDenUrsprung(pendel()),
  },
  {
    id: "wippe", name: "Wippe", icon: "🎢",
    beschreibung: "Brett auf einer Achse. Fällt ein Gewicht auf das eine Ende, fliegt vom anderen, was dort liegt. Steht auf dem Boden.",
    aufbau: wippe(),
    amBoden: true,
  },
  {
    id: "winde", name: "Winde", icon: "🧵",
    beschreibung: "Trommel mit Motor: hebt die Last um Halbmesser mal Drehwinkel.",
    aufbau: umDenUrsprung(winde()),
  },
  {
    id: "trebuchet", name: "Trebuchet", icon: "🏰",
    beschreibung: "200 kg Gegengewicht schleudern den Stein knapp zehn Meter weit. Steht auf dem Boden.",
    aufbau: trebuchet(),
    amBoden: true,
  },
];

export const bauplan = (id: string): Bauplan | undefined => BAUPLAENE.find(b => b.id === id);
