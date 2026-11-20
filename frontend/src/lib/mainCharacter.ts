/**
 * Main Character — Lebenssimulation bis zum Abschluss, reine Rechnung ohne Oberfläche.
 *
 * Fünf Werte (0–100). Jede Woche gibt es Zeit (abhängig von Energie und
 * Miteinander), die nach einem Plan auf die Werte verteilt wird. Jeder Wert
 * wächst mit seinem Anteil und verfällt mit eigener Rate:
 *   Style verfällt schnell, Zielgerichtet kaum (wächst mit Serie und Zinseszins),
 *   Wissen hat einen flüchtigen Teil und einen Sockel, der bleibt,
 *   Miteinander verfällt mittel und schenkt Zeit, Energie begrenzt alles.
 * Wer einen festen Plan hält, landet auf einem Gleichgewicht. Das NPC hält
 * immer denselben Plan, behält kein Wissen und hat kein Ziel — es bleibt stehen.
 *
 * Talente (aus dem Fragebogen) multiplizieren das Wachstum je Wert, Stärken
 * verändern einzelne Regeln, Baustellen bremsen am Anfang und schrumpfen,
 * je mehr Zeit in den passenden Wert fließt.
 */

export type Wert = "W" | "Z" | "S" | "M" | "E";
export const WERTE: Wert[] = ["W", "Z", "S", "M", "E"];

export const WERT_INFO: Record<Wert, { name: string; regel: string; fett: string }> = {
  W: { name: "Wissen", regel: "wächst stetig", fett: "ein Teil bleibt für immer" },
  Z: { name: "Zielgerichtet", regel: "langsamer Start", fett: "wächst immer schneller" },
  S: { name: "Style", regel: "schnell da, schnell weg", fett: "jede Woche neu" },
  M: { name: "Miteinander", regel: "kommt zurück", fett: "gibt dir mehr Zeit" },
  E: { name: "Energie", regel: "Schlaf, Bewegung, Essen", fett: "begrenzt alles" },
};

/** Wochen bis zum Abschluss im Sommer 2028, gezählt ab Ende November 2026. */
export const ABSCHLUSS = 85;

/** Anteil der Wochenzeit je Wert. Rest bis 1 = Leerlauf, Summe über 1 = überplant. */
export type Plan = Record<Wert, number>;

export type KlasseId =
  | "styler" | "mitlaeufer" | "hoodie" | "kuemmerer" | "nerd"
  | "gamer" | "bored" | "streber" | "checker" | "sportler" | "npc";

export interface Klasse {
  id: KlasseId;
  name: string;
  /** kurzer Name fürs Schild, wenn `name` zu lang ist */
  kurz?: string;
  motto: string;
  /** Figur im Hintergrundbild (0–4), fehlt beim NPC */
  figur?: number;
  start: Record<Wert, number>;
  /** fehlt nur beim Mitläufer, der den Plan anderer Klassen übernimmt */
  plan?: Plan;
  /** Energie, die jede Woche zusätzlich verloren geht */
  ezug?: number;
  /** übernimmt alle 5 Wochen den Plan der nächsten Klasse dieser Liste */
  hopp?: KlasseId[];
  /** NPC: behält kein Wissen, hat kein Ziel */
  skript?: boolean;
}

const p = (W: number, Z: number, S: number, M: number, E: number): Plan => ({ W, Z, S, M, E });

export const KLASSEN: Record<KlasseId, Klasse> = {
  styler: { id: "styler", name: "Styler", figur: 0, motto: "Sieht top aus. Kostet jede Woche Zeit.",
    start: p(25, 10, 70, 45, 50), plan: p(.1, .05, .5, .2, .15) },
  mitlaeufer: { id: "mitlaeufer", name: "Mitläufer", figur: 0, motto: "Macht, was gerade angesagt ist. Alle 5 Wochen was Neues.",
    start: p(25, 10, 55, 45, 50), hopp: ["styler", "checker", "hoodie", "gamer", "sportler"] },
  hoodie: { id: "hoodie", name: "Hoodie", figur: 1, motto: "Leise, loyal, immer für die Crew da.",
    start: p(25, 10, 35, 55, 55), plan: p(.2, .1, .15, .3, .25) },
  kuemmerer: { id: "kuemmerer", name: "Kümmerer", figur: 1, motto: "Ist für alle da. Nur nicht für sich selbst.",
    start: p(25, 10, 25, 65, 45), plan: p(.1, .05, .05, .6, .05), ezug: 2 },
  nerd: { id: "nerd", name: "Nerd", figur: 2, motto: "Kopf voran. Wissen wächst, der Rest wartet.",
    start: p(50, 25, 15, 25, 45), plan: p(.45, .25, .05, .1, .15) },
  gamer: { id: "gamer", name: "Gamer", figur: 2, motto: "Grindet mit Plan. Aber die Nächte sind lang.",
    start: p(30, 30, 20, 35, 40), plan: p(.1, .25, .05, .15, .05), ezug: 1.5 },
  bored: { id: "bored", name: "Bored to death", kurz: "Bored", figur: 3, motto: "Scrollen. Schlafen. Wiederholen.",
    start: p(15, 5, 20, 20, 35), plan: p(.1, 0, .1, .1, .1) },
  streber: { id: "streber", name: "Streber auf Anschlag", kurz: "Streber", figur: 3, motto: "Will alles zu 100 %. Plant 130 % der Zeit.",
    start: p(35, 25, 30, 30, 70), plan: p(.4, .35, .2, .2, .15), ezug: .5 },
  checker: { id: "checker", name: "Checker", figur: 4, motto: "Hat den Plan, die Leute und den Look.",
    start: p(30, 35, 50, 50, 55), plan: p(.15, .25, .25, .2, .15) },
  sportler: { id: "sportler", name: "Sportler", figur: 4, motto: "Training, Team, Ziel. Jede Woche.",
    start: p(25, 35, 40, 45, 65), plan: p(.15, .3, .1, .2, .25) },
  npc: { id: "npc", name: "NPC", motto: "Jede Woche dasselbe Skript. Lernt nichts dazu.", skript: true,
    start: p(30, 5, 45, 25, 45), plan: p(.2, 0, .3, .1, .1) },
};

/** Spielbare Klassen in der Reihenfolge der Figuren (ohne NPC). */
export const SPIELKLASSEN: KlasseId[] = [
  "styler", "mitlaeufer", "hoodie", "kuemmerer", "nerd", "gamer", "bored", "streber", "checker", "sportler",
];

export type StaerkeId =
  | "neugierig" | "hartnaeckig" | "kreativ" | "empathisch" | "organisiert"
  | "sportlich" | "flexibel" | "spaetzuender" | "humorvoll" | "ruhig";

export const STAERKEN: Record<StaerkeId, { name: string; text: string }> = {
  neugierig:    { name: "Neugierig",    text: "Wissen wächst 30 % schneller." },
  hartnaeckig:  { name: "Hartnäckig",   text: "Dranbleiben zählt doppelt: Die Serie bei Zielgerichtet bringt doppelten Bonus." },
  kreativ:      { name: "Kreativ",      text: "Style wächst 30 % schneller und hält länger." },
  empathisch:   { name: "Empathisch",   text: "Miteinander wächst 40 % schneller." },
  organisiert:  { name: "Organisiert",  text: "Nur halb so viel Zeit läuft ins Leere." },
  sportlich:    { name: "Sportlich",    text: "Energie lädt schneller auf." },
  flexibel:     { name: "Flexibel",     text: "Umstellen kostet dich nichts: Wechsel brechen deine Serie nicht." },
  spaetzuender: { name: "Spätzünder",   text: "In den letzten 25 Wochen wächst alles 50 % schneller." },
  humorvoll:    { name: "Humorvoll",    text: "Miteinander und Style wachsen 15 % schneller." },
  ruhig:        { name: "Ruhig",        text: "Energie geht langsamer verloren." },
};

export type BaustelleId = "handy" | "aufschieben" | "schlaf" | "lernfrust" | "unsicher";

/**
 * Baustellen bremsen anfangs und schrumpfen, je mehr Zeit in `durch` fließt.
 * `rate`: Prozentpunkte Abbau je investierter Zeiteinheit.
 */
export const BAUSTELLEN: Record<BaustelleId, { name: string; text: string; durch: Wert; rate: number }> = {
  handy:       { name: "Handy-Sog",    text: "Bis zu 2 Zeiteinheiten pro Woche laufen ins Leere.", durch: "Z", rate: 2 },
  aufschieben: { name: "Aufschieben",  text: "Die Serie bei Zielgerichtet reißt leichter.",       durch: "Z", rate: 2 },
  schlaf:      { name: "Schlaf-Chaos", text: "Energie lädt bis zu 30 % langsamer auf.",           durch: "E", rate: 3 },
  lernfrust:   { name: "Lernfrust",    text: "Wissen wächst bis zu 35 % langsamer.",              durch: "W", rate: 1.5 },
  unsicher:    { name: "Unsicher",     text: "Miteinander wächst bis zu 35 % langsamer.",         durch: "M", rate: 2.5 },
};

/** Was einen Charakter ausmacht, unabhängig von der gewählten Klasse. */
export interface Profil {
  /** Wachstumsfaktor je Wert, aus dem Fragebogen (etwa 0,7 bis 1,4) */
  talente: Record<Wert, number>;
  staerken: StaerkeId[];
  baustellen: BaustelleId[];
}

export const NEUTRAL: Profil = { talente: { W: 1, Z: 1, S: 1, M: 1, E: 1 }, staerken: [], baustellen: [] };

export interface Zustand {
  /** Wissen: Sockel (bleibt) und flüchtiger Teil */
  K: number; F: number;
  Z: number; S: number; M: number; E: number;
  /** Wochen in Folge mit Zeit für Zielgerichtet */
  serie: number;
  /** Wochen im Mitläufer-Takt */
  hw: number;
  /** Rest jeder Baustelle in Prozent (100 = ganz da, 0 = geschafft) */
  rest: Partial<Record<BaustelleId, number>>;
  /** zuletzt verteilte Zeit und Leerlauf (negativ = überplant) */
  zeit: number; leer: number;
  woche: number;
}

const klemm = (v: number) => Math.max(0, Math.min(100, v));

export function startZustand(start: Record<Wert, number>, baustellen: BaustelleId[] = []): Zustand {
  const rest: Zustand["rest"] = {};
  for (const b of baustellen) rest[b] = 100;
  return { K: start.W * .4, F: start.W * .6, Z: start.Z, S: start.S, M: start.M, E: start.E,
    serie: 0, hw: 0, rest, zeit: 0, leer: 0, woche: 0 };
}

export function wert(z: Zustand, w: Wert): number {
  return w === "W" ? Math.min(100, z.K + z.F) : z[w];
}

export function werte(z: Zustand): Record<Wert, number> {
  return { W: wert(z, "W"), Z: z.Z, S: z.S, M: z.M, E: z.E };
}

/** Klasse, deren Plan der Mitläufer gerade übernimmt. */
export function hoppKlasse(z: Zustand, kl: Klasse): KlasseId | null {
  return kl.hopp ? kl.hopp[Math.floor(z.hw / 5) % kl.hopp.length] : null;
}

/** Plan einer Klasse (beim Mitläufer der aktuell übernommene). */
export function klassenPlan(z: Zustand, kl: Klasse): Plan {
  const h = hoppKlasse(z, kl);
  return h ? KLASSEN[h].plan! : kl.plan!;
}

export const AUSGEBRANNT = 15;
/** Energieverlust je 100 % Überplanung pro Woche */
export const UEBERPLANT_ZUG = 15;

/**
 * Eine Woche: Zeit verteilen, wachsen, verfallen. Verändert `z`.
 * `plan` überschreibt den Klassenplan (eigener Wochenplan im Charakterbogen).
 */
export function woche(z: Zustand, kl: Klasse, profil: Profil = NEUTRAL, plan?: Plan): void {
  const st = new Set(profil.staerken);
  const tal = profil.talente;
  const r = (b: BaustelleId) => (z.rest[b] ?? 0) / 100;
  const spurt = st.has("spaetzuender") && z.woche >= ABSCHLUSS - 25 ? 1.5 : 1;
  const g = (w: Wert) => tal[w] * spurt; // Wachstumsfaktor

  let zeit = 6 + 6 * z.E / 100 + Math.floor(z.M / 25);
  if (z.E < AUSGEBRANNT) zeit *= .5;
  zeit -= 2 * r("handy");

  let t = plan ?? klassenPlan(z, kl);
  let wechsel = false;
  if (kl.hopp && !plan) {
    wechsel = z.hw > 0 && z.hw % 5 === 0;
    z.hw++;
    if (wechsel && !st.has("flexibel")) { zeit *= .6; z.serie = 0; }
  }
  zeit = Math.max(0, zeit);

  let summe = WERTE.reduce((s, w) => s + t[w], 0);
  if (st.has("organisiert") && summe > 0 && summe < 1) {
    const neu = summe + (1 - summe) / 2;
    t = Object.fromEntries(WERTE.map(w => [w, t[w] * neu / summe])) as Plan;
    summe = neu;
  }
  const e = Object.fromEntries(WERTE.map(w => [w, zeit * t[w]])) as Record<Wert, number>;
  z.zeit = zeit;
  z.leer = zeit * (1 - summe);

  // Energie
  const regen = st.has("sportlich") ? 4.5 : 3;
  // Überplanen (mehr als 100 % der Zeit) frisst Energie
  const ezug = ((kl.ezug ?? 0) + Math.max(0, summe - 1) * UEBERPLANT_ZUG) * (st.has("ruhig") ? .5 : 1);
  const eVerfall = st.has("ruhig") ? .92 : .9;
  z.E = klemm(z.E * eVerfall + regen + 1.5 * e.E * g("E") * (1 - .3 * r("schlaf")) - ezug);
  // Style
  const sKreativ = st.has("kreativ") ? 1.3 : 1;
  const sHumor = st.has("humorvoll") ? 1.15 : 1;
  z.S = klemm(z.S * (st.has("kreativ") ? .85 : .8) + 3.5 * e.S * g("S") * sKreativ * sHumor);
  // Miteinander
  const mBonus = (st.has("empathisch") ? 1.4 : 1) * (st.has("humorvoll") ? 1.15 : 1);
  z.M = klemm(z.M * .95 + 1.2 * e.M * g("M") * mBonus * (1 - .35 * r("unsicher")));
  // Wissen: flüchtiger Teil verblasst, Sockel bleibt (NPC behält nichts)
  const gw = .6 * e.W * g("W") * (st.has("neugierig") ? 1.3 : 1) * (1 - .35 * r("lernfrust"));
  const sockel = kl.skript ? 0 : .03 + .12 * z.Z / 100;
  z.F = z.F * .94 + gw * (1 - sockel);
  z.K = Math.min(100, z.K + gw * sockel);
  // Zielgerichtet: Serie und Zinseszins (NPC hat kein Ziel)
  if (kl.skript) {
    z.Z = klemm(z.Z * .99);
    z.serie = 0;
  } else {
    const schwelle = .5 + 1.5 * r("aufschieben");
    if (!wechsel || st.has("flexibel")) z.serie = e.Z >= schwelle ? z.serie + 1 : 0;
    const bonus = 1 + Math.min(z.serie, 10) * (st.has("hartnaeckig") ? .1 : .05);
    z.Z = klemm(z.Z * .99 + e.Z * g("Z") * (.3 + z.Z / 150) * bonus * (1 - z.Z / 110));
  }
  // Baustellen schrumpfen mit der Zeit, die in ihren Wert fließt
  for (const b of Object.keys(z.rest) as BaustelleId[]) {
    const info = BAUSTELLEN[b];
    z.rest[b] = Math.max(0, (z.rest[b] ?? 0) - e[info.durch] * info.rate);
  }
  z.woche++;
}

/** Ganzer Lauf mit festem Plan bis zum Abschluss (für Tests und Vergleiche). */
export function lauf(kl: Klasse, profil: Profil = NEUTRAL, plan?: Plan, wochen = ABSCHLUSS): Zustand {
  const z = startZustand(kl.start, profil.baustellen);
  for (let i = 0; i < wochen; i++) woche(z, kl, profil, plan);
  return z;
}
