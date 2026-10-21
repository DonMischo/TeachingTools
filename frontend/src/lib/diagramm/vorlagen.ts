/** Auswahllisten und Startvorlagen der Diagramm-Werkstatt. */

/** D2-Themen (theme-id). Die Namen sind eigene, die Farben bringt D2 mit. */
export const THEMEN: { id: number; name: string; dunkel?: boolean }[] = [
  { id: 0, name: "Standard" },
  { id: 1, name: "Grau" },
  { id: 3, name: "Blau-Gelb" },
  { id: 4, name: "Klassisch kühl" },
  { id: 5, name: "Beerenblau" },
  { id: 6, name: "Traube" },
  { id: 7, name: "Aubergine" },
  { id: 8, name: "Farbenblind-freundlich" },
  { id: 100, name: "Vanille-Cola" },
  { id: 101, name: "Orangen-Eis" },
  { id: 102, name: "Kirsch-Limo" },
  { id: 103, name: "Erdtöne" },
  { id: 104, name: "Waldgrün" },
  { id: 105, name: "Toast" },
  { id: 200, name: "Dunkel Mauve", dunkel: true },
  { id: 201, name: "Dunkel Blau", dunkel: true },
  { id: 300, name: "Terminal" },
  { id: 301, name: "Terminal grau" },
  { id: 302, name: "Origami" },
  { id: 303, name: "C4" },
];

export const FORMEN: { id: string; name: string; hinweis?: string }[] = [
  { id: "rectangle", name: "Rechteck", hinweis: "Schritt, Tätigkeit" },
  { id: "oval", name: "Oval", hinweis: "Start, Ende" },
  { id: "diamond", name: "Raute", hinweis: "Entscheidung" },
  { id: "parallelogram", name: "Parallelogramm", hinweis: "Ein-/Ausgabe" },
  { id: "circle", name: "Kreis" },
  { id: "hexagon", name: "Sechseck" },
  { id: "cylinder", name: "Zylinder", hinweis: "Speicher" },
  { id: "document", name: "Dokument" },
  { id: "page", name: "Seite" },
  { id: "cloud", name: "Wolke" },
  { id: "person", name: "Person" },
  { id: "step", name: "Pfeilschritt" },
  { id: "queue", name: "Warteschlange" },
  { id: "callout", name: "Sprechblase" },
];

export const FARBEN: { wert: string; name: string }[] = [
  { wert: "#fecaca", name: "Rot hell" },
  { wert: "#fed7aa", name: "Orange hell" },
  { wert: "#fef08a", name: "Gelb hell" },
  { wert: "#bbf7d0", name: "Grün hell" },
  { wert: "#bfdbfe", name: "Blau hell" },
  { wert: "#ddd6fe", name: "Lila hell" },
  { wert: "#fbcfe8", name: "Rosa hell" },
  { wert: "#e5e7eb", name: "Grau hell" },
  { wert: "#dc2626", name: "Rot" },
  { wert: "#ea580c", name: "Orange" },
  { wert: "#ca8a04", name: "Gelb" },
  { wert: "#16a34a", name: "Grün" },
  { wert: "#2563eb", name: "Blau" },
  { wert: "#7c3aed", name: "Lila" },
  { wert: "#db2777", name: "Rosa" },
  { wert: "#374151", name: "Dunkelgrau" },
  { wert: "#000000", name: "Schwarz" },
  { wert: "#ffffff", name: "Weiß" },
];

export const RICHTUNGEN = [
  { id: "down", name: "↓ nach unten" },
  { id: "right", name: "→ nach rechts" },
  { id: "up", name: "↑ nach oben" },
  { id: "left", name: "← nach links" },
];

/* --------------------------------------------------- Auftrag für eine KI */

/**
 * Regeln, die eine KI bei der einfachen D2-Schreibweise halten, die der
 * Bausteine-Modus vollständig versteht. Gelten für die Vorlage »Mit KI
 * erstellen« und für den Prompt-Baukasten gleichermaßen.
 */
export const KI_REGELN = [
  "Jeder Knoten bekommt eine kurze Id ohne Leerzeichen und eine Beschriftung, z. B. licht: Sonnenlicht",
  "Verbindungen: a -> b oder a -> b: Beschriftung (auch <-, <->, --)",
  "Formen nur mit shape: rectangle, oval, diamond, parallelogram, circle, hexagon, cylinder, document, cloud oder person",
  "Farben nur mit style.fill, style.stroke oder style.font-color als Hexwert in Anführungszeichen, z. B. style.fill: \"#bbf7d0\"",
  "Kein JSON, keine Klassen, Ebenen, Markdown, Icons oder Bilder",
  "Beschriftungen mit Raute, Semikolon oder geschweiften Klammern in \"doppelte Anführungszeichen\" setzen",
  "Beschriftungen auf Deutsch, kurz und verständlich für Schüler·innen",
];

export type KiArt = "mindmap" | "ablauf" | "frei";

export const KI_ARTEN: Record<KiArt, { name: string; wort: string; regeln: string[] }> = {
  mindmap: {
    name: "🧠 Mindmap",
    wort: "eine Mindmap",
    regeln: [
      "Mindmap: direction: right, ein Knoten in der Mitte als oval, höchstens drei Ebenen, Stichworte statt Sätze",
      "Mindmap: jeder Hauptast bekommt eine eigene helle Füllfarbe, seine Unteräste dieselbe",
    ],
  },
  ablauf: {
    name: "🔀 Ablaufdiagramm",
    wort: "ein Ablaufdiagramm (Flussdiagramm)",
    regeln: [
      "Ablaufdiagramm: direction: down, Start und Ende als oval, Entscheidungen als diamond mit ja/nein an den Pfeilen",
      "Ablaufdiagramm: Eingaben und Ausgaben als parallelogram, jeder Schritt ein kurzer Satz mit Verb",
    ],
  },
  frei: {
    name: "✨ KI wählt passend",
    wort: "ein passendes Diagramm (z. B. Mindmap, Ablauf, Kreislauf oder Übersicht)",
    regeln: ["Wähle die Diagrammart, die das Thema am besten erklärt, und setze direction passend"],
  },
};

export function kiPrompt({ art, thema, zusatz, bisher }: { art: KiArt; thema: string; zusatz?: string; bisher?: string }): string {
  const a = KI_ARTEN[art];
  const zeilen = [
    `Erstelle ${a.wort} in der Diagrammsprache D2 (https://d2lang.com).`,
    "",
    `Thema: ${thema.trim() || "(bitte Thema eintragen)"}`,
  ];
  if (zusatz?.trim()) zeilen.push(`Das soll vorkommen: ${zusatz.trim()}`);
  zeilen.push(
    "",
    "Antworte nur mit dem D2-Code in einem Codeblock (```d2 … ```), ohne Erklärung davor oder danach.",
    "",
    "Regeln:",
    ...[...KI_REGELN, ...a.regeln].map(r => `- ${r}`),
  );
  if (bisher?.trim()) {
    zeilen.push("", "Baue auf diesem Diagramm auf, behalte die Ids bei und gib den vollständigen neuen Code zurück:", "```d2", bisher.trim(), "```");
  }
  return zeilen.join("\n");
}

export const VORLAGEN: { id: string; name: string; code: string }[] = [
  { id: "leer", name: "Leeres Blatt", code: "" },
  {
    id: "mindmap",
    name: "Mindmap",
    code: `vars: {
  d2-config: {
    theme-id: 4
  }
}
direction: right

thema: Wasser {
  shape: oval
  style.fill: "#bfdbfe"
  style.font-size: 24
}
kreislauf: Kreislauf
nutzen: Nutzen
gefahren: Gefahren

thema -> kreislauf
thema -> nutzen
thema -> gefahren

verdunsten: Verdunsten
regen: Niederschlag
trinken: Trinkwasser
energie: Wasserkraft
hochwasser: Hochwasser {
  style.fill: "#fecaca"
}

kreislauf -> verdunsten
kreislauf -> regen
nutzen -> trinken
nutzen -> energie
gefahren -> hochwasser: droht bei Starkregen {
  style.stroke: "#dc2626"
}
`,
  },
  {
    id: "ablauf",
    name: "Ablaufdiagramm",
    code: `vars: {
  d2-config: {
    theme-id: 0
  }
}
direction: down

start: Start {
  shape: oval
  style.fill: "#bbf7d0"
}
eingabe: Zahl eingeben {
  shape: parallelogram
}
frage: Zahl gerade? {
  shape: diamond
  style.fill: "#fef08a"
}
gerade: »gerade« ausgeben
ungerade: »ungerade« ausgeben
ende: Ende {
  shape: oval
  style.fill: "#fecaca"
}

start -> eingabe
eingabe -> frage
frage -> gerade: ja
frage -> ungerade: nein
gerade -> ende
ungerade -> ende
`,
  },
  {
    id: "gruppen",
    name: "Ablauf mit Gruppen",
    code: `direction: right

kueche: Küche {
  bestellung: Bestellung lesen
  kochen: Kochen
  bestellung -> kochen
}
service: Service {
  aufnehmen: Bestellung aufnehmen
  bringen: Essen bringen
}

service.aufnehmen -> kueche.bestellung
kueche.kochen -> service.bringen: fertig
`,
  },
  {
    id: "ki",
    name: "Mit KI erstellen",
    code: [
      "# ============ Auftrag für eine KI ============",
      "# So geht's:",
      "# 1. Im Code-Modus »📋 Kopieren« drücken und alles in einen KI-Chat einfügen.",
      "# 2. Darunter schreiben, was du brauchst, z. B.",
      "#    »Thema: Fotosynthese, als Mindmap« oder »Ablauf: Brot backen«.",
      "# 3. Die Antwort der KI hier über alles drüber einfügen.",
      "# 4. Prüfen! Die KI kann sich irren. Danach mit Bausteinen weiterbauen.",
      "# (Bequemer: »🤖 Prompt für eine KI« über dem Code baut den Auftrag fertig.)",
      "#",
      "# Liebe KI, bitte erstelle ein Diagramm in der Sprache D2 (d2lang.com).",
      "# Antworte nur mit D2-Code in einem Codeblock, ohne Erklärung.",
      "# Halte dich an diese Regeln, damit wir es weiter bearbeiten können:",
      ...[...KI_REGELN, ...KI_ARTEN.mindmap.regeln, ...KI_ARTEN.ablauf.regeln, "Den vars-Block unten übernehmen, die Kommentare weglassen"]
        .map(r => `# - ${r}`),
      "# ============================================",
      "",
      "vars: {",
      "  d2-config: {",
      "    theme-id: 4",
      "  }",
      "}",
      "direction: right",
      "",
      "thema: Mein Thema {",
      "  shape: oval",
      "}",
      "",
    ].join("\n"),
  },
];
