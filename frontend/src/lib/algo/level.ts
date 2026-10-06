/**
 * Die Level des Code-Abenteuers — acht Welten, jede bringt genau eine neue Idee.
 *
 * Jedes Level trägt eine Musterlösung (`loesung`). Der Test spielt sie auf allen
 * Karten durch und prüft, dass `optimal` wirklich erreichbar ist — wer eine Karte
 * ändert, merkt es sofort.
 */
import type { BedingungArt, BefehlTyp, Befehl, Karte, Programm, Richtung } from "./spiel";

/** direkt = Pfeiltasten wie im Arbeitsblatt, pfeile = Programm aus Pfeilen, drehen = vor/links/rechts */
export type Modus = "direkt" | "pfeile" | "drehen";

export interface Level {
  id: string;
  welt: number;
  titel: string;
  /** Auftrag mit Themen-Platzhaltern ({held}, {aPl} …) */
  text: string;
  modus: Modus;
  bloecke: BefehlTyp[];
  bedingungen?: BedingungArt[];
  /** mehrere Karten = das Programm muss auf allen funktionieren */
  karten: Karte[];
  optimal: number;
  maxBloecke?: number;
  /** vorgegebenes Programm, das repariert werden soll */
  vorlage?: Programm;
  /** Vorhersage-Aufgabe: dieses Programm lesen und das Endfeld anklicken */
  vorhersage?: Programm;
  loesung: Programm;
  tipp?: string;
  /** Merksatz nach dem Lösen */
  merke?: string;
}

export interface Welt { nr: number; titel: string; idee: string }

export const WELTEN: Welt[] = [
  { nr: 1, titel: "Direkt steuern", idee: "Mit den Pfeiltasten und Enter — jeder Tastendruck ist ein Schritt." },
  { nr: 2, titel: "Erst planen, dann starten", idee: "Das Programm steht fest, bevor es losgeht. Wer gut plant, braucht keinen zweiten Versuch." },
  { nr: 3, titel: "Drehen statt Himmelsrichtung", idee: "Die Figur kennt nur vor, links und rechts — aus ihrer eigenen Sicht." },
  { nr: 4, titel: "Schleifen", idee: "Was sich wiederholt, schreibt man nur einmal." },
  { nr: 5, titel: "Bedingungen", idee: "Ein Programm für viele Karten: Die Figur schaut nach und entscheidet." },
  { nr: 6, titel: "Labyrinthe", idee: "Eine Regel, die jedes Labyrinth löst." },
  { nr: 7, titel: "Unterprogramme", idee: "Einem Ablauf einen Namen geben und ihn immer wieder aufrufen." },
  { nr: 8, titel: "Endgegner", idee: "Alles zusammen: Schleifen, Warten, Unterprogramme." },
];

// Kurzschreibweisen für Musterlösungen
const G = (r: Richtung): Befehl => ({ t: "geh", r });
const H = G(0), R = G(1), U = G(2), L = G(3);
const V: Befehl = { t: "vor" };
const LI: Befehl = { t: "links" };
const RE: Befehl = { t: "rechts" };
const N: Befehl = { t: "nimm" };
const W: Befehl = { t: "warte" };
const rep = (n: number, ...k: Befehl[]): Befehl => ({ t: "wiederhole", n, k });
const bis = (art: BedingungArt, ...k: Befehl[]): Befehl => ({ t: "bis", b: { art }, k });
const wenn = (art: BedingungArt, k: Befehl[], sonst?: Befehl[]): Befehl => ({ t: "wenn", b: { art }, k, ...(sonst ? { sonst } : {}) });
const RUF: Befehl = { t: "rufe" };
const P = (...haupt: Befehl[]): Programm => ({ haupt, fn: [] });

const PFEILE: BefehlTyp[] = ["geh", "nimm"];
const DREHEN: BefehlTyp[] = ["vor", "links", "rechts", "nimm"];

export const LEVEL: Level[] = [
  // ── Welt 1: Direkt steuern ──────────────────────────────────────────
  {
    id: "1-1", welt: 1, titel: "Der erste Ausflug", modus: "direkt", bloecke: PFEILE,
    text: "Steuere {held} mit den Pfeiltasten hin und drücke Enter, um {aAkk} zu {verb}.",
    karten: [{ zeilen: ["#######", "#>..#.#", "###.#.#", "#a..#.#", "#######"] }],
    optimal: 7, loesung: P(R, R, U, U, L, L, N),
    merke: "Jeder Tastendruck ist ein Einzelschritt. Zusammen ergeben sie einen Algorithmus.",
  },
  {
    id: "1-2", welt: 1, titel: "Vorsicht, {gefahr}!", modus: "direkt", bloecke: PFEILE,
    text: "Hol {bAkk} — aber Achtung: {GefahrPl} sind tabu!",
    karten: [{ zeilen: ["########", "#>.x..b#", "#.####.#", "#......#", "########"] }],
    optimal: 10, loesung: P(U, U, R, R, R, R, R, H, H, N),
  },
  {
    id: "1-3", welt: 1, titel: "Das Beste zum Schluss", modus: "direkt", bloecke: PFEILE,
    text: "Sammle beide {aPl} — und {bAkk} erst ganz am Ende!",
    karten: [{ zeilen: ["#########", "#a..>..b#", "#.#####.#", "#...a...#", "#########"], bZuletzt: true }],
    optimal: 16, loesung: P(L, L, L, N, U, U, R, R, R, N, R, R, R, H, H, N),
    merke: "Manchmal ist die Reihenfolge der Schritte wichtig — dann muss der Algorithmus sie genau festlegen.",
  },

  // ── Welt 2: Erst planen, dann starten ──────────────────────────────
  {
    id: "2-1", welt: 2, titel: "Was passiert hier?", modus: "pfeile", bloecke: PFEILE,
    text: "Lies das Programm. Wo steht {held} am Ende? Klicke auf das Feld.",
    karten: [{ zeilen: ["######", "#>#..#", "#.#.b#", "#a...#", "######"] }],
    vorhersage: P(U, U, N, R, R, R, H, N),
    optimal: 8, loesung: P(U, U, N, R, R, R, H, N),
    merke: "Ein Algorithmus ist eindeutig: Wer ihn genau befolgt, landet immer auf demselben Feld.",
  },
  {
    id: "2-2", welt: 2, titel: "Der Plan", modus: "pfeile", bloecke: PFEILE,
    text: "Baue das ganze Programm, bevor du startest. Ziel: {bAkk}.",
    karten: [{ zeilen: ["#######", "#>..#b#", "###.#.#", "#.....#", "#######"] }],
    optimal: 9, loesung: P(R, R, U, U, R, R, H, H, N),
  },
  {
    id: "2-3", welt: 2, titel: "Fehlersuche", modus: "pfeile", bloecke: PFEILE,
    text: "Dieses Programm hat einen Fehler. Finde ihn und repariere ihn!",
    karten: [{ zeilen: ["#######", "#>.a..#", "#.###.#", "#..b..#", "#######"] }],
    vorlage: P(R, R, N, R, R, U, L, L, N),
    optimal: 10, loesung: P(R, R, N, R, R, U, U, L, L, N),
    tipp: "Starte das Programm und schau genau hin, an welcher Stelle es schiefgeht.",
    merke: "Einen Fehler im Programm nennt man Bug — ihn zu finden heißt Debugging.",
  },
  {
    id: "2-4", welt: 2, titel: "Abwarten", modus: "pfeile", bloecke: [...PFEILE, "warte"],
    text: "{Gegner} läuft auf und ab. Mit »warte« bleibt {held} einen Takt stehen.",
    karten: [{
      zeilen: ["#######", "###.###", "###.###", "#>...b#", "###.###", "###.###", "#######"],
      gegner: [{ weg: [[3, 1], [3, 2], [3, 3], [3, 4], [3, 5]] }],
    }],
    optimal: 7, loesung: P(R, W, W, R, R, R, N),
    tipp: "Jeder Schritt — auch »warte« — ist ein Takt. In jedem Takt zieht {gegner} ein Feld weiter.",
  },

  // ── Welt 3: Drehen ──────────────────────────────────────────────────
  {
    id: "3-1", welt: 3, titel: "Um die Ecke", modus: "drehen", bloecke: DREHEN,
    text: "{Held} kann nur geradeaus gehen und sich drehen. Hol {aAkk}.",
    karten: [{ zeilen: ["######", "#>..##", "###.##", "###.a#", "######"] }],
    optimal: 8, loesung: P(V, V, RE, V, V, LI, V, N),
    tipp: "Links und rechts gelten aus Sicht der Figur — nicht vom Bildschirm aus.",
  },
  {
    id: "3-2", welt: 3, titel: "Kehrtwende", modus: "drehen", bloecke: DREHEN,
    text: "{Held} schaut nach oben. Hol {aAkk}.",
    karten: [{ zeilen: ["#######", "#.....#", "#.###.#", "#^###a#", "#######"] }],
    optimal: 11, loesung: P(V, V, RE, V, V, V, V, RE, V, V, N),
  },
  {
    id: "3-3", welt: 3, titel: "Wohin geht's?", modus: "drehen", bloecke: DREHEN,
    text: "Lies das Programm. Wo steht {held} am Ende? Klicke auf das Feld.",
    karten: [{ zeilen: ["######", "#>...#", "#....#", "#.a..#", "######"] }],
    vorhersage: P(V, V, RE, V, RE, V, LI, V, N),
    optimal: 9, loesung: P(V, V, RE, V, RE, V, LI, V, N),
  },
  {
    id: "3-4", welt: 3, titel: "Links oder rechts?", modus: "drehen", bloecke: DREHEN,
    text: "Hier hat jemand links und rechts verwechselt. Repariere das Programm.",
    karten: [{ zeilen: ["#######", "#v#...#", "#.#.#.#", "#...#a#", "#######"] }],
    vorlage: P(V, V, RE, V, V, LI, V, V, RE, V, V, RE, V, V, N),
    optimal: 15, loesung: P(V, V, LI, V, V, LI, V, V, RE, V, V, RE, V, V, N),
  },

  // ── Welt 4: Schleifen ───────────────────────────────────────────────
  {
    id: "4-1", welt: 4, titel: "Der lange Gang", modus: "drehen", bloecke: [...DREHEN, "wiederhole"],
    text: "Nur drei Bausteine erlaubt! »wiederhole« führt seinen Inhalt mehrmals aus.",
    karten: [{ zeilen: ["############", "#>........a#", "############"] }],
    maxBloecke: 3, optimal: 3, loesung: P(rep(9, V), N),
  },
  {
    id: "4-2", welt: 4, titel: "Die Treppe", modus: "drehen", bloecke: [...DREHEN, "wiederhole"],
    text: "Eine Treppe besteht aus lauter gleichen Stufen. Höchstens 7 Bausteine.",
    karten: [{ zeilen: ["#######", "#>.####", "##..###", "###..##", "####.a#", "#######"] }],
    maxBloecke: 7, optimal: 7, loesung: P(V, rep(3, RE, V, LI, V), N),
    tipp: "Was passiert bei jeder Stufe? Genau das kommt in die Schleife.",
  },
  {
    id: "4-3", welt: 4, titel: "Perlenkette", modus: "drehen", bloecke: [...DREHEN, "wiederhole"],
    text: "Sammle alle {aPl} mit höchstens 4 Bausteinen.",
    karten: [{ zeilen: ["###########", "#>.a.a.a.a#", "###########"] }],
    maxBloecke: 4, optimal: 4, loesung: P(rep(4, V, V, N)),
  },
  {
    id: "4-4", welt: 4, titel: "Runde um den Block", modus: "drehen", bloecke: [...DREHEN, "wiederhole"],
    text: "Drei Ecken, drei {aPl}. Geht es mit einer Schleife in der Schleife?",
    karten: [{ zeilen: ["######", "#a..a#", "#.##.#", "#.##.#", "#^..a#", "######"] }],
    maxBloecke: 6, optimal: 5, loesung: P(rep(3, rep(3, V), N, RE)),
    merke: "Schleifen kann man ineinander stecken: Die innere läuft bei jedem Durchgang der äußeren komplett.",
  },
  {
    id: "4-5", welt: 4, titel: "Schatztreppe", modus: "drehen", bloecke: [...DREHEN, "wiederhole"],
    text: "Auf jeder Stufe liegt etwas. Höchstens 6 Bausteine.",
    karten: [{ zeilen: ["########", "#>a#####", "##.a####", "###.a###", "####.a##", "########"] }],
    maxBloecke: 6, optimal: 6, loesung: P(rep(4, V, N, RE, V, LI)),
  },

  // ── Welt 5: Bedingungen ─────────────────────────────────────────────
  {
    id: "5-1", welt: 5, titel: "Wo liegt es?", modus: "drehen", bloecke: [...DREHEN, "wiederhole", "wenn"], bedingungen: ["ding"],
    text: "Drei Karten, ein Programm! Die {aPl} liegen jedes Mal woanders.",
    karten: [
      { zeilen: ["############", "#>..a..a...#", "############"] },
      { zeilen: ["############", "#>aa......a#", "############"] },
      { zeilen: ["############", "#>...a.....#", "############"] },
    ],
    maxBloecke: 5, optimal: 4, loesung: P(rep(9, V, wenn("ding", [N]))),
    tipp: "»wenn« prüft erst und handelt nur, wenn die Bedingung stimmt.",
  },
  {
    id: "5-2", welt: 5, titel: "Wie weit noch?", modus: "drehen", bloecke: [...DREHEN, "bis"], bedingungen: ["ziel"],
    text: "Der Gang ist jedes Mal anders lang. Lauf bis zu {ziel}.",
    karten: [
      { zeilen: ["######", "#>..Z#", "######"] },
      { zeilen: ["##########", "#>......Z#", "##########"] },
      { zeilen: ["########", "#>....Z#", "########"] },
    ],
    maxBloecke: 2, optimal: 2, loesung: P(bis("ziel", V)),
    merke: "»wiederhole bis« zählt nicht — es schaut vor jedem Durchgang nach, ob es schon fertig ist.",
  },
  {
    id: "5-3", welt: 5, titel: "Immer links herum", modus: "drehen", bloecke: [...DREHEN, "bis", "wenn"], bedingungen: ["frei", "ziel"],
    text: "Wo der Weg endet, geht es links weiter. Ein Programm für alle drei Karten.",
    karten: [
      { zeilen: ["#######", "#Z...##", "####.##", "#>...##", "#######"] },
      { zeilen: ["########", "##Z...##", "#####.##", "#####.##", "#>....##", "########"] },
      { zeilen: ["########", "#>....Z#", "########"] },
    ],
    optimal: 4, loesung: P(bis("ziel", wenn("frei", [V], [LI]))),
  },
  {
    id: "5-4", welt: 5, titel: "Mal links, mal rechts", modus: "drehen", bloecke: [...DREHEN, "bis", "wenn"], bedingungen: ["frei", "frei_links", "ziel"],
    text: "Jetzt biegt der Weg in beide Richtungen ab. »wenn … sonst« kann man auch ineinander stecken.",
    karten: [
      { zeilen: ["#######", "#>..###", "###.###", "###...#", "#####Z#", "#######"] },
      { zeilen: ["#######", "#####Z#", "###...#", "###.###", "#>..###", "#######"] },
      { zeilen: ["#######", "#Z...##", "####.##", "#>...##", "#######"] },
    ],
    optimal: 6, loesung: P(bis("ziel", wenn("frei", [V], [wenn("frei_links", [LI], [RE])]))),
  },

  // ── Welt 6: Labyrinthe ──────────────────────────────────────────────
  {
    id: "6-1", welt: 6, titel: "Die Rechte-Hand-Regel", modus: "drehen", bloecke: [...DREHEN, "bis", "wenn"], bedingungen: ["frei", "frei_links", "frei_rechts", "ziel"],
    text: "Drei Labyrinthe, ein Programm. Wer immer die rechte Hand an der Wand lässt, kommt hinaus.",
    karten: [
      { zeilen: ["#########", "#>..#...#", "#.#.#.#.#", "#.#...#.#", "#.#####.#", "#.....#Z#", "#########"] },
      { zeilen: ["#########", "#.....#Z#", "#.###.#.#", "#...#...#", "###.###.#", "#^..#...#", "#########"] },
      { zeilen: ["#######", "#>#...#", "#.#.#.#", "#...#Z#", "#######"] },
    ],
    optimal: 7, loesung: P(bis("ziel", wenn("frei_rechts", [RE, V], [wenn("frei", [V], [LI])]))),
    tipp: "Ist rechts frei? Dann rechts herum. Sonst: Ist vorne frei? Dann vor. Sonst: links drehen.",
    merke: "Dieser Algorithmus funktioniert für jedes Labyrinth ohne Rundwege — er ist allgemein gültig.",
  },

  // ── Welt 7: Unterprogramme ──────────────────────────────────────────
  {
    id: "7-1", welt: 7, titel: "Drei Nischen", modus: "drehen", bloecke: [...DREHEN, "wiederhole", "rufe"],
    text: "In den Nischen liegen {aPl}. Schreib das Holen einmal ins Unterprogramm und ruf es dreimal auf.",
    karten: [{ zeilen: ["##########", "##a#a###a#", "#>.......#", "##########"] }],
    optimal: 15,
    loesung: { haupt: [V, RUF, rep(2, V), RUF, rep(4, V), RUF], fn: [LI, V, N, RE, RE, V, LI] },
    merke: "Ein Unterprogramm ist ein Algorithmus im Algorithmus. Man schreibt ihn einmal und benutzt ihn oft.",
  },

  // ── Welt 8: Endgegner ───────────────────────────────────────────────
  {
    id: "8-1", welt: 8, titel: "Die Wächter", modus: "drehen", bloecke: [...DREHEN, "warte", "wiederhole", "rufe"],
    text: "Zwei {gegnerPl} bewachen den Gang. Sammle {aAkk} und danach {bAkk}.",
    karten: [{
      zeilen: ["###########", "###.###.###", "###.###.###", "#>...a...b#", "###.###.###", "###.#######", "###########"],
      gegner: [
        { weg: [[3, 1], [3, 2], [3, 3], [3, 4], [3, 5]] },
        { weg: [[7, 1], [7, 2], [7, 3], [7, 4]] },
      ],
      bZuletzt: true,
    }],
    optimal: 11,
    loesung: { haupt: [V, rep(2, W), RUF, V, rep(3, W), RUF], fn: [rep(3, V), N] },
    tipp: "Zähle die Takte: Wann ist der Gang vor dir frei — und bleibt es einen Schritt lang?",
  },
];

export const levelById = (id: string) => LEVEL.find(l => l.id === id);
