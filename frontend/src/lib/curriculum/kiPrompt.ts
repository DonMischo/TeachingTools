/**
 * Prompts für einen KI-Chat (ChatGPT, Copilot, Mistral …), die Teile einer
 * Curriculum-Vorlage zurückgeben. Die Antwort wird als JSON hochgeladen
 * (oder eingefügt); `antwortLesen` holt den JSON-Block aus dem Chattext.
 *
 * Die Regeln für die Niveaus sind die, nach denen die Thüringer Pläne
 * gebaut sind: Anspruchsebene I = Hauptschule, II = Realschule; im alten
 * RS-Plan zusätzlich »Kurs II« (nur R) und das Kapitel Kl. 9 HS-Kurs.
 */
import type { Thema, Vorlage } from "./modell";

const KARTE = `Karte = ein Spiegelstrich der Sach-(und Methoden-)kompetenz; Unterpunkte gehören in denselben Text.
Nicht übernehmen: Lernausgangslage, Selbst- und Sozialkompetenz, Querschnittsaufgaben.
{
  "id": "<lehrplan>-<56|78|910>-<zahl|fkt|geo|stoch|gr>-<laufende Nr. zweistellig>",
  "block": "5/6" | "7/8" | "9/10",
  "klasse": Klassenstufe der Zielbeschreibung (6, 8, 9 oder 10),
  "bereich": "Zahl & Algebra" | "Funktionen" | "Geometrie" | "Stochastik" | "Größen",
  "lernbereich": Überschrift des Lernbereichs im Lehrplan,
  "titel": eigene Kurzform, höchstens 60 Zeichen,
  "niveaus": { "G"?: Wortlaut, "R"?: Wortlaut, "H"?: Wortlaut },
  "seite": gedruckte Seitenzahl
}`;

const NIVEAU_REGELN = `Niveaus:
- Gymnasium: nur "G".
- Regelschule: Text für beide Abschlüsse → "R" und "H" mit gleichem Text.
  Anspruchsebene I (Spalte oder Fußnote) → nur "H"; Anspruchsebene II → nur "R".
  Stehen AE I und AE II nebeneinander und unterscheiden sich nur in einem Satzteil: EINE Karte, "H" und "R" je ganz ausformuliert.
  Alter RS-Plan: »Kurs II« → nur "R"; Kapitel »Klassenstufe 9 – hauptschulabschlussbezogener Kurs« → nur "H" (klasse 9); »Klassenstufen 9/10 – realschulbezogen« → nur "R".
  Hauptschulniveau endet mit Klasse 9; Klasse 10 ist nur "R".
- Achte beim Regelschul-Plan besonders auf alles, was ausdrücklich für den Hauptschulabschluss gilt.`;

const PAAR = `Paar (alte ↔ neue Karte):
{
  "alt": [alte Karten-ids] (leer bei neu),
  "neu": [neue Karten-ids] (leer bei entfallen),
  "status": "identisch" | "geändert" | "verschoben" | "neu" | "entfallen",
  "niveaus": betroffene Niveaus, z. B. ["R","H"],
  "unterschied": kurz und konkret, was sich ändert ("" bei identisch),
  "von": Block alt, "nach": Block neu   (nur bei verschoben)
}
- Jede alte und jede neue Karte kommt in mindestens einem Paar vor.
- verschoben = anderer Block; inhaltliche Änderungen dann zusätzlich in "unterschied".
- Paare dürfen mehrere Karten je Seite haben (aufgeteilt / zusammengelegt).
- Ändert sich nur ein Niveau (z. B. nur Hauptschule), gehört das in "niveaus" und "unterschied".`;

export type KiArt = "vergleich" | "zuordnung";

export function vergleichPrompt(v: Vorlage, o: { schulart: "RS" | "GY"; altId: string; neuId: string; alteKartenMit: boolean }): string {
  const alt = v.lehrplaene.find(l => l.id === o.altId);
  const teile = [
    `Du vergleichst zwei Thüringer Lehrpläne ${v.fach} für die ${o.schulart === "RS" ? "Regelschule (Haupt- und Realschulabschluss)" : "das Gymnasium"}, Klassen 5–10.`,
    `Im Anhang: der ALTE und der NEUE Lehrplan (PDF). Arbeite die Klassenstufen 5–10 vollständig ab, Lernbereich für Lernbereich.`,
    ``,
    `Gib GENAU EINEN JSON-Codeblock zurück, ohne weiteren Text, in diesem Aufbau:`,
    `{
  "format": "tt-curriculum/1",
  "lehrplaene": [
    { "id": "${o.altId}", "rolle": "alt", "schulart": "${o.schulart}", "titel": …, "fassung": …, "karten": [Karte, …] },
    { "id": "${o.neuId}", "rolle": "neu", "schulart": "${o.schulart}", "titel": …, "fassung": …,
      "inkraft": { "5": Schuljahr, "6": …, … }, "karten": [Karte, …] }
  ],
  "abgleich": [Paar, …]
}`,
    ``, KARTE, ``, NIVEAU_REGELN, ``, PAAR,
    ``,
    `"inkraft": je Klassenstufe das Schuljahr, ab dem der neue Plan dort gilt (steht auf dem Deckblatt), z. B. "2026/27".`,
    `Ist die Antwort zu lang, gib zuerst Block 5/6 aus und warte auf »weiter« für 7/8 und 9/10 — jeweils als eigenes vollständiges JSON im selben Aufbau.`,
  ];
  if (o.alteKartenMit && alt?.karten.length) {
    teile.push(
      ``,
      `Der alte Plan ist schon erfasst. Übernimm diese Karten UNVERÄNDERT (gleiche ids) statt ihn neu zu lesen, und gib im JSON für "${o.altId}" nur die ids an ("karten": [] reicht):`,
      JSON.stringify(alt.karten.map(k => ({ id: k.id, block: k.block, titel: k.titel, niveaus: k.niveaus }))),
    );
  }
  return teile.join("\n");
}

export function zuordnungPrompt(v: Vorlage, o: { rolle: "alt" | "neu"; nurOhne: boolean }): string {
  const themen: { klasse: number; t: Thema }[] = v.curriculum.klassen.flatMap(k =>
    k.themen.filter(t => !o.nurOhne || t.karten.length === 0).map(t => ({ klasse: k.klasse, t })));
  const karten = v.lehrplaene.filter(l => l.rolle === o.rolle).flatMap(l =>
    l.karten.map(k => ({ id: k.id, block: k.block, titel: k.titel, text: Object.entries(k.niveaus).map(([n, t]) => `${n}: ${t}`).join(" | ") })));
  return [
    `Ordne den Themen unseres schulinternen Curriculums (${v.fach}) die passenden Karten des ${o.rolle === "alt" ? "ALTEN" : "NEUEN"} Lehrplans zu.`,
    `Ein Thema bekommt alle Karten, die es inhaltlich abdeckt (auf irgendeinem Niveau G/R/H). Karten aus einem anderen Klassenblock nur, wenn das Thema sie wirklich unterrichtet.`,
    `Eine Karte darf mehreren Themen zugeordnet werden. Karten, die zu keinem Thema passen, weglassen.`,
    ``,
    `Gib GENAU EINEN JSON-Codeblock zurück, ohne weiteren Text:`,
    `{ "format": "tt-curriculum/1", "zuordnung": [ { "thema": "<thema-id>", "karten": ["<karten-id>", …] }, … ] }`,
    ``,
    `THEMEN (Klasse, id, Titel, Inhalte je Niveau):`,
    ...themen.map(({ klasse, t }) =>
      `- Kl. ${klasse} · ${t.id} · ${t.titel}: ${Object.entries(t.inhalte).map(([n, x]) => `${n}: ${x.replace(/\n/g, "; ")}`).join(" | ")}`),
    ``,
    `KARTEN:`,
    JSON.stringify(karten),
  ].join("\n");
}

/** JSON aus einer Chat-Antwort holen: ```json-Block, sonst vom ersten { bis zum letzten }. */
export function antwortLesen(text: string): unknown {
  const block = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const roh = block ? block[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(roh);
}
