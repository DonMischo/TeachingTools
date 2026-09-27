/**
 * Supermärkte in Erfurt mit Eigenmarken, Markenware, Bio und Wochenangeboten.
 *
 * Echte Prospektdaten gibt es ohne Vertrag mit den Handelsketten nicht (keine
 * offene Schnittstelle, Scraping verbieten die AGB). Deshalb sind die
 * Angebote **simuliert**: jede Spielwoche zieht jeder Markt aus seinem
 * Sortiment 12–18 Artikel mit 15–40 % Rabatt — gleiche Woche, gleiche
 * Angebote für alle, die mit demselben Startwert spielen. Die Basispreise
 * sind typische Regalpreise 2026 (siehe daten/produkte.json).
 * Im Recherche-Modus tragen Schüler:innen echte Preise aus Prospekt oder
 * Online-Shop ein und vergleichen.
 */
import PRODUKTE_JSON from "./daten/produkte.json";
import { werte } from "./werte";

export type Kategorie =
  | "obst" | "gemuese" | "brot" | "fruehstueck" | "milch" | "kaese" | "wurst" | "fleisch" | "fisch" | "vegetarisch"
  | "eier" | "nudeln_reis" | "konserven" | "tk" | "fertig" | "suesses" | "snacks" | "getraenke" | "alkohol"
  | "gewuerze" | "backen" | "hygiene" | "koerperpflege" | "putzen" | "waesche" | "haushalt";

export type VerbrauchsArt = "duschen" | "zaehne" | "klopapier" | "haare" | "deo" | "spuelen" | "putzen" | "waesche"
  | "muell" | "kueche" | "rasur" | "menstruation";

export type Produkt = {
  id: string;
  name: string;
  menge: string;
  kategorie: Kategorie;
  eigen: number;
  marke: { marke: string; preis: number } | null;
  bio: number | null;
  kcal: number;
  protein: number;
  zucker: number;
  portionen: number;
  obstGemuese: number;
  haltbarTage: number;
  kuehlen: boolean;
  tk: boolean;
  kochen: boolean;
  ab: number;
  verbrauch: { art: VerbrauchsArt; tage: number } | null;
};

export const PRODUKTE = PRODUKTE_JSON as Produkt[];
export const PRODUKT = new Map(PRODUKTE.map((p) => [p.id, p]));

export const KATEGORIEN: Record<Kategorie, { name: string; icon: string; food: boolean }> = {
  obst: { name: "Obst", icon: "🍎", food: true },
  gemuese: { name: "Gemüse", icon: "🥦", food: true },
  brot: { name: "Brot & Backwaren", icon: "🍞", food: true },
  fruehstueck: { name: "Frühstück & Aufstrich", icon: "🥣", food: true },
  milch: { name: "Milchprodukte", icon: "🥛", food: true },
  kaese: { name: "Käse", icon: "🧀", food: true },
  wurst: { name: "Wurst & Aufschnitt", icon: "🥓", food: true },
  fleisch: { name: "Fleisch", icon: "🍗", food: true },
  fisch: { name: "Fisch", icon: "🐟", food: true },
  vegetarisch: { name: "Vegetarisch", icon: "🌱", food: true },
  eier: { name: "Eier", icon: "🥚", food: true },
  nudeln_reis: { name: "Nudeln & Reis", icon: "🍝", food: true },
  konserven: { name: "Konserven & Soßen", icon: "🥫", food: true },
  tk: { name: "Tiefkühl", icon: "🧊", food: true },
  fertig: { name: "Fertiggerichte", icon: "🍜", food: true },
  suesses: { name: "Süßes", icon: "🍫", food: true },
  snacks: { name: "Knabbereien", icon: "🥨", food: true },
  getraenke: { name: "Getränke", icon: "🧃", food: true },
  alkohol: { name: "Alkohol", icon: "🍺", food: true },
  gewuerze: { name: "Gewürze", icon: "🧂", food: true },
  backen: { name: "Backen & Grundzutaten", icon: "🧁", food: true },
  hygiene: { name: "Papier & Hygiene", icon: "🧻", food: false },
  koerperpflege: { name: "Körperpflege", icon: "🧴", food: false },
  putzen: { name: "Putzen & Spülen", icon: "🧽", food: false },
  waesche: { name: "Wäsche", icon: "🧺", food: false },
  haushalt: { name: "Haushalt", icon: "🔋", food: false },
};

export type Variante = "eigen" | "marke" | "bio";

export type Markt = {
  id: string;
  name: string;
  art: "Discounter" | "Supermarkt" | "SB-Warenhaus" | "Drogerie";
  icon: string;
  /** Name der Eigenmarke im Regal. */
  eigenmarke: string;
  biomarke: string;
  /** Preisfaktoren gegenüber dem Basispreis. */
  faktor: { eigen: number; marke: number; bio: number; drogerie: number };
  /** Sortiment: welche Kategorien es hier gibt. */
  sortiment: Kategorie[] | "alles";
  /** Minuten Einkauf + Weg (Durchschnitt). */
  minuten: number;
  text: string;
};

const DROGERIE: Kategorie[] = ["hygiene", "koerperpflege", "putzen", "waesche", "haushalt"];

export const MAERKTE: Markt[] = [
  { id: "lidl", name: "Lidl", art: "Discounter", icon: "🟦", eigenmarke: "Lidl-Eigenmarke", biomarke: "Bioland (Lidl)",
    faktor: { eigen: 1, marke: 1, bio: 1, drogerie: 1.05 }, sortiment: "alles", minuten: 45,
    text: "Kleines Sortiment, günstige Eigenmarken, starke Wochenangebote." },
  { id: "netto", name: "Netto Marken-Discount", art: "Discounter", icon: "🟨", eigenmarke: "Gut & Günstig", biomarke: "BioBio",
    faktor: { eigen: 1, marke: 1.02, bio: 1, drogerie: 1.05 }, sortiment: "alles", minuten: 40,
    text: "Viele Filialen, mehr Markenartikel als andere Discounter." },
  { id: "rewe", name: "REWE", art: "Supermarkt", icon: "🟥", eigenmarke: "ja!", biomarke: "REWE Bio",
    faktor: { eigen: 1, marke: 1.07, bio: 1.06, drogerie: 1.1 }, sortiment: "alles", minuten: 50,
    text: "Großes Sortiment, frische Theke. ja! kostet so viel wie beim Discounter, Marken etwas mehr." },
  { id: "kaufland", name: "Kaufland", art: "SB-Warenhaus", icon: "🟥", eigenmarke: "K-Classic", biomarke: "K-Bio",
    faktor: { eigen: 0.98, marke: 0.98, bio: 1, drogerie: 1 }, sortiment: "alles", minuten: 70,
    text: "Riesig, alles unter einem Dach, oft am günstigsten — aber der Einkauf dauert." },
  { id: "dm", name: "dm-drogerie markt", art: "Drogerie", icon: "🟪", eigenmarke: "Balea / Denkmit", biomarke: "dmBio",
    faktor: { eigen: 0.9, marke: 0.97, bio: 1, drogerie: 0.9 }, sortiment: DROGERIE, minuten: 30,
    text: "Körperpflege, Putz- und Waschmittel am günstigsten." },
];

export const MARKT = new Map(MAERKTE.map((m) => [m.id, m]));

export function imSortiment(m: Markt, p: Produkt): boolean {
  return m.sortiment === "alles" || m.sortiment.includes(p.kategorie);
}

/** Einfacher, im Code eigener Zufall (mulberry32) — für stabile Wochenangebote. */
export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Angebot = { produkt: string; variante: Variante; rabatt: number };

/** Wochenangebote eines Marktes (Woche = Spielwoche ab Start). */
export function wochenangebote(markt: Markt, woche: number, seed: number): Angebot[] {
  const r = mulberry(seed * 7919 + woche * 104729 + markt.id.charCodeAt(0) * 31 + markt.id.length);
  const kandidaten = PRODUKTE.filter((p) => imSortiment(markt, p));
  const anzahl = markt.art === "Drogerie" ? 8 : 12 + Math.floor(r() * 7);
  const gewaehlt = new Map<string, Angebot>();
  for (let i = 0; i < anzahl * 3 && gewaehlt.size < anzahl; i++) {
    const p = kandidaten[Math.floor(r() * kandidaten.length)];
    if (gewaehlt.has(p.id)) continue;
    const variante: Variante = p.marke && r() < 0.6 ? "marke" : "eigen";
    const rabatt = Math.round((0.15 + r() * 0.25) * 100) / 100;
    gewaehlt.set(p.id, { produkt: p.id, variante, rabatt });
  }
  return [...gewaehlt.values()];
}

/** Regalpreis in einem Markt (ohne Angebot), inflationsbereinigt. */
export function regalpreis(p: Produkt, v: Variante, m: Markt, preisindex: number): number | null {
  const basis = v === "eigen" ? p.eigen : v === "marke" ? p.marke?.preis ?? null : p.bio;
  if (basis == null) return null;
  const drogerie = !KATEGORIEN[p.kategorie].food;
  const f = (drogerie ? m.faktor.drogerie : 1) * m.faktor[v];
  return Math.round(basis * f * preisindex * 100) / 100;
}

export function preis(p: Produkt, v: Variante, m: Markt, preisindex: number, angebote: Angebot[]): { preis: number; alt: number | null; angebot: boolean } | null {
  const r = regalpreis(p, v, m, preisindex);
  if (r == null) return null;
  const a = angebote.find((x) => x.produkt === p.id && x.variante === v);
  if (!a) return { preis: glatt(r), alt: null, angebot: false };
  return { preis: glatt(r * (1 - a.rabatt)), alt: glatt(r), angebot: true };
}

/** Preise enden im Laden gern auf 9. */
function glatt(n: number): number {
  const c = Math.round(n * 100);
  const neu = c < 100 ? c : c - (c % 10) + 9;
  return neu / 100;
}

export function variantenName(p: Produkt, v: Variante, m: Markt): string {
  if (v === "marke") return p.marke?.marke ?? p.name;
  if (v === "bio") return m.biomarke;
  return m.eigenmarke;
}

/**
 * Referenz-Wocheneinkauf für eine Person (orientiert an den Mengen der
 * DGE-Empfehlungen: täglich 5 Portionen Obst/Gemüse, 3 Portionen Milch-
 * produkte, Getreide/Brot als Basis, wenig Fleisch). Bewusst schlicht —
 * Zweck ist der Vergleich, nicht ein Diätplan.
 */
export const REFERENZ_WOCHE: { produkt: string; menge: number; warum: string }[] = [
  { produkt: "brot-mischbrot-500g", menge: 1, warum: "Brot fürs Frühstück und Abendbrot" },
  { produkt: "brot-toast-500g", menge: 1, warum: "hält länger als frisches Brot" },
  { produkt: "fruehstueck-haferflocken-500g", menge: 1, warum: "günstiges, sattmachendes Frühstück" },
  { produkt: "milch-h-milch-1l", menge: 2, warum: "Milch fürs Müsli, lange haltbar" },
  { produkt: "milch-joghurt-500g", menge: 1, warum: "Milchprodukt" },
  { produkt: "kaese-gouda-150g", menge: 1, warum: "Aufschnitt" },
  { produkt: "fruehstueck-butter-250g", menge: 1, warum: "Aufstrich" },
  { produkt: "eier-10er-karton", menge: 1, warum: "Eiweiß, vielseitig" },
  { produkt: "nudeln_reis-spaghetti-500g", menge: 1, warum: "Grundnahrung" },
  { produkt: "gemuese-kartoffeln-2500g", menge: 1, warum: "Grundnahrung, hält lange" },
  { produkt: "konserven-tomaten-dose-425g", menge: 2, warum: "Basis für Soßen" },
  { produkt: "fleisch-hackfleisch-gemischt-500g", menge: 1, warum: "ein bis zwei Fleischmahlzeiten reichen" },
  { produkt: "tk-gemuese-mix-600g", menge: 1, warum: "Gemüse, das nicht schlecht wird" },
  { produkt: "obst-apfel-1kg", menge: 1, warum: "Obst" },
  { produkt: "obst-bananen-1kg", menge: 1, warum: "Obst, schnell gegessen" },
  { produkt: "gemuese-moehren-1kg", menge: 1, warum: "Gemüse zum Knabbern und Kochen" },
  { produkt: "gemuese-gurke-stk", menge: 1, warum: "Salat, Abendbrot" },
  { produkt: "gemuese-zwiebeln-1kg", menge: 0.5, warum: "zum Kochen (hält mehrere Wochen)" },
  { produkt: "getraenke-kaffee-500g", menge: 0.25, warum: "Kaffee oder Tee — Leitungswasser ist in Erfurt bestes Trinkwasser" },
  { produkt: "hygiene-klopapier-8er", menge: 0.33, warum: "8 Rollen reichen etwa drei Wochen" },
  { produkt: "koerperpflege-duschgel-250ml", menge: 0.25, warum: "reicht etwa einen Monat" },
  { produkt: "koerperpflege-zahnpasta-75ml", menge: 0.12, warum: "reicht etwa zwei Monate" },
  { produkt: "putzen-spuelmittel-500ml", menge: 0.25, warum: "Abwasch" },
];

/** Was man zum »Überleben« im Haushalt dauerhaft da haben sollte. */
export const GRUNDBEDARF: { art: VerbrauchsArt; name: string; wirkung: string }[] = [
  { art: "klopapier", name: "Klopapier", wirkung: "ohne geht's nicht" },
  { art: "zaehne", name: "Zahnpasta", wirkung: "Hygiene, Zahnarztkosten" },
  { art: "duschen", name: "Duschgel/Seife", wirkung: "Hygiene" },
  { art: "deo", name: "Deo", wirkung: "Hygiene, Kolleg:innen danken" },
  { art: "spuelen", name: "Spülmittel", wirkung: "Ordnung, sonst stapelt sich Geschirr" },
  { art: "putzen", name: "Reiniger", wirkung: "Ordnung, Schimmel vermeiden" },
  { art: "waesche", name: "Waschmittel", wirkung: "saubere Kleidung" },
  { art: "muell", name: "Müllbeutel", wirkung: "Ordnung" },
];

/** Preisniveau am Wohnort: auf Sylt ist Einkaufen spürbar teurer (Annahme +25 %). */
export function preisindexFuer(s: { tag: number; wohnung: { stadtteil: string } }): number {
  const jahr = new Date(Date.UTC(2026, 6, 1 + s.tag)).getUTCFullYear();
  return werte(jahr).preisindex * (s.wohnung.stadtteil === "Sylt" ? 1.25 : 1);
}
