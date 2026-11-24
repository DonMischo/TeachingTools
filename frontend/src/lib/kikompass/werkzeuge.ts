/**
 * KI-Werkzeuge im Netz: was es gibt und was man in der Schule damit machen kann.
 *
 * Altersangaben = Mindestalter laut Nutzungsbedingungen der Anbieter (Stand
 * 11/2026, aus deren AGB bzw. Übersichten zusammengetragen). Sie ändern sich
 * oft — vor dem Einsatz beim Anbieter prüfen. Ob ein Werkzeug im Unterricht
 * erlaubt ist, entscheiden Land und Schulleitung, nicht diese Liste.
 *
 * Wer sieht was:
 *   Lehrkraft  alles (umschaltbar auf die Schülersicht)
 *   Schüler    nur Werkzeuge »für Schüler·innen« bzw. »für beide«
 *   Gäste      davon nur kindersichere ohne eigenes Konto
 */

export type Kategorie = "schulki" | "chat" | "bild" | "material" | "audio" | "lernen";
export type Fuer = "lehrkraft" | "schueler" | "beide";
/** keins = ohne Anmeldung; lehrkraft = Zugang kommt von der Lehrkraft (Code/QR/Klasse); schulkonto = über die Schule; eigenes = eigenes Konto nötig */
export type Konto = "keins" | "lehrkraft" | "schulkonto" | "eigenes";
/** Datenschutz-Einschätzung: gruen = für Schulen gemacht/AV-Vertrag, gelb = mit Vorsicht, rot = keine personenbezogenen Daten, nur Lehrkraft privat */
export type Ampel = "gruen" | "gelb" | "rot";

export type KiWerkzeug = {
  id: string;
  name: string;
  url: string;
  kategorie: Kategorie;
  fuer: Fuer;
  /** Mindestalter laut Anbieter; null = kein Konto nötig bzw. keine Altersgrenze genannt */
  alter: number | null;
  alterText: string;
  konto: Konto;
  kosten: "kostenlos" | "teils kostenlos" | "kostenpflichtig" | "Land/Schule";
  daten: Ampel;
  /** Geeignet für Kinder ohne Begleitung (Filter, keine offene Bildersuche/Chat mit Fremden) */
  kindersicher: boolean;
  was: string;
  ideen: string[];
};

export const KATEGORIEN: Record<Kategorie, { icon: string; name: string }> = {
  schulki: { icon: "🏫", name: "Schul-KI (datenschutzfreundlich)" },
  chat: { icon: "💬", name: "Chatbots / Sprachmodelle" },
  bild: { icon: "🎨", name: "Bilder & Gestaltung" },
  material: { icon: "📄", name: "Unterrichtsmaterial" },
  audio: { icon: "🎵", name: "Musik, Stimme & Sprache" },
  lernen: { icon: "🧪", name: "KI verstehen & ausprobieren" },
};

export const STAND = "11/2026";

export const WERKZEUGE: KiWerkzeug[] = [
  // ── Schul-KI ────────────────────────────────────────────────────────
  {
    id: "ais", name: "AIS.chat", url: "https://bildung.thueringen.de/ais-chat", kategorie: "schulki", fuer: "beide",
    alter: null, alterText: "über die Lehrkraft, ohne Konto", konto: "lehrkraft", kosten: "Land/Schule", daten: "gruen", kindersicher: true,
    was: "Die KI-Umgebung für Thüringer Schulen (früher telli). Die Lehrkraft richtet eine Lernumgebung ein, Schüler·innen kommen per QR-Code ohne Konto hinein.",
    ideen: ["Stationen des KI-Führerscheins", "Lernbegleiter mit festem Auftrag (z. B. »frag mich Vokabeln ab«)", "Texte gemeinsam überarbeiten lassen und vergleichen"],
  },
  {
    id: "telli", name: "telli", url: "https://telli.schule", kategorie: "schulki", fuer: "beide",
    alter: null, alterText: "über die Schule", konto: "schulkonto", kosten: "Land/Schule", daten: "gruen", kindersicher: true,
    was: "Länderübergreifender KI-Chatbot für Schulen (u. a. Baden-Württemberg, Thüringen). Lehrkräfte bauen Lernszenarien, Schüler·innen nutzen sie ohne eigene Daten.",
    ideen: ["Dialoge mit historischen Figuren als Lernszenario", "Feedback auf Schülertexte nach eigenen Kriterien"],
  },
  {
    id: "fobizz", name: "fobizz KI-Tools", url: "https://fobizz.com", kategorie: "schulki", fuer: "beide",
    alter: null, alterText: "Schülerzugang über das Lehrerkonto", konto: "lehrkraft", kosten: "kostenpflichtig", daten: "gruen", kindersicher: true,
    was: "Deutscher Anbieter mit KI-Chat, Bildgenerator und Korrekturhilfe; Lehrkräfte geben Klassen einen datensparsamen Zugang.",
    ideen: ["KI-Assistenz für eine Klasse freischalten", "Bilder für Geschichten erzeugen lassen", "Bewertungshilfe mit eigenem Raster"],
  },
  {
    id: "schulki", name: "SchulKI", url: "https://schulki.de", kategorie: "schulki", fuer: "beide",
    alter: null, alterText: "Schüler·innen ohne Konto", konto: "lehrkraft", kosten: "teils kostenlos", daten: "gruen", kindersicher: true,
    was: "Von Lehrkräften entwickelte Oberfläche für Sprachmodelle mit AV-Vertrag; Lernende arbeiten ohne eigenes Konto.",
    ideen: ["Lernassistenten mit festem Auftrag teilen", "Rückmeldungen zu Aufsätzen geben lassen"],
  },
  // ── Chatbots / Sprachmodelle ────────────────────────────────────────
  {
    id: "chatgpt", name: "ChatGPT (OpenAI)", url: "https://chatgpt.com", kategorie: "chat", fuer: "lehrkraft",
    alter: 13, alterText: "ab 13, unter 18 mit Einwilligung der Eltern", konto: "eigenes", kosten: "teils kostenlos", daten: "gelb", kindersicher: false,
    was: "Bekanntester Chatbot: Texte schreiben, erklären, zusammenfassen, Bilder erzeugen. Daten gehen an einen US-Anbieter.",
    ideen: ["Arbeitsblätter auf drei Niveaus umschreiben", "Erwartungshorizont entwerfen und kritisch prüfen", "Beispiele für »Halluzinationen« sammeln"],
  },
  {
    id: "gemini", name: "Gemini (Google)", url: "https://gemini.google.com", kategorie: "chat", fuer: "lehrkraft",
    alter: 13, alterText: "Schulkonto (Workspace for Education) ab 13, privat je nach Land höher", konto: "schulkonto", kosten: "teils kostenlos", daten: "gelb", kindersicher: false,
    was: "Chatbot von Google, eng mit Docs, Drive und YouTube verbunden. Mit Schulkonto entscheidet der Admin.",
    ideen: ["Lange Texte oder Videos zusammenfassen", "Ideen für Unterrichtseinstiege"],
  },
  {
    id: "copilot", name: "Microsoft Copilot", url: "https://copilot.microsoft.com", kategorie: "chat", fuer: "lehrkraft",
    alter: 13, alterText: "ab 13 mit Microsoft-Konto; mit Schulkonto (M365 Education) nach Freigabe", konto: "schulkonto", kosten: "teils kostenlos", daten: "gelb", kindersicher: false,
    was: "Chatbot von Microsoft, in Word, PowerPoint und Teams eingebaut.",
    ideen: ["Folien aus einem Text entwerfen", "E-Mails an Eltern höflich formulieren (ohne Namen!)"],
  },
  {
    id: "claude", name: "Claude (Anthropic)", url: "https://claude.ai", kategorie: "chat", fuer: "lehrkraft",
    alter: 18, alterText: "ab 18", konto: "eigenes", kosten: "teils kostenlos", daten: "gelb", kindersicher: false,
    was: "Sprachmodell, stark bei langen Texten, Programmieren und sorgfältigen Erklärungen. Nur für Erwachsene.",
    ideen: ["Material aus langen PDFs aufbereiten", "Kleine Lern-Apps als Artefakt bauen lassen"],
  },
  {
    id: "lechat", name: "Le Chat (Mistral)", url: "https://chat.mistral.ai", kategorie: "chat", fuer: "lehrkraft",
    alter: 18, alterText: "für Erwachsene — Altersregel beim Anbieter prüfen", konto: "eigenes", kosten: "teils kostenlos", daten: "gelb", kindersicher: false,
    was: "Chatbot eines französischen Anbieters, Daten in der EU.",
    ideen: ["Vergleich: dieselbe Frage an zwei Chatbots stellen"],
  },
  {
    id: "perplexity", name: "Perplexity", url: "https://www.perplexity.ai", kategorie: "chat", fuer: "lehrkraft",
    alter: 13, alterText: "ab 13, unter 18 mit Einwilligung der Eltern", konto: "eigenes", kosten: "teils kostenlos", daten: "gelb", kindersicher: false,
    was: "KI-Suchmaschine: Antworten mit Quellenangaben.",
    ideen: ["Quellen einer KI-Antwort nachprüfen lassen (Faktencheck-Station)"],
  },
  {
    id: "notebooklm", name: "NotebookLM (Google)", url: "https://notebooklm.google.com", kategorie: "chat", fuer: "lehrkraft",
    alter: 18, alterText: "privat ab 18; mit Schulkonto nach Freigabe", konto: "schulkonto", kosten: "kostenlos", daten: "gelb", kindersicher: false,
    was: "Antwortet nur aus Quellen, die man hochlädt; macht Zusammenfassungen, Lernkarten und Podcasts daraus.",
    ideen: ["Lehrplan oder Fachtexte hochladen und Fragen dazu stellen", "Hör-Zusammenfassung eines Themas erzeugen"],
  },
  {
    id: "deepseek", name: "DeepSeek", url: "https://www.deepseek.com", kategorie: "chat", fuer: "lehrkraft",
    alter: 18, alterText: "ab 18", konto: "eigenes", kosten: "kostenlos", daten: "rot", kindersicher: false,
    was: "Chatbot aus China; Daten werden dort verarbeitet, Antworten zu politischen Themen sind gefiltert. Zum Vergleichen im Unterricht interessant, für eigene Daten nicht.",
    ideen: ["Zensur sichtbar machen: dieselbe Geschichtsfrage an zwei Modelle stellen"],
  },
  // ── Bilder & Gestaltung ─────────────────────────────────────────────
  {
    id: "canva", name: "Canva for Education (Magic Studio)", url: "https://www.canva.com/education/", kategorie: "bild", fuer: "beide",
    alter: null, alterText: "kostenlos für Lehrkräfte; Schüler·innen nur über die Klasse der Lehrkraft", konto: "lehrkraft", kosten: "kostenlos", daten: "gelb", kindersicher: true,
    was: "Plakate, Präsentationen, Videos — mit KI-Bildern, Texthilfe und Übersetzen. In der Schulversion steuert die Lehrkraft, welche KI-Funktionen Kinder nutzen.",
    ideen: ["Plakat zu einem Sachthema mit KI-Bild gestalten", "Präsentation aus Stichpunkten entwerfen lassen und selbst verbessern"],
  },
  {
    id: "adobeexpress", name: "Adobe Express (Schulversion, Firefly)", url: "https://www.adobe.com/education/express/", kategorie: "bild", fuer: "beide",
    alter: null, alterText: "Schulversion über Schule bzw. Lehrkraft; privat ab 13", konto: "schulkonto", kosten: "kostenlos", daten: "gelb", kindersicher: true,
    was: "Gestaltung mit Firefly-Bildern; die Schulversion filtert Inhalte für Kinder.",
    ideen: ["Buchcover oder Comic-Szene gestalten", "Text-Effekte für einen Titel erzeugen"],
  },
  {
    id: "leonardo", name: "Leonardo.ai", url: "https://leonardo.ai", kategorie: "bild", fuer: "lehrkraft",
    alter: 13, alterText: "ab 13, unter 18 mit Einwilligung; App-Store-Freigabe 18+", konto: "eigenes", kosten: "teils kostenlos", daten: "gelb", kindersicher: false,
    was: "Starker Bildgenerator mit vielen Stilen und Bildbearbeitung. Öffentliche Galerie mit fremden Bildern — nicht für Kinder allein.",
    ideen: ["Illustrationen für Arbeitsblätter", "Bilder für eine Fantasiegeschichte als Schreibanlass"],
  },
  {
    id: "firefly", name: "Adobe Firefly", url: "https://firefly.adobe.com", kategorie: "bild", fuer: "lehrkraft",
    alter: 13, alterText: "ab 13", konto: "eigenes", kosten: "teils kostenlos", daten: "gelb", kindersicher: false,
    was: "Bildgenerator, trainiert auf lizenzierten Bildern — gut, wenn die Rechte zählen.",
    ideen: ["Bilder für Folien ohne Urheberrechtssorgen", "Stile vergleichen: Foto, Aquarell, Comic"],
  },
  // ── Unterrichtsmaterial ─────────────────────────────────────────────
  {
    id: "toteach", name: "to-teach.ai", url: "https://to-teach.ai", kategorie: "material", fuer: "lehrkraft",
    alter: 18, alterText: "für Lehrkräfte", konto: "eigenes", kosten: "teils kostenlos", daten: "gruen", kindersicher: false,
    was: "Deutscher Anbieter: Arbeitsblätter, Lesetexte und Übungen auf Knopfdruck, differenziert nach Niveau.",
    ideen: ["Lesetext zu einem Thema in drei Schwierigkeiten", "Lückentext aus einem eigenen Text"],
  },
  {
    id: "magicschool", name: "MagicSchool", url: "https://www.magicschool.ai", kategorie: "material", fuer: "lehrkraft",
    alter: 18, alterText: "für Lehrkräfte; Schülerräume nur über die Lehrkraft", konto: "eigenes", kosten: "teils kostenlos", daten: "gelb", kindersicher: false,
    was: "Sammlung von über 80 Lehrkraft-Werkzeugen (Englisch): Rubrics, Quizze, Elternbriefe, Differenzierung.",
    ideen: ["Bewertungsraster entwerfen", "Quiz aus einem Text erzeugen"],
  },
  {
    id: "diffit", name: "Diffit", url: "https://web.diffit.me", kategorie: "material", fuer: "lehrkraft",
    alter: 18, alterText: "für Lehrkräfte", konto: "eigenes", kosten: "teils kostenlos", daten: "gelb", kindersicher: false,
    was: "Macht aus einem Text oder Thema Lesetexte in passender Schwierigkeit mit Fragen und Wortschatz.",
    ideen: ["Zeitungsartikel für Klasse 5 vereinfachen"],
  },
  {
    id: "gamma", name: "Gamma", url: "https://gamma.app", kategorie: "material", fuer: "lehrkraft",
    alter: 18, alterText: "für Erwachsene", konto: "eigenes", kosten: "teils kostenlos", daten: "gelb", kindersicher: false,
    was: "Präsentationen und Webseiten aus Stichpunkten.",
    ideen: ["Folien als Rohfassung erzeugen und dann selbst kürzen"],
  },
  // ── Musik, Stimme & Sprache ─────────────────────────────────────────
  {
    id: "deepl", name: "DeepL Übersetzer & Write", url: "https://www.deepl.com", kategorie: "audio", fuer: "beide",
    alter: null, alterText: "ohne Konto nutzbar", konto: "keins", kosten: "teils kostenlos", daten: "gelb", kindersicher: true,
    was: "Übersetzer aus Köln; »Write« schlägt bessere Formulierungen vor. Keine Namen oder privaten Texte eingeben.",
    ideen: ["Übersetzung prüfen: Wo liegt die KI daneben?", "Eigenen Satz verbessern lassen und Unterschiede erklären"],
  },
  {
    id: "suno", name: "Suno", url: "https://suno.com", kategorie: "audio", fuer: "lehrkraft",
    alter: 13, alterText: "ab 13 laut Anbieter", konto: "eigenes", kosten: "teils kostenlos", daten: "gelb", kindersicher: false,
    was: "Erzeugt ganze Lieder mit Gesang aus einer Beschreibung oder einem eigenen Text.",
    ideen: ["Merk-Song zu einem Thema mit selbst geschriebenem Text", "Diskussion: Wem gehört ein KI-Lied?"],
  },
  {
    id: "elevenlabs", name: "ElevenLabs", url: "https://elevenlabs.io", kategorie: "audio", fuer: "lehrkraft",
    alter: 18, alterText: "ab 18", konto: "eigenes", kosten: "teils kostenlos", daten: "gelb", kindersicher: false,
    was: "Sprachausgabe mit sehr echten Stimmen, auch Stimmen klonen — gut, um über Deepfakes zu sprechen. Keine Schülerstimmen hochladen.",
    ideen: ["Hörtext vorlesen lassen", "Deepfake-Stimme als Warnbeispiel vorspielen"],
  },
  // ── KI verstehen & ausprobieren ─────────────────────────────────────
  {
    id: "quickdraw", name: "Quick, Draw!", url: "https://quickdraw.withgoogle.com", kategorie: "lernen", fuer: "beide",
    alter: null, alterText: "ohne Konto", konto: "keins", kosten: "kostenlos", daten: "gruen", kindersicher: true,
    was: "Du zeichnest, die KI rät, was es ist. Zeigt spielerisch, wie Bilderkennung aus vielen Beispielen lernt.",
    ideen: ["Warum erkennt die KI manches nicht? Daten-Beispiele ansehen"],
  },
  {
    id: "autodraw", name: "AutoDraw", url: "https://www.autodraw.com", kategorie: "lernen", fuer: "beide",
    alter: null, alterText: "ohne Konto", konto: "keins", kosten: "kostenlos", daten: "gruen", kindersicher: true,
    was: "Aus einer Kritzelei schlägt die KI saubere Zeichnungen vor.",
    ideen: ["Plakat-Symbole zeichnen", "Wie »rät« die KI aus wenigen Strichen?"],
  },
  {
    id: "teachable", name: "Teachable Machine", url: "https://teachablemachine.withgoogle.com", kategorie: "lernen", fuer: "beide",
    alter: null, alterText: "ohne Konto, läuft im Browser", konto: "keins", kosten: "kostenlos", daten: "gruen", kindersicher: true,
    was: "Eigenes KI-Modell trainieren: Bilder, Töne oder Posen mit der Kamera aufnehmen, die KI lernt die Klassen. Die Daten bleiben im Browser.",
    ideen: ["Schere-Stein-Papier-Erkenner bauen", "Mit schlechten Trainingsdaten absichtlich eine voreingenommene KI bauen"],
  },
  {
    id: "mlforkids", name: "Machine Learning for Kids", url: "https://machinelearningforkids.co.uk", kategorie: "lernen", fuer: "beide",
    alter: null, alterText: "Klassenkonten legt die Lehrkraft an", konto: "lehrkraft", kosten: "kostenlos", daten: "gelb", kindersicher: true,
    was: "Eigene KI trainieren und mit Scratch in einem Spiel benutzen.",
    ideen: ["Chatbot für Fragen zur Schulordnung in Scratch", "Text-Stimmung erkennen (nett/gemein)"],
  },
];

export type Sicht = "lehrkraft" | "schueler" | "gast";

/** Was die jeweilige Gruppe zu sehen bekommt. */
export function sichtbar(w: KiWerkzeug, sicht: Sicht): boolean {
  if (sicht === "lehrkraft") return true;
  if (w.fuer === "lehrkraft") return false;
  if (sicht === "gast") return w.kindersicher && w.konto !== "eigenes";
  return true;
}

/** Nach Kategorie (feste Reihenfolge), darin Schul-taugliches zuerst: Ampel, dann ohne eigenes Konto, dann Name. */
export function sortiert(liste: KiWerkzeug[]): KiWerkzeug[] {
  const kat = Object.keys(KATEGORIEN);
  const ampel = { gruen: 0, gelb: 1, rot: 2 };
  const konto = { keins: 0, lehrkraft: 1, schulkonto: 2, eigenes: 3 };
  return [...liste].sort((a, b) =>
    kat.indexOf(a.kategorie) - kat.indexOf(b.kategorie)
    || ampel[a.daten] - ampel[b.daten]
    || konto[a.konto] - konto[b.konto]
    || a.name.localeCompare(b.name, "de"));
}
