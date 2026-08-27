/**
 * Wortnachschub für die Spiele.
 *
 * Ein Spiel darf immer nur Zeichen verlangen, die schon geübt wurden — sonst
 * sucht der Schüler unter Zeitdruck nach einer Taste, die er nie gezeigt
 * bekommen hat. Deshalb wird die Wortliste am Zeichenvorrat der Lektion
 * gefiltert (siehe `zeichenBis`).
 *
 * In den ersten Lektionen bleiben davon kaum echte Wörter übrig — mit
 * a s d f j k l ö lässt sich wenig sagen. Dann fällt der Nachschub auf
 * Silben zurück, genau wie die Übungstexte selbst es tun.
 *
 * Alles klein geschrieben: die Umschalttaste unter Zeitdruck ist eine eigene
 * Übung und gehört nicht in ein Spiel, das Tempo belohnt.
 */

/** Kleingeschrieben, ohne Tottasten, schulnah, ohne Dubletten. */
const WOERTER = [
  // Grundstellung (a s d f j k l ö) und die nächsten Tasten (g h)
  "als", "aal", "saal", "fall", "falls", "fass", "dass", "kalk",
  "hals", "hall", "gas", "glas", "gasl", "schal",
  // e i r u
  "reis", "kies", "flur", "haus", "haar", "feuer", "reise", "kreis",
  "riese", "leiter", "geld", "regal", "insel", "kaffee", "eier", "adler",
  // t z o w q
  "wort", "zeit", "tor", "stuhl", "kraut", "wolke", "quelle", "quark",
  "torte", "otter", "sturz", "wetter", "zettel", "storch", "weizen",
  "wurzel", "zitat", "westen", "osten", "tafel", "kreide", "ordner",
  // n m v b c x y
  "name", "mond", "vogel", "birne", "blume", "brief", "bank", "wolf",
  "nebel", "monat", "muster", "nummer", "boxen", "system", "zebra",
  "banane", "melone", "zitrone", "gurke", "tomate", "kanne", "besen",
  "krone", "schule", "lehrer", "klasse", "stunde", "pause", "heft",
  "buch", "stift", "mappe", "zirkel", "lineal", "fenster", "boden",
  "decke", "garten", "wiese", "wald", "berg", "fluss", "meer", "strand",
  "regen", "sonne", "wind", "sturm", "schnee", "frost", "hitze",
  "montag", "dienstag", "freitag", "sonntag", "morgen", "abend", "nacht",
  "minute", "sekunde", "woche", "jahr", "datum", "uhrzeit",
  "rechnen", "lesen", "schreiben", "denken", "lernen", "malen", "singen",
  "zahlen", "summe", "produkt", "rest", "hälfte", "drittel", "viertel",
  "quadrat", "dreieck", "würfel", "kugel", "linie", "punkt", "strecke",
  "energie", "kraft", "masse", "volumen", "dichte", "wärme", "strom",
  "atom", "molekül", "stoff", "wasser", "salz", "säure", "gemisch",
  "körper", "muskel", "knochen", "blut", "herz", "lunge", "zelle",
];

/** Wörter, die sich vollständig aus diesem Zeichenvorrat tippen lassen. */
export function woerterFuer(erlaubt: string): string[] {
  const vorrat = new Set(erlaubt);
  return WOERTER.filter(w => [...w].every(c => vorrat.has(c)));
}

/** Eine Silbe aus dem Vorrat — der Notnagel für die frühen Lektionen. */
export function silbeFuer(erlaubt: string, laenge: number, zufall: () => number): string {
  const buchstaben = [...new Set(erlaubt)].filter(c => c !== " ");
  let silbe = "";
  for (let i = 0; i < laenge; i++) {
    silbe += buchstaben[Math.floor(zufall() * buchstaben.length)];
  }
  return silbe;
}

/**
 * Unterhalb dieser Zahl echter Wörter wiederholte sich dieselbe Handvoll
 * ständig — dann sind Silben die ehrlichere Übung.
 */
const GENUG = 12;

/** Der nächste Begriff für ein Spiel: echtes Wort, sonst Silbe. */
export function nachschub(erlaubt: string, zufall: () => number): string {
  const pool = woerterFuer(erlaubt);
  if (pool.length >= GENUG) return pool[Math.floor(zufall() * pool.length)];
  return silbeFuer(erlaubt, 3 + Math.floor(zufall() * 2), zufall);
}
