/**
 * Regeln des Aufbaus (siehe docs/stadt-aufbau-plan.md):
 *   Güter     was ein Gebäude bietet und wie weit (Gehminuten auf dem Straßennetz, Güterordnung nach Christaller)
 *   Schichten wer in den Häusern wohnt, was er zum Leben braucht, wie viele Steuern er zahlt
 *   Stufen    Dörfer → Marktort → Stadt → …, mit Einwohnerschwelle, Versorgungsquote und Pflichtbauten
 *   Geld      Baukosten, Unterhalt ∝ Straßen^0,8, Steuern ∝ Einwohner^1,15 (Bettencourt u. a. 2007)
 */
import { BAUTEN, type BauTyp, type Stil } from "./modell";
import { BAUPLAENE } from "./bauen";

export type Gut = "wasser" | "nahrung" | "glaube" | "schutz" | "recht" | "bildung" | "gesundheit" | "nahverkehr";

export const GUETER: Record<Gut, { label: string; icon: string }> = {
  wasser: { label: "Wasser", icon: "💧" }, nahrung: { label: "Nahrung", icon: "🍞" }, glaube: { label: "Glaube", icon: "⛪" },
  schutz: { label: "Schutz", icon: "🛡️" }, recht: { label: "Recht", icon: "⚖️" }, bildung: { label: "Bildung", icon: "📚" },
  gesundheit: { label: "Gesundheit", icon: "🩺" }, nahverkehr: { label: "Nahverkehr", icon: "🚋" },
};

/** Gehgeschwindigkeit auf Wegen: 80 m je Minute */
export const METER_JE_MINUTE = 80;

/** Was ein Gebäude bietet: Gut und Reichweite in Gehminuten (kleine Güterordnung = kurze Wege) */
export const ANBIETER: Partial<Record<BauTyp, { gut: Gut; minuten: number }[]>> = {
  brunnen: [{ gut: "wasser", minuten: 2 }], castellum: [{ gut: "wasser", minuten: 7 }], hammam: [{ gut: "wasser", minuten: 3 }, { gut: "gesundheit", minuten: 6 }],
  thermen: [{ gut: "wasser", minuten: 4 }, { gut: "gesundheit", minuten: 8 }],
  markt: [{ gut: "nahrung", minuten: 6 }], forum: [{ gut: "nahrung", minuten: 6 }], plaza: [{ gut: "nahrung", minuten: 6 }],
  kaufhalle: [{ gut: "nahrung", minuten: 5 }], einkauf: [{ gut: "nahrung", minuten: 12 }], depot: [{ gut: "nahrung", minuten: 5 }],
  karawanserei: [{ gut: "nahrung", minuten: 6 }], hafenkontor: [{ gut: "nahrung", minuten: 5 }],
  kapelle: [{ gut: "glaube", minuten: 3 }], kirche: [{ gut: "glaube", minuten: 8 }], kathedrale: [{ gut: "glaube", minuten: 20 }],
  tempel: [{ gut: "glaube", minuten: 8 }], moschee: [{ gut: "glaube", minuten: 8 }], kloster: [{ gut: "glaube", minuten: 6 }],
  burg: [{ gut: "schutz", minuten: 14 }], zitadelle: [{ gut: "schutz", minuten: 14 }], kasbah: [{ gut: "schutz", minuten: 12 }],
  kaserne: [{ gut: "schutz", minuten: 10 }], paradeplatz: [{ gut: "schutz", minuten: 10 }], schloss: [{ gut: "schutz", minuten: 12 }, { gut: "recht", minuten: 12 }],
  rathaus: [{ gut: "recht", minuten: 10 }], cabildo: [{ gut: "recht", minuten: 10 }], gericht: [{ gut: "recht", minuten: 10 }],
  bergamt: [{ gut: "recht", minuten: 8 }], kulturhaus: [{ gut: "recht", minuten: 10 }], aufmarschplatz: [{ gut: "recht", minuten: 8 }],
  schule: [{ gut: "bildung", minuten: 6 }], universitaet: [{ gut: "bildung", minuten: 25 }],
  spital: [{ gut: "gesundheit", minuten: 10 }], poliklinik: [{ gut: "gesundheit", minuten: 10 }],
  haltestelle: [{ gut: "nahverkehr", minuten: 5 }], umsteige: [{ gut: "nahverkehr", minuten: 5 }], bahnhof: [{ gut: "nahverkehr", minuten: 8 }],
};

/** Grundversorgung, die jeder Stadttyp bauen kann (ab Stufe) */
export const GRUNDBAUTEN: { bau: BauTyp; stufe: number }[] = [
  { bau: "brunnen", stufe: 0 }, { bau: "kapelle", stufe: 0 }, { bau: "schule", stufe: 2 }, { bau: "spital", stufe: 2 }, { bau: "haltestelle", stufe: 4 },
];

export interface Schicht { name: string; grund: Gut[]; bewohner: number; steuer: number }

/** Schichten von unten nach oben; ein Haus steigt auf, wenn es voll ist und alles hat, was die nächste braucht */
export const SCHICHTEN: Schicht[] = [
  { name: "Bauern", grund: ["wasser", "glaube"], bewohner: 7, steuer: 0.4 },
  { name: "Handwerker", grund: ["wasser", "nahrung", "glaube"], bewohner: 8, steuer: 1 },
  { name: "Bürger", grund: ["wasser", "nahrung", "glaube", "schutz", "recht"], bewohner: 12, steuer: 1.6 },
  { name: "Arbeiter", grund: ["wasser", "nahrung", "bildung", "gesundheit"], bewohner: 26, steuer: 1.4 },
  { name: "Angestellte", grund: ["wasser", "nahrung", "bildung", "gesundheit", "nahverkehr"], bewohner: 34, steuer: 2.6 },
];

/** Gebäude, die ein Stadttyp im Aufbau bauen kann (sein Bauplan plus Grundversorgung) */
export function palette(stil: Stil): { bau: BauTyp; stufe: number }[] {
  const plan = BAUPLAENE[stil];
  const aus = plan.orte.map(o => ({ bau: o.bau, stufe: o.stufe + 1 }));
  // das Kern-Gebäude (Markt …) ist schon in Stufe 0 setzbar: es erhebt ein Dorf zum Marktort
  const z = zentrumTyp(stil);
  for (const x of aus) if (x.bau === z) x.stufe = 0;
  for (const gb of GRUNDBAUTEN) if (!aus.some(x => x.bau === gb.bau)) aus.push(gb);
  return aus;
}

export const zentrumTyp = (stil: Stil): BauTyp => BAUPLAENE[stil].zentrum ?? BAUPLAENE[stil].stufen[0].braucht[0];

/** Güter, die es bei diesem Stadttyp überhaupt gibt (nur die zählen als Bedürfnis) */
export function verfuegbareGueter(stil: Stil): Set<Gut> {
  const s = new Set<Gut>();
  for (const p of palette(stil)) for (const a of ANBIETER[p.bau] ?? []) s.add(a.gut);
  return s;
}

/** Grundbedürfnisse einer Schicht bei diesem Stadttyp */
export const grundVon = (stil: Stil, schicht: number) => {
  const da = verfuegbareGueter(stil);
  return SCHICHTEN[schicht].grund.filter(x => da.has(x));
};

export interface AufStufe { name: string; ab: number; quote: number; braucht: BauTyp[]; maxSchicht: number; jahr: number }

const SCHWELLEN = [0, 150, 800, 3000, 12000, 40000];
const MAX_SCHICHT = [0, 1, 2, 2, 3, 4];

/**
 * Stufen: 0 = Dörfer. Das Kern-Gebäude erhebt ein Dorf zum Marktort (Stufe 1). Weiter geht es mit
 * Einwohnern (Schwellen nach realen Stadtgrößen), Versorgungsquote und den Pflichtbauten der Stufe.
 */
export function aufStufen(stil: Stil): AufStufe[] {
  const plan = BAUPLAENE[stil];
  const st: AufStufe[] = [{ name: "Dörfer", ab: 0, quote: 0, braucht: [zentrumTyp(stil)], maxSchicht: 0, jahr: plan.stufen[0].jahr - 80 }];
  plan.stufen.forEach((s, k) => st.push({
    name: s.name, ab: SCHWELLEN[k + 1] ?? SCHWELLEN[SCHWELLEN.length - 1] * 2 ** (k + 2 - SCHWELLEN.length),
    quote: k === 0 ? 0 : 0.7, braucht: s.braucht.filter(b => b !== zentrumTyp(stil)), maxSchicht: MAX_SCHICHT[Math.min(k + 1, MAX_SCHICHT.length - 1)], jahr: s.jahr,
  }));
  return st;
}

/** Baukosten in Talern: Grundbetrag, Fläche und Höhe */
export function kosten(b: BauTyp): number {
  const a = BAUTEN[b];
  return Math.round((40 + a.b * a.h * 0.06 + a.hoehe * 4) / 10) * 10;
}

export const START_TALER = 1500;
export const TROCKEN_KOSTEN = 40;

/** Einnahmen je Schritt: Steuern wachsen überproportional mit der Stadt (N^1,15) und mit der Zufriedenheit */
export const steuern = (steuerkraft: number, zufriedenheit: number) => 0.0065 * Math.pow(Math.max(0, steuerkraft), 1.15) * zufriedenheit;
/** Ausgaben je Schritt: Gebäudeunterhalt plus Wege, die unterproportional wachsen (N^0,8) */
export const unterhalt = (baukosten: number, strassenfelder: number) => 0.005 * baukosten + 0.012 * Math.pow(strassenfelder, 0.8);

/** Nahrung, die ein Bauernhof liefert (für Bewohner der Stadt); ein Hof steht im Spiel für einen ganzen Weiler */
export const NAHRUNG_JE_HOF = 30;
/** Einfuhr über Bahn und Schiff (Getreide aus der Ferne) */
export const EINFUHR: Partial<Record<BauTyp, number>> = { bahnhof: 1500, depot: 600, kai: 800, hafenkontor: 400, kanalhafen: 600 };
