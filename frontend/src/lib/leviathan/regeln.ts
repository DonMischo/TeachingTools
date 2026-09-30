/**
 * Das Wirkungsgefüge: wer wen wie stark beeinflusst.
 *
 * Jede Zeile wirkt einmal je Runde: `staerke × n(von)`, wobei n den Wert von
 * 0…100 auf −1…+1 abbildet (50 = keine Wirkung). `verzoegerung` liest den Wert
 * von vor so vielen Runden. `nurUeber50` lässt nur die obere Hälfte wirken
 * (Klimaschäden gibt es nicht »negativ«).
 *
 * Die Zahlen sind Spielgrößen, nicht die Effektstärken der Studien. Die Studie
 * legt Richtung, Verzögerung und grobe Rangfolge fest.
 */
import type { Groesse } from "./typen";

export interface Regel {
  von: Groesse;
  nach: Groesse;
  staerke: number;
  verzoegerung: number;
  quelle: string;
  nurUeber50?: boolean;
}

const r = (von: Groesse, nach: Groesse, staerke: number, quelle: string, verzoegerung = 0, nurUeber50 = false): Regel =>
  ({ von, nach, staerke, verzoegerung, quelle, nurUeber50 });

export const REGELN: Regel[] = [
  // Wirtschaft
  r("demokratie", "wirtschaft", 1.2, "acemoglu2019", 3),
  r("bildung", "wirtschaft", 1.5, "annahme", 2),
  r("energie", "wirtschaft", 0.8, "way2022", 2),
  r("korruption", "wirtschaft", -1.5, "rothstein2005"),
  r("staatskapazitaet", "wirtschaft", 1.0, "korridor"),
  r("vertrauen", "wirtschaft", 0.5, "annahme", 1),
  r("klima", "wirtschaft", -1.5, "armstrongMcKay2022", 0, true),
  // Gesundheit & Soziales
  r("wirtschaft", "soziales", 0.8, "annahme", 1),
  r("zusammenhalt", "soziales", 1.0, "who2025"),
  r("klima", "soziales", -1.5, "lancetCountdown2025", 0, true),
  // Bildung
  r("wirtschaft", "bildung", 0.6, "annahme", 1),
  // Gleichheit
  r("soziales", "gleichheit", 2.0, "rothstein2005"),
  r("korruption", "gleichheit", -1.2, "rothstein2005"),
  r("vertrauen", "gleichheit", 0.8, "rothstein2005", 1),
  r("bildung", "gleichheit", 1.0, "annahme", 2),
  // Vertrauen
  r("gleichheit", "vertrauen", 1.8, "rothstein2005", 1),
  r("korruption", "vertrauen", -2.0, "rothstein2005"),
  r("desinformation", "vertrauen", -2.2, "vosoughi2018"),
  r("rechtsstaat", "vertrauen", 1.0, "oecd2024"),
  r("zusammenhalt", "vertrauen", 0.8, "whr2025"),
  // Zusammenhalt
  r("soziales", "zusammenhalt", 1.2, "who2025"),
  r("gleichheit", "zusammenhalt", 1.0, "rothstein2005"),
  r("desinformation", "zusammenhalt", -1.2, "wef2025"),
  r("familie", "zusammenhalt", 0.8, "whr2025"),
  r("klima", "zusammenhalt", -0.8, "annahme", 0, true),
  // Desinformation (hoch = schlecht)
  r("vertrauen", "desinformation", -1.5, "vosoughi2018"),
  r("bildung", "desinformation", -2.5, "roozenbeek2022", 1),
  r("demokratie", "desinformation", -1.5, "mli2023"),
  // Demokratie
  r("rechtsstaat", "demokratie", 1.5, "vdem2026"),
  r("vertrauen", "demokratie", 0.8, "vdem2026", 1),
  r("desinformation", "demokratie", -1.0, "vdem2026"),
  r("zusammenhalt", "demokratie", 0.5, "korridor"),
  // Staatskapazität
  r("rechtsstaat", "staatskapazitaet", 1.8, "korridor"),
  r("wirtschaft", "staatskapazitaet", 1.0, "annahme"),
  r("korruption", "staatskapazitaet", -1.8, "cpi2025"),
  // Korruption (hoch = schlecht)
  r("rechtsstaat", "korruption", -2.2, "cpi2025"),
  r("demokratie", "korruption", -1.5, "vdem2026"),
  r("gleichheit", "korruption", -1.0, "rothstein2005"),
];

/** Was eine Größe außerhalb der Tabelle bewegt – für den »Warum?«-Knopf. */
export const EIGENDYNAMIK: Partial<Record<Groesse, { text: string; quelle: string }[]>> = {
  wirtschaft: [{ text: "Wächst durch technischen Fortschritt leicht von selbst; unter einem Autokraten schrumpft sie Jahr für Jahr ein wenig.", quelle: "funke2023" }],
  energie: [{ text: "Jede Investition macht die nächste billiger (Lernkurve): Die ersten Punkte bringen wenig, später deutlich mehr.", quelle: "way2022" }],
  rechtsstaat: [{ text: "Steigt nur durch eigene Investitionen. Autokraten und neu besetzte Gerichte bauen ihn ab und sperren ihn zeitweise.", quelle: "vdem2026" }],
  familie: [{ text: "Steigt nur durch eigene Investitionen. Wirkt auf die Geburtenrate, auf den Zusammenhalt und darauf, ob Zugewanderte Arbeit finden.", quelle: "whr2025" }],
  klima: [
    { text: "Steigt durch die eigene Wirtschaft (je nach Energiewende) und durch den weltweiten Trend – ein kleines Land kann das Weltklima allein kaum ändern.", quelle: "annahme" },
    { text: "Über einem Kipppunkt sinkt die Klimalast nicht mehr darunter und steigt jede Runde schneller.", quelle: "armstrongMcKay2022" },
  ],
  desinformation: [
    { text: "Wächst von selbst, weil Falschmeldungen häufiger geteilt werden als wahre.", quelle: "vosoughi2018" },
    { text: "Ab 2032 macht KI Fälschungen billiger.", quelle: "wef2025" },
  ],
  vertrauen: [{ text: "Schrumpft die Wirtschaft (Arbeitslosigkeit), sinkt das Vertrauen in die Institutionen.", quelle: "algan2017" }],
  demokratie: [{ text: "Unter einem Autokraten bröckelt sie jede Runde; unter 20 sind Wahlen nicht mehr frei.", quelle: "vdem2026" }],
};

/** Die Rückkopplungsschleifen für die Nachbesprechung. */
export interface Schleife {
  id: string;
  art: "verstaerkend" | "ausgleichend";
  name: string;
  ablauf: string;
  quelle: string;
  gut?: boolean;
}

export const SCHLEIFEN: Schleife[] = [
  { id: "R1", art: "verstaerkend", name: "Krisen-Populismus", quelle: "funke2016",
    ablauf: "Finanzkrise → Arbeitslosigkeit → Vertrauen sinkt → Populist gewählt → Wirtschaft leidet langsam → neue Unsicherheit" },
  { id: "R2", art: "verstaerkend", name: "Ungleichheitsfalle", quelle: "rothstein2005",
    ablauf: "Ungleichheit → Misstrauen → Korruption und weniger Rückhalt für Sozialpolitik → noch mehr Ungleichheit" },
  { id: "R3", art: "verstaerkend", name: "Desinformationsspirale", quelle: "vosoughi2018",
    ablauf: "Wenig Vertrauen → Menschen suchen »alternative« Quellen → mehr Desinformation → noch weniger Vertrauen" },
  { id: "R4", art: "verstaerkend", name: "Autokratie rastet ein", quelle: "vdem2026",
    ablauf: "Demokratie sinkt → Pressefreiheit sinkt → Korruption bleibt unentdeckt → Kontrolle ist immer schwerer zurückzuholen" },
  { id: "R5", art: "verstaerkend", name: "Lernkurve der Energiewende", quelle: "way2022", gut: true,
    ablauf: "Investition → Anlagen werden billiger → mehr Ausbau je Aktionspunkt → weniger Klimalast, günstigere Energie" },
  { id: "R6", art: "verstaerkend", name: "Klimakaskade", quelle: "armstrongMcKay2022",
    ablauf: "Klimalast steigt → Kipppunkt → Hitze und Dürre → Gesundheit und Wirtschaft leiden → weniger Geld für die Wende" },
  { id: "B1", art: "ausgleichend", name: "Bildung und Demografie", quelle: "lutz2014",
    ablauf: "Mehr Bildung → weniger Kinder → erst viele Erwerbstätige (Dividende), Jahrzehnte später viele Alte (Rentenlast)" },
  { id: "B2", art: "ausgleichend", name: "Medienkompetenz bremst", quelle: "roozenbeek2022", gut: true,
    ablauf: "Bildung und Medienkompetenz → Desinformation wirkt schwächer" },
  { id: "B3", art: "ausgleichend", name: "Zusammenhalt puffert", quelle: "who2025", gut: true,
    ablauf: "Starker Zusammenhalt → Schocks treffen Gesundheit und Vertrauen schwächer" },
  { id: "B4", art: "ausgleichend", name: "Demokratie-Dividende", quelle: "acemoglu2019", gut: true,
    ablauf: "Stabile Demokratie im Korridor → die Wirtschaft wächst langfristig schneller" },
];
