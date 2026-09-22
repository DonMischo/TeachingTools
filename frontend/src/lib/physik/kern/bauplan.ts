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
import { standardWerteVerbinder } from "./verbinder";

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
    verbinder: aufbau.verbinder.map(v => ({
      ...v, a: ende(v.a), b: ende(v.b), ...(v.ueber ? { ueber: v.ueber.map(ende) } : {}),
    })),
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
    s = verbinde(s, v.art, ende(v.a), ende(v.b), v.werte, (v.ueber ?? []).map(ende)).aufbau;
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

/**
 * Flaschenzug mit Winde: eine feste Rolle lenkt um, eine lose trägt die Last.
 *
 * Zwei Stränge tragen die lose Rolle, also hält das Seil nur ihr halbes
 * Gewicht — und die Winde holt zwei Meter Seil ein, um die Last einen zu
 * heben. Beides lässt sich am Kraftmesser und am Weg ablesen.
 */
function flaschenzug(): Aufbau {
  const hoehe = 2.6, r = 0.1;
  let a = neuerAufbau();
  const trommel = teil(a, "scheibe", { x: 0.9, y: hoehe }, { durchmesser: r * 2, dicke: 0.03 });
  a = verbinde(trommel.aufbau, "achse", amTeil(trommel.id), wand({ x: 0.9, y: hoehe }),
    { reibung: 0, motorMoment: 120, drehzahl: 3 }).aufbau;

  const fest = teil(a, "scheibe", { x: 0.15, y: hoehe }, { durchmesser: 0.12, dicke: 0.03 });
  a = verbinde(fest.aufbau, "achse", amTeil(fest.id), wand({ x: 0.15, y: hoehe })).aufbau;

  const lose = teil(a, "scheibe", { x: 0, y: hoehe - 1 }, { durchmesser: 0.16, dicke: 0.05, masseVorgabe: 10 });
  a = lose.aufbau;

  a = verbinde(a, "seil", amTeil(trommel.id, { x: 0, y: r }), wand({ x: -0.15, y: hoehe }),
    { laenge: 0, wickelt: 1, wickelrichtung: 1 },
    [amTeil(fest.id), amTeil(lose.id)]).aufbau;
  return a;
}

/** Ein Bauteil an die Wand geschraubt — sonst fällt es herunter. */
function festAnDieWand(a: Aufbau, id: string, pos: Punkt): Aufbau {
  return verbinde(a, "schraube", amTeil(id), wand(pos), standardWerteVerbinder("schraube")).aufbau;
}

const linkerPol = (id: string): Ende => amTeil(id, { x: -0.03, y: 0 });
const rechterPol = (id: string): Ende => amTeil(id, { x: 0.03, y: 0 });

/** Batterie, Schalter, Lämpchen — der erste Stromkreis, den man baut. */
function stromkreis(): Aufbau {
  let a = neuerAufbau();
  const bat = teil(a, "batterie", { x: -0.35, y: 2 }, { spannung: 4.5, innenwiderstand: 0.5 });
  a = festAnDieWand(bat.aufbau, bat.id, { x: -0.35, y: 2 });
  const schalter = teil(a, "schalter", { x: 0, y: 2.25 });
  a = festAnDieWand(schalter.aufbau, schalter.id, { x: 0, y: 2.25 });
  const lampe = teil(a, "lampe", { x: 0.35, y: 2 }, { widerstand: 12, nennleistung: 1.5 });
  a = festAnDieWand(lampe.aufbau, lampe.id, { x: 0.35, y: 2 });

  a = verbinde(a, "kabel", rechterPol(bat.id), linkerPol(schalter.id)).aufbau;
  a = verbinde(a, "kabel", rechterPol(schalter.id), linkerPol(lampe.id)).aufbau;
  a = verbinde(a, "kabel", rechterPol(lampe.id), linkerPol(bat.id)).aufbau;
  return a;
}

/**
 * Motor mit Winde: Strom hebt eine Last.
 *
 * Der Aufbau, an dem sich die ganze Kopplung zeigt — schaltet man ein, steigt
 * das Gewicht; hängt man mehr daran, zieht der Motor mehr Strom und dreht
 * langsamer. Dieselbe Maschine wird zum Dynamo, wenn man die Batterie durch
 * ein Lämpchen ersetzt und das Rad von Hand anwirft.
 */
function motorwinde(): Aufbau {
  let a = neuerAufbau();
  const motor = teil(a, "motor", { x: 0, y: 2.2 }, { widerstand: 2, konstante: 0.3 });
  a = festAnDieWand(motor.aufbau, motor.id, { x: -0.06, y: 2.24 });
  const trommel = teil(a, "scheibe", { x: 0, y: 2.2 }, { durchmesser: 0.16, dicke: 0.03 }); a = trommel.aufbau;
  a = verbinde(a, "achse", amTeil(motor.id), amTeil(trommel.id), standardWerteVerbinder("achse")).aufbau;

  const last = teil(a, "massestueck", { x: 0.08, y: 1.2 }, { masse: 0.5 }); a = last.aufbau;
  a = verbinde(a, "seil", amTeil(trommel.id, { x: 0.08, y: 0 }), amTeil(last.id),
    { ...standardWerteVerbinder("seil"), laenge: 0, wickelt: 1, wickelrichtung: 1 }).aufbau;

  const bat = teil(a, "batterie", { x: -0.45, y: 2.5 }, { spannung: 9, innenwiderstand: 0.3 });
  a = festAnDieWand(bat.aufbau, bat.id, { x: -0.45, y: 2.5 });
  const schalter = teil(a, "schalter", { x: 0.2, y: 2.5 }, { geschlossen: 0 });
  a = festAnDieWand(schalter.aufbau, schalter.id, { x: 0.2, y: 2.5 });

  a = verbinde(a, "kabel", rechterPol(bat.id), linkerPol(schalter.id)).aufbau;
  a = verbinde(a, "kabel", rechterPol(schalter.id), rechterPol(motor.id)).aufbau;
  a = verbinde(a, "kabel", linkerPol(motor.id), linkerPol(bat.id)).aufbau;
  return a;
}

/**
 * Brennglas: Licht wird gebündelt, und am Brennpunkt wird es heiß.
 *
 * Der Aufbau, an dem drei Bereiche zusammenkommen — der Strahler hängt am
 * Stromkreis, die Linse sammelt, und was am Brennpunkt ankommt, steht danach
 * als Temperatur im Messschreiber. Dafür gibt es nirgends einen Sonderfall.
 */
function brennglas(): Aufbau {
  const f = 0.3;
  let a = neuerAufbau();
  const bat = teil(a, "batterie", { x: -0.5, y: 2.5 }, { spannung: 24, innenwiderstand: 0.2 });
  a = festAnDieWand(bat.aufbau, bat.id, { x: -0.5, y: 2.5 });
  const schalter = teil(a, "schalter", { x: 0.1, y: 2.5 }, { geschlossen: 0 });
  a = festAnDieWand(schalter.aufbau, schalter.id, { x: 0.1, y: 2.5 });

  const strahler = teil(a, "strahler", { x: -0.5, y: 2 }, { widerstand: 8, wirkungsgrad: 0.9, breite: 0.14, strahlen: 7 });
  a = festAnDieWand(strahler.aufbau, strahler.id, { x: -0.5, y: 2 });
  const linse = teil(a, "linse", { x: 0, y: 2 }, { durchmesser: 0.2, brennweite: f });
  a = festAnDieWand(linse.aufbau, linse.id, { x: 0, y: 2 });
  const span = teil(a, "klotz", { x: f, y: 2 }, { breite: 0.03, hoehe: 0.03, tiefe: 0.03, stoff: 0 });
  a = festAnDieWand(span.aufbau, span.id, { x: f, y: 2 });

  a = verbinde(a, "kabel", rechterPol(bat.id), linkerPol(schalter.id)).aufbau;
  a = verbinde(a, "kabel", rechterPol(schalter.id), rechterPol(strahler.id)).aufbau;
  a = verbinde(a, "kabel", linkerPol(strahler.id), linkerPol(bat.id)).aufbau;
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
    id: "flaschenzug", name: "Flaschenzug", icon: "⛓️",
    beschreibung: "Feste und lose Rolle: die Winde hebt 10 kg und zieht dabei nur mit der halben Kraft.",
    aufbau: umDenUrsprung(flaschenzug()),
  },
  {
    id: "stromkreis", name: "Stromkreis", icon: "🔌",
    beschreibung: "Batterie, Schalter, Lämpchen. Einschalten — und am Kraftmesser für Strom sieht man U = R · I.",
    aufbau: umDenUrsprung(stromkreis()),
  },
  {
    id: "motorwinde", name: "Motor mit Winde", icon: "⚡",
    beschreibung: "Strom hebt eine Last. Mehr Last heißt mehr Strom und weniger Drehzahl — der Schalter ist offen.",
    aufbau: umDenUrsprung(motorwinde()),
  },
  {
    id: "brennglas", name: "Brennglas", icon: "🔎",
    beschreibung: "Strahler, Linse, Holzspan im Brennpunkt. Einschalten — und die Temperatur im Messschreiber steigt.",
    aufbau: umDenUrsprung(brennglas()),
  },
  {
    id: "trebuchet", name: "Trebuchet", icon: "🏰",
    beschreibung: "200 kg Gegengewicht schleudern den Stein knapp zehn Meter weit. Steht auf dem Boden.",
    aufbau: trebuchet(),
    amBoden: true,
  },
];

export const bauplan = (id: string): Bauplan | undefined => BAUPLAENE.find(b => b.id === id);
