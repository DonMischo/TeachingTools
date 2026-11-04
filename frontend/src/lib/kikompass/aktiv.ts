/**
 * Der Weg der Lehrkräfte: Phasen nach dem AKTIV(ER)-Framework.
 *
 * Struktur und Phasennamen nach Manuel Flick, »Das AKTIV-Framework: KI
 * souverän in Schule und Unterricht integrieren«
 * (https://www.manuelflick.de/blog/aktiv-framework). Der Beitrag ist nicht
 * offen lizenziert. Alle Texte hier sind deshalb eigene Formulierungen, und
 * nur die Gliederung wird übernommen.
 */
import type { DocxBlock } from "@/lib/docx";

export type PhaseId = "analyse" | "A" | "K" | "T" | "I" | "V" | "E" | "R";

export type VorlageId =
  | "regeln" | "elternbrief" | "nutzung" | "gespraech" | "bewertung" | "umfrage" | "mini-fortbildung";

export type Phase = {
  id: PhaseId;
  buchstabe: string;
  titel: string;
  ziel: string;
  /** Schule statt eigener Unterricht. */
  schule: string;
  checkliste: string[];
  vorlagen: VorlageId[];
  /** Werkzeug im KI-Kompass, das hier hilft. */
  werkzeug?: { titel: string; ziel: "raster" | "fuehrerschein" | "werkstatt" | "umbau" | "pruefen" | "projekte" | "uebersicht" };
};

export const PHASEN: Phase[] = [
  {
    id: "analyse", buchstabe: "0", titel: "Ausgangslage klären",
    ziel: "Wissen, wo man selbst, die Klasse und das Kollegium stehen, bevor man plant.",
    schule: "Ist-Stand im Kollegium erheben: Wer nutzt was? Welche Geräte, Zugänge (AIS.chat), Sorgen und Wünsche gibt es?",
    checkliste: [
      "Ich habe mich selbst im Kompetenzraster eingeschätzt und einen Messpunkt gespeichert.",
      "Meine Klasse hat sich eingeschätzt (Code »Zum Mitmachen«).",
      "Ich weiß, ob mein AIS.chat-Zugang im Schulportal funktioniert.",
      "Ich habe ein bis zwei Ziele für dieses Halbjahr notiert.",
    ],
    vorlagen: ["umfrage"],
    werkzeug: { titel: "Kompetenzraster", ziel: "raster" },
  },
  {
    id: "A", buchstabe: "A", titel: "Ausprobieren & Anwenden",
    ziel: "Eigene Erfahrung sammeln. Wer KI selbst ausprobiert hat, kann Schüler·innen begleiten. Als Richtwert gelten etwa zehn Stunden eigene Nutzung.",
    schule: "Kurze Fortbildungshäppchen (15–30 min), ein datenschutzkonformer Zugang für alle, erste Pilotklassen.",
    checkliste: [
      "Ich habe die Stationen des KI-Führerscheins selbst durchgespielt.",
      "Ich habe AIS.chat für eine echte Unterrichtsvorbereitung genutzt (z. B. Differenzierung, Beispiele, Feedback).",
      "Ich habe erlebt, dass die KI sich irrt, und weiß, wie ich prüfe.",
      "Ich kenne die Datenschutzregeln: keine personenbezogenen Daten eingeben.",
    ],
    vorlagen: ["mini-fortbildung"],
    werkzeug: { titel: "KI-Führerschein (selbst machen)", ziel: "fuehrerschein" },
  },
  {
    id: "K", buchstabe: "K", titel: "Kommunizieren & Klarheit schaffen",
    ziel: "Offen über KI reden, mit der Klasse, im Kollegium, mit Eltern, und gemeinsame Regeln vereinbaren. Gespräch statt Pauschalverbot. KI-Detektoren sind kein Beweis.",
    schule: "KI-Sprechstunde, Thema in Fachschaften, Eltern- und Schülervertretung einbinden, schulweite Grundregeln.",
    checkliste: [
      "Ich habe mit der Klasse darüber gesprochen, wie sie KI schon nutzt.",
      "Wir haben Klassenregeln (KI-Ampel) vereinbart und einen Termin zum Überprüfen festgelegt.",
      "Die Eltern sind über AIS.chat informiert.",
      "Die Klasse kennt die KI-Nutzungserklärung.",
    ],
    vorlagen: ["gespraech", "regeln", "elternbrief", "nutzung"],
    werkzeug: { titel: "Station »Unsere KI-Regeln«", ziel: "fuehrerschein" },
  },
  {
    id: "T", buchstabe: "T", titel: "Transformieren von Lernprozessen",
    ziel: "Aufgaben bewusst planen: Lernen mit, über, durch, trotz oder ohne KI. Mal punktuell, mal durchgehend mit KI, und Grundlagen begründet ohne KI.",
    schule: "Fachschaften bei der Aufgabenentwicklung unterstützen, Mediencurriculum um KI-Kompetenzen ergänzen.",
    checkliste: [
      "Ich habe eine bestehende Aufgabe mit dem Aufgaben-Umbauer überarbeitet.",
      "Ich weiß für jede Aufgabe, welche der fünf Dimensionen sie bedient.",
      "Wenn ich KI ausschließe, begründe ich es der Klasse.",
      "Hausaufgaben sind KI-resilienter (persönlicher Bezug, Medienwechsel, Reflexion).",
    ],
    vorlagen: [],
    werkzeug: { titel: "Aufgaben-Umbauer", ziel: "umbau" },
  },
  {
    id: "I", buchstabe: "I", titel: "Integrativ prüfen & bewerten",
    ziel: "Prüfungen weiterentwickeln: ohne, punktuell oder durchgehend mit KI. Den Prozess und die Reflexion des KI-Einsatzes mitbewerten.",
    schule: "Gemeinsame Prüfungskultur, angepasste Bewertungskriterien, alternative Leistungsnachweise (Portfolio, Projekt).",
    checkliste: [
      "Ich weiß für jede Leistung, ob sie unter Aufsicht oder zu Hause entsteht.",
      "Zu Hause entstandene Arbeiten haben einen KI-resilienten Teil (z. B. mündliche Rückfrage).",
      "Die KI-Reflexion ist Teil der Bewertung (Bewertungsbogen).",
      "Mein Erwartungshorizont nennt klare Operatoren.",
    ],
    vorlagen: ["bewertung", "nutzung"],
    werkzeug: { titel: "Prüfungsformat & Erwartungshorizont", ziel: "pruefen" },
  },
  {
    id: "V", buchstabe: "V", titel: "Verändern & Mitgestalten",
    ziel: "Über den eigenen Unterricht hinaus wirken: Erfahrungen teilen, Projekte anstoßen, an Leitlinien mitarbeiten.",
    schule: "KI-Gruppe oder AG, Multiplikator·innen, Ergebnisse sichtbar machen, im Schulprogramm und Medienkonzept verankern.",
    checkliste: [
      "Ich habe Material oder Erfahrungen mit Kolleg·innen geteilt.",
      "Meine Klasse hat ein KI-Projekt (Stufe II) durchgeführt.",
      "Ich bringe mich bei den Schulregeln oder beim Medienkonzept ein.",
    ],
    vorlagen: ["mini-fortbildung"],
    werkzeug: { titel: "Projektkarten", ziel: "projekte" },
  },
  {
    id: "E", buchstabe: "E", titel: "Evaluieren",
    ziel: "Prüfen, was sich verändert hat: neuer Messpunkt im Raster, Rückmeldung der Klasse.",
    schule: "Kurze Umfrage im Kollegium und in den Klassen, Ergebnisse gemeinsam auswerten.",
    checkliste: [
      "Ich habe einen neuen Messpunkt gespeichert und mit dem ersten verglichen.",
      "Die Klasse hat einen neuen Messpunkt gesetzt (Klassen-Spinne vorher/nachher).",
      "Ich habe Rückmeldung der Klasse eingeholt.",
    ],
    vorlagen: ["umfrage"],
    werkzeug: { titel: "Klassenübersicht", ziel: "uebersicht" },
  },
  {
    id: "R", buchstabe: "R", titel: "Rückschlüsse & Redesign",
    ziel: "Aus der Auswertung lernen: Ziele, Regeln und Material anpassen. Dann beginnt die nächste Runde.",
    schule: "Ziele und Maßnahmen nachjustieren, Fortbildungsbedarf neu erheben, Leitbild anpassen.",
    checkliste: [
      "Ich habe die Klassenregeln mit der Klasse überprüft und angepasst.",
      "Ich habe neue Ziele für das nächste Halbjahr notiert.",
      "Ich weiß, was ich als Nächstes lernen will (nächste Stufe im Raster).",
    ],
    vorlagen: ["regeln"],
    werkzeug: { titel: "Kompetenzraster", ziel: "raster" },
  },
];

export const VORLAGEN: Record<VorlageId, { titel: string; bloecke: () => DocxBlock[] }> = {
  regeln: {
    titel: "KI-Klassenregeln (Ampel)",
    bloecke: () => [
      { art: "titel", text: "Unsere KI-Regeln" },
      { art: "text", text: "Klasse: ________   Vereinbart am: ________   Überprüfen am: ________" },
      { art: "ueberschrift", text: "🔴 Ohne KI" },
      { art: "text", text: "Zum Beispiel: Klassenarbeiten, Grundlagen üben (Einmaleins, Rechtschreibung, Vokabeln lernen)." },
      { art: "linie", text: "Bei uns:" },
      { art: "ueberschrift", text: "🟡 KI für bestimmte Schritte, mit Angabe" },
      { art: "text", text: "Zum Beispiel: Ideen sammeln, Feedback zum eigenen Text, sich abfragen lassen." },
      { art: "linie", text: "Bei uns:" },
      { art: "ueberschrift", text: "🟢 KI frei, mit Nutzungserklärung" },
      { art: "text", text: "Zum Beispiel: Projekte, Recherche mit Faktencheck, Präsentationen." },
      { art: "linie", text: "Bei uns:" },
      { art: "ueberschrift", text: "Immer gilt" },
      { art: "text", text: "1. Keine persönlichen Daten in die KI, weder eigene noch fremde." },
      { art: "text", text: "2. KI-Antworten prüfen wir mit einer zweiten Quelle." },
      { art: "text", text: "3. Wer KI nutzt, sagt es (Nutzungserklärung)." },
      { art: "text", text: "4. Die Entscheidung trifft der Mensch." },
      { art: "linie", text: "5." },
      { art: "text", text: "Unterschriften der Klasse:" },
    ],
  },
  elternbrief: {
    titel: "Elternbrief: KI im Unterricht (AIS.chat)",
    bloecke: () => [
      { art: "titel", text: "Information: Künstliche Intelligenz im Unterricht" },
      { art: "text", text: "Liebe Eltern und Sorgeberechtigte," },
      { art: "text", text: "in den kommenden Wochen beschäftigt sich die Klasse ____ mit Künstlicher Intelligenz (KI). Ziel ist, dass die Kinder verstehen, wie KI funktioniert, sie sinnvoll und sicher nutzen und ihre Ergebnisse kritisch prüfen." },
      { art: "text", text: "Dazu nutzen wir den KI-Führerschein auf unserer Lernplattform und den KI-Chatbot AIS.chat aus dem Thüringer Schulportal. AIS.chat ist kostenfrei und datenschutzkonform. Die Kinder werden von der Lehrkraft per QR-Code eingeladen, brauchen kein eigenes Konto und werden ohne Namen für einen begrenzten Zeitraum freigeschaltet." },
      { art: "text", text: "Wichtig: In AIS.chat werden keine persönlichen Daten eingegeben (Namen, Adressen, Geburtstage, Fotos). Das üben wir ausdrücklich." },
      { art: "text", text: "Weitere Informationen: bildung.thueringen.de/ais-chat" },
      { art: "text", text: "Bei Fragen melden Sie sich gern bei mir." },
      { art: "linie", text: "Mit freundlichen Grüßen" },
    ],
  },
  nutzung: {
    titel: "KI-Nutzungserklärung",
    bloecke: () => [
      { art: "titel", text: "KI-Nutzungserklärung" },
      { art: "linie", text: "Name / Klasse:" },
      { art: "linie", text: "Arbeit / Aufgabe:" },
      { art: "linie", text: "KI-Werkzeug:" },
      { art: "text", text: "Wofür: ☐ Ideen sammeln  ☐ Text überarbeiten  ☐ Erklärungen  ☐ Abfragen/Üben  ☐ Bilder  ☐ Sonstiges" },
      { art: "linie", text: "Meine wichtigsten Prompts:" },
      { art: "linie", text: "Was ich selbst gemacht habe:" },
      { art: "linie", text: "Wie ich die Ergebnisse geprüft habe:" },
      { art: "linie", text: "Was die KI gut / schlecht gemacht hat:" },
    ],
  },
  gespraech: {
    titel: "Gesprächsleitfaden: Wie nutzt ihr KI?",
    bloecke: () => [
      { art: "titel", text: "Gesprächsleitfaden: Wie nutzt ihr KI?" },
      { art: "text", text: "Ziel: ehrlich ins Gespräch kommen, ohne Vorwürfe. Kein Kind muss etwas zugeben." },
      { art: "ueberschrift", text: "Einstieg (5 min)" },
      { art: "text", text: "Anonyme Handzeichen oder Kärtchen: Wer hat schon einmal einen Chatbot benutzt? Wofür?" },
      { art: "ueberschrift", text: "Fragen für das Gespräch (15 min)" },
      { art: "text", text: "• Wobei hilft euch KI wirklich?" },
      { art: "text", text: "• Wann habt ihr gemerkt, dass eine KI-Antwort falsch war?" },
      { art: "text", text: "• Wann ist es unfair, KI zu benutzen? Wann ist es in Ordnung?" },
      { art: "text", text: "• Wovor habt ihr Sorge (z. B. dass man euch Schummeln vorwirft)?" },
      { art: "text", text: "• Was solltet ihr selbst können, auch wenn es KI gibt?" },
      { art: "ueberschrift", text: "Abschluss (5 min)" },
      { art: "text", text: "Drei Wünsche für unsere Klassenregeln sammeln. Weiter mit der Station »Unsere KI-Regeln«." },
    ],
  },
  bewertung: {
    titel: "Bewertungsbogen: KI-Einsatz und Reflexion",
    bloecke: () => [
      { art: "titel", text: "Bewertungsbogen: KI-Einsatz und Reflexion" },
      { art: "linie", text: "Name / Arbeit:" },
      { art: "text", text: "Je Kriterium: 0 = fehlt · 1 = teilweise · 2 = erfüllt" },
      { art: "text", text: "☐☐☐ Nutzungserklärung vollständig (Werkzeug, Zweck, Prompts, Eigenanteil)" },
      { art: "text", text: "☐☐☐ KI-Ergebnisse geprüft (zweite Quelle, Fehler benannt)" },
      { art: "text", text: "☐☐☐ Eigener Anteil klar erkennbar und angemessen" },
      { art: "text", text: "☐☐☐ Reflexion: Nutzen und Grenzen der KI begründet beschrieben" },
      { art: "text", text: "☐☐☐ Datenschutz und Regeln eingehalten" },
      { art: "linie", text: "Summe (max. 10) / Rückmeldung:" },
    ],
  },
  umfrage: {
    titel: "Fragen für die Umfrage (Ausgangslage/Evaluation)",
    bloecke: () => [
      { art: "titel", text: "Umfrage: KI an unserer Schule" },
      { art: "text", text: "Für das Umfrage-Werkzeug in TT. Skala 1 (gar nicht) bis 5 (sehr)." },
      { art: "text", text: "1. Ich fühle mich sicher im Umgang mit KI-Chatbots." },
      { art: "text", text: "2. Ich weiß, welche Daten nicht in eine KI gehören." },
      { art: "text", text: "3. Ich prüfe KI-Antworten mit anderen Quellen." },
      { art: "text", text: "4. Ich weiß, wann KI im Unterricht erlaubt ist." },
      { art: "text", text: "5. KI hilft mir beim Lernen. (Lernende) / KI entlastet mich bei der Vorbereitung. (Lehrkräfte)" },
      { art: "text", text: "6. Freitext: Was wünschst du dir zum Thema KI?" },
      { art: "text", text: "7. Freitext: Was bereitet dir Sorgen?" },
    ],
  },
  "mini-fortbildung": {
    titel: "Ablauf: 30-Minuten-Mikrofortbildung",
    bloecke: () => [
      { art: "titel", text: "KI-Mikrofortbildung (30 Minuten)" },
      { art: "text", text: "Für Konferenzen oder Fachschaftssitzungen. Kein Vorwissen nötig." },
      { art: "ueberschrift", text: "5 min · Einschätzen" },
      { art: "text", text: "Alle öffnen den KI-Kompass und kreuzen im Kompetenzraster Stufe 0 und Basis an. Messpunkt speichern." },
      { art: "ueberschrift", text: "15 min · Ausprobieren" },
      { art: "text", text: "Paare machen die Station »Mein erster Prompt« oder »Die KI irrt sich« mit AIS.chat, mit einer echten Aufgabe aus dem eigenen Fach." },
      { art: "ueberschrift", text: "7 min · Austauschen" },
      { art: "text", text: "Was hat überrascht? Wo hilft es mir? Wo habe ich Bedenken?" },
      { art: "ueberschrift", text: "3 min · Nächster Schritt" },
      { art: "text", text: "Jede·r notiert eine Sache, die er·sie bis zum nächsten Treffen ausprobiert." },
    ],
  },
};
