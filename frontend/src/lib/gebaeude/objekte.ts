/**
 * Was in einem Zimmer steht. Das Gebäude zeichnet es, der Inhalt (Exitgame,
 * Demo, später Verkehr/Rock your Life) sucht es aus.
 */
export const OBJEKTE = [
  "pult", "computer", "kuckucksuhr", "globus", "regal", "mikroskop",
  "tafel", "laborbank", "tresor", "teleskop", "kalender", "waage", "abakus",
  "monster", "boss",
  // Medien durch die Zeit
  "hoehlenwand", "tontafel", "schriftrolle", "buch", "druckerpresse", "zeitung",
  "telegraph", "telefon", "radio", "filmprojektor", "fernseher", "grossrechner",
  "laptop", "smartphone", "tablet", "kopfhoerer", "grafiktablett", "kikern",
] as const;

export type Objekt = (typeof OBJEKTE)[number];

export const OBJEKT_NAME: Record<Objekt, string> = {
  pult: "Schreibtisch", computer: "Computer", kuckucksuhr: "Kuckucksuhr", globus: "Globus",
  regal: "Bücherregal", mikroskop: "Mikroskop", tafel: "Tafel", laborbank: "Labortisch",
  tresor: "Tresor", teleskop: "Teleskop", kalender: "Wandkalender", waage: "Waage", abakus: "Abakus",
  monster: "Monster", boss: "Bossmonster",
  hoehlenwand: "Höhlenmalerei", tontafel: "Tontafel mit Keilschrift", schriftrolle: "Schriftrollen",
  buch: "Handschrift am Lesepult", druckerpresse: "Druckerpresse", zeitung: "Zeitungsständer",
  telegraph: "Telegraf", telefon: "Kurbeltelefon", radio: "Röhrenradio", filmprojektor: "Filmprojektor",
  fernseher: "Röhrenfernseher", grossrechner: "Großrechner", laptop: "Laptop", smartphone: "Smartphone",
  tablet: "Tablet", kopfhoerer: "Kopfhörer", grafiktablett: "Bildbearbeitung", kikern: "KI-Rechenzentrum",
};

export function istObjekt(x: unknown): x is Objekt {
  return typeof x === "string" && (OBJEKTE as readonly string[]).includes(x);
}

/**
 * Wie ein Objekt zu Wort kommt, wenn man davor steht: Das Telefon klingelt,
 * das Radio sendet, die Tontafel trägt die Nachricht. Erst Info, dann Aufgabe.
 */
export const OBJEKT_STIMME: Record<Objekt, { icon: string; info: string; aufgabe: string }> = {
  pult: { icon: "📝", info: "Auf dem Schreibtisch liegt ein Zettel", aufgabe: "Auf dem Schreibtisch liegt eine Aufgabe" },
  computer: { icon: "🖥️", info: "Der Bildschirm zeigt", aufgabe: "Der Computer stellt dir eine Aufgabe" },
  kuckucksuhr: { icon: "🕰️", info: "Die Kuckucksuhr schlägt – und erzählt", aufgabe: "Kuckuck! Die Uhr will etwas wissen" },
  globus: { icon: "🌍", info: "Der Globus dreht sich zu einem fernen Land", aufgabe: "Der Globus hält an – eine Frage aus aller Welt" },
  regal: { icon: "📚", info: "Ein Buch fällt aus dem Regal", aufgabe: "Zwischen den Büchern steckt eine Aufgabe" },
  mikroskop: { icon: "🔬", info: "Unter dem Mikroskop siehst du", aufgabe: "Unter dem Mikroskop wartet eine Aufgabe" },
  tafel: { icon: "✍️", info: "An der Tafel steht", aufgabe: "An der Tafel steht eine Aufgabe" },
  laborbank: { icon: "⚗️", info: "Im Labor liegt ein Protokoll", aufgabe: "Das Experiment braucht deine Antwort" },
  tresor: { icon: "🔐", info: "Im Tresor liegt eine Notiz", aufgabe: "Der Tresor öffnet sich nur mit der richtigen Antwort" },
  teleskop: { icon: "🔭", info: "Durch das Teleskop siehst du", aufgabe: "Das Teleskop zeigt eine Aufgabe" },
  kalender: { icon: "📅", info: "Im Kalender ist markiert", aufgabe: "Der Kalender will geordnet werden" },
  waage: { icon: "⚖️", info: "Die Waage schwankt", aufgabe: "Die Waage will ins Gleichgewicht" },
  abakus: { icon: "🧮", info: "Die Perlen des Abakus zeigen", aufgabe: "Der Abakus stellt dir eine Rechnung" },
  monster: { icon: "👾", info: "Ein Monster knurrt", aufgabe: "Ein Monster stellt dir eine Aufgabe" },
  boss: { icon: "👹", info: "Das Bossmonster brüllt", aufgabe: "Ein Bossmonster stellt dir eine Aufgabe" },
  hoehlenwand: { icon: "🦬", info: "Im Fackelschein erkennst du Bilder an der Felswand", aufgabe: "Die Höhlenbilder stellen dir ein Rätsel" },
  tontafel: { icon: "🪨", info: "In die Tontafel ist geritzt", aufgabe: "Die Tontafel verlangt eine Antwort" },
  schriftrolle: { icon: "📜", info: "Du rollst den Papyrus auf", aufgabe: "Auf der Schriftrolle steht eine Frage" },
  buch: { icon: "📖", info: "Die Handschrift auf dem Lesepult ist aufgeschlagen", aufgabe: "Ein Mönch hat dir eine Frage an den Rand geschrieben" },
  druckerpresse: { icon: "🖨️", info: "Frisch aus der Druckerpresse", aufgabe: "Die Presse druckt eine Frage" },
  zeitung: { icon: "📰", info: "Extrablatt!", aufgabe: "Das Zeitungsrätsel des Tages" },
  telegraph: { icon: "📠", info: "Der Telegraf tickert eine Nachricht", aufgabe: "Ein Telegramm – es verlangt Antwort" },
  telefon: { icon: "☎️", info: "Das Telefon klingelt. Du nimmst ab und hörst", aufgabe: "Das Telefon klingelt – am anderen Ende wartet eine Frage" },
  radio: { icon: "📻", info: "Aus dem Radio tönt es", aufgabe: "Das Radio veranstaltet ein Quiz" },
  filmprojektor: { icon: "🎞️", info: "Der Projektor surrt, auf der Leinwand erscheint", aufgabe: "Der Film hält an – mit einer Frage" },
  fernseher: { icon: "📺", info: "Im Fernsehen läuft gerade", aufgabe: "Die Quizsendung ruft dich auf" },
  grossrechner: { icon: "🗄️", info: "Der Großrechner druckt eine Lochkarte aus", aufgabe: "Der Großrechner erwartet eine Eingabe" },
  laptop: { icon: "💻", info: "Auf dem Laptop ist eine Seite geöffnet", aufgabe: "Auf dem Laptop blinkt eine Aufgabe" },
  smartphone: { icon: "📱", info: "Dein Handy vibriert – eine Nachricht", aufgabe: "Eine Push-Nachricht mit einer Frage" },
  tablet: { icon: "📲", info: "Auf dem Tablet läuft ein Video", aufgabe: "Das Tablet zeigt ein Quiz" },
  kopfhoerer: { icon: "🎧", info: "Du setzt die Kopfhörer auf und hörst", aufgabe: "Im Kopfhörer stellt jemand eine Frage" },
  grafiktablett: { icon: "🎨", info: "Auf dem Bildschirm ist ein Bild geöffnet", aufgabe: "Das Bild stellt dir eine Aufgabe" },
  kikern: { icon: "🤖", info: "Die KI meldet sich", aufgabe: "Die KI will dich prüfen" },
};
