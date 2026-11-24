/**
 * Training »Schreiben«: Großbuchstaben, Umlaute, Satzzeichen, Sonderzeichen
 * bis zu den Alt-Gr-Zeichen — und zum Schluss Rechtschreibung (ein Satz mit
 * Fehlern steht schon im Feld und wird verbessert).
 *
 * Rein rechnend: Lektionen, Prüfen und »welche Tasten brauche ich für das
 * nächste Zeichen?«. Die Bildschirmtastatur kommt aus dem 10-Finger-Trainer.
 */
import { zeichenZuTaste, umschaltFuer } from "@/lib/tippen/layout";

export type SchreibLektion = {
  id: string;
  icon: string;
  titel: string;
  /** Erklärung mit [[Tasten]]. */
  schritte: string[];
  /** Zu tippende Sätze. */
  saetze: string[];
  /** Rechtschreibung: so steht der Satz zu Beginn im Feld (gleiche Reihenfolge wie `saetze`). */
  vorgaben?: string[];
};

export const SCHREIB_LEKTIONEN: SchreibLektion[] = [
  {
    id: "gross", icon: "🔠", titel: "Großbuchstaben",
    schritte: [
      "[[Umschalt]] gedrückt halten und den Buchstaben tippen: A, B, C …",
      "Profi-Griff: [[Umschalt]] mit der anderen Hand drücken als den Buchstaben.",
      "[[Feststelltaste]] schreibt alles groß — für ein ganzes Wort in Großbuchstaben. Danach wieder ausschalten!",
    ],
    saetze: ["Anna wohnt in Erfurt.", "Der Hund heißt Bello.", "Am Montag schreiben wir einen Test.", "Die UNO hat ihren Sitz in New York."],
  },
  {
    id: "umlaute", icon: "🇩🇪", titel: "Umlaute und ß",
    schritte: [
      "ä, ö, ü haben eigene Tasten rechts neben L und P.",
      "Groß: [[Umschalt]] + ä ergibt Ä.",
      "ß liegt neben der 0. Ein großes ß gibt es auf der Tastatur nicht — man schreibt SS.",
    ],
    saetze: ["Die Bäume blühen schön.", "Über die Brücke fährt ein Bus.", "Ich muss den Fuß schonen.", "Öl ist ärgerlich teuer."],
  },
  {
    id: "satzzeichen", icon: "❓", titel: "Satzzeichen",
    schritte: [
      "Punkt, Komma und Bindestrich haben eigene Tasten unten rechts.",
      "Mit [[Umschalt]]: aus , wird ; — aus . wird : — aus - wird _",
      "Fragezeichen: [[Umschalt]] + ß. Ausrufezeichen: [[Umschalt]] + 1.",
      "Nach einem Satzzeichen kommt ein Leerzeichen, davor keins.",
    ],
    saetze: ["Kommst du morgen?", "Halt! Stopp!", "Wir brauchen: Mehl, Eier und Milch.", "Das ist gut; das andere nicht.", "Das Fußball-Spiel war super."],
  },
  {
    id: "zahlenreihe", icon: "🔢", titel: "Zeichen der Zahlenreihe",
    schritte: [
      "Über den Ziffern stehen Zeichen, die man mit [[Umschalt]] bekommt:",
      "! \" § $ % & / ( ) = liegen auf 1 bis 0.",
      "Anführungszeichen: [[Umschalt]] + 2. Schrägstrich: [[Umschalt]] + 7.",
    ],
    saetze: ["Rabatt: 20 %", "Klasse 7/8 & 9", "Er rief: \"Hallo!\"", "§ 3 der Hausordnung", "(4 + 5) = 9", "Das kostet 3 $."],
  },
  {
    id: "altgr", icon: "@", titel: "Alt-Gr-Zeichen",
    schritte: [
      "Manche Tasten haben ein drittes Zeichen unten rechts. Das gibt es mit [[AltGr]] (rechts neben der Leertaste).",
      "@ = [[AltGr]] + [[Q]] — € = [[AltGr]] + [[E]] — µ = [[AltGr]] + [[M]]",
      "² und ³ = [[AltGr]] + [[2]] / [[3]] — { [ ] } = [[AltGr]] + [[7]] bis [[0]]",
      "\\ = [[AltGr]] + [[ß]] — ~ = [[AltGr]] + [[+]] — | = [[AltGr]] + [[<]]",
      "Statt [[AltGr]] geht auch [[Strg]] + [[Alt]] zusammen.",
    ],
    saetze: ["mia@schule.de", "Das Heft kostet 2 €.", "Fläche: 12 m²", "Volumen: 8 m³", "[eckig] und {geschweift}", "C:\\Schule\\Deutsch", "ja | nein", "~ 5 km"],
  },
  {
    id: "sonder", icon: "#", titel: "Weitere Sonderzeichen",
    schritte: [
      "# und ' teilen sich eine Taste neben dem Ä. + * liegen neben dem Ü, < > neben dem Y.",
      "Grad: [[Umschalt]] + ^ ergibt °.",
      "Tottasten: ^ ´ ` erscheinen erst, wenn danach noch eine Taste kommt — für das Zeichen allein danach die [[Leertaste]] drücken.",
    ],
    saetze: ["Es ist 21 °C warm.", "#Klassenfahrt", "3 * 4 = 12", "2 < 5 > 1", "datei_neu.txt", "Ich hab's geschafft.", "2^3 = 8"],
  },
  {
    id: "rechtschreibung", icon: "📝", titel: "Rechtschreibung",
    schritte: [
      "Im Feld steht schon ein Satz — mit Fehlern. Verbessere ihn.",
      "Satzanfang und Nomen (Namen von Dingen, Orten, Personen) schreibt man groß.",
      "»dass« mit ss verbindet zwei Sätze; davor steht ein Komma.",
      "Markieren hilft: Wort doppelklicken und richtig drübertippen.",
    ],
    vorgaben: [
      "am montag gehen wir ins kino.",
      "ich weis das nicht.",
      "das auto ist sehr schnel.",
      "Er sagt das er morgen kommt.",
      "Wir fahren nach muenchen.",
      "die Schüler lernen Fuer den test.",
    ],
    saetze: [
      "Am Montag gehen wir ins Kino.",
      "Ich weiß das nicht.",
      "Das Auto ist sehr schnell.",
      "Er sagt, dass er morgen kommt.",
      "Wir fahren nach München.",
      "Die Schüler lernen für den Test.",
    ],
  },
];

/** Alt-Gr-Zeichen der deutschen Tastatur → physische Taste. */
export const ALTGR: Record<string, string> = {
  "@": "KeyQ", "€": "KeyE", "µ": "KeyM", "²": "Digit2", "³": "Digit3",
  "{": "Digit7", "[": "Digit8", "]": "Digit9", "}": "Digit0",
  "\\": "Minus", "~": "BracketRight", "|": "IntlBackslash",
};

/** Kappen-Beschriftung zu einem Code, für den Hinweis in Worten. */
const KAPPE: Record<string, string> = {
  KeyQ: "Q", KeyE: "E", KeyM: "M", Digit2: "2", Digit3: "3", Digit7: "7", Digit8: "8", Digit9: "9", Digit0: "0",
  Minus: "ß", BracketRight: "+", IntlBackslash: "<",
};

export type Hilfe = { codes: string[]; text: string };

/** Welche Tasten braucht das Zeichen? Für Ring auf der Bildschirmtastatur und den Hinweis in Worten. */
export function tastenFuer(zeichen: string | undefined): Hilfe | null {
  if (zeichen === undefined) return null;
  if (ALTGR[zeichen]) return { codes: ["AltRight", ALTGR[zeichen]], text: `[[AltGr]] + [[${KAPPE[ALTGR[zeichen]]}]]` };
  if (zeichen === " ") return { codes: ["Space"], text: "[[Leertaste]]" };
  // Tasten links oben und neben dem ß: ° ist ein normales Zeichen, ^ ´ ` sind Tottasten
  if (zeichen === "°") return { codes: ["ShiftRight", "Backquote"], text: "[[Umschalt]] + [[^]]" };
  if (zeichen === "^") return { codes: ["Backquote", "Space"], text: "[[^]], dann [[Leertaste]]" };
  if (zeichen === "´") return { codes: ["Equal", "Space"], text: "[[´]], dann [[Leertaste]]" };
  if (zeichen === "`") return { codes: ["ShiftLeft", "Equal", "Space"], text: "[[Umschalt]] + [[´]], dann [[Leertaste]]" };
  const a = zeichenZuTaste(zeichen);
  if (!a) return null;
  if (a.shift) return { codes: [umschaltFuer(a.finger), a.code], text: `[[Umschalt]] + ${zeichen}` };
  return { codes: [a.code], text: zeichen };
}

/** Bis wohin stimmt das Getippte? (Index des ersten falschen Zeichens bzw. Länge) */
export function richtigBis(ist: string, soll: string): number {
  let i = 0;
  while (i < ist.length && i < soll.length && ist[i] === soll[i]) i++;
  return i;
}

/** Gelöst, wenn der Text genau stimmt — Leerzeichen am Rand zählen nicht. */
export function stimmt(ist: string, soll: string): boolean {
  return ist.replace(/\r/g, "").trim() === soll;
}
