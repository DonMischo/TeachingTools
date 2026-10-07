/**
 * Koordinaten-Lauf — Welten, Level und Infohappen.
 *
 * Jede Welt beginnt mit einem Infohappen; jeder Infohappen kann sich selbst
 * vorführen (die Figur läuft und springt die Beispielpunkte ab, mit Satz je
 * Schritt). Die Level einer Welt bauen aufeinander auf, gesperrt ist keines.
 */
import type { Bereich, Level, LevelInhalt } from "./spiel";

export type Welt = { nr: number; titel: string; icon: string; infos: string[] };

export const WELTEN: Welt[] = [
  { nr: 1, titel: "Erst laufen, dann springen", icon: "🏃", infos: ["achsen", "laufen"] },
  { nr: 2, titel: "Alle vier Quadranten", icon: "🌊", infos: ["negativ", "achsenpunkte"] },
  { nr: 3, titel: "Symmetrie", icon: "🦋", infos: ["achsensymmetrie", "punktsymmetrie"] },
  { nr: 4, titel: "Steigung", icon: "⛰️", infos: ["steigung"] },
  { nr: 5, titel: "Lineare Funktionen", icon: "📈", infos: ["gerade"] },
];

const Q1: Bereich = { x0: 0, x1: 10, y0: 0, y1: 7 };
const VIER: Bereich = { x0: -7, x1: 7, y0: -5, y1: 5 };

const pk = (name: string, x: number, y: number) => ({ name, p: { x, y } });

export const LEVEL: Level[] = [
  /* Welt 1 — erster Quadrant */
  {
    id: "w1-edelsteine", welt: 1, titel: "Edelsteine sammeln", art: "setzen", bereich: Q1, sichtbar: true, info: ["laufen"],
    text: "Die Edelsteine liegen schon sichtbar da. Lauf unter jeden Stein und spring genau so hoch, dass du ihn erwischst.",
    ziele: [pk("A", 3, 2), pk("B", 6, 4), pk("C", 1, 5)],
  },
  {
    id: "w1-karte", welt: 1, titel: "Nur mit Koordinaten", art: "setzen", bereich: Q1, info: ["laufen"],
    text: "Jetzt sind die Steine unsichtbar — nur ihre Koordinaten stehen auf der Liste.",
    ziele: [pk("A", 4, 1), pk("B", 2, 6), pk("C", 7, 3), pk("D", 5, 5)],
  },
  {
    id: "w1-vertauscht", welt: 1, titel: "Vertauscht?", art: "setzen", bereich: Q1, info: ["laufen"],
    text: "Vorsicht: (2|5) und (5|2) sind zwei verschiedene Punkte.",
    ziele: [pk("A", 2, 5), pk("B", 5, 2), pk("C", 6, 3), pk("D", 3, 6)],
  },
  {
    id: "w1-haus", welt: 1, titel: "Das Haus", art: "setzen", bereich: Q1, info: ["laufen"],
    text: "Setz alle Eckpunkte — die Linien verbinden sich von selbst. Welche Figur entsteht?",
    ziele: [pk("A", 2, 1), pk("B", 8, 1), pk("C", 8, 4), pk("D", 5, 7), pk("E", 2, 4), pk("F", 4, 1), pk("G", 4, 3), pk("H", 6, 3), pk("I", 6, 1)],
    linien: [[0, 1, 2, 3, 4, 0], [5, 6, 7, 8]],
  },
  {
    id: "w1-boot", welt: 1, titel: "Das Segelboot", art: "setzen", bereich: Q1, info: ["laufen"],
    text: "Rumpf und Segel — sieben Eckpunkte.",
    ziele: [pk("A", 2, 1), pk("B", 8, 1), pk("C", 9, 2), pk("D", 1, 2), pk("E", 5, 3), pk("F", 5, 7), pk("G", 8, 3)],
    linien: [[0, 1, 2, 3, 0], [4, 5, 6, 4]],
  },

  /* Welt 2 — vier Quadranten */
  {
    id: "w2-links", welt: 2, titel: "Nach links", art: "setzen", bereich: VIER, sichtbar: true, info: ["negativ"],
    text: "Ein Minus bei x heißt: nach links laufen.",
    ziele: [pk("A", -3, 2), pk("B", -6, 4), pk("C", 2, 3), pk("D", -1, 1)],
  },
  {
    id: "w2-tauchen", welt: 2, titel: "Abtauchen", art: "setzen", bereich: VIER, info: ["negativ", "achsenpunkte"],
    text: "Ein Minus bei y heißt: abtauchen. Und manche Punkte liegen genau auf einer Achse.",
    ziele: [pk("A", 3, -2), pk("B", -4, -3), pk("C", -2, -1), pk("D", 0, -4), pk("E", 5, 0), pk("F", 0, 3)],
  },
  {
    id: "w2-fisch", welt: 2, titel: "Der Fisch", art: "setzen", bereich: VIER, info: ["negativ"],
    text: "Der Fisch schwimmt durch alle vier Quadranten.",
    ziele: [pk("A", -6, 2), pk("B", -6, -2), pk("C", -3, 0), pk("D", 0, 3), pk("E", 4, 1), pk("F", 4, -1), pk("G", 0, -3)],
    linien: [[2, 0, 1, 2], [2, 3, 4, 5, 6, 2]],
  },
  {
    id: "w2-rakete", welt: 2, titel: "Die Rakete", art: "setzen", bereich: VIER, info: ["negativ", "achsenpunkte"],
    text: "Startklar in drei … zwei … eins.",
    ziele: [pk("A", 0, 5), pk("B", 2, 2), pk("C", 2, -3), pk("D", 4, -5), pk("E", -4, -5), pk("F", -2, -3), pk("G", -2, 2)],
    linien: [[0, 1, 2, 3, 4, 5, 6, 0], [2, 5]],
  },

  /* Welt 3 — Symmetrie */
  {
    id: "w3-tanne", welt: 3, titel: "Die halbe Tanne", art: "spiegeln", bereich: VIER, achse: { art: "y" }, info: ["achsensymmetrie"],
    text: "Die linke Hälfte steht schon. Spiegel sie an der y-Achse.",
    vorlage: [pk("A", 0, 5), pk("B", -2, 2), pk("C", -1, 2), pk("D", -4, -1), pk("E", -1, -1), pk("F", -1, -3), pk("G", 0, -3)],
    linien: [[0, 1, 2, 3, 4, 5, 6]],
  },
  {
    id: "w3-see", welt: 3, titel: "Spiegelbild im See", art: "spiegeln", bereich: VIER, achse: { art: "x" }, info: ["achsensymmetrie"],
    text: "Die Berge spiegeln sich im Wasser — die x-Achse ist das Ufer.",
    vorlage: [pk("A", -7, 0), pk("B", -4, 4), pk("C", -2, 2), pk("D", 1, 5), pk("E", 4, 1), pk("F", 6, 3), pk("G", 7, 0)],
    linien: [[0, 1, 2, 3, 4, 5, 6]],
  },
  {
    id: "w3-falter", welt: 3, titel: "Der Schmetterling", art: "spiegeln", bereich: { x0: -4, x1: 8, y0: -4, y1: 6 },
    achse: { art: "senkrecht", k: 2 }, info: ["achsensymmetrie"],
    text: "Diesmal ist die Spiegelachse die Gerade x = 2. Zähle den Abstand zur Achse, nicht zur y-Achse.",
    vorlage: [pk("A", 2, 2), pk("B", 0, 5), pk("C", -3, 4), pk("D", -1, 1), pk("E", -3, -2), pk("F", 0, -3), pk("G", 2, -1)],
    linien: [[0, 1, 2, 3, 4, 5, 6]],
  },
  {
    id: "w3-punkt", welt: 3, titel: "Punktspiegelung", art: "spiegeln", bereich: { x0: -6, x1: 6, y0: -5, y1: 5 },
    achse: { art: "ursprung" }, info: ["punktsymmetrie"],
    text: "Spiegel am Ursprung: Jeder Punkt landet genau gegenüber, durch (0|0) hindurch.",
    vorlage: [pk("A", 0, 0), pk("B", 3, 0), pk("C", 3, 2), pk("D", -2, 2), pk("E", -2, 4), pk("F", 4, 4)],
    linien: [[0, 1, 2, 3, 4, 5]],
  },

  /* Welt 4 — Steigung */
  {
    id: "w4-treppe", welt: 4, titel: "Treppe: m = 1", art: "steigung", bereich: { x0: -6, x1: 6, y0: -5, y1: 5 }, info: ["steigung"],
    text: "Vom Startpunkt aus jedes Mal: 1 nach rechts, 1 nach oben.", start: { x: -5, y: -4 }, m: [1, 1], schritte: 6, tipp: true,
  },
  {
    id: "w4-steil", welt: 4, titel: "Steil: m = 2", art: "steigung", bereich: { x0: -6, x1: 6, y0: -5, y1: 5 }, info: ["steigung"],
    text: "m = 2 ist dasselbe wie 2/1: 1 nach rechts, 2 nach oben.", start: { x: -4, y: -5 }, m: [2, 1], schritte: 4, tipp: true,
  },
  {
    id: "w4-flach", welt: 4, titel: "Flach: m = ½", art: "steigung", bereich: VIER, info: ["steigung"],
    text: "Ein Bruch: Nenner laufen, Zähler springen.", start: { x: -6, y: -2 }, m: [1, 2], schritte: 5, tipp: true,
  },
  {
    id: "w4-bergab", welt: 4, titel: "Bergab: m = −1", art: "steigung", bereich: { x0: -6, x1: 6, y0: -5, y1: 5 }, info: ["steigung"],
    text: "Negative Steigung: erst nach rechts, dann nach unten.", start: { x: -5, y: 4 }, m: [-1, 1], schritte: 7, tipp: true,
  },
  {
    id: "w4-zweidrittel", welt: 4, titel: "m = 2/3", art: "steigung", bereich: VIER, info: ["steigung"],
    text: "Ohne Hilfe: was heißt m = 2/3?", start: { x: -6, y: -4 }, m: [2, 3], schritte: 4,
  },
  {
    id: "w4-dreihalbe", welt: 4, titel: "m = −3/2", art: "steigung", bereich: { x0: -6, x1: 6, y0: -5, y1: 6 }, info: ["steigung"],
    text: "Steil bergab.", start: { x: -5, y: 5 }, m: [-3, 2], schritte: 3,
  },

  /* Welt 5 — y = mx + n */
  {
    id: "w5-eins", welt: 5, titel: "y = x + 1", art: "gerade", bereich: { x0: -6, x1: 6, y0: -5, y1: 5 }, info: ["gerade"],
    text: "Erst den y-Achsenabschnitt setzen, dann mit der Steigung weiter.", n: 1, m: [1, 1], schritte: 3, tipp: true,
  },
  {
    id: "w5-zwei", welt: 5, titel: "y = 2x − 3", art: "gerade", bereich: { x0: -6, x1: 6, y0: -5, y1: 5 }, info: ["gerade"],
    text: "n ist negativ — abtauchen.", n: -3, m: [2, 1], schritte: 3, tipp: true,
  },
  {
    id: "w5-halb", welt: 5, titel: "y = ½x + 2", art: "gerade", bereich: { x0: -7, x1: 7, y0: -5, y1: 6 }, info: ["gerade"],
    text: "Eine flache Gerade.", n: 2, m: [1, 2], schritte: 3,
  },
  {
    id: "w5-fallend", welt: 5, titel: "y = −⅔x + 3", art: "gerade", bereich: { x0: -7, x1: 7, y0: -5, y1: 5 }, info: ["gerade"],
    text: "Eine fallende Gerade.", n: 3, m: [-2, 3], schritte: 2,
  },
  {
    id: "w5-steil", welt: 5, titel: "y = −3x + 4", art: "gerade", bereich: { x0: -6, x1: 6, y0: -5, y1: 5 }, info: ["gerade"],
    text: "Steil bergab bis ganz nach unten.", n: 4, m: [-3, 1], schritte: 3,
  },
];

/* ── Infohappen ────────────────────────────────────────────────────────────── */

export type Info = {
  id: string;
  icon: string;
  titel: string;
  absaetze: string[];
  /** Beispiel zum Vorführen: die Figur erledigt dieses Mini-Level selbst. */
  beispiel: Level;
  /** Sätze vor dem ersten Punkt der Vorführung. */
  einleitung: string[];
};

const KLEIN: Bereich = { x0: -5, x1: 5, y0: -4, y1: 4 };
const KLEIN_Q1: Bereich = { x0: 0, x1: 6, y0: 0, y1: 4 };
const bsp = (id: string, inhalt: LevelInhalt): Level =>
  ({ id: `info-${id}`, welt: 0, titel: "Beispiel", text: "", info: [], ...inhalt });

export const INFOS: Info[] = [
  {
    id: "achsen", icon: "✚", titel: "Das Koordinatensystem",
    absaetze: [
      "Zwei Zahlenstrahlen, die sich rechtwinklig kreuzen: die x-Achse waagerecht, die y-Achse senkrecht.",
      "Wo sie sich treffen, ist der Ursprung — der Punkt (0|0). Von dort aus wird alles gezählt.",
      "Jeder Punkt hat zwei Koordinaten: P(x|y). Die erste sagt, wie weit nach rechts, die zweite, wie weit nach oben.",
    ],
    einleitung: ["Die Figur steht im Ursprung (0|0).", "Unten die x-Achse, links die y-Achse."],
    beispiel: bsp("achsen", { art: "setzen", bereich: KLEIN_Q1, ziele: [pk("P", 4, 3)] }),
  },
  {
    id: "laufen", icon: "🏃", titel: "Erst laufen, dann springen",
    absaetze: [
      "Für den Punkt P(3|2) läufst du zuerst 3 nach rechts (das ist x) und springst dann 2 hoch (das ist y).",
      "Die Reihenfolge zählt: (3|2) und (2|3) sind zwei verschiedene Punkte.",
      "Steuerung: ←/→ laufen, ↑/↓ Sprunghöhe einstellen, Leertaste springen. Auf dem Tablet gibt es Knöpfe darunter.",
    ],
    einleitung: ["Zwei Punkte mit denselben Zahlen — aber vertauscht."],
    beispiel: bsp("laufen", { art: "setzen", bereich: KLEIN_Q1, ziele: [pk("P", 3, 2), pk("Q", 2, 3)] }),
  },
  {
    id: "negativ", icon: "🌊", titel: "Negative Koordinaten",
    absaetze: [
      "Die Achsen gehen auch über den Ursprung hinaus: links und unten liegen die negativen Zahlen.",
      "Ein Minus bei x heißt nach links laufen, ein Minus bei y heißt abtauchen — unter der x-Achse ist Wasser.",
      "Die Achsen teilen die Ebene in vier Quadranten. Sie werden gegen den Uhrzeigersinn gezählt: I oben rechts, II oben links, III unten links, IV unten rechts.",
    ],
    einleitung: ["Jetzt geht es auch nach links und unter Wasser."],
    beispiel: bsp("negativ", { art: "setzen", bereich: KLEIN, ziele: [pk("P", -3, 2), pk("Q", -2, -3), pk("R", 3, -1)] }),
  },
  {
    id: "achsenpunkte", icon: "📍", titel: "Punkte auf den Achsen",
    absaetze: [
      "Ist x = 0, bleibst du stehen, wo du bist — auf der y-Achse — und springst nur.",
      "Ist y = 0, springst du gar nicht: Der Punkt liegt auf der x-Achse.",
    ],
    einleitung: ["Eine Null heißt: in dieser Richtung gar nicht bewegen."],
    beispiel: bsp("achsenpunkte", { art: "setzen", bereich: KLEIN, ziele: [pk("P", 0, 3), pk("Q", 4, 0), pk("R", 0, -2)] }),
  },
  {
    id: "achsensymmetrie", icon: "🦋", titel: "Achsensymmetrie",
    absaetze: [
      "Beim Spiegeln an einer Achse liegt der Bildpunkt auf der anderen Seite — genauso weit von der Achse entfernt wie das Original.",
      "An der y-Achse wechselt x das Vorzeichen, y bleibt: aus (−3|2) wird (3|2).",
      "An der x-Achse wechselt y das Vorzeichen, x bleibt: aus (2|3) wird (2|−3).",
      "Punkte auf der Achse bleiben, wo sie sind.",
    ],
    einleitung: ["Spiegelachse ist die y-Achse."],
    beispiel: bsp("achsensymmetrie", { art: "spiegeln", bereich: KLEIN, achse: { art: "y" }, vorlage: [pk("A", -3, 2), pk("B", -1, -2)] }),
  },
  {
    id: "punktsymmetrie", icon: "🔄", titel: "Punktsymmetrie",
    absaetze: [
      "Beim Spiegeln am Ursprung geht jeder Punkt geradewegs durch (0|0) hindurch und gleich weit auf die andere Seite.",
      "Beide Koordinaten wechseln das Vorzeichen: aus (2|1) wird (−2|−1).",
      "Das ist dasselbe wie eine halbe Drehung um den Ursprung.",
    ],
    einleitung: ["Spiegelzentrum ist der Ursprung."],
    beispiel: bsp("punktsymmetrie", { art: "spiegeln", bereich: KLEIN, achse: { art: "ursprung" }, vorlage: [pk("A", 2, 1), pk("B", -3, 3)] }),
  },
  {
    id: "steigung", icon: "⛰️", titel: "Die Steigung m",
    absaetze: [
      "Bei der Steigung läufst du nicht mehr von der x-Achse los, sondern vom letzten Punkt aus.",
      "m ist ein Bruch: m = Zähler/Nenner. Der Nenner sagt, wie weit du nach rechts läufst, der Zähler, wie weit du nach oben springst.",
      "Ist m negativ, geht es nach dem Laufen nach unten. Ganze Zahlen sind Brüche mit Nenner 1: m = 2 heißt 1 nach rechts, 2 nach oben.",
      "Laufen und Springen zusammen bilden das Steigungsdreieck.",
    ],
    einleitung: ["m = 2/3, Start bei A(−3|−2)."],
    beispiel: bsp("steigung", { art: "steigung", bereich: KLEIN, start: { x: -3, y: -2 }, m: [2, 3], schritte: 2 }),
  },
  {
    id: "gerade", icon: "📈", titel: "y = mx + n",
    absaetze: [
      "Eine lineare Funktion hat die Form y = mx + n. Ihr Graph ist eine Gerade.",
      "n ist der y-Achsenabschnitt: Dort schneidet die Gerade die y-Achse, beim Punkt (0|n). Das ist der Startpunkt.",
      "Von dort aus geht es mit der Steigung m weiter — Punkt für Punkt, immer dasselbe Dreieck.",
    ],
    einleitung: ["y = ½x − 1: also n = −1 und m = 1/2."],
    beispiel: bsp("gerade", { art: "gerade", bereich: KLEIN, n: -1, m: [1, 2], schritte: 2 }),
  },
];

export const infoNach = (id: string) => INFOS.find(i => i.id === id);
