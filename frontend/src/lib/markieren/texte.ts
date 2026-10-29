/**
 * Übungstexte fürs Markieren und Bearbeiten: kurze Zeilen, damit nichts
 * umbricht — sonst wären »Zeile 3«, Pos1/Ende und der Dreifachklick
 * mehrdeutig (Pos1 springt an den Anfang der *sichtbaren* Zeile).
 *
 * `ersatz` und `teile` sind von Hand gewählt, damit die Aufgaben einen Sinn
 * ergeben: »Ersetze Milch durch Kakao«, »Markiere nur Zahn aus Zahnbürste«.
 */

export type Uebungstext = {
  titel: string;
  zeilen: string[];
  /** [Wort im Text, Ersatz] fürs Überschreiben. */
  ersatz: [string, string][];
  /** [zusammengesetztes Wort, vorderer Teil] fürs zeichenweise Markieren. */
  teile: [string, string][];
};

export const TEXTE: Uebungstext[] = [
  {
    titel: "Einkaufszettel",
    zeilen: [
      "Einkaufszettel für Samstag",
      "Zwei Liter Milch und sechs Eier",
      "Ein frisches Brot vom Bäcker",
      "Bananen, Äpfel und Kirschen",
      "Käse für die Pizza am Abend",
      "Nicht vergessen: Futter für Bello",
    ],
    ersatz: [["Milch", "Kakao"], ["Brot", "Brötchen"], ["Kirschen", "Erdbeeren"], ["Pizza", "Lasagne"], ["Bello", "Minka"]],
    teile: [["Einkaufszettel", "Einkauf"], ["Samstag", "Sams"], ["Kirschen", "Kirsch"]],
  },
  {
    titel: "Packliste",
    zeilen: [
      "Packliste für die Klassenfahrt",
      "Schlafsack und Kopfkissen",
      "Zahnbürste, Zahnpasta und Handtuch",
      "Regenjacke und feste Schuhe",
      "Taschenlampe mit neuen Batterien",
      "Ein Kartenspiel für den Abend",
    ],
    ersatz: [["Kopfkissen", "Kuscheltier"], ["Handtuch", "Duschgel"], ["Schuhe", "Stiefel"], ["Kartenspiel", "Buch"]],
    teile: [["Schlafsack", "Schlaf"], ["Zahnbürste", "Zahn"], ["Regenjacke", "Regen"], ["Taschenlampe", "Taschen"], ["Kopfkissen", "Kopf"]],
  },
  {
    titel: "Steckbrief Igel",
    zeilen: [
      "Steckbrief: Der Igel",
      "Größe: etwa dreißig Zentimeter",
      "Nahrung: Käfer, Würmer und Schnecken",
      "Besonderheit: rund achttausend Stacheln",
      "Im Winter hält er einen langen Winterschlaf",
      "Er ist vor allem nachts unterwegs",
    ],
    ersatz: [["Igel", "Maulwurf"], ["Schnecken", "Spinnen"], ["Stacheln", "Borsten"], ["Winter", "Herbst"]],
    teile: [["Winterschlaf", "Winter"], ["Steckbrief", "Steck"], ["achttausend", "acht"], ["Besonderheit", "Besonder"]],
  },
  {
    titel: "Wetterbericht",
    zeilen: [
      "Das Wetter für morgen",
      "Am Vormittag scheint die Sonne",
      "Mittags ziehen dicke Wolken auf",
      "Am Nachmittag regnet es kräftig",
      "Abends wird es windig und kühl",
      "Die Temperaturen liegen bei zwölf Grad",
    ],
    ersatz: [["Sonne", "Sonnenschein"], ["Wolken", "Gewitter"], ["windig", "neblig"], ["zwölf", "fünfzehn"]],
    teile: [["Vormittag", "Vor"], ["Nachmittag", "Nach"], ["Temperaturen", "Temperatur"]],
  },
  {
    titel: "Pfannkuchen",
    zeilen: [
      "Rezept für Pfannkuchen",
      "Mehl, Milch und Eier verrühren",
      "Eine Prise Salz dazugeben",
      "Den Teig zehn Minuten ruhen lassen",
      "Etwas Butter in der Pfanne erhitzen",
      "Die Pfannkuchen goldbraun backen",
    ],
    ersatz: [["Salz", "Zucker"], ["Butter", "Öl"], ["zehn", "fünf"], ["goldbraun", "knusprig"]],
    teile: [["Pfanne", "Pfann"], ["goldbraun", "gold"], ["dazugeben", "dazu"]],
  },
  {
    titel: "Stundenplan",
    zeilen: [
      "Stundenplan für Montag",
      "Erste Stunde: Mathematik",
      "Zweite Stunde: Deutsch",
      "Dritte Stunde: Sport in der Halle",
      "Vierte Stunde: Englisch",
      "Fünfte Stunde: Kunst mit Wasserfarben",
    ],
    ersatz: [["Mathematik", "Musik"], ["Deutsch", "Biologie"], ["Halle", "Schwimmhalle"], ["Montag", "Dienstag"]],
    teile: [["Stundenplan", "Stunden"], ["Wasserfarben", "Wasser"], ["Mathematik", "Mathe"]],
  },
];

/** Wörter, die sich in einen Text »einschleichen« — zum Löschen. */
export const EINDRINGLINGE = ["Quatsch", "Kuckuck", "Hoppla", "Blubb", "Wackelpudding", "Schnickschnack"];

/** Zeilen, die nicht in den Text gehören. */
export const FALSCHE_ZEILEN = [
  "Diese Zeile gehört nicht hierher",
  "Hier hat sich ein Fehler versteckt",
  "Lösch mich, wenn du mich findest",
  "Bla bla bla und noch mal bla",
];
