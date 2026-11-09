/**
 * Lernpfad für Lehrkräfte: kurze Einheiten von Stufe 0 bis III, jede mit
 * einem Auftrag zum Ausprobieren (AIS.chat), einer Reflexionsfrage und dem
 * Sprung zum passenden Workflow oder Werkzeug. Dazu ein Workshop-Paket für
 * 90 Minuten im Kollegium (Ablaufplan und Handout als Word).
 *
 * Alle Texte sind eigene. Die Prompt-Formel heißt wie im KI-Führerschein:
 * Rolle, Aufgabe, Hintergrund, Form.
 */
import type { DocxBlock } from "@/lib/docx";
import type { StufeId } from "./raster";
import type { Phase } from "./aktiv";
import { DATENSCHUTZ_REGEL } from "./werkstatt";

export type Sprungziel = NonNullable<Phase["werkzeug"]>["ziel"];

export interface Etappe { id: string; stufe: StufeId; titel: string; ziel: string }

export interface Einheit {
  id: string;
  etappe: string;
  titel: string;
  minuten: number;
  ziel: string;
  ausprobieren: string;
  prompt?: string;
  reflexion: string;
  workflow?: string;
  sprung?: { ziel: Sprungziel; titel: string };
}

export const ETAPPEN: Etappe[] = [
  { id: "start", stufe: "0", titel: "Erste Schritte", ziel: "KI einmal selbst ausprobieren, ohne Druck und ohne Vorwissen." },
  { id: "prompten", stufe: "Ia", titel: "Prompten lernen", ziel: "Gezielt fragen, nachschärfen und Antworten prüfen." },
  { id: "material", stufe: "Ib", titel: "Material erstellen", ziel: "Mit KI Unterrichtsmaterial vorbereiten, das du selbst verantwortest." },
  { id: "unterricht", stufe: "II", titel: "Im Unterricht einsetzen", ziel: "KI so einbauen, dass die Lernenden mehr denken, nicht weniger." },
  { id: "gestalten", stufe: "III", titel: "Workflows und Agenten", ziel: "Eigene Abläufe entwerfen, verstehen, wie Agenten arbeiten, und andere mitnehmen." },
];

export const PROMPT_FORMEL = [
  "Rolle: »Du bist eine erfahrene Lehrkraft für …«",
  "Aufgabe: »Erstelle / Erkläre / Prüfe …«",
  "Hintergrund: »Für Klasse 7, Thema …, die Klasse kann schon …«",
  "Form: »als Tabelle, 5 Punkte, höchstens 100 Wörter«",
];

export const DATENSCHUTZ_REGELN = [
  "Keine Namen, Adressen, Geburtstage oder Fotos von Lernenden, Eltern oder Kolleg·innen.",
  "Schülertexte nur anonymisiert, und nur in datenschutzkonformen Werkzeugen wie AIS.chat.",
  "Keine Noten, Gutachten oder Förderdiagnosen von der KI schreiben lassen.",
  "Keine internen Dokumente der Schule einfügen.",
  "Im Zweifel: erfundene Beispiele nehmen.",
];

export const EINHEITEN: Einheit[] = [
  // Stufe 0
  { id: "erster-prompt", etappe: "start", titel: "Erster Prompt in 10 Minuten", minuten: 10,
    ziel: "Erleben, wie schnell eine brauchbare Antwort kommt.",
    ausprobieren: "Melde dich in AIS.chat an und probier drei kleine Aufträge aus deinem Alltag.",
    prompt: "1. Formuliere diese Elternnachricht freundlicher: [eigener Text ohne Namen]\n2. Schreib fünf Quizfragen mit Lösung zum Thema [Thema] für Klasse [Klasse].\n3. Erkläre [Fachbegriff] so, dass ein Kind der 5. Klasse es versteht.",
    reflexion: "Welche Antwort war brauchbar, welche nicht? Woran lag es?" },
  { id: "grenzen", etappe: "start", titel: "Was KI nicht weiß", minuten: 10,
    ziel: "Sehen, dass KI flüssig klingt, auch wenn sie sich irrt.",
    ausprobieren: "Frag nach etwas, das du genau kennst und das kaum im Internet steht.",
    prompt: "Erzähl mir die Geschichte unserer Schule [Name des Ortes, nicht der Schule] und nenne drei Quellen.",
    reflexion: "Was war erfunden? Hättest du es ohne Vorwissen bemerkt?" },
  { id: "datenschutz", etappe: "start", titel: "Datenschutz in fünf Regeln", minuten: 5,
    ziel: "Wissen, was nie in eine KI gehört.",
    ausprobieren: "Lies die fünf Regeln und überleg, welche dir im Alltag am schwersten fällt.",
    reflexion: "Welche Regel schreibst du dir auf einen Zettel neben den Rechner?" },
  // Stufe Ia
  { id: "formel", etappe: "prompten", titel: "Die Prompt-Formel", minuten: 15,
    ziel: "Rolle, Aufgabe, Hintergrund und Form gezielt einsetzen.",
    ausprobieren: "Stell dieselbe Frage zweimal: einmal in einem Satz, einmal mit allen vier Teilen. Vergleiche.",
    prompt: "Du bist eine erfahrene Lehrkraft für [Fach]. Erstelle einen Einstieg für eine Stunde zum Thema [Thema]. Die Klasse [Klasse] kennt schon [Vorwissen]. Form: drei Ideen mit je zwei Sätzen und Materialbedarf.",
    reflexion: "Welcher der vier Teile hat am meisten verändert?" },
  { id: "nachschaerfen", etappe: "prompten", titel: "Nachschärfen statt neu fragen", minuten: 15,
    ziel: "Eine Antwort im Gespräch verbessern.",
    ausprobieren: "Nimm eine Antwort aus der letzten Einheit und verbessere sie mit drei Rückmeldungen, ohne neu anzufangen.",
    prompt: "Das ist gut, aber Idee 2 ist für Klasse [Klasse] zu schwer, weil [Grund]. Mach sie leichter und behalte den Rest.",
    reflexion: "Wie viele Runden brauchtest du bis zu einem Ergebnis, das du verwenden würdest?" },
  { id: "pruefen", etappe: "prompten", titel: "Antworten prüfen", minuten: 15,
    ziel: "Eine feste Prüfroutine haben.",
    ausprobieren: "Lass dir einen Sachtext aus deinem Fach schreiben und prüf ihn mit der Checkliste: Fakten, Zahlen, Quellen, Fachsprache, Niveau.",
    prompt: "Schreib einen Sachtext von 150 Wörtern zum Thema [Thema] für Klasse [Klasse] mit zwei Zahlen und einer Quelle.",
    reflexion: "Was hast du gefunden? Würdest du den Text so ausgeben?",
    workflow: "recherche" },
  // Stufe Ib
  { id: "differenzieren", etappe: "material", titel: "Ein Arbeitsblatt, drei Niveaus", minuten: 30,
    ziel: "Vorhandenes Material differenzieren lassen und prüfen.",
    ausprobieren: "Nimm ein eigenes Arbeitsblatt für die nächste Woche und geh den Workflow durch.",
    reflexion: "Welche Fassung musstest du am meisten nachbessern?", workflow: "differenzieren" },
  { id: "tt-material", etappe: "material", titel: "TT-Material mit KI", minuten: 30,
    ziel: "Ein Quiz, einen Lückentext oder TaskCrawler aus dem eigenen Thema bauen.",
    ausprobieren: "Wähl ein TT-Werkzeug und geh den Workflow bis zum Probelauf durch.",
    reflexion: "Wo hat die KI Zeit gespart, wo hat sie Arbeit gemacht?", workflow: "tt-vorlage" },
  { id: "bild", etappe: "material", titel: "Bilder mit Verstand", minuten: 20,
    ziel: "Wissen, wann ein KI-Bild sinnvoll ist und wie man es prüft und kennzeichnet.",
    ausprobieren: "Erzeuge (falls dein Werkzeug es kann) dreimal »eine Person, die forscht« und schau, wer zu sehen ist.",
    reflexion: "Welche Klischees sind dir aufgefallen?", workflow: "bild" },
  // Stufe II
  { id: "dimensionen", etappe: "unterricht", titel: "Mit, über, durch, trotz, ohne KI", minuten: 20,
    ziel: "Für eine Stunde bewusst entscheiden, welche Rolle KI spielt.",
    ausprobieren: "Plan eine Stunde aus deinem Fach und lass dir in der Material-Werkstatt je Dimension eine Aufgabe vorschlagen.",
    reflexion: "Welche Dimension passt am besten zu deinem Fach, welche nie?",
    sprung: { ziel: "werkstatt", titel: "🧪 Material-Werkstatt" } },
  { id: "resilient", etappe: "unterricht", titel: "Eine Aufgabe umbauen", minuten: 20,
    ziel: "Hausaufgaben und Prüfungen so stellen, dass eigenes Denken sichtbar wird.",
    ausprobieren: "Teste eine deiner typischen Hausaufgaben in AIS.chat und bau sie mit dem Workflow um.",
    reflexion: "Was hat sich an der Aufgabe verändert, was an deiner Erwartung?", workflow: "resilient" },
  { id: "lernumgebung", etappe: "unterricht", titel: "Ein Lernbegleiter für deine Klasse", minuten: 30,
    ziel: "Eine AIS.chat-Lernumgebung mit Regeln bauen und testen.",
    ausprobieren: "Bau einen Lernbegleiter für ein laufendes Thema und versuch, ihn zum Vorsagen zu überreden.",
    reflexion: "Welche Regel im Systemtext war am wichtigsten?", workflow: "lernumgebung" },
  // Stufe III
  { id: "agent", etappe: "gestalten", titel: "Wie Agenten arbeiten", minuten: 20,
    ziel: "Agent, Werkzeug (MCP) und Skill erklären können.",
    ausprobieren: "Spiel das Agenten-Rollenspiel mit Kolleg·innen oder einer Klasse.",
    reflexion: "Wo würdest du einem Agenten im Schulalltag etwas überlassen, wo nie?", workflow: "agent" },
  { id: "eigener-workflow", etappe: "gestalten", titel: "Deinen Workflow entwerfen", minuten: 30,
    ziel: "Einen eigenen wiederkehrenden Ablauf mit KI festhalten.",
    ausprobieren: "Öffne einen Workflow als Flussdiagramm, bau ihn für deinen Alltag um und teile die Prompts im Materialpool.",
    reflexion: "Welcher Schritt bleibt bei dir immer menschlich?", sprung: { ziel: "pool", titel: "📚 Materialpool" } },
  { id: "skill", etappe: "gestalten", titel: "Eine Anleitung, die bleibt", minuten: 20,
    ziel: "Eine wiederverwendbare Anleitung schreiben (das Prinzip hinter »Skills« und Systemtexten).",
    ausprobieren: "Schreib eine Anleitung, mit der die KI immer gleich gutes Feedback nach deinen Kriterien gibt. Teste sie an drei erfundenen Texten.",
    prompt: "Du gibst Feedback zu Texten der Klasse [Klasse] im Fach [Fach]. Kriterien: [Kriterien]. Vorgehen: 1. eine Stärke mit Zitat, 2. ein nächster Schritt je Kriterium, 3. keine Note. Sprache: einfach, Du-Form.",
    reflexion: "Was musstest du nach dem Test an der Anleitung ändern?" },
];

export function einheitenVon(etappe: string): Einheit[] {
  return EINHEITEN.filter(e => e.etappe === etappe);
}

/* ------------------------------------------------------- Workshop 90 Min. */

export interface WorkshopPhase { minuten: number; titel: string; ablauf: string; material: string }

export const WORKSHOP: { titel: string; fuer: string; ziel: string; vorbereitung: string[]; phasen: WorkshopPhase[]; tipps: string[] } = {
  titel: "Prompt-Werkstatt im Kollegium",
  fuer: "Schulinterne Fortbildung oder Fachkonferenz, 6 bis 30 Lehrkräfte, kein Vorwissen nötig",
  ziel: "Alle haben selbst gepromptet, kennen Grenzen und Datenschutzregeln und gehen mit einem Material für die eigene nächste Stunde raus.",
  vorbereitung: [
    "Geräte mit Internet (eigene Laptops oder Tablets reichen, eins pro Paar)",
    "Zugang zu AIS.chat für alle Lehrkräfte über das Schulportal vorher prüfen",
    "KI-Kompass-Sitzung öffnen und den Code an die Wand werfen (für Raster und Führerschein)",
    "Teilnehmende bitten, ein eigenes Arbeitsblatt oder eine Aufgabe mitzubringen",
    "Handout drucken (siehe »Handout als Word«)",
  ],
  phasen: [
    { minuten: 10, titel: "Ankommen und Standort",
      ablauf: "Positionslinie im Raum: »Ich habe KI schon … nie / ab und zu / oft genutzt«. Danach Selbsteinschätzung im Kompetenzraster des KI-Kompass (Spinne).",
      material: "KI-Kompass-Code, Raster" },
    { minuten: 15, titel: "Impuls: Wie ein Sprachmodell arbeitet",
      ablauf: "Live das Wort-Raten aus der KI-Werkstatt zeigen: KI sagt das wahrscheinlichste nächste Wort voraus. Daraus folgen Stärken (Sprache, Struktur) und Grenzen (Fakten, Quellen, Aktualität). Die fünf Datenschutzregeln vorstellen.",
      material: "Beamer, KI-Führerschein Station »Das nächste Wort«" },
    { minuten: 20, titel: "Erster Prompt in Paaren",
      ablauf: "Paare stellen dieselbe Aufgabe zweimal: einmal knapp, einmal mit der Prompt-Formel (Rolle, Aufgabe, Hintergrund, Form). Ergebnisse vergleichen, zwei Paare zeigen kurz ihren Unterschied.",
      material: "AIS.chat, Handout Prompt-Formel" },
    { minuten: 25, titel: "Material für die eigene Stunde",
      ablauf: "Jede Person wählt einen Workflow aus dem KI-Kompass (Arbeitsblatt in drei Niveaus, TT-Material mit KI, Aufgabe umbauen) und bearbeitet ihr mitgebrachtes Material. Wer fertig ist, prüft das Ergebnis eines Nachbarn mit der Checkliste.",
      material: "Mitgebrachtes Material, KI-Kompass → Workflows" },
    { minuten: 10, titel: "Fehler finden",
      ablauf: "Alle suchen in ihrem Ergebnis den größten Fehler der KI. Sammeln an der Tafel: Was übersieht man leicht?",
      material: "Tafel oder Pinnwand" },
    { minuten: 10, titel: "Abschluss und nächster Schritt",
      ablauf: "Jede Person notiert eine Sache, die sie nächste Woche im Unterricht ausprobiert. Gelungene Prompts im Materialpool teilen. Termin für ein kurzes Austauschtreffen in vier Wochen vereinbaren.",
      material: "Materialpool, Kalender" },
  ],
  tipps: [
    "Keine Technikschulung daraus machen: Lieber weniger zeigen, mehr selbst ausprobieren lassen.",
    "Skepsis ernst nehmen. Die Phase »Fehler finden« ist für Skeptiker oft die wichtigste.",
    "Nach vier Wochen fragen: Was hat im Unterricht funktioniert? Dann die nächste Etappe im Lernpfad wählen.",
  ],
};

const ZEITEN = (() => {
  let t = 0;
  return WORKSHOP.phasen.map(p => { const von = t; t += p.minuten; return `${von}–${t} Min.`; });
})();

export function workshopDocx(): DocxBlock[] {
  return [
    { art: "titel", text: `${WORKSHOP.titel} (90 Minuten)` },
    { art: "text", text: WORKSHOP.fuer, grau: true },
    { art: "text", text: `Ziel: ${WORKSHOP.ziel}` },
    { art: "ueberschrift", text: "Vorbereitung" },
    ...WORKSHOP.vorbereitung.map(v => ({ art: "text" as const, text: `☐ ${v}` })),
    { art: "ueberschrift", text: "Ablauf" },
    ...WORKSHOP.phasen.flatMap((p, i): DocxBlock[] => [
      { art: "text", text: `${ZEITEN[i]} · ${p.titel}`, fett: true },
      { art: "text", text: p.ablauf },
      { art: "text", text: `Material: ${p.material}`, klein: true, grau: true },
    ]),
    { art: "ueberschrift", text: "Tipps für die Moderation" },
    ...WORKSHOP.tipps.map(t => ({ art: "text" as const, text: `• ${t}` })),
    { art: "text", text: "Erstellt mit dem KI-Kompass in TT - Teaching Tools.", klein: true, grau: true },
  ];
}

export function handoutDocx(): DocxBlock[] {
  return [
    { art: "titel", text: "KI im Unterricht: das Wichtigste auf einer Seite" },
    { art: "ueberschrift", text: "Die Prompt-Formel" },
    ...PROMPT_FORMEL.map(t => ({ art: "text" as const, text: `• ${t}` })),
    { art: "text", text: "Nachschärfen statt neu fragen: »Das ist gut, aber … Behalte den Rest.«" },
    { art: "ueberschrift", text: "Fünf Datenschutzregeln" },
    ...DATENSCHUTZ_REGELN.map((t, i) => ({ art: "text" as const, text: `${i + 1}. ${t}` })),
    { art: "ueberschrift", text: "KI-Antworten prüfen" },
    ...["Stimmen Fakten und Zahlen? (zweite Quelle)", "Gibt es die Quellen wirklich?", "Passt das Niveau zur Klasse?", "Fachsprache korrekt?", "Klischees oder einseitige Darstellung?"]
      .map(t => ({ art: "text" as const, text: `☐ ${t}` })),
    { art: "ueberschrift", text: "Drei Startprompts" },
    { art: "text", text: "Du bist eine erfahrene Lehrkraft für [Fach]. Erstelle drei Einstiege für eine Stunde zum Thema [Thema] in Klasse [Klasse]. Form: je zwei Sätze und Materialbedarf.", mono: true },
    { art: "text", text: "Mach aus diesem Arbeitsblatt drei Fassungen (Basis mit Hilfen, Standard, Erweiterung) mit Lösungen: [Arbeitsblatt]", mono: true },
    { art: "text", text: "Löse diese Aufgabe wie eine gute Schülerin der Klasse [Klasse]. Danach: Wie könnte ich sie umbauen, damit eigenes Denken sichtbar wird? [Aufgabe]", mono: true },
    { art: "ueberschrift", text: "Weiter geht's" },
    { art: "text", text: "Im KI-Kompass: Lernpfad für Lehrkräfte (Für Lehrkräfte → Lernpfad & Workshop), Workflows mit Prompts zum Kopieren, Materialpool des Kollegiums." },
    { art: "text", text: DATENSCHUTZ_REGEL, klein: true, grau: true },
  ];
}
