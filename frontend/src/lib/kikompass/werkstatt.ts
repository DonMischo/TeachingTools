/**
 * Material-Werkstatt: Bausteine, mit denen Lehrkräfte passendes Material zum
 * KI-Kompass erzeugen. Alles läuft im Browser. Herausgegeben werden fertige
 * Prompts für AIS.chat und leere Arbeitsblätter mit Kompetenzkopf.
 *
 * Die fünf Dimensionen (Lernen mit, über, durch, trotz, ohne KI) gehen auf
 * Joscha Falck (2023) zurück. Die Erläuterungen hier sind eigene Kurzfassungen.
 */
import { BEREICHE, STUFEN, saetze, type BereichId, type StufeId } from "./raster";

export type DimensionId = "mit" | "ueber" | "durch" | "trotz" | "ohne";

export const DIMENSIONEN: { id: DimensionId; name: string; text: string }[] = [
  { id: "mit", name: "Lernen mit KI", text: "KI ist Werkzeug: Ideen, Feedback, Erklärungen, Üben." },
  { id: "ueber", name: "Lernen über KI", text: "KI ist Gegenstand: Wie funktioniert sie, wo irrt sie, was macht sie mit uns?" },
  { id: "durch", name: "Lernen durch KI", text: "KI verändert den Lernweg, etwa als Tutor, mit Rückmeldungen oder angepasstem Tempo." },
  { id: "trotz", name: "Lernen trotz KI", text: "Aufgaben, bei denen Lernen gelingt, obwohl KI verfügbar ist (KI-resilient)." },
  { id: "ohne", name: "Lernen ohne KI", text: "Grundlagen bewusst ohne KI, mit Begründung für die Klasse." },
];

/** Operatoren je Stufe, abgeleitet aus dem Raster. */
export const OPERATOREN: Record<StufeId, string[]> = {
  "0": ["nennen", "erzählen", "sortieren", "zeigen"],
  Ia: ["benennen", "erkennen", "auflisten"],
  Ib: ["beschreiben", "schildern", "beachten", "vorschlagen"],
  II: ["vergleichen", "erklären", "erläutern", "prüfen", "diskutieren", "einsetzen"],
  III: ["bewerten", "beurteilen", "entwickeln", "gestalten"],
};

export const MATERIALARTEN = [
  "Arbeitsblatt mit 3 gestuften Aufgaben",
  "Selbst-Check mit 5 Multiple-Choice-Fragen und Begründungen",
  "Fallbeispiel mit Diskussionsfragen",
  "Stationskarte (Erklärung, Auftrag, Reflexion)",
  "Sortieraufgabe mit 8 Karten",
  "Rollenspiel / Debatte mit Rollenkarten",
] as const;

export const DATENSCHUTZ_REGEL =
  "Verwende keine echten Namen oder personenbezogenen Daten; nutze erfundene Beispiele.";

export type MaterialWunsch = {
  fach: string;
  klasse: string;
  thema: string;
  bereich: BereichId;
  stufe: StufeId;
  dimension: DimensionId;
  art: string;
};

/** Prompt, der in AIS.chat passendes Material zum gewählten Rasterfeld erzeugt. */
export function materialPrompt(w: MaterialWunsch): string {
  const b = BEREICHE.find(x => x.id === w.bereich)!;
  const s = STUFEN.find(x => x.id === w.stufe)!;
  const d = DIMENSIONEN.find(x => x.id === w.dimension)!;
  const ziele = saetze(w.bereich, w.stufe).map(k => `- ${k.text}`).join("\n");
  return [
    `Du bist eine erfahrene Lehrkraft für ${w.fach || "das Fach"} und erstellst Unterrichtsmaterial zur KI-Kompetenz.`,
    `Erstelle: ${w.art}.`,
    `Zielgruppe: Klasse ${w.klasse || "5–10"}${w.thema ? `, Thema: ${w.thema}` : ""}.`,
    `Kompetenzbereich: ${b.name} (${b.untertitel}), Stufe ${s.id} »${s.name}« (${s.hinweis}).`,
    `Die Lernenden sollen danach sagen können:\n${ziele}`,
    `Dimension: ${d.name}. ${d.text}`,
    `Benutze Operatoren dieser Stufe: ${OPERATOREN[w.stufe].join(", ")}.`,
    "Schreibe in einfacher, altersgerechter Sprache. Gib am Ende einen kurzen Lösungs- bzw. Erwartungshorizont für die Lehrkraft an.",
    DATENSCHUTZ_REGEL,
  ].join("\n\n");
}

export type EinsatzId = "ohne" | "punktuell" | "durchgehend";
export const EINSATZ: { id: EinsatzId; name: string; text: string }[] = [
  { id: "ohne", name: "ohne KI", text: "z. B. Präsenzaufgabe, Grundlagen" },
  { id: "punktuell", name: "punktuell mit KI", text: "KI nur in festgelegten Schritten, z. B. Ideen oder Feedback" },
  { id: "durchgehend", name: "durchgehend mit KI", text: "KI in allen Schritten, z. B. Projekt, Portfolio" },
];

export const RESILIENZ = [
  { id: "medium", text: "Medienwechsel: Ergebnis als Skizze, Video, Modell, Vortrag statt nur Text" },
  { id: "persoenlich", text: "Persönlicher oder regionaler Bezug (eigene Erfahrung, Schulort, aktuelles Klassenereignis)" },
  { id: "prozess", text: "Zwischenstände abgeben (Gliederung, Entwurf, Überarbeitung)" },
  { id: "muendlich", text: "Kurze mündliche Rückfrage oder Präsentation" },
  { id: "reflexion", text: "Reflexionsteil: Was habe ich wie gemacht, wo half KI, wo nicht?" },
  { id: "pruefen", text: "KI-Ausgabe kritisch prüfen und Fehler markieren als Teil der Aufgabe" },
] as const;

export type Umbau = {
  aufgabe: string;
  fach: string;
  klasse: string;
  dimension: DimensionId;
  einsatz: EinsatzId;
  zuhause: boolean;
  resilienz: string[];
};

/** Hinweise, was beim Umbau noch fehlt. */
export function umbauHinweise(u: Umbau): string[] {
  const h: string[] = [];
  if (u.zuhause && u.einsatz !== "durchgehend" && u.resilienz.length < 2)
    h.push("Zu Hause ist KI immer verfügbar: Wähle mindestens zwei Resilienz-Bausteine oder plane den KI-Einsatz offen ein.");
  if (u.einsatz !== "ohne" && !u.resilienz.includes("reflexion"))
    h.push("Mit KI-Einsatz gehört ein Reflexionsteil dazu (Nutzungserklärung).");
  if (u.dimension === "ohne" && u.einsatz !== "ohne")
    h.push("Dimension »ohne KI« passt nicht zu einem KI-Einsatz.");
  if (u.einsatz === "ohne" && u.dimension === "ohne")
    h.push("Begründe der Klasse, warum diese Aufgabe ohne KI gelöst wird.");
  return h;
}

/** Prompt für AIS.chat, der die bestehende Aufgabe umbaut. */
export function umbauPrompt(u: Umbau): string {
  const d = DIMENSIONEN.find(x => x.id === u.dimension)!;
  const e = EINSATZ.find(x => x.id === u.einsatz)!;
  const bausteine = RESILIENZ.filter(r => u.resilienz.includes(r.id)).map(r => `- ${r.text}`).join("\n");
  return [
    `Du bist eine erfahrene Lehrkraft für ${u.fach || "das Fach"}. Überarbeite die folgende Aufgabe für Klasse ${u.klasse || "5–10"}.`,
    `Ursprüngliche Aufgabe:\n"""\n${u.aufgabe.trim()}\n"""`,
    `Ziel-Dimension: ${d.name} (${d.text}). KI-Einsatz: ${e.name} (${e.text}). Bearbeitung: ${u.zuhause ? "zu Hause" : "im Unterricht unter Aufsicht"}.`,
    bausteine ? `Baue diese Elemente ein:\n${bausteine}` : "",
    u.einsatz !== "ohne" ? "Lege genau fest, in welchen Schritten KI erlaubt ist, und füge eine kurze KI-Nutzungserklärung hinzu." : "Formuliere einen Satz, der den Lernenden begründet, warum hier ohne KI gearbeitet wird.",
    "Gib die überarbeitete Aufgabe als Schülerfassung aus und danach einen kurzen Erwartungshorizont mit Operatoren.",
    DATENSCHUTZ_REGEL,
  ].filter(Boolean).join("\n\n");
}
