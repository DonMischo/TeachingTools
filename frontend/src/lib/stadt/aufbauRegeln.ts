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
  // Werkstätten (Berufe); die Mühle für Stadttypen, deren Bauplan keine hat
  { bau: "muehle", stufe: 1 }, { bau: "schmiede", stufe: 1 }, { bau: "zimmerei", stufe: 1 },
  { bau: "baecker", stufe: 2 }, { bau: "weberei", stufe: 2 }, { bau: "brauerei", stufe: 2 },
  // Warenketten (Rohstoffe und Baustoffe)
  { bau: "holzfaeller", stufe: 0 }, { bau: "saegewerk", stufe: 1 }, { bau: "koehler", stufe: 1 },
  { bau: "lehmgrube", stufe: 1 }, { bau: "ziegelei", stufe: 1 }, { bau: "schafhof", stufe: 2 },
  { bau: "hopfengarten", stufe: 2 }, { bau: "steinbruch", stufe: 2 },
];

/** Warenkette: dieser Betrieb arbeitet nur, wenn der vorige läuft (Getreide → Mühle → Mehl → Bäckerei → Brot) */
export const VORSTUFE: Partial<Record<BauTyp, BauTyp>> = {
  baecker: "muehle", saegewerk: "holzfaeller", koehler: "holzfaeller", ziegelei: "lehmgrube", schmiede: "koehler",
  zimmerei: "saegewerk", weberei: "schafhof", brauerei: "hopfengarten",
};

// ---------------------------------------------------------------- Berufe

/** Wirtschaftszweige; Zielanteile nach der Berufsstruktur spätmittelalterlicher Städte (gerundet) */
export const SEKTOREN = {
  land: { label: "Landwirtschaft", icon: "🌾", ziel: 0.25 },
  nahrung: { label: "Nahrung", icon: "🥖", ziel: 0.15 },
  handwerk: { label: "Handwerk und Textil", icon: "⚒️", ziel: 0.25 },
  bau: { label: "Bau", icon: "🪚", ziel: 0.1 },
  handel: { label: "Handel und Verwaltung", icon: "⚖️", ziel: 0.15 },
  dienste: { label: "Kirche, Schule, Pflege", icon: "⛪", ziel: 0.1 },
  industrie: { label: "Industrie und Verkehr", icon: "🏭", ziel: 0 },
  arbeitslos: { label: "Ohne Arbeit", icon: "🪧", ziel: 0 },
} as const;
export type Sektor = keyof typeof SEKTOREN;

/** Stellen je Betrieb: Schicht (die Schicht darunter darf aushelfen), Zahl, Wirtschaftszweig */
export const STELLEN: Partial<Record<BauTyp, { schicht: number; n: number; sektor: Sektor }>> = {
  markt: { schicht: 1, n: 6, sektor: "nahrung" }, forum: { schicht: 1, n: 6, sektor: "nahrung" }, plaza: { schicht: 1, n: 6, sektor: "nahrung" },
  muehle: { schicht: 1, n: 4, sektor: "nahrung" }, baecker: { schicht: 1, n: 3, sektor: "nahrung" }, brauerei: { schicht: 1, n: 4, sektor: "nahrung" },
  schmiede: { schicht: 1, n: 3, sektor: "handwerk" }, weberei: { schicht: 1, n: 6, sektor: "handwerk" }, zimmerei: { schicht: 1, n: 4, sektor: "bau" },
  kirche: { schicht: 1, n: 3, sektor: "dienste" }, kloster: { schicht: 1, n: 6, sektor: "dienste" }, kathedrale: { schicht: 2, n: 8, sektor: "dienste" },
  schule: { schicht: 2, n: 4, sektor: "dienste" }, spital: { schicht: 2, n: 6, sektor: "dienste" }, universitaet: { schicht: 2, n: 20, sektor: "dienste" },
  rathaus: { schicht: 2, n: 6, sektor: "handel" }, hafenkontor: { schicht: 2, n: 6, sektor: "handel" }, zollhaus: { schicht: 2, n: 4, sektor: "handel" },
  burg: { schicht: 1, n: 8, sektor: "dienste" }, kaserne: { schicht: 1, n: 12, sektor: "dienste" },
  fabrik: { schicht: 3, n: 40, sektor: "industrie" }, bahnhof: { schicht: 3, n: 20, sektor: "industrie" }, hochofen: { schicht: 3, n: 60, sektor: "industrie" },
  zechenturm: { schicht: 3, n: 50, sektor: "industrie" }, kai: { schicht: 1, n: 10, sektor: "handel" }, werft: { schicht: 3, n: 30, sektor: "industrie" },
  holzfaeller: { schicht: 0, n: 3, sektor: "land" }, saegewerk: { schicht: 1, n: 3, sektor: "bau" }, lehmgrube: { schicht: 0, n: 3, sektor: "bau" },
  ziegelei: { schicht: 1, n: 4, sektor: "bau" }, koehler: { schicht: 0, n: 2, sektor: "handwerk" }, schafhof: { schicht: 0, n: 2, sektor: "land" },
  steinbruch: { schicht: 1, n: 4, sektor: "bau" }, hopfengarten: { schicht: 0, n: 2, sektor: "land" },
};

/**
 * Werkstätten verkaufen an die Stadt: Erlös je besetzter Stelle und Schritt, solange es Kundschaft gibt.
 * KUNDEN = Einwohner, die ein Betrieb dieser Art versorgen kann — mehr gleiche Betriebe teilen sich die Kunden.
 */
export const ERLOES_JE_STELLE = 0.25;
export const KUNDEN: Partial<Record<BauTyp, number>> = {
  muehle: 300, baecker: 150, brauerei: 300, schmiede: 250, zimmerei: 250, weberei: 400,
};

/**
 * Selbstständige je Schicht als Anteil der Stadtbevölkerung (Handwerker in der eigenen Werkstatt, Kaufleute,
 * kleine Betriebe, Büros). Wer darüber hinaus keine Stelle findet, ist ohne Arbeit.
 */
export const SELBST = [0, 0.85, 0.12, 0.05, 0.1];
/** Arbeitslosenquote, ab der die Zufriedenheit sinkt, der Zuzug stoppt bzw. Leute absteigen oder wegziehen */
export const ARBEITSLOS = { unmut: 0.1, zuzug: 0.15, abwanderung: 0.25 };

/** Anteil der Bewohner, die in Betrieben arbeiten (der Rest arbeitet zu Hause, im Haushalt, auf dem eigenen Acker) */
export const ERWERBSQUOTE = 0.3;
/** Reihenfolge, in der Betriebe Personal bekommen: erst die Versorgung, dann der Rest */
export const VORRANG: BauTyp[] = ["markt", "forum", "plaza", "muehle", "baecker", "holzfaeller", "saegewerk", "kirche", "burg", "rathaus", "koehler", "schmiede",
  "zimmerei", "lehmgrube", "ziegelei", "schule", "spital", "schafhof", "weberei", "hopfengarten", "brauerei", "steinbruch"];

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
  // ein Betrieb wird nie vor seiner Vorstufe frei
  for (const x of aus) { const v = VORSTUFE[x.bau], vs = v ? aus.find(y => y.bau === v) : null; if (vs && vs.stufe > x.stufe) x.stufe = vs.stufe; }
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

// ---------------------------------------------------------------- Waren und Warenketten

export type Ware = "holz" | "bretter" | "lehm" | "ziegel" | "kohle" | "wolle" | "tuch" | "stein" | "hopfen" | "bier";
export const WAREN: Record<Ware, { label: string; icon: string }> = {
  holz: { label: "Bauholz", icon: "🪵" }, bretter: { label: "Bretter", icon: "🪚" }, lehm: { label: "Lehm", icon: "🟫" },
  ziegel: { label: "Ziegel", icon: "🧱" }, kohle: { label: "Holzkohle", icon: "⚫" }, wolle: { label: "Wolle", icon: "🐑" },
  tuch: { label: "Tuch", icon: "🧶" }, stein: { label: "Bruchstein", icon: "🪨" }, hopfen: { label: "Hopfen", icon: "🌿" },
  bier: { label: "Bier", icon: "🍺" },
};
/** höchstens so viel je Ware im Lager am Markt */
export const LAGER_MAX = 400;
/** Startlager: genug Holz und Bretter für Markt, Brunnen und die ersten Betriebe */
export const START_LAGER: Partial<Record<Ware, number>> = { holz: 80, bretter: 40 };

/**
 * Warenketten je Betrieb und Schritt bei voller Besetzung (ein = verbraucht, aus = erzeugt). Ohne Rohstoff steht
 * der Betrieb still. Nach den Gewerben spätmittelalterlicher Städte: Holz → Sägemühle, Lehm + Brennholz → Ziegelei,
 * Holz → Köhler → Holzkohle für die Schmiede, Wolle → Weberei, Hopfen → Brauerei.
 */
export const KETTE: Partial<Record<BauTyp, { ein?: Partial<Record<Ware, number>>; aus?: Partial<Record<Ware, number>> }>> = {
  holzfaeller: { aus: { holz: 3 } },
  saegewerk: { ein: { holz: 2 }, aus: { bretter: 2 } },
  lehmgrube: { aus: { lehm: 3 } },
  ziegelei: { ein: { lehm: 2, holz: 1 }, aus: { ziegel: 2 } },
  koehler: { ein: { holz: 2 }, aus: { kohle: 2 } },
  schmiede: { ein: { kohle: 1 } },
  zimmerei: { ein: { bretter: 1 } },
  schafhof: { aus: { wolle: 2 } },
  weberei: { ein: { wolle: 2 }, aus: { tuch: 2 } },
  steinbruch: { aus: { stein: 2 } },
  hopfengarten: { aus: { hopfen: 2 } },
  brauerei: { ein: { hopfen: 1 }, aus: { bier: 2 } },
};

/** Bürger wollen Bier und Tuch (je 1 auf 150 Bürger und Schritt) — ohne sie sinkt ihre Stimmung, und niemand steigt zum Bürger auf */
export const LUXUS: Ware[] = ["bier", "tuch"];
export const LUXUS_JE = 150;
/** ein Bürgerhaus braucht Ziegel (Steinbau statt Fachwerk) */
export const ZIEGEL_JE_BUERGERHAUS = 4;

/**
 * Baustoffe eines Gebäudes, nach seiner Stufe: anfangs nur Bauholz, ab der Siedlung Bretter, ab der Marktstadt
 * Ziegel, ab der Handelsstadt Bruchstein. Betriebe der Warenketten kosten nur Bauholz (sonst käme man nie hinein),
 * der Holzfäller nichts.
 */
export function baustoffe(stil: Stil, b: BauTyp): Partial<Record<Ware, number>> {
  if (b === "holzfaeller") return {};
  const k = kosten(b);
  if (KETTE[b]) return { holz: Math.max(4, Math.round(k / 50)) };
  const st = palette(stil).find(p => p.bau === b)?.stufe ?? 0;
  const aus: Partial<Record<Ware, number>> = { holz: Math.max(2, Math.round(k / 40)) };
  if (st >= 1) aus.bretter = Math.round(k / 60);
  if (st >= 2) aus.ziegel = Math.round(k / 50);
  if (st >= 3) aus.stein = Math.round(k / 60);
  return aus;
}
