/**
 * KI-Führerschein: Stationen in vier Modulen, eines je Bereich des Rasters.
 *
 * Jede Station hat: Erklärung → Auftrag → (optional) AIS.chat-Teil →
 * Selbst-Check → Reflexion fürs Portfolio. Der AIS.chat-Teil hat zwei
 * Hälften: Die Lehrkraft legt in AIS.chat (Thüringer Schulportal) eine
 * Lernumgebung an und zeigt den QR-Code, die Lernenden arbeiten dort und
 * reflektieren danach hier in TT. Ausgaben der KI werden in TT nicht gespeichert.
 *
 * Die Aufgaben sind eigene Texte. Die Gliederung der Themen lehnt sich an
 * die Pinnwand »KI-Kompetenzen im Unterricht: Impulse für die Praxis«
 * (Fischer, Friese, Minner, Ricker, Zirwes; VK:KIWA Thinktank) an.
 */
import type { BereichId } from "./raster";

export type Frage = { frage: string; antworten: string[]; richtig: number; warum: string };

export type AisTeil = {
  /** Was die Lehrkraft in AIS.chat vorbereitet. */
  lehrkraft: string;
  /** Vorschlag für den Auftrag bzw. Systemtext der Lernumgebung. */
  systemtext: string;
  /** Schritte für die Lernenden in AIS.chat. */
  schritte: string[];
  /** Prompts zum Ausprobieren. */
  prompts?: string[];
};

export type Station = {
  id: string;
  modul: BereichId;
  stufe: "0" | "I";
  titel: string;
  icon: string;
  minuten: number;
  /** Ids der Kann-Sätze, die diese Station trainiert. */
  kann: string[];
  erklaerung: string[];
  auftrag: string[];
  ais?: AisTeil;
  link?: { titel: string; url: string; quelle: string };
  /** Interne Simulation zum Ausprobieren. */
  sim?: { titel: string; href: string };
  quiz: Frage[];
  reflexion: string[];
};

/** Ab so vielen richtigen Antworten (Anteil) ist der Selbst-Check bestanden. */
export const QUIZ_SCHWELLE = 2 / 3;
/** So viele Zeichen braucht jede Reflexionsantwort mindestens. */
export const REFLEXION_MIN = 20;
export const REFLEXION_MAX = 2000;

const DATENSCHUTZ = "Keine Namen, Adressen, Geburtstage, Fotos oder andere persönliche Daten eingeben – auch nicht von anderen.";

export const STATIONEN: Station[] = [
  // ───────────────────────────── Verstehen ──
  {
    id: "v-mensch-maschine", modul: "verstehen", stufe: "0", titel: "Mensch oder Maschine?", icon: "🤔", minuten: 20,
    kann: ["v-0-1", "v-0-2", "v-Ia-1"],
    erklaerung: [
      "KI steckt in vielen Dingen, die du jeden Tag benutzt: Sie schlägt dir Videos vor, erkennt Gesichter auf Fotos, übersetzt Texte oder beantwortet Fragen im Chat.",
      "Aber nicht jedes Gerät hat KI. Ein Taschenrechner rechnet nur nach festen Regeln. Eine KI wurde mit sehr vielen Beispielen trainiert und findet darin Muster.",
    ],
    auftrag: [
      "Schreibt in Partnerarbeit 10 Geräte, Apps oder Dienste auf, die ihr benutzt (z. B. Taschenrechner, Videoplattform, Navi, Wecker, Übersetzer).",
      "Sortiert sie in drei Gruppen: »sicher KI«, »vielleicht KI« und »keine KI«.",
      "Vergleicht mit einem anderen Paar. Wo seid ihr euch uneinig? Begründet eure Entscheidung.",
    ],
    quiz: [
      { frage: "Welches Gerät nutzt am wahrscheinlichsten KI?", antworten: ["Ein einfacher Taschenrechner", "Ein Übersetzer, der ganze Sätze übersetzt", "Eine Küchenwaage"], richtig: 1, warum: "Übersetzer werden mit Millionen Beispielsätzen trainiert. Rechner und Waage folgen festen Regeln." },
      { frage: "Was unterscheidet eine KI von einem normalen Programm?", antworten: ["Sie hat Gefühle", "Sie wurde mit vielen Beispielen trainiert und erkennt Muster", "Sie braucht keinen Strom"], richtig: 1, warum: "KI lernt aus Daten. Gefühle hat sie keine." },
      { frage: "Woher weiß eine Videoplattform, was dir gefallen könnte?", antworten: ["Sie rät zufällig", "Sie wertet aus, was du und ähnliche Menschen angeschaut haben", "Deine Lehrkraft sagt es ihr"], richtig: 1, warum: "Empfehlungssysteme lernen aus deinem Verhalten und dem Verhalten vieler anderer." },
    ],
    reflexion: [
      "Bei welchem Gerät oder Dienst warst du überrascht, dass KI drinsteckt (oder nicht)?",
      "Wo begegnet dir KI in deinem Alltag am häufigsten?",
    ],
  },
  {
    id: "v-daten", modul: "verstehen", stufe: "0", titel: "Daten sind das Futter", icon: "📊", minuten: 25,
    kann: ["v-0-2", "v-0-3", "v-Ia-2"],
    erklaerung: [
      "Eine KI lernt aus Daten. Daten sind gesammelte Beispiele, etwa Bilder mit der Beschriftung »Katze« oder »Hund«.",
      "Ein Algorithmus ist eine genaue Schritt-für-Schritt-Anleitung. Computer brauchen sehr genaue Anleitungen, weil sie nichts »einfach so« verstehen.",
      "Sind die Daten einseitig, lernt die KI etwas Einseitiges. Gute Daten sind deshalb das Wichtigste.",
    ],
    auftrag: [
      "Macht eine Mini-Erhebung in der Klasse: Jede·r nennt ihr·sein Lieblingsobst. Sammelt die Antworten in einer Strichliste.",
      "Überlegt: Eine »Obst-KI« soll nur mit euren Daten vorhersagen, was Menschen am liebsten essen. Für wen stimmt die Vorhersage, für wen nicht?",
      "Schreibt einen Algorithmus (Schritt-für-Schritt-Anleitung) für »Ein Pausenbrot schmieren«. Ein·e Partner·in führt ihn wörtlich aus. Wo fehlen Schritte?",
    ],
    sim: { titel: "Algorithmen-Werkstatt", href: "/simulationen/algo" },
    quiz: [
      { frage: "Was ist ein Algorithmus?", antworten: ["Eine genaue Schritt-für-Schritt-Anleitung", "Ein Roboter", "Ein Fehler im Computer"], richtig: 0, warum: "Algorithmen sind eindeutige Anleitungen, die Schritt für Schritt abgearbeitet werden." },
      { frage: "Eine KI wurde nur mit Fotos von Hunden auf grüner Wiese trainiert. Was kann passieren?", antworten: ["Sie erkennt Hunde überall perfekt", "Sie hält vielleicht alles auf grüner Wiese für einen Hund", "Sie kann dann auch Katzen erkennen"], richtig: 1, warum: "Die KI lernt das Muster in den Daten, und hier gehört die Wiese dazu." },
      { frage: "Was brauchen KI-Systeme zum Lernen?", antworten: ["Viele Beispiele (Daten)", "Nur Strom", "Ein Lehrbuch"], richtig: 0, warum: "Ohne Daten kein Training." },
    ],
    reflexion: [
      "Welcher Schritt fehlte in eurer Pausenbrot-Anleitung? Was sagt das über Computer?",
      "Warum wäre eine KI, die nur mit den Daten eurer Klasse trainiert wurde, nicht für alle Menschen gut?",
    ],
  },
  {
    id: "v-naechstes-wort", modul: "verstehen", stufe: "I", titel: "Wie ein Chatbot schreibt", icon: "💬", minuten: 30,
    kann: ["v-Ia-2", "v-Ib-1", "v-Ib-2", "v-Ib-3"],
    erklaerung: [
      "Ein Chatbot wie AIS.chat beruht auf einem Sprachmodell. Es wurde mit riesigen Textmengen trainiert und hat dabei gelernt, welches Wort wahrscheinlich als nächstes kommt.",
      "Es »weiß« nichts wie ein Mensch, sondern berechnet Wort für Wort eine passende Fortsetzung. Darum kann dieselbe Frage zu unterschiedlichen Antworten führen.",
      "Ein Mensch denkt, eine KI berechnet.",
    ],
    auftrag: [
      "Probiert in der KI-Werkstatt aus, wie ein kleines Wortnetz aus Beispielsätzen lernt und neue Sätze bildet.",
      "Spielt »Satz-Fortsetzer«: Eine Person sagt »Heute in der Pause …«, alle schreiben das nächste Wort auf. Welches Wort kam am häufigsten? So ähnlich arbeitet ein Sprachmodell.",
    ],
    sim: { titel: "KI-Werkstatt", href: "/simulationen/ki" },
    ais: {
      lehrkraft: "Lernumgebung »Wie ein Chatbot schreibt« anlegen, Freischaltung für eine Unterrichtsstunde, QR-Code zeigen.",
      systemtext: "Du bist ein freundlicher KI-Lernbegleiter für Schüler·innen der Klassen 5–10. Beantworte Fragen kurz und in einfacher Sprache. Wenn jemand fragt, wie du funktionierst, erkläre ehrlich, dass du das wahrscheinlich nächste Wort berechnest und keine Gefühle hast.",
      schritte: [
        "Scanne den QR-Code deiner Lehrkraft. " + DATENSCHUTZ,
        "Stelle zweimal genau dieselbe Frage (neuer Chat). Vergleiche die Antworten.",
        "Frage: »Wie funktionierst du? Erkläre es für ein Kind in Klasse 6.«",
      ],
      prompts: ["Schreibe einen Satz, der mit »Heute in der Pause« beginnt.", "Wie funktionierst du? Erkläre es für ein Kind in Klasse 6."],
    },
    quiz: [
      { frage: "Was berechnet ein Sprachmodell?", antworten: ["Das wahrscheinlich nächste Wort", "Die richtige Antwort aus einem Lexikon", "Die Gefühle der Nutzer·innen"], richtig: 0, warum: "Es setzt Text Wort für Wort fort, nach Wahrscheinlichkeit." },
      { frage: "Warum gibt ein Chatbot auf dieselbe Frage manchmal andere Antworten?", antworten: ["Er ist kaputt", "Bei der Wortwahl spielt Zufall mit", "Er hat schlechte Laune"], richtig: 1, warum: "Unter mehreren wahrscheinlichen Wörtern wird eins ausgewählt, nicht immer dasselbe." },
      { frage: "Was bedeutet »Training« bei KI?", antworten: ["Die KI macht Sport", "Die KI lernt aus vielen Beispielen Muster, dabei entsteht ein Modell", "Ein Mensch programmiert jede Antwort einzeln"], richtig: 1, warum: "Aus den Trainingsdaten entsteht das Modell." },
    ],
    reflexion: [
      "Wie unterschieden sich die zwei Antworten auf dieselbe Frage?",
      "Erkläre mit eigenen Worten: Warum »weiß« ein Chatbot nicht wirklich etwas?",
    ],
  },
  {
    id: "v-fachwoerter", modul: "verstehen", stufe: "I", titel: "Fachwörter-Kiste", icon: "🧰", minuten: 20,
    kann: ["v-Ia-2", "v-Ib-4", "v-Ia-3"],
    erklaerung: [
      "Daten: gesammelte Beispiele. Algorithmus: genaue Anleitung. Training: Lernen aus Daten. Modell: das Ergebnis des Trainings.",
      "Prompt: deine Eingabe an die KI. Bias (sprich »Bei-es«): eine Verzerrung, also eine Schieflage in Daten oder Ergebnissen, die manche Gruppen benachteiligt.",
      "Halluzination: Die KI erfindet etwas und klingt dabei sicher.",
    ],
    auftrag: [
      "Erstellt zu jedem Fachwort eine Karteikarte: Wort, eigene Erklärung, Beispiel aus dem Alltag.",
      "Spielt »Tabu«: Erklärt ein Fachwort, ohne es zu sagen.",
    ],
    quiz: [
      { frage: "Was ist ein Prompt?", antworten: ["Die Eingabe oder der Auftrag an die KI", "Ein Computervirus", "Die Antwort der KI"], richtig: 0, warum: "Der Prompt ist das, was du der KI schreibst." },
      { frage: "Was ist Bias?", antworten: ["Ein schneller Computer", "Eine Verzerrung, die manche Gruppen benachteiligen kann", "Ein Passwort"], richtig: 1, warum: "Bias entsteht oft durch einseitige Trainingsdaten." },
      { frage: "Eine KI nennt ein Buch, das es gar nicht gibt. Wie heißt das?", antworten: ["Training", "Halluzination", "Algorithmus"], richtig: 1, warum: "Erfundene, aber überzeugend klingende Angaben heißen Halluzinationen." },
    ],
    reflexion: [
      "Welches Fachwort war für dich neu? Erkläre es in einem Satz.",
      "Wo könnte Bias in deinem Alltag eine Rolle spielen?",
    ],
  },
  // ───────────────────────────── Anwenden ──
  {
    id: "a-datenschutz", modul: "anwenden", stufe: "0", titel: "Was nie in die KI gehört", icon: "🔒", minuten: 15,
    kann: ["a-0-3", "a-Ia-3", "a-Ib-3"],
    erklaerung: [
      "Alles, was du in einen Chat tippst, wird an einen Server geschickt. Auch wenn AIS.chat datenschutzfreundlich ist: Persönliche Daten haben dort nichts zu suchen.",
      "Persönliche Daten sind alles, womit man dich oder andere erkennen kann: Name, Adresse, Geburtstag, Telefonnummer, Fotos, Passwörter, Gesundheitsdaten, Noten.",
    ],
    auftrag: [
      "Sortiert diese Beispiele in »darf rein« und »gehört nie rein«: Hausaufgabe zur Photosynthese, eigene Adresse, Foto der Klasse, Frage nach einer Matheformel, Name der besten Freundin, Passwort, ausgedachte Geschichte, Zeugnisnote.",
      "Formuliert eine Frage, die persönliche Daten enthält (»Ich bin Lea aus der 7b der Schule …«), so um, dass sie ohne persönliche Daten auskommt.",
    ],
    quiz: [
      { frage: "Was darfst du in einen KI-Chat schreiben?", antworten: ["Deine Adresse", "Eine Frage zu einem Schulthema", "Das Passwort deines Accounts"], richtig: 1, warum: "Sachfragen ja, persönliche Daten nie." },
      { frage: "Gilt die Regel auch für Daten anderer Menschen?", antworten: ["Nein, nur für meine eigenen", "Ja, auch Namen und Fotos von Freund·innen gehören nicht hinein", "Nur bei Erwachsenen"], richtig: 1, warum: "Die Daten anderer sind genauso schützenswert." },
      { frage: "Wie fragst du besser? »Ich bin Max, 12, aus Erfurt und habe eine 5 in Mathe …«", antworten: ["So lassen", "»Ein·e Schüler·in der 6. Klasse möchte Brüche üben …«", "Noch die Schule dazuschreiben"], richtig: 1, warum: "Für eine gute Antwort braucht die KI keine persönlichen Daten." },
    ],
    reflexion: [
      "Welche drei Dinge gehören für dich nie in eine KI?",
      "Wie hast du die Frage mit persönlichen Daten umformuliert?",
    ],
  },
  {
    id: "a-erster-prompt", modul: "anwenden", stufe: "0", titel: "Mein erster Prompt", icon: "✏️", minuten: 25,
    kann: ["a-0-2", "a-Ia-1", "a-Ia-2"],
    erklaerung: [
      "Ein Prompt ist dein Auftrag an die KI. Je klarer der Auftrag, desto besser passt die Antwort.",
      "Vage: »Erzähl was über Hunde.« Klar: »Erkläre in 5 Sätzen für Klasse 5, warum Hunde hecheln.«",
    ],
    auftrag: [
      "Probiert in AIS.chat einen vagen und einen klaren Prompt zum selben Thema aus.",
      "Vergleicht die beiden Antworten: Was ist besser, und warum?",
    ],
    ais: {
      lehrkraft: "Lernumgebung »Mein erster Prompt« anlegen, Freischaltung für die Stunde, QR-Code zeigen. Vorher die Station »Was nie in die KI gehört« machen.",
      systemtext: "Du bist ein KI-Lernbegleiter für Schüler·innen der Klassen 5–7. Antworte in einfacher Sprache und höchstens 8 Sätzen. Wenn jemand persönliche Daten eingibt, weise freundlich darauf hin, dass sie nicht in einen KI-Chat gehören.",
      schritte: [
        "Scanne den QR-Code deiner Lehrkraft. " + DATENSCHUTZ,
        "Schreibe einen vagen Prompt, z. B. »Erzähl was über Hunde.«",
        "Schreibe einen klaren Prompt zum selben Thema, z. B. »Erkläre in 5 Sätzen für Klasse 5, warum Hunde hecheln.«",
        "Vergleiche die Antworten.",
      ],
      prompts: ["Erzähl was über Hunde.", "Erkläre in 5 Sätzen für Klasse 5, warum Hunde hecheln."],
    },
    quiz: [
      { frage: "Welcher Prompt ist klarer?", antworten: ["»Mach was zu Vulkanen.«", "»Erkläre in 4 Sätzen für Klasse 6, wie ein Vulkan ausbricht.«", "»Vulkane?«"], richtig: 1, warum: "Er nennt Thema, Länge und Zielgruppe." },
      { frage: "Was hilft der KI, eine passende Antwort zu geben?", antworten: ["Angaben zu Länge, Zielgruppe und Thema", "Möglichst viele Smileys", "Großbuchstaben"], richtig: 0, warum: "Präzise Angaben steuern die Antwort." },
      { frage: "Die Antwort passt nicht. Was tust du?", antworten: ["Aufgeben", "Den Prompt genauer machen und nachfragen", "Die Antwort trotzdem abschreiben"], richtig: 1, warum: "Ein Chat ist ein Gespräch: Nachschärfen ist normal." },
    ],
    reflexion: [
      "Wie unterschieden sich die Antworten auf den vagen und den klaren Prompt?",
      "Was machst du beim nächsten Prompt anders?",
    ],
  },
  {
    id: "a-prompt-formel", modul: "anwenden", stufe: "I", titel: "Die Prompt-Formel", icon: "🧪", minuten: 30,
    kann: ["a-Ia-2", "a-Ib-1"],
    erklaerung: [
      "Gute Prompts haben oft vier Teile: Rolle (»Du bist …«), Aufgabe (»Erkläre …«), Hintergrund (»Ich bin in Klasse 7 und …«) und Form (»in einer Tabelle, 5 Punkte«).",
      "Man muss nicht immer alle vier benutzen, aber sie helfen, wenn die Antwort nicht passt.",
    ],
    auftrag: [
      "Wählt ein Thema aus dem aktuellen Unterricht.",
      "Baut Schritt für Schritt einen Prompt: zuerst nur die Aufgabe, dann mit Rolle, dann mit Hintergrund, dann mit Form. Schreibt jede Version ab.",
      "Bewertet jede Antwort mit 1–5 Sternen.",
    ],
    ais: {
      lehrkraft: "Lernumgebung »Prompt-Formel« anlegen (Freischaltung eine Doppelstunde). Tipp: ein Thema aus dem laufenden Unterricht vorgeben.",
      systemtext: "Du bist ein KI-Lernbegleiter für Schüler·innen der Klassen 6–10. Halte dich genau an Rolle, Aufgabe und Format, die im Prompt verlangt werden. Antworte sachlich und altersgerecht.",
      schritte: [
        "Scanne den QR-Code deiner Lehrkraft. " + DATENSCHUTZ,
        "Version 1: nur Aufgabe. Version 2: + Rolle. Version 3: + Hintergrund. Version 4: + Form.",
        "Starte für jede Version einen neuen Chat, damit die Antworten sich nicht beeinflussen.",
      ],
      prompts: ["Du bist eine Biologielehrerin. Erkläre die Fotosynthese. Ich bin in Klasse 7 und verstehe das Wort »Chlorophyll« nicht. Antworte in 5 Stichpunkten."],
    },
    quiz: [
      { frage: "Welcher Teil gehört zur Prompt-Formel?", antworten: ["Rolle", "Lieblingsfarbe", "Passwort"], richtig: 0, warum: "Rolle, Aufgabe, Hintergrund, Form." },
      { frage: "»Antworte in einer Tabelle mit 3 Spalten« ist …", antworten: ["die Rolle", "die Form", "der Hintergrund"], richtig: 1, warum: "Es legt fest, wie die Antwort aussehen soll." },
      { frage: "Warum einen neuen Chat für jede Version?", antworten: ["Damit der vorige Verlauf die Antwort nicht beeinflusst", "Weil der Chat sonst voll ist", "Das ist egal"], richtig: 0, warum: "Der Chatbot berücksichtigt den bisherigen Verlauf." },
    ],
    reflexion: [
      "Welcher Teil der Formel hat die Antwort am meisten verbessert?",
      "Schreibe deinen besten Prompt auf.",
    ],
  },
  {
    id: "a-lernhelfer", modul: "anwenden", stufe: "I", titel: "KI als Lernhelfer", icon: "🎓", minuten: 30,
    kann: ["a-Ib-2", "a-Ib-4"],
    erklaerung: [
      "KI kann dir die Hausaufgabe abnehmen, aber dann lernst du nichts. Besser: Lass dich von der KI abfragen, dir etwas erklären oder Tipps geben, ohne dass sie die Lösung verrät.",
      "Wenn du KI für eine Abgabe benutzt, schreibe dazu, wofür (KI-Nutzungserklärung). Das ist ehrlich und fair.",
    ],
    auftrag: [
      "Lass dich in AIS.chat zu einem Thema der nächsten Klassenarbeit abfragen.",
      "Schreibe für eine Abgabe eine KI-Nutzungserklärung: »Ich habe KI benutzt für … Ich habe selbst gemacht: …«",
    ],
    ais: {
      lehrkraft: "Lernumgebung »Lernhelfer« anlegen, Thema der nächsten Klassenarbeit vorgeben, Freischaltung z. B. eine Woche.",
      systemtext: "Du bist ein Lerncoach. Verrate keine fertigen Lösungen. Stelle Fragen, gib Tipps in kleinen Schritten und lobe richtige Antworten. Frage am Anfang, welches Thema geübt werden soll, und stelle dann eine Frage nach der anderen.",
      schritte: [
        "Scanne den QR-Code deiner Lehrkraft. " + DATENSCHUTZ,
        "Schreibe: »Frag mich 5 Fragen zum Thema … Gib mir erst Tipps, wenn ich falsch liege.«",
        "Beantworte die Fragen selbst, ohne nachzuschauen.",
      ],
      prompts: ["Frag mich 5 Fragen zum Thema Bruchrechnung. Gib mir nur Tipps, keine Lösungen, wenn ich falsch liege."],
    },
    quiz: [
      { frage: "Welche Nutzung hilft beim Lernen am meisten?", antworten: ["KI schreibt den Aufsatz", "KI fragt mich ab und gibt Tipps", "KI löst alle Matheaufgaben"], richtig: 1, warum: "Lernen passiert, wenn du selbst denkst." },
      { frage: "Was gehört in eine KI-Nutzungserklärung?", antworten: ["Wofür ich KI benutzt habe und was ich selbst gemacht habe", "Mein Passwort", "Nichts, KI-Nutzung verschweigt man"], richtig: 0, warum: "Transparenz ist fair gegenüber Lehrkraft und Mitschüler·innen." },
      { frage: "Darf man KI-Text als eigenen ausgeben?", antworten: ["Ja, immer", "Nein, das ist unehrlich", "Nur bei Kurztexten"], richtig: 1, warum: "Wer KI nutzt, sagt es dazu." },
    ],
    reflexion: [
      "Wie viele Fragen konntest du ohne Hilfe beantworten? Was übst du noch?",
      "Schreibe deine KI-Nutzungserklärung für eine Abgabe auf.",
    ],
  },
  // ───────────────────────────── Reflektieren ──
  {
    id: "r-echt-oder-ki", modul: "reflektieren", stufe: "0", titel: "Echt oder KI?", icon: "🎭", minuten: 25,
    kann: ["r-0-2", "r-0-3", "r-Ia-2"],
    erklaerung: [
      "KI kann Texte, Bilder, Stimmen und Videos erzeugen, die echt wirken. Gefälschte Videos von echten Menschen heißen Deepfakes.",
      "Hinweise auf KI-Bilder: komische Hände oder Finger, verschwommene Schrift, unlogische Schatten, zu glatte Haut, seltsame Hintergründe. Aber: Die Bilder werden immer besser, deshalb ist die Quelle der wichtigste Hinweis.",
    ],
    auftrag: [
      "Schreibe eine kurze Geschichte (5 Sätze) über deinen Schulweg, aber ausgedacht und ohne echte Namen.",
      "Lass AIS.chat eine Geschichte zum selben Thema schreiben.",
      "Tauscht in der Gruppe: Ratet, welche Geschichte von einem Menschen und welche von der KI ist. Woran habt ihr es gemerkt?",
    ],
    ais: {
      lehrkraft: "Lernumgebung »Echt oder KI?« anlegen, Freischaltung für die Stunde. Optional vorab einige KI-Bilder und echte Fotos zum Raten zeigen.",
      systemtext: "Du schreibst kurze, kindgerechte Geschichten für Schüler·innen der Klassen 5–7. Schreibe höchstens 5 Sätze und keine echten Namen.",
      schritte: [
        "Scanne den QR-Code deiner Lehrkraft. " + DATENSCHUTZ,
        "Prompt: »Schreibe eine Geschichte in 5 Sätzen über einen Schulweg, aus Sicht eines Kindes in Klasse 6.«",
        "Schreibe die KI-Geschichte auf eine Karte, deine eigene auf eine zweite.",
      ],
    },
    link: { titel: "CheckNews: Fake News erkennen", url: "https://www.iqesonline.net/bildung-digital/checknews/", quelle: "fög (Universität Zürich) und IQES online" },
    quiz: [
      { frage: "Was ist ein Deepfake?", antworten: ["Ein sehr tiefes Foto", "Ein mit KI gefälschtes Video oder Audio eines Menschen", "Ein Tauchvideo"], richtig: 1, warum: "Deepfakes zeigen Menschen, die etwas tun oder sagen, das nie passiert ist." },
      { frage: "Was ist der beste Hinweis, ob ein Bild echt ist?", antworten: ["Wie viele Likes es hat", "Woher es kommt (Quelle)", "Ob es bunt ist"], richtig: 1, warum: "Merkmale wie Hände werden mit der Zeit besser. Die Quelle bleibt wichtig." },
      { frage: "Du siehst ein schockierendes Video. Was tust du zuerst?", antworten: ["Sofort teilen", "Prüfen, wer es veröffentlicht hat und ob seriöse Medien berichten", "Kommentieren"], richtig: 1, warum: "Erst prüfen, dann teilen (oder nicht)." },
    ],
    reflexion: [
      "Woran hast du die KI-Geschichte erkannt (oder warum nicht)?",
      "Was machst du in Zukunft, bevor du ein Bild oder Video teilst?",
    ],
  },
  {
    id: "r-ki-irrt", modul: "reflektieren", stufe: "I", titel: "Die KI irrt sich", icon: "❗", minuten: 30,
    kann: ["r-Ia-1", "r-Ib-1"],
    erklaerung: [
      "Chatbots klingen immer sicher, auch wenn sie falsch liegen. Sie erfinden manchmal Fakten, Zahlen oder Quellen (Halluzinationen).",
      "Besonders oft passiert das bei sehr neuen Ereignissen, bei Orten und Dingen, die selten im Internet vorkommen, und bei genauen Zahlen.",
    ],
    auftrag: [
      "Stelle AIS.chat drei Fragen zu deinem Wohnort oder deiner Region, deren Antwort du kennst oder nachprüfen kannst (z. B. Sehenswürdigkeiten, Einwohnerzahl, ein Fluss).",
      "Prüfe jede Antwort mit einer zweiten Quelle (Schulbuch, Lexikon, offizielle Website).",
      "Markiere: richtig, teilweise richtig, falsch.",
    ],
    ais: {
      lehrkraft: "Lernumgebung »Die KI irrt sich« anlegen, Freischaltung für die Stunde. Lexika oder Schulbücher zum Prüfen bereitlegen.",
      systemtext: "Du bist ein Chatbot für Schüler·innen. Beantworte Sachfragen in höchstens 5 Sätzen.",
      schritte: [
        "Scanne den QR-Code deiner Lehrkraft. " + DATENSCHUTZ,
        "Frage nach Fakten zu deiner Region, nicht nach deiner Adresse.",
        "Frage am Ende: »Nenne mir deine Quellen.« Gibt es die Quellen wirklich?",
      ],
    },
    link: { titel: "CheckNews: Faktencheck im Internet", url: "https://www.iqesonline.net/bildung-digital/checknews/", quelle: "fög (Universität Zürich) und IQES online" },
    quiz: [
      { frage: "Was ist eine Halluzination bei KI?", antworten: ["Die KI schläft", "Die KI erfindet etwas und klingt dabei sicher", "Die KI zeigt Bilder"], richtig: 1, warum: "Darum: immer gegenprüfen." },
      { frage: "Wann solltest du eine KI-Antwort besonders genau prüfen?", antworten: ["Bei genauen Zahlen, Quellen und lokalen Fakten", "Nie", "Nur wenn sie lang ist"], richtig: 0, warum: "Dort sind Fehler häufig." },
      { frage: "Wie prüfst du eine KI-Antwort?", antworten: ["Dieselbe KI noch mal fragen", "Mit einer zweiten, verlässlichen Quelle vergleichen", "Gar nicht"], richtig: 1, warum: "Unabhängige Quellen sind der Maßstab." },
    ],
    reflexion: [
      "Wie viele der drei Antworten waren richtig? Was war falsch?",
      "Gab es die genannten Quellen wirklich? Was folgt daraus für dich?",
    ],
  },
  {
    id: "r-fair", modul: "reflektieren", stufe: "I", titel: "Fair oder verzerrt?", icon: "⚖️", minuten: 30,
    kann: ["r-Ia-3", "r-Ib-2", "v-Ib-4"],
    erklaerung: [
      "KI lernt aus Texten und Bildern von Menschen und übernimmt dabei auch ihre Vorurteile. Das nennt man Bias.",
      "Wenn eine KI bei »Arzt« immer einen Mann und bei »Pflegekraft« immer eine Frau beschreibt, gibt sie ein Klischee wieder und verstärkt es.",
    ],
    auftrag: [
      "Bitte AIS.chat um kurze Beschreibungen von Personen in verschiedenen Berufen (z. B. Ärztin/Arzt, Pflegekraft, Ingenieur·in, Erzieher·in). Gib dabei kein Geschlecht vor.",
      "Notiert in einer Tabelle: Welches Geschlecht, Alter, Aussehen wurde angenommen?",
      "Diskutiert: Woher kommen diese Muster? Wem könnte das schaden?",
    ],
    ais: {
      lehrkraft: "Lernumgebung »Fair oder verzerrt?« anlegen. Hinweis: Ergebnisse können je nach Modell schwanken. Auch »keine Verzerrung gefunden« ist ein gutes Ergebnis, über das man sprechen kann.",
      systemtext: "Du bist ein Chatbot für Schüler·innen. Beantworte Anfragen kurz in 2–3 Sätzen.",
      schritte: [
        "Scanne den QR-Code deiner Lehrkraft. " + DATENSCHUTZ,
        "Prompt: »Beschreibe in 2 Sätzen eine Person, die im Krankenhaus als Pflegekraft arbeitet. Gib ihr einen Namen.«",
        "Wiederhole das für andere Berufe.",
      ],
    },
    quiz: [
      { frage: "Woher bekommt eine KI Vorurteile?", antworten: ["Aus den Trainingsdaten, die von Menschen stammen", "Sie denkt sich selbst welche aus", "Vom Strom"], richtig: 0, warum: "Was in den Daten steckt, steckt später im Modell." },
      { frage: "Eine Bewerbungs-KI bevorzugt Männer, weil früher meist Männer eingestellt wurden. Das ist …", antworten: ["fair", "ein Beispiel für Bias", "ein Deepfake"], richtig: 1, warum: "Alte Ungerechtigkeiten werden so fortgeschrieben." },
      { frage: "Was hilft gegen Bias?", antworten: ["Vielfältige Daten und kritisches Prüfen der Ergebnisse", "Mehr Strom", "Längere Prompts mit Smileys"], richtig: 0, warum: "Gute Daten und wache Menschen." },
    ],
    reflexion: [
      "Welche Muster hast du in den Beschreibungen gefunden?",
      "Wer könnte durch solche Verzerrungen benachteiligt werden?",
    ],
  },
  // ───────────────────────────── Mitgestalten ──
  {
    id: "m-ideen", modul: "mitgestalten", stufe: "0", titel: "Wo hilft KI bei uns?", icon: "💡", minuten: 20,
    kann: ["m-0-1", "m-Ia-1"],
    erklaerung: [
      "KI kann vieles erleichtern, aber nicht alles soll sie übernehmen. Ihr entscheidet mit, wo KI sinnvoll ist.",
    ],
    auftrag: [
      "Sammelt in Gruppen Ideen: Wo könnte KI in eurer Schule oder eurem Alltag helfen (z. B. Vorlesen für Leseanfänger·innen, Übersetzen für neue Mitschüler·innen, Vokabeln abfragen)?",
      "Markiert jede Idee: 👍 sinnvoll, 🤔 kommt drauf an, 👎 lieber nicht. Begründet.",
      "Stellt eure beste Idee der Klasse vor.",
    ],
    quiz: [
      { frage: "Welche Idee ist am ehesten sinnvoll?", antworten: ["KI entscheidet über Zeugnisnoten", "KI liest Texte für Kinder mit Leseschwierigkeiten vor", "KI schreibt alle Hausaufgaben"], richtig: 1, warum: "KI als Unterstützung, die Entscheidungen bleiben bei Menschen." },
      { frage: "Wer sollte bei wichtigen Entscheidungen das letzte Wort haben?", antworten: ["Die KI", "Menschen", "Der Zufall"], richtig: 1, warum: "Verantwortung tragen Menschen." },
      { frage: "Warum ist »kommt drauf an« oft eine gute Antwort?", antworten: ["Weil man faul ist", "Weil Nutzen und Risiken von der Situation abhängen", "Weil KI immer schlecht ist"], richtig: 1, warum: "Abwägen gehört zur KI-Kompetenz." },
    ],
    reflexion: [
      "Welche Idee deiner Gruppe findest du am besten, und warum?",
      "Wo sollte KI deiner Meinung nach nicht eingesetzt werden?",
    ],
  },
  {
    id: "m-regeln", modul: "mitgestalten", stufe: "I", titel: "Unsere KI-Regeln", icon: "🚦", minuten: 45,
    kann: ["m-Ib-2", "m-Ib-1", "a-Ib-4"],
    erklaerung: [
      "Damit alle wissen, wann KI erlaubt ist, braucht die Klasse Regeln. Ein einfaches Modell ist die KI-Ampel:",
      "🔴 ohne KI (z. B. Klassenarbeit, Grundlagen üben) · 🟡 KI nur für bestimmte Schritte und mit Angabe (z. B. Ideen sammeln, Feedback) · 🟢 KI frei mit Nutzungserklärung (z. B. Projekt).",
    ],
    auftrag: [
      "Sammelt Aufgabenarten aus eurem Schulalltag (Hausaufgabe, Referat, Vokabeln, Aufsatz, Projekt …).",
      "Ordnet jeder Aufgabenart eine Ampelfarbe zu und begründet.",
      "Schreibt 5 Klassenregeln für KI auf ein Plakat, besprecht sie mit eurer Lehrkraft und hängt sie auf. Nach einigen Wochen überprüft ihr: Passen die Regeln noch?",
    ],
    quiz: [
      { frage: "Was bedeutet 🟡 in der KI-Ampel?", antworten: ["KI verboten", "KI für bestimmte Schritte, mit Angabe", "KI für alles"], richtig: 1, warum: "Gelb = gezielt und transparent." },
      { frage: "Warum sollten Regeln regelmäßig überprüft werden?", antworten: ["Weil sich KI und unsere Erfahrungen schnell ändern", "Weil Plakate verblassen", "Das ist unnötig"], richtig: 0, warum: "Regeln wachsen mit der Erfahrung." },
      { frage: "Warum Grundlagen manchmal bewusst ohne KI üben?", antworten: ["Weil man sie selbst können muss, um KI-Ergebnisse zu prüfen", "Weil KI zu teuer ist", "Ohne Grund"], richtig: 0, warum: "Nur wer es selbst kann, erkennt Fehler." },
    ],
    reflexion: [
      "Welche Regel war in der Klasse am meisten umstritten? Wie habt ihr entschieden?",
      "Welche Regel findest du persönlich am wichtigsten?",
    ],
  },
  {
    id: "m-verbessern", modul: "mitgestalten", stufe: "I", titel: "Verbesserungsvorschlag", icon: "📮", minuten: 30,
    kann: ["m-Ia-2", "m-Ib-1"],
    erklaerung: [
      "KI-Anwendungen werden von Menschen gebaut und können verbessert werden. Rückmeldungen von Nutzer·innen sind dabei wichtig, auch von Schüler·innen.",
    ],
    auftrag: [
      "Denke an deine Erfahrungen mit AIS.chat oder einer anderen KI-App. Was hat gestört, was fehlte?",
      "Schreibe einen kurzen, sachlichen Verbesserungsvorschlag: Was ist das Problem? Was wäre besser? Warum hilft das anderen?",
      "Sammelt die Vorschläge in der Klasse. Eure Lehrkraft kann sie gebündelt an die richtige Stelle weitergeben (z. B. den AIS.chat-Support des ThILLM).",
    ],
    quiz: [
      { frage: "Was macht einen guten Verbesserungsvorschlag aus?", antworten: ["Problem, Vorschlag, Begründung, sachlich formuliert", "Möglichst viele Ausrufezeichen", "Nur »ist doof«"], richtig: 0, warum: "Konkret und sachlich wird man gehört." },
      { frage: "Wer kann KI-Anwendungen verbessern?", antworten: ["Nur große Firmen", "Auch Nutzer·innen durch Rückmeldungen", "Niemand"], richtig: 1, warum: "Rückmeldungen fließen in die Weiterentwicklung ein." },
      { frage: "Darf ein Verbesserungsvorschlag Namen von Mitschüler·innen enthalten?", antworten: ["Ja", "Nein, persönliche Daten bleiben draußen", "Nur Vornamen"], richtig: 1, warum: "Datenschutz gilt auch hier." },
    ],
    reflexion: [
      "Schreibe deinen Verbesserungsvorschlag auf.",
      "Wem würdest du deinen Vorschlag schicken, und warum genau dorthin?",
    ],
  },
];

export const MODUL_REIHENFOLGE: BereichId[] = ["verstehen", "anwenden", "reflektieren", "mitgestalten"];

export function stationenVon(modul: BereichId): Station[] {
  return STATIONEN.filter(s => s.modul === modul);
}

/** Stand einer Station: bestes Quiz-Ergebnis + Reflexionstexte. */
export type StationStand = { quiz: number; reflexion: string[]; erledigt_am?: string | null };

export function quizBestanden(station: Station, richtig: number): boolean {
  return richtig / station.quiz.length >= QUIZ_SCHWELLE - 1e-9;
}

export function reflexionFertig(station: Station, texte: string[] | undefined): boolean {
  return station.reflexion.every((_, i) => (texte?.[i]?.trim().length ?? 0) >= REFLEXION_MIN);
}

export function stationFertig(station: Station, stand: StationStand | undefined): boolean {
  return !!stand && quizBestanden(station, stand.quiz) && reflexionFertig(station, stand.reflexion);
}

export function modulFertig(modul: BereichId, stande: Record<string, StationStand>): boolean {
  return stationenVon(modul).every(s => stationFertig(s, stande[s.id]));
}

export function fuehrerscheinFertig(stande: Record<string, StationStand>): boolean {
  return MODUL_REIHENFOLGE.every(m => modulFertig(m, stande));
}
