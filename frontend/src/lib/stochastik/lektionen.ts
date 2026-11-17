/**
 * Die Lektionen der Sim nach dem Thüringer Lehrplan Mathematik 2026
 * (Regelschule und Gymnasium, Bereich Stochastik). Je Lektion: Doppel-
 * klassenstufe, Niveaus, die Lehrplan-Karten (Ids aus
 * public/curriculum/mathematik_thueringen.json), worauf sie aufbaut und was
 * früher (RS 2011 / GY 2018) in welcher Klasse kam – für Klassen im Übergang.
 *
 * Niveaus: H = Hauptschul-, R = Realschul-, G = Gymnasialniveau.
 * Die neuen Pläne gelten ab 2026/27 für 5/6 und 7, dann jährlich 8, 9, 10.
 */

export type Niveau = "H" | "R" | "G";
export type Stufe = "5/6" | "7/8" | "9/10";
export const STUFEN: Stufe[] = ["5/6", "7/8", "9/10"];
export const NIVEAU_NAME: Record<Niveau, string> = { H: "Hauptschulniveau", R: "Realschulniveau", G: "Gymnasium" };

export type LektionId =
  | "erfassen" | "diagramme" | "kenngroessen" | "umfrage" | "experimente"
  | "labor" | "laplace" | "baum" | "venn"
  | "vierfelder" | "kombinatorik" | "zufallsgroessen";

export interface Lektion {
  id: LektionId;
  icon: string;
  label: string;
  stufe: Stufe;
  /** Klasse laut Lehrplan-Karte, als Text: »5/6«, »8«, »10«. */
  klasse: string;
  niveaus: Niveau[];
  /** Was der Lehrplan verlangt, knapp; Zusätze je Niveau in Klammern. */
  lehrplan: string;
  karten: string[];
  /** »Kennst du aus …« – sichtbare Rückgriffe auf frühere Lektionen. */
  rueckgriff?: { id: LektionId; text: string }[];
  /** Was früher wo kam (alte Pläne RS 2011, GY 2018). */
  frueher?: string;
  ausblick?: string;
}

export const LEKTIONEN: Lektion[] = [
  {
    id: "erfassen", icon: "📋", label: "Daten erfassen", stufe: "5/6", klasse: "5/6", niveaus: ["H", "R", "G"],
    lehrplan: "Daten aus Darstellungen entnehmen, in Ur- und Strichlisten erfassen, ordnen; Ranglisten und Häufigkeitstabellen; absolute und relative Häufigkeiten",
    karten: ["m2026-56-56-stoch-01", "m2026-56-56-stoch-04"],
    frueher: "Relative Häufigkeiten kamen früher an der Regelschule erst in Kl. 8 – jetzt schon in Kl. 5/6.",
  },
  {
    id: "diagramme", icon: "📊", label: "Diagramme", stufe: "5/6", klasse: "5/6", niveaus: ["H", "R", "G"],
    lehrplan: "Säulen- und Balkendiagramme ohne und mit digitalem Werkzeug; Daten aus Diagrammen entnehmen",
    karten: ["m2026-56-56-stoch-01"],
    rueckgriff: [{ id: "erfassen", text: "Die Häufigkeitstabelle aus »Daten erfassen« ist die Grundlage für jedes Diagramm." }],
  },
  {
    id: "kenngroessen", icon: "📏", label: "Kenngrößen", stufe: "5/6", klasse: "5/6", niveaus: ["H", "R", "G"],
    lehrplan: "Minimum, Maximum, Spannweite, Median, Modalwert, arithmetisches Mittel; Daten charakterisieren und vergleichen (R/G zusätzlich Quartile und Boxplot)",
    karten: ["m2026-56-56-stoch-02", "m2026-56-56-stoch-03"],
    rueckgriff: [{ id: "erfassen", text: "Für den Median brauchst du die Rangliste aus »Daten erfassen«." }],
    frueher: "Quartile und Boxplot sind neu in Kl. 5/6 (R/G); in den alten Plänen gab es sie hier nicht.",
  },
  {
    id: "umfrage", icon: "🗳️", label: "Eigene Umfrage", stufe: "5/6", klasse: "5/6", niveaus: ["H", "R", "G"],
    lehrplan: "Eine eigene Erhebung planen, Daten erfassen, darstellen und mit Kenngrößen auswerten",
    karten: ["m2026-56-56-stoch-01", "m2026-56-56-stoch-02", "m2026-56-56-stoch-03", "m2026-56-56-stoch-04"],
    rueckgriff: [
      { id: "erfassen", text: "Strichliste und Häufigkeitstabelle" },
      { id: "diagramme", text: "das passende Diagramm wählen" },
      { id: "kenngroessen", text: "Kenngrößen bei Zahlantworten" },
    ],
  },
  {
    id: "experimente", icon: "🎲", label: "Zufallsexperimente", stufe: "5/6", klasse: "5/6", niveaus: ["H", "R", "G"],
    lehrplan: "Ein- und zweistufige Zufallsexperimente planen, durchführen und in Baumdiagrammen darstellen (ohne Wahrscheinlichkeiten)",
    karten: ["m2026-56-56-stoch-05"],
    rueckgriff: [{ id: "erfassen", text: "Ergebnisse zählst du mit der Strichliste." }],
    frueher: "Früher erst in Kl. 8 (einstufig); zweistufige Experimente kamen an der Regelschule in Kl. 10, am Gymnasium in Kl. 8.",
  },
  {
    id: "labor", icon: "📈", label: "Zufallslabor", stufe: "7/8", klasse: "8", niveaus: ["H", "R", "G"],
    lehrplan: "Wahrscheinlichkeit als Schätzwert der relativen Häufigkeit bei vielen Wiederholungen, durch Simulation schätzen (G: Zufallsdaten in Tabellen und Diagrammen darstellen; H Kl. 9: Wahrscheinlichkeiten einfacher Experimente auch digital ermitteln)",
    karten: ["m2026-78-stoch-01", "m2026-78-stoch-05", "m2026-910-stoch-03"],
    rueckgriff: [
      { id: "erfassen", text: "Relative Häufigkeit kennst du aus Kl. 5/6." },
      { id: "experimente", text: "Die Experimente sind dieselben wie in Kl. 5/6 – jetzt sehr oft wiederholt." },
    ],
    frueher: "Schätzen durch Simulation ist neu im Lehrplan.",
  },
  {
    id: "laplace", icon: "🎯", label: "Ereignisse & Laplace", stufe: "7/8", klasse: "8", niveaus: ["H", "R", "G"],
    lehrplan: "Ergebnisse und Ereignisse beschreiben (R/G auch zweistufig und in Mengenschreibweise); sicheres, unmögliches Ereignis, Gegenereignis; Laplace-Wahrscheinlichkeiten",
    karten: ["m2026-78-stoch-02", "m2026-78-stoch-03", "m2026-78-stoch-04"],
    rueckgriff: [{ id: "labor", text: "Bei vielen Würfen nähert sich die relative Häufigkeit der Laplace-Wahrscheinlichkeit." }],
    frueher: "Ergebnisse zweistufiger Experimente kamen an der Regelschule früher in Kl. 10, jetzt in Kl. 8.",
  },
  {
    id: "baum", icon: "🌳", label: "Baumdiagramm & Pfadregeln", stufe: "7/8", klasse: "8", niveaus: ["H", "R", "G"],
    lehrplan: "Wahrscheinlichkeiten mit Baumdiagramm und Pfadregeln berechnen (H einfache, R/G auch mehrstufige Experimente)",
    karten: ["m2026-78-stoch-06"],
    rueckgriff: [{ id: "experimente", text: "Das Baumdiagramm ohne Wahrscheinlichkeiten kennst du aus Kl. 5/6 – jetzt kommen sie an die Äste." }],
    frueher: "Baumdiagramme mit Pfadregeln kamen an der Regelschule früher in Kl. 10; im Hauptschulniveau sind sie neu.",
  },
  {
    id: "venn", icon: "⭕", label: "Verknüpfte Ereignisse", stufe: "7/8", klasse: "8 (G) · 9 (R)", niveaus: ["R", "G"],
    lehrplan: "G Kl. 8: verknüpfte Ereignisse in Mengenschreibweise und Venn-Diagrammen, Vereinigung, Schnitt, Gegenereignis mit Symbolen; R Kl. 9: im Wortlaut beschreiben",
    karten: ["m2026-78-stoch-07", "m2026-910-stoch-01"],
    rueckgriff: [{ id: "laplace", text: "Ereignisse als Mengen von Ergebnissen kennst du aus »Ereignisse & Laplace«." }],
    frueher: "Am Gymnasium früher in Kl. 10; Venn-Diagramme sind neu.",
  },
  {
    id: "vierfelder", icon: "▦", label: "Vierfeldertafel & bedingt", stufe: "9/10", klasse: "9/10", niveaus: ["R", "G"],
    lehrplan: "R/G Kl. 9: Vierfeldertafeln mit Häufigkeiten und Wahrscheinlichkeiten, Wahrscheinlichkeit verknüpfter Ereignisse; G Kl. 9: bedingte Wahrscheinlichkeiten, Unabhängigkeit, Wechsel Baum ↔ Tafel; R Kl. 10: bedingte Wahrscheinlichkeiten im Alltag erkennen",
    karten: ["m2026-910-stoch-02", "m2026-910-stoch-03", "m2026-910-stoch-04", "m2026-910-stoch-05", "m2026-910-stoch-06", "m2026-910-stoch-07", "m2026-910-stoch-08", "m2026-910-stoch-09"],
    rueckgriff: [
      { id: "baum", text: "Baumdiagramm und Pfadregeln aus Kl. 8" },
      { id: "venn", text: "Schnitt A ∩ B und Gegenereignis Ā" },
    ],
    frueher: "Vierfeldertafel am Gymnasium früher Kl. 10, an der Regelschule neu; bedingte Wahrscheinlichkeiten sind neu.",
  },
  {
    id: "kombinatorik", icon: "🔢", label: "Kombinatorik", stufe: "9/10", klasse: "10", niveaus: ["G"],
    lehrplan: "Abzählprinzipien: Ziehen mit und ohne Zurücklegen mit Reihenfolge, Ziehen mit einem Griff",
    karten: ["m2026-910-stoch-10"],
    rueckgriff: [{ id: "baum", text: "Jeder Pfad im Baumdiagramm ist eine Möglichkeit – die Produktregel zählt sie." }],
    frueher: "Am Gymnasium gab es früher einfache Kombinatorik in Kl. 6.",
    ausblick: "Die Schreibweise als Binomialkoeffizient kommt in Kl. 11/12.",
  },
  {
    id: "zufallsgroessen", icon: "📶", label: "Zufallsgrößen", stufe: "9/10", klasse: "10", niveaus: ["G"],
    lehrplan: "Verteilungen diskreter Zufallsgrößen in Tabellen und Histogrammen; Erwartungswert; Summenzeichen; Wahrscheinlichkeit und Erwartungswert aus Histogrammen",
    karten: ["m2026-910-stoch-11", "m2026-910-stoch-12", "m2026-910-stoch-13", "m2026-910-stoch-14", "m2026-910-stoch-15"],
    rueckgriff: [
      { id: "kenngroessen", text: "Der Erwartungswert ist das »Mittel auf lange Sicht« – wie das arithmetische Mittel aus Kl. 5/6." },
      { id: "baum", text: "Die Wahrscheinlichkeiten holst du mit den Pfadregeln." },
    ],
    frueher: "Die Standardabweichung gehört nicht mehr hierher.",
    ausblick: "Standardabweichung und Bernoulli-Formel kommen in Kl. 11/12.",
  },
];

export const lektion = (id: LektionId) => LEKTIONEN.find(l => l.id === id)!;

/** Wie die Lektion zur gewählten Stufe und zum Niveau steht. */
export function lage(l: Lektion, stufe: Stufe | null, niveau: Niveau | null): "dran" | "frueher" | "spaeter" | "anderes" {
  if (niveau && !l.niveaus.includes(niveau)) return "anderes";
  if (!stufe) return "dran";
  const a = STUFEN.indexOf(l.stufe), b = STUFEN.indexOf(stufe);
  return a === b ? "dran" : a < b ? "frueher" : "spaeter";
}
