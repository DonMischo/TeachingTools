/**
 * Der Übungstext für Markieren und Kopieren — und der Vergleich, ob das
 * Markierte bzw. Eingefügte passt.
 *
 * Verglichen wird nachsichtig: Satzzeichen am Rand zählen nicht, Leerraum gar
 * nicht. Ein Doppelklick nimmt unter Windows das Leerzeichen hinter dem Wort
 * mit, ein Dreifachklick den Zeilenumbruch, und ob beim Ziehen der Punkt am
 * Satzende noch mit drin ist, soll kein Kind eine Aufgabe kosten. Leerraum
 * fällt ganz heraus, weil `Range.toString()` Absätze ohne Trenner aneinander-
 * hängt — »… ankommt.Die Erde …« — und die Auswahl sonst nie passen könnte.
 */

export const TEXT_TITEL = "Das Leben, das Universum und der ganze Rest";

export const ABSAETZE: string[] = [
  "Das Universum ist unvorstellbar groß. Es besteht aus Milliarden Galaxien, und jede Galaxie besteht aus Milliarden Sternen. Einer dieser Sterne ist unsere Sonne. Ihr Licht braucht ungefähr acht Minuten, bis es bei uns auf der Erde ankommt.",
  "Die Erde ist bisher der einzige Planet, auf dem wir Leben kennen. Hier gibt es Wasser, Luft zum Atmen und genau die richtige Wärme. Im Ozean schwimmen Wale, im Wald wachsen Pilze, und auf der Wiese summen Bienen von Blüte zu Blüte.",
  "Alles Leben ist aus winzigen Bausteinen gebaut, den Zellen. Ein Mensch besteht aus vielen Billionen davon. Trotzdem ist jeder Mensch anders: Niemand hat genau deine Stimme, dein Lachen oder deine Ideen.",
  "Und was ist mit dem ganzen Rest? Manche Fragen kann noch niemand beantworten. Gibt es irgendwo anders Leben? Wie groß ist das Universum wirklich? In einem berühmten Buch lautet die Antwort auf alle Fragen einfach: 42. Ob das stimmt, darfst du selbst herausfinden.",
];

export type Art = "wort" | "absatz" | "alles" | "satz";
export type Aufgabe = { art: Art; ziel: string; absatz: number };

export const GANZER_TEXT = ABSAETZE.join("\n\n");

export const MARKIER_AUFGABEN: Aufgabe[] = [
  { art: "wort", ziel: "Sonne", absatz: 0 },
  { art: "wort", ziel: "Bienen", absatz: 1 },
  { art: "wort", ziel: "Zellen", absatz: 2 },
  { art: "absatz", ziel: ABSAETZE[1], absatz: 1 },
  { art: "absatz", ziel: ABSAETZE[3], absatz: 3 },
  { art: "alles", ziel: GANZER_TEXT, absatz: 0 },
];

export const KOPIER_AUFGABEN: Aufgabe[] = [
  { art: "wort", ziel: "Universum", absatz: 0 },
  { art: "wort", ziel: "Galaxien", absatz: 0 },
  { art: "satz", ziel: "Einer dieser Sterne ist unsere Sonne.", absatz: 0 },
  { art: "satz", ziel: "Niemand hat genau deine Stimme, dein Lachen oder deine Ideen.", absatz: 2 },
  { art: "absatz", ziel: ABSAETZE[2], absatz: 2 },
];

export const PUNKTE_MARKIEREN = 250;
export const PUNKTE_KOPIEREN = 300;

const RAND = /^[\s.,:;!?»«"'()–-]+|[\s.,:;!?»«"'()–-]+$/g;

export function normalisiere(s: string): string {
  return s.replace(RAND, "").replace(/\s+/g, "");
}

export function passt(auswahl: string, ziel: string): boolean {
  const a = normalisiere(auswahl);
  return a.length > 0 && a === normalisiere(ziel);
}
