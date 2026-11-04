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

const MATHE_BEREICHE = ["Zahl & Algebra", "Funktionen", "Geometrie", "Stochastik", "Größen"];

/** Bereiche: die schon im Plan stehen, sonst bei Mathe die üblichen, sonst frei. */
function bereiche(v: Vorlage): string {
  const da = [...new Set(v.lehrplaene.flatMap(l => l.karten.map(k => k.bereich).filter((b): b is string => !!b)))];
  const liste = da.length ? da : /mathe/i.test(v.fach) ? MATHE_BEREICHE : [];
  return liste.length
    ? liste.map(b => `"${b}"`).join(" | ") + " (bei Bedarf weitere)"
    : `Themenfeld des Fachs, kurz (z. B. "Mechanik", "Optik") — dieselben Namen in allen Lehrplänen`;
}

function karte(v: Vorlage): string {
  return `Karte = ein Spiegelstrich der Sach-(und Methoden-)kompetenz; Unterpunkte gehören in denselben Text.
Nicht übernehmen: Lernausgangslage, Selbst- und Sozialkompetenz, Querschnittsaufgaben, Beispiellisten (»geeignet sind …«).
Verbindliche Schülerexperimente/Beobachtungen mit Protokoll werden eigene Karten (titel »Schülerexperiment: …«).
{
  "id": "<lehrplan-id>-<56|78|910>-<Kürzel des Bereichs>-<laufende Nr. zweistellig>",
  "block": "5/6" | "7/8" | "9/10",
  "klasse": Klassenstufe der Zielbeschreibung (z. B. 6, 8, 9 oder 10),
  "bereich": ${bereiche(v)},
  "lernbereich": Überschrift des Lernbereichs im Lehrplan,
  "titel": eigene Kurzform, höchstens 60 Zeichen,
  "niveaus": { "G"?: Wortlaut, "R"?: Wortlaut, "H"?: Wortlaut },
  "seite": gedruckte Seitenzahl
}`;
}

const REGEL_GY = `- Gymnasium: nur "G".`;
const REGEL_RS = `- Regelschule: Text für beide Abschlüsse → "R" und "H" mit gleichem Text.
  Anspruchsebene I (Spalte oder Fußnote) → nur "H"; Anspruchsebene II → nur "R".
  Stehen AE I und AE II nebeneinander und unterscheiden sich nur in einem Satzteil: EINE Karte, "H" und "R" je ganz ausformuliert.
  Alter RS-Plan: »Kurs II« → nur "R"; Kapitel »Klassenstufe 9 – hauptschulabschlussbezogener Kurs« → nur "H" (klasse 9); »Klassenstufen 9/10 – realschulbezogen« → nur "R".
  Hauptschulniveau endet mit Klasse 9; Klasse 10 ist nur "R".
  Achte besonders auf alles, was ausdrücklich für den Hauptschulabschluss gilt.`;

const PAAR = `Paar (alte ↔ neue Karte, immer innerhalb EINER Schulart):
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

const EINHEITEN = `Klasse (curriculum) — je Klassenstufe die Unterrichtseinheiten, LEER (die Karten ordnet die Fachschaft selbst zu):
{ "klasse": 7, "wochen_verfuegbar": 36, "themen": [
  { "id": "k7-t1", "titel": <Name des Lernbereichs, ohne Unterabschnitt>, "wochen": null, "inhalte": {}, "karten": [], "notiz": "" }, …
] }
- Je Lernbereich des NEUEN Lehrplans eine Einheit, in der Reihenfolge des Lehrplans; gleicher Lernbereich in beiden Schularten = eine Einheit.
- Doppeljahrgänge (5/6, 7/8): die Einheit in BEIDE Klassen. Bei 9 und 10 in die Klasse, die der Lehrplan nennt.
- ids je Klasse fortlaufend: k<Klasse>-t1, k<Klasse>-t2, …`;

export type KiArt = "vergleich" | "zuordnung";
export type Schulart = "RS" | "GY";
const SCHULART_NAME: Record<Schulart, string> = { RS: "Regelschule (Haupt- und Realschulabschluss)", GY: "Gymnasium" };

/** id eines Plans dieser Schulart und Rolle — vorhandene behalten, sonst z. B. »rs_neu«. */
export function planId(v: Vorlage, schulart: Schulart, rolle: "alt" | "neu"): string {
  return v.lehrplaene.find(l => l.rolle === rolle && l.schulart === schulart)?.id ?? `${schulart.toLowerCase()}_${rolle}`;
}

/**
 * Prompt für eine oder beide Schularten. Mit `mitAlt` werden alter und neuer
 * Plan verglichen (Karten + Abgleich), ohne nur die neuen Pläne erfasst.
 * Schon erfasste alte Pläne kann man mitschicken: Die KI lässt sie dann im
 * JSON weg — beim Hochladen bleiben sie stehen, weil nur mitgeschickte
 * Lehrpläne ersetzt werden.
 */
export function vergleichPrompt(v: Vorlage, o: { schularten: Schulart[]; mitAlt: boolean; alteKartenMit: boolean }): string {
  const arten = o.schularten;
  const beide = arten.length > 1;
  const erfasst = (s: Schulart) => o.mitAlt && o.alteKartenMit && !!v.lehrplaene.find(l => l.id === planId(v, s, "alt"))?.karten.length;
  const pdfs = arten.flatMap(s => o.mitAlt ? [`${s} alt`, `${s} neu`] : [`${s} neu`]).filter(x => !(x.endsWith("alt") && erfasst(x.slice(0, 2) as Schulart)));
  const planZeilen = arten.flatMap(s => [
    ...(o.mitAlt && !erfasst(s) ? [`    { "id": "${planId(v, s, "alt")}", "rolle": "alt", "schulart": "${s}", "titel": …, "fassung": …, "karten": [Karte, …] }`] : []),
    `    { "id": "${planId(v, s, "neu")}", "rolle": "neu", "schulart": "${s}", "titel": …, "fassung": …,
      "inkraft": { "<Klassenstufe>": Schuljahr, … }, "karten": [Karte, …] }`,
  ]);
  const teile = [
    o.mitAlt
      ? `Du vergleichst Thüringer Lehrpläne ${v.fach} — ${arten.map(s => SCHULART_NAME[s]).join(" und ")} — jeweils ALT gegen NEU, Sekundarstufe I bis Klasse 10.`
      : `Du erfasst ${beide ? "die neuen Thüringer Lehrpläne" : "den neuen Thüringer Lehrplan"} ${v.fach} — ${arten.map(s => SCHULART_NAME[s]).join(" und ")} — Sekundarstufe I bis Klasse 10.`,
    `Im Anhang (PDF): ${pdfs.join(", ")}. Arbeite alle Klassenstufen bis 10 vollständig ab, Lernbereich für Lernbereich.`,
    ``,
    `Gib GENAU EINEN JSON-Codeblock zurück, ohne weiteren Text, in diesem Aufbau:`,
    `{
  "format": "tt-curriculum/1",
  "fach": "${v.fach}",
  "lehrplaene": [
${planZeilen.join(",\n")}
  ]${o.mitAlt ? `,
  "abgleich": [Paar, …]` : ""},
  "curriculum": { "stand": "", "klassen": [Klasse, …] }
}`,
    ``, karte(v), ``, `Niveaus:`, ...arten.map(s => (s === "GY" ? REGEL_GY : REGEL_RS)),
    ...(o.mitAlt ? [``, PAAR] : []),
    ``, EINHEITEN,
    ``,
    `"inkraft": je Klassenstufe das Schuljahr, ab dem der neue Plan dort gilt (steht auf dem Deckblatt), z. B. "2026/27".`,
    beide
      ? `Ist die Antwort zu lang, gib zuerst die Regelschule aus und warte auf »weiter« für das Gymnasium — jeweils als eigenes vollständiges JSON im selben Aufbau.`
      : `Ist die Antwort zu lang, gib zuerst Block 5/6 aus und warte auf »weiter« für 7/8 und 9/10 — jeweils als eigenes vollständiges JSON im selben Aufbau.`,
  ];
  for (const s of arten) {
    if (!erfasst(s)) continue;
    const alt = v.lehrplaene.find(l => l.id === planId(v, s, "alt"))!;
    teile.push(
      ``,
      `Der alte ${s}-Plan ist schon erfasst. Lies ihn NICHT neu und lass ihn im JSON weg (er bleibt beim Hochladen erhalten). Nutze im Abgleich diese Karten-ids:`,
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
    `Ordne den Unterrichtseinheiten unseres schulinternen Curriculums (${v.fach}) die passenden Karten des ${o.rolle === "alt" ? "ALTEN" : "NEUEN"} Lehrplans zu.`,
    `Eine Unterrichtseinheit bekommt alle Karten, die sie inhaltlich abdeckt (auf irgendeinem Niveau G/R/H). Karten aus einem anderen Klassenblock nur, wenn die Einheit sie wirklich unterrichtet. Die Niveaus verteilt das Tool selbst (GY → G, RS → R und H).`,
    `Eine Karte darf mehreren Unterrichtseinheiten zugeordnet werden. Karten, die zu keiner Einheit passen, weglassen.`,
    ``,
    `Gib GENAU EINEN JSON-Codeblock zurück, ohne weiteren Text:`,
    `{ "format": "tt-curriculum/1", "zuordnung": [ { "thema": "<id der Unterrichtseinheit>", "karten": ["<karten-id>", …] }, … ] }`,
    ``,
    `UNTERRICHTSEINHEITEN (Klasse, id, Titel, Inhalte je Niveau):`,
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
