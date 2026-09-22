/**
 * Die Aufgaben für das Attention-Minispiel.
 *
 * Attention ist der Trick, der Sprachmodelle von unserem Wortnetz trennt: Statt
 * stur auf das letzte Wort zu schauen, sucht sich das Modell für *jedes* Wort
 * aus, welche früheren Wörter jetzt wichtig sind. Genau das lässt sich spielen,
 * ohne ein Modell zu haben — man muss die Klasse nur dasselbe tun lassen.
 *
 * Die Aufgaben sind Paare: zwei Sätze, die sich in **einem einzigen Wort**
 * unterscheiden, und die Antwort kippt. Das ist der Beweis, dass es ohne
 * Verstehen des ganzen Satzes nicht geht — ein Netz, das nur zählt, welches
 * Wort auf welches folgt, müsste bei beiden Sätzen dasselbe antworten.
 *
 * (Solche Paare heißen in der Forschung Winograd-Schemata und wurden genau zu
 * diesem Zweck erfunden: als Prüfung, die sich nicht durch Statistik über
 * einzelne Wörter lösen lässt.)
 */

/** Wonach gefragt wird — die Auswertung gruppiert danach. */
export type AttentionArt = "pronomen" | "bedeutung" | "verbklammer" | "satzbau";

export const ART_TITEL: Record<AttentionArt, string> = {
  pronomen: "Wer ist gemeint?",
  bedeutung: "Was bedeutet das Wort hier?",
  verbklammer: "Was gehört zum Verb?",
  satzbau: "Wer gehört zu wem?",
};

export type AttentionAufgabe = {
  id: string;
  art: AttentionArt;
  /** Die Frage über dem Satz. Fehlt sie, wird nach dem Bezug gefragt. */
  frageText?: string;
  /** Die Wörter des Satzes, so wie sie angezeigt werden. */
  woerter: string[];
  /** Das Wort, das »zurückschaut« — meistens ein Pronomen. */
  frage: number;
  /** Worauf es sich bezieht. */
  ziel: number;
  /** Welche Wörter angetippt werden dürfen (die in Frage kommenden Nomen). */
  wahlbar: number[];
  /** Was ein Modell sich ansehen würde: Wortindex → Gewicht (0–1). */
  modell: Record<number, number>;
  /** Warum es dieses Wort ist — nach dem Antippen zu lesen. */
  erklaerung: string;
  /** Aufgaben mit derselben Paar-Nummer unterscheiden sich in einem Wort. */
  paar?: string;
  /** Das Wort, das den Unterschied macht (für die Auflösung hervorgehoben). */
  schluesselwort?: number;
};

export const ATTENTION_AUFGABEN: AttentionAufgabe[] = [
  {
    id: "pokal-gross",
    art: "pronomen",
    paar: "pokal",
    woerter: ["Der", "Pokal", "passt", "nicht", "in", "den", "Koffer,", "weil", "er", "zu", "groß", "ist."],
    frage: 8,
    ziel: 1,
    wahlbar: [1, 6],
    modell: { 1: 0.62, 6: 0.22, 10: 0.11 },
    schluesselwort: 10,
    erklaerung: "»Zu groß« ist der Pokal — ein Koffer, der zu groß ist, wäre ja kein Problem.",
  },
  {
    id: "pokal-klein",
    art: "pronomen",
    paar: "pokal",
    woerter: ["Der", "Pokal", "passt", "nicht", "in", "den", "Koffer,", "weil", "er", "zu", "klein", "ist."],
    frage: 8,
    ziel: 6,
    wahlbar: [1, 6],
    modell: { 6: 0.58, 1: 0.24, 10: 0.13 },
    schluesselwort: 10,
    erklaerung: "Ein einziges Wort hat sich geändert — und »er« meint jetzt den Koffer. Genau das kann kein Modell schaffen, das nur auf das letzte Wort schaut.",
  },
  {
    id: "buch-schon",
    art: "pronomen",
    paar: "buch",
    woerter: ["Paul", "gab", "Tim", "das", "Buch,", "weil", "er", "es", "schon", "gelesen", "hatte."],
    frage: 6,
    ziel: 0,
    wahlbar: [0, 2, 4],
    modell: { 0: 0.55, 2: 0.27, 8: 0.1 },
    schluesselwort: 8,
    erklaerung: "Wer etwas verschenkt, hat es schon gelesen: »er« ist Paul.",
  },
  {
    id: "buch-noch-nicht",
    art: "pronomen",
    paar: "buch",
    woerter: ["Paul", "gab", "Tim", "das", "Buch,", "weil", "er", "es", "nie", "gelesen", "hatte."],
    frage: 6,
    ziel: 2,
    wahlbar: [0, 2, 4],
    modell: { 2: 0.52, 0: 0.3, 8: 0.1 },
    schluesselwort: 8,
    erklaerung: "Ein Wort weiter — »schon« ist zu »nie« geworden, und »er« ist jetzt Tim, der das Buch bekommt, weil er es noch nicht kennt.",
  },
  {
    id: "anruf-frage",
    art: "pronomen",
    paar: "anruf",
    woerter: ["Anna", "rief", "Lisa", "an,", "weil", "sie", "eine", "Frage", "hatte."],
    frage: 5,
    ziel: 0,
    wahlbar: [0, 2],
    modell: { 0: 0.57, 2: 0.26, 7: 0.1 },
    schluesselwort: 7,
    erklaerung: "Wer eine Frage hat, ruft an: »sie« ist Anna.",
  },
  {
    id: "anruf-antwort",
    art: "pronomen",
    paar: "anruf",
    woerter: ["Anna", "rief", "Lisa", "an,", "weil", "sie", "eine", "Antwort", "hatte."],
    frage: 5,
    ziel: 2,
    wahlbar: [0, 2],
    modell: { 2: 0.54, 0: 0.28, 7: 0.11 },
    schluesselwort: 7,
    erklaerung: "Nur »Frage« ist zu »Antwort« geworden — und angerufen wird die, die Bescheid weiß: »sie« ist Lisa.",
  },
  {
    id: "kiste-breit",
    art: "pronomen",
    paar: "kiste",
    woerter: ["Die", "Kiste", "passt", "nicht", "durch", "die", "Tür,", "weil", "sie", "zu", "breit", "ist."],
    frage: 8,
    ziel: 1,
    wahlbar: [1, 6],
    modell: { 1: 0.6, 6: 0.23, 10: 0.11 },
    schluesselwort: 10,
    erklaerung: "Zu breit ist hier die Kiste.",
  },
  {
    id: "kiste-schmal",
    art: "pronomen",
    paar: "kiste",
    woerter: ["Die", "Kiste", "passt", "nicht", "durch", "die", "Tür,", "weil", "sie", "zu", "schmal", "ist."],
    frage: 8,
    ziel: 6,
    wahlbar: [1, 6],
    modell: { 6: 0.59, 1: 0.24, 10: 0.12 },
    schluesselwort: 10,
    erklaerung: "»Schmal« statt »breit« — und gemeint ist die Tür.",
  },
  {
    id: "katze-sofa",
    art: "satzbau",
    frageText: "Wer schnurrt?",
    woerter: ["Die", "Katze,", "die", "auf", "dem", "Sofa", "liegt,", "schnurrt", "laut."],
    frage: 7,
    ziel: 1,
    wahlbar: [1, 5],
    modell: { 1: 0.66, 5: 0.14, 2: 0.08 },
    erklaerung: "Zwischen »Katze« und »schnurrt« stehen fünf Wörter. Unser Wortnetz hätte die Katze da längst vergessen — es sieht nur »liegt,« davor.",
  },
  {
    id: "schluessel",
    art: "pronomen",
    woerter: ["Der", "Schlüssel", "für", "die", "Schränke", "liegt", "in", "der", "Schublade.", "Er", "ist", "golden."],
    frage: 9,
    ziel: 1,
    wahlbar: [1, 4, 8],
    modell: { 1: 0.68, 8: 0.12, 4: 0.09 },
    erklaerung: "Hier hilft die Grammatik: »Er« ist männlich und Einzahl — das passt nur zum Schlüssel, nicht zu den Schränken (Mehrzahl) und nicht zur Schublade (weiblich).",
  },

  // ── Wortbedeutung: dasselbe Wort, zwei Bedeutungen ────────────────────
  // Hier zeigt der Bogen nicht auf ein Pronomen, sondern auf das Wort, das
  // die Bedeutung festlegt. Fuer ein Modell ist das dieselbe Rechnung — es
  // sucht in beiden Faellen, welches frühere Wort jetzt zaehlt.
  {
    id: "schloss-turm",
    art: "bedeutung",
    paar: "schloss",
    frageText: "Welches Wort verrät, was »Schloss« hier bedeutet?",
    woerter: ["Sie", "fotografierte", "das", "Schloss", "mit", "dem", "Turm."],
    frage: 3,
    ziel: 6,
    wahlbar: [1, 6],
    modell: { 6: 0.64, 1: 0.18, 2: 0.08 },
    schluesselwort: 6,
    erklaerung: "Ein Turm gehört zu einem Gebäude — gemeint ist das Schloss des Königs.",
  },
  {
    id: "schloss-schluessel",
    art: "bedeutung",
    paar: "schloss",
    frageText: "Welches Wort verrät, was »Schloss« hier bedeutet?",
    woerter: ["Sie", "fotografierte", "das", "Schloss", "mit", "dem", "Schlüssel."],
    frage: 3,
    ziel: 6,
    wahlbar: [1, 6],
    modell: { 6: 0.66, 1: 0.16, 2: 0.08 },
    schluesselwort: 6,
    erklaerung: "Ein Schlüssel gehört zu einem Türschloss. Ein einziges Wort später im Satz entscheidet, welches Bild du im Kopf hast.",
  },
  {
    id: "maus-tastatur",
    art: "bedeutung",
    paar: "maus",
    frageText: "Welches Wort verrät, was »Maus« hier bedeutet?",
    woerter: ["Die", "Maus", "lag", "direkt", "neben", "der", "Tastatur."],
    frage: 1,
    ziel: 6,
    wahlbar: [2, 6],
    modell: { 6: 0.68, 2: 0.13, 4: 0.07 },
    schluesselwort: 6,
    erklaerung: "Neben einer Tastatur liegt das Gerät, nicht das Tier.",
  },
  {
    id: "maus-falle",
    art: "bedeutung",
    paar: "maus",
    frageText: "Welches Wort verrät, was »Maus« hier bedeutet?",
    woerter: ["Die", "Maus", "lag", "direkt", "neben", "der", "Falle."],
    frage: 1,
    ziel: 6,
    wahlbar: [2, 6],
    modell: { 6: 0.67, 2: 0.14, 4: 0.07 },
    schluesselwort: 6,
    erklaerung: "Neben einer Falle liegt das Tier. Das Wort »Maus« hat sich nicht geändert — nur sein Nachbar.",
  },
  {
    id: "ball-gaeste",
    art: "bedeutung",
    paar: "ball",
    frageText: "Welches Wort verrät, was »Ball« hier bedeutet?",
    woerter: ["Am", "Abend", "war", "der", "Ball", "voller", "Gäste."],
    frage: 4,
    ziel: 6,
    wahlbar: [1, 6],
    modell: { 6: 0.7, 1: 0.12, 5: 0.07 },
    schluesselwort: 6,
    erklaerung: "Voller Gäste ist ein Fest — der Ball, auf dem getanzt wird.",
  },
  {
    id: "ball-luft",
    art: "bedeutung",
    paar: "ball",
    frageText: "Welches Wort verrät, was »Ball« hier bedeutet?",
    woerter: ["Am", "Abend", "war", "der", "Ball", "voller", "Luft."],
    frage: 4,
    ziel: 6,
    wahlbar: [1, 6],
    modell: { 6: 0.69, 1: 0.13, 5: 0.07 },
    schluesselwort: 6,
    erklaerung: "Voller Luft ist der Ball zum Spielen. Dasselbe Wort, ein anderes Ding — entschieden vom letzten Wort im Satz.",
  },

  // ── Verbklammer: das deutsche Verb steht an zwei Stellen ──────────────
  {
    id: "fenster-auf",
    art: "verbklammer",
    frageText: "Zu welchem Wort gehört »auf«?",
    woerter: ["Am", "Morgen", "macht", "Paul", "das", "Fenster", "weit", "auf."],
    frage: 7,
    ziel: 2,
    wahlbar: [2, 3, 5],
    modell: { 2: 0.63, 5: 0.14, 6: 0.09 },
    erklaerung: "»aufmachen« ist ein Wort, das im Satz auseinandergerissen wird — der Anfang steht vorn, das Ende ganz hinten. Fünf Wörter dazwischen muss ein Modell überbrücken.",
  },
  {
    id: "klasse-ein",
    art: "verbklammer",
    frageText: "Zu welchem Wort gehört »ein«?",
    woerter: ["Tim", "lädt", "am", "Samstag", "seine", "ganze", "Klasse", "ein."],
    frage: 7,
    ziel: 1,
    wahlbar: [1, 6],
    modell: { 1: 0.66, 6: 0.13, 3: 0.07 },
    erklaerung: "»einladen«: »lädt« vorn, »ein« hinten. Ohne das letzte Wort wüsste man nicht einmal, was Tim tut.",
  },
  {
    id: "apfelbaum-gepflanzt",
    art: "verbklammer",
    frageText: "Welches Wort gehört zu »gepflanzt«?",
    woerter: ["Lisa", "hat", "gestern", "im", "Garten", "einen", "Apfelbaum", "gepflanzt."],
    frage: 7,
    ziel: 1,
    wahlbar: [0, 1, 6],
    modell: { 1: 0.61, 6: 0.16, 0: 0.09 },
    erklaerung: "»hat … gepflanzt« gehört zusammen, obwohl sechs Wörter dazwischenstehen. Diese Satzklammer ist im Deutschen die Regel — und für Modelle eine Übung im Weitschauen.",
  },

  // ── Satzbau: Bezüge über Satzteile und Satzgrenzen hinweg ─────────────
  {
    id: "bruder-relativ",
    art: "satzbau",
    frageText: "Worauf bezieht sich das zweite »der«?",
    woerter: ["Der", "Bruder", "meiner", "Freundin,", "der", "in", "Berlin", "wohnt,", "kommt", "morgen."],
    frage: 4,
    ziel: 1,
    wahlbar: [1, 3, 6],
    modell: { 1: 0.64, 3: 0.19, 6: 0.06 },
    erklaerung: "»der« ist männlich — die Freundin scheidet damit aus, obwohl sie direkt davorsteht. Hier hilft die Grammatik gegen die Nähe.",
  },
  {
    id: "hund-satzgrenze",
    art: "satzbau",
    frageText: "Worauf bezieht sich »Er«?",
    woerter: ["Lisa", "holte", "den", "Hund", "aus", "dem", "Garten.", "Er", "bellte", "laut."],
    frage: 7,
    ziel: 3,
    wahlbar: [0, 3, 6],
    modell: { 3: 0.62, 6: 0.17, 0: 0.08 },
    erklaerung: "Der Bezug geht über den Punkt hinweg. »Lisa« scheidet grammatisch aus, »Garten« inhaltlich — Gärten bellen nicht.",
  },
];

/** Die Aufgaben eines Paares — für die Auflösung »ein Wort, andere Antwort«. */
export function partner(aufgabe: AttentionAufgabe): AttentionAufgabe | null {
  if (!aufgabe.paar) return null;
  return ATTENTION_AUFGABEN.find(a => a.paar === aufgabe.paar && a.id !== aufgabe.id) ?? null;
}
