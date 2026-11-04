/**
 * Daten und Logik der interaktiven Teile im KI-Führerschein. Alles läuft im
 * Browser, ohne echte KI. Alle Personen und Namen sind erfunden.
 */

// ───────────────────────────────────────────── Sortieren ──

export type SortKorb = { id: string; titel: string; farbe?: string };
export type SortKarte = { id: string; text: string; ziel: string; warum: string };
export type SortSpiel = {
  id: string;
  titel: string;
  anleitung: string;
  koerbe: SortKorb[];
  karten: SortKarte[];
  /** Offen: Es gibt kein Richtig/Falsch, nur einen begründeten Vorschlag. */
  offen?: boolean;
};

export const SORTIERSPIELE: Record<string, SortSpiel> = {
  "ki-alltag": {
    id: "ki-alltag", titel: "Mit oder ohne KI?",
    anleitung: "Tippe eine Karte an und dann den Korb, in den sie gehört.",
    koerbe: [{ id: "ki", titel: "🤖 mit KI", farbe: "#2e9e44" }, { id: "ohne", titel: "⚙️ ohne KI", farbe: "#888888" }],
    karten: [
      { id: "1", text: "Taschenrechner", ziel: "ohne", warum: "Rechnet nach festen Regeln, lernt nichts aus Beispielen." },
      { id: "2", text: "Sprachassistent, der Fragen versteht", ziel: "ki", warum: "Spracherkennung wurde mit sehr vielen Sprachaufnahmen trainiert." },
      { id: "3", text: "Videovorschläge auf einer Videoplattform", ziel: "ki", warum: "Ein Empfehlungssystem lernt aus deinem Verhalten und dem vieler anderer." },
      { id: "4", text: "Küchenwaage", ziel: "ohne", warum: "Misst nur ein Gewicht." },
      { id: "5", text: "Übersetzer-App für ganze Sätze", ziel: "ki", warum: "Mit Millionen übersetzter Sätze trainiert." },
      { id: "6", text: "Ampel mit fester Schaltzeit", ziel: "ohne", warum: "Folgt einem festen Zeitplan." },
      { id: "7", text: "Handy mit dem Gesicht entsperren", ziel: "ki", warum: "Gesichtserkennung ist ein trainiertes Modell." },
      { id: "8", text: "Spamfilter im E-Mail-Postfach", ziel: "ki", warum: "Lernt aus vielen als Spam markierten Mails." },
      { id: "9", text: "Wecker", ziel: "ohne", warum: "Klingelt zur eingestellten Zeit, mehr nicht." },
      { id: "10", text: "Kopierer", ziel: "ohne", warum: "Kopiert, was auf dem Glas liegt." },
    ],
  },
  fachwoerter: {
    id: "fachwoerter", titel: "Welches Fachwort passt?",
    anleitung: "Tippe eine Erklärung an und dann das passende Fachwort.",
    koerbe: [
      { id: "daten", titel: "Daten" }, { id: "algorithmus", titel: "Algorithmus" }, { id: "training", titel: "Training" },
      { id: "modell", titel: "Modell" }, { id: "prompt", titel: "Prompt" }, { id: "bias", titel: "Bias" },
      { id: "halluzination", titel: "Halluzination" },
    ],
    karten: [
      { id: "1", text: "Gesammelte Beispiele, z. B. Fotos mit der Beschriftung »Katze«", ziel: "daten", warum: "Daten sind das Futter, aus dem eine KI lernt." },
      { id: "2", text: "Eine genaue Schritt-für-Schritt-Anleitung", ziel: "algorithmus", warum: "Computer brauchen eindeutige Anleitungen." },
      { id: "3", text: "Die KI sucht in vielen Beispielen nach Mustern", ziel: "training", warum: "Beim Training werden aus Beispielen Zahlen im Modell eingestellt." },
      { id: "4", text: "Das Ergebnis des Trainings, das danach Antworten berechnet", ziel: "modell", warum: "Ein Modell ist das »gelernte« Wissen als Zahlen." },
      { id: "5", text: "Dein Auftrag oder deine Frage an die KI", ziel: "prompt", warum: "Je klarer der Prompt, desto passender die Antwort." },
      { id: "6", text: "Eine Schieflage, die manche Gruppen benachteiligt", ziel: "bias", warum: "Oft steckt sie schon in einseitigen Trainingsdaten." },
      { id: "7", text: "Die KI erfindet etwas und klingt dabei sicher", ziel: "halluzination", warum: "Darum: immer gegenprüfen." },
    ],
  },
  datenschutz: {
    id: "datenschutz", titel: "Darf das in die KI?",
    anleitung: "Tippe eine Karte an und dann den passenden Korb.",
    koerbe: [{ id: "ok", titel: "✅ darf rein", farbe: "#2e9e44" }, { id: "nie", titel: "🔒 gehört nie rein", farbe: "#c0392b" }],
    karten: [
      { id: "1", text: "Frage zur Photosynthese", ziel: "ok", warum: "Eine Sachfrage ohne persönliche Daten." },
      { id: "2", text: "Meine Adresse", ziel: "nie", warum: "Damit kann man dich finden." },
      { id: "3", text: "Foto unserer Klasse", ziel: "nie", warum: "Auf Fotos erkennt man Menschen, und die anderen wurden nicht gefragt." },
      { id: "4", text: "Wie lautet die Formel für den Flächeninhalt eines Kreises?", ziel: "ok", warum: "Reine Sachfrage." },
      { id: "5", text: "Der Name meiner besten Freundin", ziel: "nie", warum: "Auch Daten anderer sind geschützt." },
      { id: "6", text: "Mein Passwort", ziel: "nie", warum: "Passwörter gibt man nirgends ein außer beim eigenen Login." },
      { id: "7", text: "Eine ausgedachte Geschichte über einen Drachen", ziel: "ok", warum: "Erfunden, ohne echte Personen." },
      { id: "8", text: "Meine Zeugnisnote in Mathe", ziel: "nie", warum: "Noten sind persönliche Daten." },
      { id: "9", text: "Meine Krankheit oder die eines Freundes", ziel: "nie", warum: "Gesundheitsdaten sind besonders geschützt." },
    ],
  },
  "ki-ampel": {
    id: "ki-ampel", titel: "Unsere KI-Ampel", offen: true,
    anleitung: "Ordne jede Aufgabe einer Ampelfarbe zu. Danach siehst du einen Vorschlag. Besprecht Unterschiede in der Klasse.",
    koerbe: [
      { id: "rot", titel: "🔴 ohne KI", farbe: "#c0392b" },
      { id: "gelb", titel: "🟡 KI für bestimmte Schritte, mit Angabe", farbe: "#d4a017" },
      { id: "gruen", titel: "🟢 KI frei, mit Nutzungserklärung", farbe: "#2e9e44" },
    ],
    karten: [
      { id: "1", text: "Klassenarbeit", ziel: "rot", warum: "Hier zeigst du, was du selbst kannst." },
      { id: "2", text: "Einmaleins üben", ziel: "rot", warum: "Grundlagen muss man selbst können, um KI-Ergebnisse prüfen zu können." },
      { id: "3", text: "Ideen für ein Referat sammeln", ziel: "gelb", warum: "KI als Ideengeber, die Auswahl triffst du." },
      { id: "4", text: "Feedback zum eigenen Aufsatz", ziel: "gelb", warum: "Den Text schreibst du, die KI gibt Hinweise." },
      { id: "5", text: "Sich Vokabeln abfragen lassen", ziel: "gelb", warum: "KI als Lernhelfer, nicht als Lösungsmaschine." },
      { id: "6", text: "Projekt mit Präsentation", ziel: "gruen", warum: "Mit Nutzungserklärung und Prozessbewertung." },
      { id: "7", text: "Diktat", ziel: "rot", warum: "Rechtschreibung übt man selbst." },
      { id: "8", text: "Hausaufgabe: Aufsatz schreiben", ziel: "gelb", warum: "Zu Hause ist KI da: Besser festlegen, welche Schritte erlaubt sind." },
    ],
  },
  ideen: {
    id: "ideen", titel: "Wo soll KI helfen?", offen: true,
    anleitung: "Sortiere die Ideen. Es gibt kein Richtig oder Falsch, aber gute Gründe. Danach siehst du einen Vorschlag zum Vergleichen.",
    koerbe: [
      { id: "ja", titel: "👍 sinnvoll", farbe: "#2e9e44" },
      { id: "kommt", titel: "🤔 kommt drauf an", farbe: "#d4a017" },
      { id: "nein", titel: "👎 lieber nicht", farbe: "#c0392b" },
    ],
    karten: [
      { id: "1", text: "Texte vorlesen für Kinder, die noch nicht gut lesen", ziel: "ja", warum: "Unterstützt, ohne jemandem etwas wegzunehmen." },
      { id: "2", text: "Übersetzen für neue Mitschüler·innen", ziel: "ja", warum: "Hilft beim Ankommen. Für Wichtiges trotzdem einen Menschen fragen." },
      { id: "3", text: "Zeugnisnoten festlegen", ziel: "nein", warum: "Wichtige Entscheidungen über Menschen treffen Menschen." },
      { id: "4", text: "Alle Hausaufgaben erledigen", ziel: "nein", warum: "Dann lernst du nichts." },
      { id: "5", text: "Vokabeln abfragen", ziel: "ja", warum: "Ein geduldiger Übungspartner." },
      { id: "6", text: "Stundenplan vorschlagen", ziel: "kommt", warum: "Als Vorschlag gut, prüfen und entscheiden müssen Menschen." },
      { id: "7", text: "Streit in der Klasse schlichten", ziel: "nein", warum: "Gefühle und Beziehungen brauchen Menschen." },
      { id: "8", text: "Bewerbungen vorsortieren", ziel: "kommt", warum: "Spart Zeit, kann aber Bias weitertragen." },
    ],
  },
};

export type Ablage = Record<string, string>;

export function sortWertung(spiel: SortSpiel, ablage: Ablage): { richtig: number; gesamt: number; fertig: boolean } {
  const richtig = spiel.karten.filter(k => ablage[k.id] === k.ziel).length;
  return { richtig, gesamt: spiel.karten.length, fertig: spiel.karten.every(k => ablage[k.id]) };
}

// ───────────────────────────────────────────── Schwärzen ──

/** Ein Text in Stücken; `privat` = muss geschwärzt werden. */
export type Stueck = { text: string; privat?: boolean };

export const SCHWAERZ_TEXT: Stueck[] = [
  { text: "Hallo, ich bin " }, { text: "Lea Sommer", privat: true }, { text: " aus der " }, { text: "7b", privat: true },
  { text: " der " }, { text: "Gemeinschaftsschule am Lindenpark", privat: true }, { text: ". Ich wohne in der " },
  { text: "Birkenstraße 12", privat: true }, { text: " und habe am " }, { text: "3. Mai", privat: true },
  { text: " Geburtstag. Meine Freundin " }, { text: "Mia", privat: true }, { text: " hat " }, { text: "Diabetes", privat: true },
  { text: " und kann mir nicht helfen. " }, { text: "Kannst du mir erklären, wie man Brüche kürzt?" },
];

export function schwaerzWertung(geschwaerzt: Set<number>): { gefunden: number; privat: number; zuviel: number } {
  let gefunden = 0, privat = 0, zuviel = 0;
  SCHWAERZ_TEXT.forEach((s, i) => {
    if (s.privat) { privat++; if (geschwaerzt.has(i)) gefunden++; } else if (geschwaerzt.has(i)) zuviel++;
  });
  return { gefunden, privat, zuviel };
}

// ───────────────────────────────────────────── Prompt-Baukasten ──

export type BausteinArt = "rolle" | "kontext" | "format" | "stoer";
export type Baustein = { id: string; art: BausteinArt; text: string; hinweis: string };

export const PROMPT_AUFGABE = "Erkläre die Fotosynthese.";

export const BAUSTEINE: Baustein[] = [
  { id: "rolle", art: "rolle", text: "Du bist eine freundliche Biologielehrerin.", hinweis: "Rolle: bestimmt Ton und Blickwinkel." },
  { id: "kontext", art: "kontext", text: "Ich bin in Klasse 7 und verstehe das Wort »Chlorophyll« nicht.", hinweis: "Hintergrund: die KI weiß, für wen und was dir fehlt." },
  { id: "format", art: "format", text: "Antworte in 5 kurzen Stichpunkten.", hinweis: "Form: Länge und Aufbau der Antwort." },
  { id: "bitte", art: "stoer", text: "Bitte bitte, es ist super wichtig!!!", hinweis: "Nett, aber sagt der KI nichts darüber, was du brauchst." },
  { id: "gut", art: "stoer", text: "Mach es richtig gut.", hinweis: "Zu ungenau: Was heißt »gut«?" },
];

/** Antworten für jede Kombination aus Rolle (r), Kontext (k), Format (f). */
const ANTWORTEN: Record<string, string> = {
  "": "Die Fotosynthese ist ein biochemischer Prozess, bei dem photoautotrophe Organismen mithilfe von Lichtenergie aus Kohlenstoffdioxid und Wasser Glucose und Sauerstoff synthetisieren. Sie findet in den Chloroplasten statt und gliedert sich in die lichtabhängigen Reaktionen an der Thylakoidmembran sowie die lichtunabhängigen Reaktionen (Calvin-Zyklus) im Stroma. Die Bruttogleichung lautet 6 CO₂ + 6 H₂O → C₆H₁₂O₆ + 6 O₂.",
  r: "Gern erkläre ich dir die Fotosynthese! Pflanzen stellen mit Licht ihre eigene Nahrung her. In den Chloroplasten wandeln sie Kohlenstoffdioxid und Wasser in Traubenzucker und Sauerstoff um. Dabei spielen das Chlorophyll, die Lichtreaktion und der Calvin-Zyklus eine zentrale Rolle. Toll, dass du dich dafür interessierst!",
  k: "Fotosynthese heißt: Pflanzen machen sich mit Sonnenlicht ihr eigenes Essen. Dafür brauchen sie Wasser aus dem Boden und Kohlenstoffdioxid aus der Luft. Daraus bauen sie Zucker, und als »Abfall« entsteht Sauerstoff, den wir atmen. Chlorophyll ist der grüne Farbstoff in den Blättern. Er fängt das Sonnenlicht ein, ungefähr so wie ein Solarpanel.",
  f: "• Fotosynthese ist ein biochemischer Prozess photoautotropher Organismen.\n• Ort: Chloroplasten (Thylakoide und Stroma).\n• Edukte: CO₂ und H₂O, Energie: Licht.\n• Produkte: Glucose und O₂.\n• Phasen: Lichtreaktion und Calvin-Zyklus.",
  rk: "Schön, dass du fragst! Fotosynthese heißt: Pflanzen machen sich mit Sonnenlicht ihr eigenes Essen. Sie nehmen Wasser und Kohlenstoffdioxid auf und bauen daraus Zucker. Dabei entsteht Sauerstoff, den wir zum Atmen brauchen. Und Chlorophyll? Das ist der grüne Farbstoff in den Blättern. Er fängt das Licht ein, wie ein kleines Solarpanel. Deshalb sind Blätter grün!",
  rf: "Gern, hier kurz und knapp:\n• Pflanzen stellen mit Licht ihre Nahrung her.\n• Das passiert in den Chloroplasten.\n• Aus CO₂ und Wasser wird Glucose.\n• Dabei entsteht Sauerstoff.\n• Wichtig sind Chlorophyll, Lichtreaktion und Calvin-Zyklus.",
  kf: "• Pflanzen machen sich mit Sonnenlicht ihr eigenes Essen.\n• Sie brauchen dafür Wasser und Kohlenstoffdioxid aus der Luft.\n• Daraus bauen sie Zucker.\n• Dabei entsteht Sauerstoff, den wir atmen.\n• Chlorophyll ist der grüne Farbstoff, der das Licht einfängt, wie ein Solarpanel.",
  rkf: "Gute Frage! Hier in 5 Punkten:\n• Pflanzen machen sich mit Sonnenlicht ihr eigenes Essen.\n• Dafür nehmen sie Wasser und Kohlenstoffdioxid auf.\n• Daraus bauen sie Zucker, ihre Energie zum Wachsen.\n• Nebenbei entsteht Sauerstoff, den wir atmen.\n• Chlorophyll ist der grüne Farbstoff in den Blättern. Er fängt das Licht ein wie ein Solarpanel.\nKannst du jetzt erklären, warum Blätter grün sind?",
};

export function promptText(gewaehlt: Set<string>): string {
  const teile = BAUSTEINE.filter(b => gewaehlt.has(b.id));
  const rolle = teile.filter(b => b.art === "rolle").map(b => b.text);
  const rest = teile.filter(b => b.art !== "rolle").map(b => b.text);
  return [...rolle, PROMPT_AUFGABE, ...rest].join(" ");
}

export function promptAntwort(gewaehlt: Set<string>): string {
  const schluessel = (gewaehlt.has("rolle") ? "r" : "") + (gewaehlt.has("kontext") ? "k" : "") + (gewaehlt.has("format") ? "f" : "");
  return ANTWORTEN[schluessel];
}

/** 0–3: wie viele der hilfreichen Teile gewählt sind. Störteile zählen nicht. */
export function promptGuete(gewaehlt: Set<string>): number {
  return ["rolle", "kontext", "format"].filter(id => gewaehlt.has(id)).length;
}

// ───────────────────────────────────────────── Fehlerjagd ──

export type JagdStueck = { text: string; fehler?: string };

/** Eine nachgestellte Chatbot-Antwort mit eingebauten Fehlern (Halluzinationen). */
export const FEHLERJAGD: { frage: string; stuecke: JagdStueck[]; faktenkarte: string[] } = {
  frage: "Erzähl mir etwas über Erfurt.",
  stuecke: [
    { text: "Erfurt ist die Landeshauptstadt von Thüringen. " },
    { text: "Die Stadt liegt an der Saale. ", fehler: "Erfurt liegt an der Gera. Die Saale fließt z. B. durch Jena und Halle." },
    { text: "Bekannt ist sie für den Dom St. Marien und die Severikirche auf dem Domberg. " },
    { text: "Erfurt hat heute rund 500.000 Einwohner. ", fehler: "Es sind etwa 215.000 Einwohner." },
    { text: "Die Stadt wurde 1950 gegründet. ", fehler: "Erfurt wurde schon 742 erstmals urkundlich erwähnt und ist damit über 1.200 Jahre alt." },
    { text: "Die Krämerbrücke gilt als längste durchgehend mit Häusern bebaute und bewohnte Brücke Europas. " },
    { text: "Martin Luther studierte an der Universität Erfurt. " },
    { text: "Das steht so im »Großen Thüringer Städteatlas« von Prof. Hans Weidmann (2019).", fehler: "Diese Quelle haben wir für die Übung erfunden, so wie Chatbots manchmal Bücher, Autor·innen oder Links erfinden." },
  ],
  faktenkarte: [
    "Landeshauptstadt von Thüringen",
    "Fluss: Gera",
    "Einwohner: etwa 215.000",
    "Erste urkundliche Erwähnung: 742",
    "Domberg mit Dom St. Marien und Severikirche",
    "Krämerbrücke: längste durchgehend bebaute und bewohnte Brücke Europas",
    "Martin Luther studierte ab 1501 an der Universität Erfurt",
  ],
};

export function jagdWertung(markiert: Set<number>): { gefunden: number; fehler: number; falschAlarm: number } {
  let gefunden = 0, fehler = 0, falschAlarm = 0;
  FEHLERJAGD.stuecke.forEach((s, i) => {
    if (s.fehler) { fehler++; if (markiert.has(i)) gefunden++; } else if (markiert.has(i)) falschAlarm++;
  });
  return { gefunden, fehler, falschAlarm };
}

// ───────────────────────────────────────────── Echt oder KI? (Texte) ──

export type TextPaar = { thema: string; a: string; b: string; ki: "a" | "b"; merkmale: string[] };

/**
 * Für die Übung geschrieben: Die »Mensch«-Texte ahmen Schülertexte nach, die
 * »KI«-Texte typische Merkmale von Chatbot-Antworten.
 */
export const TEXTPAARE: TextPaar[] = [
  {
    thema: "Mein Wochenende",
    a: "Am Samstag war ich mit Opa angeln am Stausee, aber wir haben nix gefangen außer einem alten Schuh lol. Dafür gabs danach Bratwurst. Sonntag hab ich nur gezockt und Mama war genervt.",
    b: "Mein Wochenende war abwechslungsreich und erholsam. Am Samstag habe ich Zeit in der Natur verbracht und neue Energie getankt. Am Sonntag standen Entspannung und Freizeitaktivitäten im Mittelpunkt. Insgesamt war es ein gelungener Ausgleich zum Schulalltag.",
    ki: "b",
    merkmale: ["allgemein statt konkret (»Zeit in der Natur«)", "keine echten Erlebnisse oder Personen", "glatte, fehlerfreie Sätze", "Zusammenfassung am Ende (»Insgesamt …«)"],
  },
  {
    thema: "Warum ich Hunde mag",
    a: "Hunde sind treue Begleiter, die viele positive Eigenschaften vereinen. Sie bieten emotionale Unterstützung, fördern Bewegung im Alltag und stärken das Verantwortungsbewusstsein. Darüber hinaus sind sie ausgezeichnete Freunde für Kinder und Erwachsene gleichermaßen.",
    b: "Ich mag Hunde, weil unser Bruno sich immer total freut, wenn ich von der Schule komme. Er springt dann an mir hoch und hat einmal sogar meine Mathehausaufgaben angefressen (echt!!). Katzen sind mir zu zickig.",
    ki: "a",
    merkmale: ["Aufzählung von Vorteilen wie aus einem Ratgeber", "Wörter wie »darüber hinaus«, »gleichermaßen«", "keine eigene Geschichte", "ausgewogen, ohne Meinung mit Ecken und Kanten"],
  },
  {
    thema: "Die Klassenfahrt",
    a: "Die Klassenfahrt war ein unvergessliches Erlebnis, das unsere Klassengemeinschaft gestärkt hat. Wir haben spannende Ausflüge unternommen, viel Neues gelernt und gemeinsam gelacht. Diese Erfahrung wird uns noch lange in Erinnerung bleiben.",
    b: "Auf der Klassenfahrt hat es fast nur geregnet und in unserem Zimmer roch es nach Käsefüßen. Am besten war die Nachtwanderung, da hat sich Herr K. hinter einem Baum versteckt und alle haben geschrien.",
    ki: "a",
    merkmale: ["große Worte ohne Inhalt (»unvergesslich«, »gestärkt«)", "nichts, was nur diese Klasse erlebt hat", "positiver Einheitston", "Abschlusssatz, der nichts Neues sagt"],
  },
];

// ───────────────────────────────────────────── Hund oder Wolf? (Bias) ──

export type Hintergrund = "wiese" | "schnee";
export type Tier = "hund" | "wolf";
export type Beispiel = { tier: Tier; hintergrund: Hintergrund; halsband: boolean };

/** Einseitige Trainingsdaten: Hunde nur auf der Wiese, Wölfe nur im Schnee. */
export const EINSEITIG: Beispiel[] = [
  ...[true, true, true, true, false, false].map(h => ({ tier: "hund" as const, hintergrund: "wiese" as const, halsband: h })),
  ...Array.from({ length: 6 }, () => ({ tier: "wolf" as const, hintergrund: "schnee" as const, halsband: false })),
];

export const TESTFAELLE: (Omit<Beispiel, "tier"> & { wahr: Tier; titel: string })[] = [
  { titel: "Hund auf der Wiese, mit Halsband", wahr: "hund", hintergrund: "wiese", halsband: true },
  { titel: "Wolf im Schnee", wahr: "wolf", hintergrund: "schnee", halsband: false },
  { titel: "Hund im Schnee, mit Halsband", wahr: "hund", hintergrund: "schnee", halsband: true },
  { titel: "Wolf auf der Wiese", wahr: "wolf", hintergrund: "wiese", halsband: false },
];

/**
 * Naiver Bayes-Klassifikator mit Laplace-Glättung über zwei Merkmale.
 * Liefert die Wahrscheinlichkeit für »hund«.
 */
export function wahrscheinlichkeitHund(daten: readonly Beispiel[], fall: Omit<Beispiel, "tier">): number {
  const wert = (tier: Tier) => {
    const eigene = daten.filter(d => d.tier === tier);
    const n = eigene.length;
    const pTier = (n + 1) / (daten.length + 2);
    const pHg = (eigene.filter(d => d.hintergrund === fall.hintergrund).length + 1) / (n + 2);
    const pHb = (eigene.filter(d => d.halsband === fall.halsband).length + 1) / (n + 2);
    return pTier * pHg * pHb;
  };
  const h = wert("hund"), w = wert("wolf");
  return h / (h + w);
}
