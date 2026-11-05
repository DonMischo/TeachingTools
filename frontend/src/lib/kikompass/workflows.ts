/**
 * Workflow-Bibliothek des KI-Kompass: wiederkehrende Abläufe mit KI als
 * Schritte. Jeder Schritt sagt, wer handelt (Mensch, KI, Werkzeug), bringt
 * bei KI-Schritten eine Promptvorlage mit Platzhaltern und bei Prüfschritten
 * eine Checkliste. Eine Prüffrage führt bei »nein« zurück (Schleife).
 *
 * Aus denselben Daten entsteht ein D2-Flussdiagramm für die
 * Diagramm-Werkstatt, damit Lehrkräfte und Lernende den Ablauf anpassen können.
 * Alle Texte sind eigene; KI-Teil wie im Führerschein über AIS.chat.
 */
import type { StufeId } from "./raster";
import { DATENSCHUTZ_REGEL } from "./werkstatt";
import { kiPrompt } from "@/lib/diagramm/vorlagen";
import { quote } from "@/lib/diagramm/d2modell";

export type Akteur = "mensch" | "ki" | "werkzeug";
export type Zielgruppe = "lehrkraft" | "lernende";

export const AKTEURE: Record<Akteur, { name: string; icon: string; farbe: string }> = {
  mensch: { name: "Mensch", icon: "🧑", farbe: "#bbf7d0" },
  ki: { name: "KI", icon: "🤖", farbe: "#ddd6fe" },
  werkzeug: { name: "Werkzeug", icon: "🧰", farbe: "#bfdbfe" },
};

/** Platzhalter, die in Prompts vorkommen dürfen. */
export const PLATZHALTER = ["thema", "fach", "klasse", "werkzeug"] as const;
export type Platzhalter = (typeof PLATZHALTER)[number];

export interface Pruefung {
  frage: string;
  /** Ziel bei »nein«: Schritt-Id oder "ende". */
  nein: string;
  /** Ziel bei »ja«; ohne Angabe der nächste Schritt. */
  ja?: string;
  neinText?: string;
}

export interface Schritt {
  id: string;
  titel: string;
  wer: Akteur;
  text: string;
  prompt?: string;
  check?: string[];
  /** Link in TT; "tt-ziel" = das gewählte TT-Werkzeug. */
  link?: { href: string; label: string } | "tt-ziel";
  pruefe?: Pruefung;
}

export interface TtZiel { id: string; name: string; href: string; hinweis?: string }

export interface Workflow {
  id: string;
  titel: string;
  icon: string;
  fuer: Zielgruppe[];
  stufe: StufeId;
  kurz: string;
  schritte: Schritt[];
  hinweis?: string;
  ttZiele?: TtZiel[];
}

/** TT-Werkzeuge mit Vorlage zum Herunterladen und Hochladen. */
export const TT_ZIELE: TtZiel[] = [
  { id: "quiz", name: "Quiz (Caputh)", href: "/aktivitaeten/caputh" },
  { id: "bingo", name: "Bingo", href: "/aktivitaeten/bingo" },
  { id: "lueckentext", name: "Lückentext", href: "/aktivitaeten/lueckentexte" },
  { id: "zeitstrahl", name: "Zeitstrahl", href: "/aktivitaeten/zeitstrahl" },
  { id: "taskcrawler", name: "TaskCrawler", href: "/aktivitaeten/taskcrawler",
    hinweis: "Nimm »🏰 Vorlage interaktiv« und wähle dein Fach: Dann listet die Vorlage nur passende Werkzeuge und bleibt kurz." },
  { id: "challenge", name: "Challenge", href: "/aktivitaeten/challenge" },
  { id: "barometer", name: "Barometer", href: "/tools/barometer" },
  { id: "tipptexte", name: "Tipptexte (10-Finger)", href: "/simulationen/tippen" },
];

const WEITER_FRAGEN = "Benenne genau, was nicht passt (»Aufgabe 3 ist zu schwer, weil …«), statt nur »nochmal« zu schreiben.";

export const WORKFLOWS: Workflow[] = [
  {
    id: "tt-vorlage", titel: "TT-Material mit KI füllen", icon: "🧰", fuer: ["lehrkraft"], stufe: "Ia",
    kurz: "Quiz, Lückentext, TaskCrawler & Co.: erst planen, dann das JSON schreiben lassen, hochladen, prüfen.",
    ttZiele: TT_ZIELE,
    schritte: [
      { id: "ziel", titel: "Ziel klären", wer: "mensch",
        text: "Was sollen die Lernenden danach können? Leg Thema, Klasse und ungefähren Umfang fest.",
        check: ["Lernziel als ein Satz mit Operator (nennen, erklären, berechnen …)", "Umfang: wie viele Aufgaben, wie lange"] },
      { id: "vorlage", titel: "Vorlage herunterladen", wer: "werkzeug", link: "tt-ziel",
        text: "Öffne das Werkzeug in TT und lade die »📄 Vorlage« herunter. Sie enthält die Anleitung für die KI." },
      { id: "plan", titel: "Plan erstellen lassen", wer: "ki",
        text: "Erst der Plan, noch kein JSON. So siehst du Fehler, bevor sie in der Datei stecken, und die Antwort bleibt kurz.",
        prompt: "Ich erstelle ein {werkzeug} zum Thema {thema} für Klasse {klasse} im Fach {fach}. Schlag mir zuerst nur einen Plan vor: Abschnitte, Aufgaben mit Lösung und typische Fehler der Lernenden. Noch kein JSON." },
      { id: "plan-pruefen", titel: "Plan prüfen", wer: "mensch",
        text: "Du bist die Fachkraft: Lies den Plan wie den Entwurf einer Referendarin.",
        check: ["Fachlich richtig", "Passt zum Niveau der Klasse", "Jede Lösung stimmt"],
        pruefe: { frage: "Passt der Plan?", nein: "plan", neinText: WEITER_FRAGEN } },
      { id: "json", titel: "JSON schreiben lassen", wer: "ki",
        text: "Häng die Vorlage als Datei an oder füg ihren Inhalt ein.",
        prompt: "Gut. Fülle jetzt die angehängte Vorlage mit diesem Plan. Antworte nur mit dem JSON, ohne die Felder, die mit _ beginnen. Wird die Antwort zu lang, schreib sie Abschnitt für Abschnitt.\n\n[Vorlage anhängen oder hier einfügen]" },
      { id: "hochladen", titel: "Hochladen", wer: "werkzeug", link: "tt-ziel",
        text: "Speichere die Antwort als .json und lade sie im Werkzeug hoch.",
        pruefe: { frage: "Klappt der Upload?", nein: "json",
          neinText: "Im Fehlerdialog »📋 Für die KI kopieren« drücken und in denselben Chat einfügen." } },
      { id: "probelauf", titel: "Feinschliff und Probelauf", wer: "mensch",
        text: "Im Formular nachbessern, dann einmal selbst durchspielen.",
        check: ["Antworten erlauben übliche Schreibweisen", "Bilder und Quellen mit Lizenz", "Einmal selbst gespielt"] },
    ],
  },
  {
    id: "differenzieren", titel: "Arbeitsblatt in drei Niveaus", icon: "📑", fuer: ["lehrkraft"], stufe: "Ia",
    kurz: "Ein vorhandenes Arbeitsblatt als Basis, Standard und Erweiterung, mit Lösungen.",
    schritte: [
      { id: "material", titel: "Ausgangsmaterial wählen", wer: "mensch",
        text: "Nimm ein eigenes Arbeitsblatt oder einen Text, den du verwenden darfst. Keine Schülerdaten." },
      { id: "fassungen", titel: "Drei Fassungen erstellen lassen", wer: "ki",
        text: "Gleiche Lernziele und gleiche Nummern, damit alle über dieselben Aufgaben sprechen können.",
        prompt: "Du bist eine erfahrene Lehrkraft für {fach}. Hier ist ein Arbeitsblatt für Klasse {klasse} zum Thema {thema}. Erstelle drei Fassungen: 1. Basis mit Hilfen und kurzen Sätzen, 2. Standard, 3. Erweiterung mit einer Transferaufgabe. Gleiche Lernziele, gleiche Nummerierung. Gib zu jeder Aufgabe die Lösung an.\n\n[Arbeitsblatt einfügen]" },
      { id: "pruefen", titel: "Prüfen", wer: "mensch",
        text: "KI-Fassungen klingen glatt. Prüf, ob sie auch stimmen.",
        check: ["Fachlich korrekt", "Basis ist wirklich leichter (Sprache, Hilfen), nicht nur kürzer", "Lösungen stimmen"],
        pruefe: { frage: "Alles richtig?", nein: "fassungen", neinText: WEITER_FRAGEN } },
      { id: "einsetzen", titel: "Einsetzen und teilen", wer: "werkzeug",
        text: "Als Datei ausgeben und im KI-Kompass unter »Für Lehrkräfte → Materialpool« für Kolleg·innen teilen." },
    ],
  },
  {
    id: "feedback", titel: "Feedback zu Schülertexten", icon: "💬", fuer: ["lehrkraft"], stufe: "II",
    kurz: "Kriterien festlegen, anonymisieren, Feedback-Vorschlag holen, selbst entscheiden.",
    hinweis: "Die Note gibst du. Die KI liefert nur einen Vorschlag für Rückmeldungen.",
    schritte: [
      { id: "kriterien", titel: "Kriterien festlegen", wer: "mensch",
        text: "Drei bis fünf Kriterien aus deinem Erwartungshorizont. Ohne Kriterien wird Feedback beliebig." },
      { id: "anonym", titel: "Text anonymisieren", wer: "mensch",
        text: "Entferne Namen, Orte, Schule und alles, was auf eine Person schließen lässt.",
        check: [DATENSCHUTZ_REGEL, "Auch im Text erwähnte Mitschüler·innen und Lehrkräfte entfernt"] },
      { id: "vorschlag", titel: "Feedback-Vorschlag holen", wer: "ki",
        text: "Ein Text pro Anfrage, damit nichts durcheinandergerät.",
        prompt: "Gib Feedback zu diesem Schülertext (Klasse {klasse}, {fach}, Thema {thema}) nur nach diesen Kriterien: [Kriterien]. Je Kriterium: eine Stärke mit kurzem Zitat und ein konkreter nächster Schritt. Keine Note. Freundlich, in einfacher Sprache, in Du-Form.\n\n[anonymisierter Text]" },
      { id: "entscheiden", titel: "Prüfen und ergänzen", wer: "mensch",
        text: "Du kennst die Person und ihren Lernweg, die KI nicht.",
        check: ["Zitate stehen wirklich im Text", "Fair und zutreffend", "Ein nächster Schritt, der machbar ist"],
        pruefe: { frage: "Fair und zutreffend?", nein: "vorschlag", neinText: WEITER_FRAGEN } },
      { id: "zurueck", titel: "Zurückgeben", wer: "mensch",
        text: "Lernende überarbeiten ihren Text mit dem Feedback. Sag offen, dass du KI als Hilfe genutzt hast." },
    ],
  },
  {
    id: "resilient", titel: "Aufgabe KI-resilient umbauen", icon: "🛡️", fuer: ["lehrkraft"], stufe: "II",
    kurz: "Testen, ob die KI die Aufgabe einfach löst, und sie so umbauen, dass eigenes Denken sichtbar wird.",
    hinweis: "Mehr Ideen im KI-Kompass unter »Für Lehrkräfte → Material-Werkstatt → Aufgaben umbauen«.",
    schritte: [
      { id: "testen", titel: "Aufgabe testen", wer: "ki",
        text: "Füg die Aufgabe unverändert in AIS.chat ein und schau, was herauskommt.",
        prompt: "Löse diese Aufgabe so, wie es eine gute Schülerin der Klasse {klasse} tun würde:\n\n[Aufgabe]",
        pruefe: { frage: "Löst die KI sie sofort gut?", ja: "umbauen", nein: "ende", neinText: "Dann passt die Aufgabe so." } },
      { id: "umbauen", titel: "Umbau vorschlagen lassen", wer: "ki",
        text: "Ziel ist nicht »KI-sicher«, sondern dass Denken und Prozess sichtbar werden.",
        prompt: "Baue diese Aufgabe für Klasse {klasse} ({fach}, Thema {thema}) so um, dass eine KI-Antwort allein nicht reicht: mit Bezug auf unseren Unterricht oder Ort, mit sichtbarem Prozess (Skizze, Begründung, Reflexion) oder mit einem kritischen Vergleich einer KI-Antwort. Gib zwei Varianten und je einen Erwartungshorizont mit Operatoren.\n\n[Aufgabe]" },
      { id: "auswaehlen", titel: "Auswählen und erneut testen", wer: "mensch",
        text: "Nimm die Variante, die zu deiner Klasse passt, und teste sie wie in Schritt 1.",
        pruefe: { frage: "Wird eigenes Denken jetzt sichtbar?", nein: "umbauen", neinText: WEITER_FRAGEN } },
    ],
  },
  {
    id: "bild", titel: "Bild für Material erzeugen", icon: "🖼️", fuer: ["lehrkraft"], stufe: "Ib",
    kurz: "Bild mit KI erzeugen, auf Fehler und Klischees prüfen, kennzeichnen.",
    hinweis: "Nur, wenn dein Werkzeug Bilder erzeugen darf. Beachte seine Nutzungsbedingungen.",
    schritte: [
      { id: "brauche", titel: "Brauche ich ein KI-Bild?", wer: "mensch",
        text: "Oft gibt es Besseres: eigene Fotos, Wikimedia Commons, Schulbuchverlag. KI-Bilder lohnen sich für Szenen, die es so nicht gibt.",
        pruefe: { frage: "Ist ein KI-Bild sinnvoll?", nein: "ende", neinText: "Nimm ein echtes Foto oder eine freie Grafik." } },
      { id: "erzeugen", titel: "Bild erzeugen lassen", wer: "ki",
        text: "Beschreibe genau, was zu sehen sein soll. Text im Bild gerät oft falsch.",
        prompt: "Erstelle ein Bild für ein Arbeitsblatt in {fach}, Klasse {klasse}, Thema {thema}: [was zu sehen sein soll]. Stil: klare Illustration, heller Hintergrund, keine Schrift im Bild, keine realen Personen oder Marken." },
      { id: "pruefen", titel: "Prüfen", wer: "mensch",
        text: "Schau genau hin, bevor das Bild vor der Klasse landet.",
        check: ["Fachlich richtig (Hände, Tiere, Geräte, Proportionen)", "Wer ist zu sehen? Keine Klischees", "Keine echten Personen, Marken oder Logos"],
        pruefe: { frage: "Passt das Bild?", nein: "erzeugen", neinText: "Prompt präzisieren statt einfach neu würfeln." } },
      { id: "kennzeichnen", titel: "Kennzeichnen", wer: "mensch",
        text: "Unter das Bild: »KI-generiert mit [Werkzeug], [Datum]«. So lernen auch die Lernenden, Bilder zu hinterfragen." },
    ],
  },
  {
    id: "lernumgebung", titel: "Eigene Lernumgebung in AIS.chat", icon: "🤖", fuer: ["lehrkraft"], stufe: "II",
    kurz: "Einen KI-Lernbegleiter mit Systemtext bauen, wie ein Schüler testen, Link teilen.",
    hinweis: "Das ist schon ein kleiner »Agent«: feste Rolle, feste Regeln, ein Auftrag.",
    schritte: [
      { id: "rolle", titel: "Rolle und Grenzen festlegen", wer: "mensch",
        text: "Tutor, Gesprächspartner (z. B. eine historische Figur) oder Quizmaster? Was darf er nicht (Lösungen vorsagen, Hausaufgaben schreiben)?" },
      { id: "systemtext", titel: "Systemtext schreiben lassen", wer: "ki",
        text: "Kurze Systemtexte halten besser als lange.",
        prompt: "Schreib mir einen Systemtext für einen KI-Lernbegleiter in {fach}, Klasse {klasse}, Thema {thema}. Er soll [Rolle], keine fertigen Lösungen geben, sondern mit Rückfragen helfen, in einfacher Sprache antworten, nicht nach persönlichen Daten fragen und bei Themen außerhalb des Unterrichts freundlich zurücklenken. Höchstens 150 Wörter." },
      { id: "anlegen", titel: "In AIS.chat anlegen", wer: "werkzeug",
        text: "Neue Lernumgebung anlegen und den Systemtext einfügen." },
      { id: "testen", titel: "Wie ein Schüler testen", wer: "mensch",
        text: "Versuch, ihn zur Lösung zu überreden. Stell Quatschfragen. Frag nach etwas Privatem.",
        check: ["Gibt keine fertigen Lösungen", "Bleibt beim Thema", "Fragt nicht nach persönlichen Daten"],
        pruefe: { frage: "Hält er sich an die Regeln?", nein: "systemtext", neinText: "Schreib in den Systemtext, was schiefging, z. B. »Auch auf Nachfrage keine Lösung nennen.«" } },
      { id: "teilen", titel: "Link teilen", wer: "werkzeug",
        text: "Im KI-Kompass in der Station (Schritt »AIS.chat«) oder unter »Für Lehrkräfte → AIS.chat-Link & Leitfaden« den Einladungslink teilen." },
    ],
  },
  {
    id: "agent", titel: "So arbeitet ein KI-Agent", icon: "🕹️", fuer: ["lehrkraft", "lernende"], stufe: "III",
    kurz: "Planen, Werkzeug nutzen, prüfen, wiederholen: als Rollenspiel ohne Computer.",
    hinweis: "Fachwörter: Ein Agent ist eine KI, die in dieser Schleife selbst arbeitet. Werkzeuge bekommt sie über Schnittstellen, z. B. MCP (wie eine Steckdose für Werkzeuge). Ein Skill ist eine gespeicherte Anleitung, die sie bei Bedarf liest (wie eine Rezeptkarte). Spielt die Rollen mit vier Personen: Auftraggeber, Planerin, Werkzeug, Prüfer.",
    schritte: [
      { id: "auftrag", titel: "Auftrag geben", wer: "mensch",
        text: "Der Auftraggeber nennt ein Ziel, z. B. »Plane unseren Wandertag«." },
      { id: "planen", titel: "Planen", wer: "ki",
        text: "Die Planerin zerlegt das Ziel in Teilschritte und schreibt sie an die Tafel.",
        prompt: "Zerlege dieses Ziel in höchstens sechs Schritte. Nenne zu jedem Schritt, welches Werkzeug du bräuchtest (z. B. Wetterbericht, Karte, Fahrplan, Taschenrechner): {thema}" },
      { id: "werkzeug", titel: "Werkzeug benutzen", wer: "werkzeug",
        text: "Das Werkzeug beantwortet nur, was gefragt wird: Wetterkarte, Fahrplan, Taschenrechner (als Karten auf dem Tisch)." },
      { id: "pruefen", titel: "Prüfen", wer: "ki",
        text: "Der Prüfer vergleicht das Ergebnis mit dem Ziel.",
        pruefe: { frage: "Ziel erreicht?", nein: "planen", neinText: "Zurück zur Planerin: Was fehlt noch?" } },
      { id: "freigabe", titel: "Freigabe durch den Menschen", wer: "mensch",
        text: "Bevor etwas Echtes passiert (buchen, bezahlen, senden), entscheidet ein Mensch." },
    ],
  },
  {
    id: "flussdiagramm", titel: "Flussdiagramm mit KI", icon: "🔀", fuer: ["lehrkraft", "lernende"], stufe: "Ib",
    kurz: "Einen Ablauf als D2-Code schreiben lassen und in der Diagramm-Werkstatt prüfen und anpassen.",
    schritte: [
      { id: "ablauf", titel: "Ablauf wählen", wer: "mensch",
        text: "Etwas mit Reihenfolge und Entscheidungen: ein Versuch, ein Rezept, ein Algorithmus, ein Antrag." },
      { id: "code", titel: "D2-Code schreiben lassen", wer: "ki",
        text: "D2 ist eine Textsprache für Diagramme. TT zeichnet sie.",
        prompt: kiPrompt({ art: "ablauf", thema: "{thema}" }) },
      { id: "einfuegen", titel: "In die Diagramm-Werkstatt einfügen", wer: "werkzeug",
        link: { href: "/simulationen/diagramme", label: "🔀 Diagramm-Werkstatt" },
        text: "Neues Blatt, Modus »⌨️ Code«, Code einfügen." },
      { id: "pruefen", titel: "Prüfen", wer: "mensch",
        text: "Spiel den Ablauf einmal mit dem Finger durch.",
        check: ["Jeder Weg führt zu einem Ende", "Entscheidungen haben ja und nein", "Reihenfolge stimmt"],
        pruefe: { frage: "Stimmt der Ablauf?", nein: "code", neinText: "Fehler benennen und die KI den vollständigen neuen Code zurückgeben lassen." } },
      { id: "nutzen", titel: "Verwenden", wer: "werkzeug",
        text: "Als PNG oder SVG für Arbeitsblatt oder Tafel herunterladen." },
    ],
  },
  {
    id: "recherche", titel: "Recherchieren mit KI und Faktencheck", icon: "🔎", fuer: ["lernende"], stufe: "Ia",
    kurz: "KI erklären lassen, Fakten in zwei Quellen nachprüfen, sauber notieren.",
    schritte: [
      { id: "frage", titel: "Frage aufschreiben", wer: "mensch",
        text: "Schreib deine Frage in einem Satz auf. Keine Namen, keine Adresse, nichts Privates." },
      { id: "fragen", titel: "KI fragen", wer: "ki",
        text: "Bitte die KI, zu sagen, wie sicher sie ist.",
        prompt: "Erkläre mir für Klasse {klasse}: {thema}. Nenne drei wichtige Fakten und sag bei jedem, wie sicher du dir bist." },
      { id: "nachpruefen", titel: "In zwei Quellen nachprüfen", wer: "werkzeug",
        text: "Schulbuch, Lexikon oder eine seriöse Website (z. B. von einer Behörde, einem Museum, einer Zeitung).",
        check: ["Fakt 1 in zwei Quellen gefunden", "Fakt 2 in zwei Quellen gefunden", "Fakt 3 in zwei Quellen gefunden"],
        pruefe: { frage: "Stimmen alle Fakten?", nein: "fragen", neinText: "Frag nach: »In [Quelle] steht aber …«. KI kann sich irren." } },
      { id: "notieren", titel: "Notieren", wer: "mensch",
        text: "Schreib die Fakten mit deinen Worten auf, nenn die Quellen und dass du KI als Hilfe genutzt hast." },
    ],
  },
  {
    id: "ueberarbeiten", titel: "Eigenen Text mit KI-Feedback verbessern", icon: "✍️", fuer: ["lernende"], stufe: "Ib",
    kurz: "Erst selbst schreiben, dann Tipps holen (keinen neuen Text!), selbst entscheiden.",
    schritte: [
      { id: "schreiben", titel: "Selbst schreiben", wer: "mensch",
        text: "Erst ohne KI. Dein Text, deine Ideen." },
      { id: "tipps", titel: "Tipps holen", wer: "ki",
        text: "Wichtig: Die KI soll nicht neu schreiben, sondern Tipps geben.",
        prompt: "Hier ist mein Text für {fach} zum Thema {thema}. Schreib ihn NICHT neu. Gib mir drei Tipps: was gut ist, was unklar ist und eine Frage, die mein Text noch nicht beantwortet.\n\n[dein Text ohne Namen]" },
      { id: "ueberarbeiten", titel: "Selbst überarbeiten", wer: "mensch",
        text: "Du entscheidest, welche Tipps du nimmst. Nicht jeder Tipp passt.",
        pruefe: { frage: "Bist du zufrieden?", nein: "tipps", neinText: "Frag gezielt nach: »Ist mein Schluss jetzt klarer?«" } },
      { id: "protokoll", titel: "Prompt-Protokoll fürs Portfolio", wer: "mensch",
        text: "Notiere: Was habe ich gefragt? Was habe ich übernommen? Was nicht, und warum?" },
    ],
  },
];

export type Werte = Partial<Record<Platzhalter, string>>;

const NAMEN: Record<Platzhalter, string> = { thema: "Thema", fach: "Fach", klasse: "Klasse", werkzeug: "Werkzeug" };

/** Setzt die Platzhalter ein; leere bleiben als »[Thema]« sichtbar. */
export function fuelle(prompt: string, werte: Werte): string {
  return prompt.replace(/\{(thema|fach|klasse|werkzeug)\}/g, (_, k: Platzhalter) => werte[k]?.trim() || `[${NAMEN[k]}]`);
}

export function fuerGruppe(gruppe: Zielgruppe): Workflow[] {
  return WORKFLOWS.filter(w => w.fuer.includes(gruppe));
}

/** Wohin eine Prüfung führt: Schritt-Index oder -1 für das Ende. */
export function ziel(w: Workflow, id: string): number {
  return id === "ende" ? -1 : w.schritte.findIndex(s => s.id === id);
}

/** D2-Flussdiagramm zum Workflow: Start, Schritte in Akteurfarben, Rauten für Prüfungen, Ende. */
export function alsD2(w: Workflow): string {
  const z: string[] = [
    "vars: {", "  d2-config: {", "    theme-id: 0", "  }", "}", "direction: down", "",
    "start: Start {", "  shape: oval", "}",
  ];
  const sid = (i: number) => (i < 0 || i >= w.schritte.length ? "ende" : `s${i + 1}`);
  w.schritte.forEach((s, i) => {
    const a = AKTEURE[s.wer];
    z.push(`${sid(i)}: ${quote(`${i + 1}. ${s.titel} (${a.name})`)} {`, `  style.fill: "${a.farbe}"`, "}");
    if (s.pruefe) z.push(`p${i + 1}: ${quote(s.pruefe.frage)} {`, "  shape: diamond", `  style.fill: "#fef08a"`, "}");
  });
  z.push("ende: Fertig {", "  shape: oval", "}", "", "start -> s1");
  w.schritte.forEach((s, i) => {
    if (!s.pruefe) { z.push(`${sid(i)} -> ${sid(i + 1)}`); return; }
    const ja = s.pruefe.ja ? ziel(w, s.pruefe.ja) : i + 1;
    z.push(`${sid(i)} -> p${i + 1}`, `p${i + 1} -> ${sid(ja)}: ja`, `p${i + 1} -> ${sid(ziel(w, s.pruefe.nein))}: nein`);
  });
  return z.join("\n") + "\n";
}
