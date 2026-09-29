/**
 * Lehrgang und Rätsel des Regel-Labors. Programme stehen als Text
 * (Format siehe `programm()` in maschine.ts), damit man sie im Editor
 * genauso sieht, wie sie hier stehen.
 */
import { istBaum, zaehle, zelle, zusammenhaengend, type Raster, type Start } from "./maschine";

export interface Station {
  id: string;
  titel: string;
  text: string[];
  /** Denkanstoß unter der Bühne */
  frage: string;
  programm: string;
  start: Start;
}

export const STATIONEN: Station[] = [
  {
    id: "lauf",
    titel: "1 · Eine Regel",
    text: [
      "Die Regel RB=WR heißt: Wo ein roter Punkt neben einem schwarzen steht, wird Rot zu Weiß und Schwarz zu Rot. Der rote Punkt macht also einen Schritt und hinterlässt eine weiße Spur.",
      "Die Maschine sucht alle Stellen, an denen das Muster passt — in allen vier Richtungen — und wählt eine davon zufällig aus.",
    ],
    frage: "Warum bleibt der Punkt irgendwann stehen? Starte mehrmals neu: Ist der Weg jedes Mal gleich lang?",
    programm: "eins: RB=WR",
    start: { b: 31, h: 31, grund: "B", mitte: "R" },
  },
  {
    id: "wachsen",
    titel: "2 · Einer oder alle?",
    text: [
      "WB=WW: Jedes weiße Feld färbt ein schwarzes Nachbarfeld weiß. So wächst ein Fleck.",
      "Mit »eins« passiert pro Schritt genau eine Ersetzung — der Fleck wächst ausgefranst. Stell den Block auf »alle«: Jetzt werden in jedem Schritt alle passenden Stellen gleichzeitig ersetzt.",
    ],
    frage: "Welche Form hat der Fleck bei »alle«? Wie viele Schritte braucht er bis zum Rand — und wie viele bei »eins«?",
    programm: "eins: WB=WW",
    start: { b: 31, h: 31, grund: "B", mitte: "W" },
  },
  {
    id: "backtracker",
    titel: "3 · Zwei Regeln: ein Labyrinth",
    text: [
      "RBB=GGR: Der rote Kopf springt zwei Felder weit ins Schwarze und legt eine grüne Spur.",
      "RGG=WWR: Kommt er nicht weiter, geht er auf seiner grünen Spur zurück und färbt sie weiß.",
      "»markov« heißt: Die erste Regel hat Vorrang. Nur wenn sie nirgends passt, kommt die zweite dran. Die grüne Spur ist ein Stapel — der Kopf merkt sich, wo er herkam. So entsteht ein Labyrinth, in dem es zwischen zwei Feldern genau einen Weg gibt.",
    ],
    frage: "Tausche die Reihenfolge der beiden Regeln. Was passiert, und warum?",
    programm: "markov: RBB=GGR, RGG=WWR",
    start: { b: 31, h: 31, grund: "B", mitte: "R" },
  },
  {
    id: "bloecke",
    titel: "4 · Blöcke nacheinander",
    text: [
      "Ein Programm kann aus mehreren Blöcken bestehen. Erst läuft der erste, bis nichts mehr passt, dann der zweite.",
      "Der zweite Block reißt mit WBW=WWW zwölf Wände ein. Die Zahl x12 ist eine Schrittgrenze: Ohne sie würden alle Wände fallen.",
    ],
    frage: "Das Labyrinth hat jetzt Rundwege. Ist das für ein Spiel besser oder schlechter? Wie viele Wände müssen weg, bis kaum noch ein Labyrinth übrig ist?",
    programm: "markov: RBB=GGR, RGG=WWR\neins x12: WBW=WWW",
    start: { b: 31, h: 31, grund: "B", mitte: "R" },
  },
  {
    id: "grundriss",
    titel: "5 · Zimmer, Flure, Türen",
    text: [
      "Mit größeren Mustern stempelt der erste Block acht Zimmer (blau) ins Schwarze. Danach setzt B=R einen roten Kopf, der die Flure gräbt.",
      "Zuletzt macht UBW=UYW Türen (gelb): eine Wand zwischen Zimmer und Flur wird durchbrochen.",
      "Aus solchen Regeln wächst später das Gebäude mit Stockwerken, in dessen Zimmern Rätsel warten.",
    ],
    frage: "Findest du ein Zimmer ohne Tür? Welche Regel bräuchte man, damit jedes Zimmer genau eine Tür bekommt?",
    programm: [
      "eins x8: BBBBB/BBBBB/BBBBB/BBBBB/BBBBB=BBBBB/BUUUB/BUUUB/BUUUB/BBBBB",
      "eins x1: B=R",
      "markov: RBB=GGR, RGG=WWR",
      "eins x10: UBW=UYW",
    ].join("\n"),
    start: { b: 41, h: 41, grund: "B" },
  },
];

export interface Raetsel {
  id: string;
  titel: string;
  aufgabe: string;
  start: Start;
  maxRegeln: number;
  /** Anfangsprogramm im Editor */
  vorlage: string;
  /** eine mögliche Lösung (für die Tests, nie angezeigt) */
  loesung: string;
  /** `null` = geschafft, sonst ein Hinweis, was noch nicht stimmt */
  pruefe: (r: Raster) => string | null;
}

const MITTE_W: Start = { b: 21, h: 21, grund: "B", mitte: "W" };
const MITTE_R: Start = { b: 23, h: 23, grund: "B", mitte: "R" };

/** Weiß mit dem roten Kopf zusammen, der am Ende eines Labyrinths stehen bleibt. */
function wegeMitKopf(r: Raster): Raster {
  return { ...r, z: r.z.map(c => (c === "R" ? "W" : c)) };
}

function stimmtMit(r: Raster, soll: (x: number, y: number) => string): boolean {
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.b; x++) if (zelle(r, x, y) !== soll(x, y)) return false;
  return true;
}

export const RAETSEL: Raetsel[] = [
  {
    id: "alles",
    titel: "Alles weiß",
    aufgabe: "Färbe das ganze Feld weiß — mit einer einzigen Regel.",
    start: MITTE_W, maxRegeln: 1,
    vorlage: "eins: WB=BB",
    loesung: "alle: WB=WW",
    pruefe: r => (zaehle(r, "W") === r.z.length ? null : "Es gibt noch Felder, die nicht weiß sind."),
  },
  {
    id: "punkte",
    titel: "Punktgitter",
    aufgabe: "Mach jedes zweite Feld in jeder Reihe und Spalte weiß, sodass ein Gitter aus Punkten entsteht (wie die Kreuzungen eines Labyrinths). Eine Regel.",
    start: MITTE_W, maxRegeln: 1,
    vorlage: "eins: WB=WW",
    loesung: "eins: WBB=WBW",
    pruefe: r => (stimmtMit(r, (x, y) => (x % 2 === 0 && y % 2 === 0 ? "W" : "B"))
      ? null : "Weiß soll nur dort sein, wo Zeile und Spalte gerade sind (von der Mitte aus jedes zweite Feld)."),
  },
  {
    id: "schach",
    titel: "Schachbrett",
    aufgabe: "Mach ein Schachbrett aus Weiß und Schwarz. Tipp: Eine Regel darf auch zwei Zeilen haben (mit / getrennt).",
    start: MITTE_W, maxRegeln: 1,
    vorlage: "eins: WB=WW",
    loesung: "eins: WB/BB=WB/BW",
    pruefe: r => (stimmtMit(r, (x, y) => ((x + y) % 2 === 0 ? "W" : "B"))
      ? null : "Zwei Felder, die sich an einer Kante berühren, müssen verschiedene Farben haben."),
  },
  {
    id: "labyrinth",
    titel: "Perfektes Labyrinth",
    aufgabe: "Bau ein Labyrinth ohne Rundwege, das das ganze Feld ausfüllt. Am Ende darf nur Weiß und Schwarz übrig sein (der rote Kopf darf stehen bleiben). Höchstens zwei Regeln.",
    start: MITTE_R, maxRegeln: 2,
    vorlage: "eins: RBB=WWR",
    loesung: "markov: RBB=GGR, RGG=WWR",
    pruefe: r => {
      const w = wegeMitKopf(r);
      if (zaehle(w, "W") + zaehle(w, "B") !== w.z.length) return "Es sind noch andere Farben als Weiß und Schwarz übrig.";
      if (!zusammenhaengend(w, "W")) return "Die Wege hängen nicht alle zusammen.";
      if (!istBaum(w, "W")) return "Es gibt Rundwege oder breite Stellen — zwischen zwei Feldern soll es genau einen Weg geben.";
      if (zaehle(w, "W") < 200) return "Das Labyrinth füllt das Feld noch nicht aus.";
      return null;
    },
  },
  {
    id: "rundwege",
    titel: "Labyrinth mit Rundwegen",
    aufgabe: "Bau ein zusammenhängendes Labyrinth mit mindestens 5 Rundwegen. Höchstens drei Regeln.",
    start: MITTE_R, maxRegeln: 3,
    vorlage: "markov: RBB=GGR, RGG=WWR",
    loesung: "markov: RBB=GGR, RGG=WWR\neins x8: WBW=WWW",
    pruefe: r => {
      const w = wegeMitKopf(r);
      if (!zusammenhaengend(w, "W") || zaehle(w, "W") < 200) return "Erst muss ein Labyrinth das Feld ausfüllen.";
      if (rundwege(w, "W") < 5) return `Bisher ${rundwege(w, "W")} Rundwege — es sollen mindestens 5 sein.`;
      return null;
    },
  },
];

/** Zahl unabhängiger Rundwege: Kanten − Knoten + 1 (bei zusammenhängenden Wegen). */
export function rundwege(r: Raster, f: string): number {
  let knoten = 0, kanten = 0;
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.b; x++) {
      if (zelle(r, x, y) !== f) continue;
      knoten++;
      if (x + 1 < r.b && zelle(r, x + 1, y) === f) kanten++;
      if (y + 1 < r.h && zelle(r, x, y + 1) === f) kanten++;
    }
  }
  return kanten - knoten + 1;
}
