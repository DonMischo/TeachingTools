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

export type AttentionAufgabe = {
  id: string;
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
    woerter: ["Die", "Katze,", "die", "auf", "dem", "Sofa", "liegt,", "schnurrt", "laut."],
    frage: 7,
    ziel: 1,
    wahlbar: [1, 5],
    modell: { 1: 0.66, 5: 0.14, 2: 0.08 },
    erklaerung: "Zwischen »Katze« und »schnurrt« stehen fünf Wörter. Unser Wortnetz hätte die Katze da längst vergessen — es sieht nur »liegt,« davor.",
  },
  {
    id: "schluessel",
    woerter: ["Der", "Schlüssel", "für", "die", "Schränke", "liegt", "in", "der", "Schublade.", "Er", "ist", "golden."],
    frage: 9,
    ziel: 1,
    wahlbar: [1, 4, 8],
    modell: { 1: 0.68, 8: 0.12, 4: 0.09 },
    erklaerung: "Hier hilft die Grammatik: »Er« ist männlich und Einzahl — das passt nur zum Schlüssel, nicht zu den Schränken (Mehrzahl) und nicht zur Schublade (weiblich).",
  },
];

/** Die Aufgaben eines Paares — für die Auflösung »ein Wort, andere Antwort«. */
export function partner(aufgabe: AttentionAufgabe): AttentionAufgabe | null {
  if (!aufgabe.paar) return null;
  return ATTENTION_AUFGABEN.find(a => a.paar === aufgabe.paar && a.id !== aufgabe.id) ?? null;
}
