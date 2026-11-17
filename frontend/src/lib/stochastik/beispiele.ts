/** Erfundene Beispieldaten für die Lektionen (keine echten Erhebungen). */

export interface Beispiel { id: string; titel: string; frage: string; urliste: string[]; kategorien?: string[]; zahlen?: boolean; einheit?: string }

const viele = (paare: [string, number][]) => paare.flatMap(([w, n]) => Array.from({ length: n }, () => w));
/** Feste Mischung, damit die Urliste nicht sortiert aussieht. */
function verwirbelt<T>(xs: T[]): T[] {
  const a = [...xs];
  let s = 17;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2147483648;
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const BEISPIELE: Beispiel[] = [
  {
    id: "haustier", titel: "🐾 Haustiere", frage: "Welches Haustier hast du (oder hättest du gern)?",
    kategorien: ["Hund", "Katze", "Hamster", "Fische", "keins"],
    urliste: verwirbelt(viele([["Hund", 8], ["Katze", 6], ["Hamster", 3], ["Fische", 2], ["keins", 5]])),
  },
  {
    id: "weg", titel: "🚲 Schulweg", frage: "Wie kommst du meistens zur Schule?",
    kategorien: ["zu Fuß", "Rad", "Bus", "Auto"],
    urliste: verwirbelt(viele([["zu Fuß", 7], ["Rad", 9], ["Bus", 10], ["Auto", 4]])),
  },
  {
    id: "geschwister", titel: "👫 Geschwister", frage: "Wie viele Geschwister hast du?", zahlen: true,
    urliste: verwirbelt(viele([["0", 5], ["1", 11], ["2", 6], ["3", 2], ["4", 1]])),
  },
  {
    id: "schuh", titel: "👟 Schuhgröße", frage: "Welche Schuhgröße hast du?", zahlen: true,
    urliste: verwirbelt(viele([["34", 2], ["35", 3], ["36", 5], ["37", 6], ["38", 4], ["39", 3], ["40", 2], ["42", 1]])),
  },
];

/** Zwei Klassen, Weitsprung in m – zum Vergleichen mit Kenngrößen und Boxplot. */
export const WEITSPRUNG = {
  "6a": [2.8, 3.1, 3.4, 2.9, 3.6, 3.0, 3.3, 2.7, 3.2, 3.9, 3.1, 2.6, 3.5, 3.0, 3.4],
  "6b": [2.5, 3.8, 3.0, 2.4, 4.1, 3.3, 2.9, 3.7, 2.2, 3.5, 4.0, 2.8, 3.1],
};

