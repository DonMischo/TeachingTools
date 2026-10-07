/**
 * Die 118 Elemente für die Simulation »Periodensystem«.
 *
 * Die Kenndaten (Masse, Konfiguration, Schmelzpunkt …) kommen aus
 * daten.json — die schreibt scripts/fetch-pse.mjs von PubChem. Hier steht
 * dazu, was PubChem nicht liefert: deutscher Name, Kategorie und der Platz
 * im Raster.
 *
 * Nicht zu verwechseln mit src/lib/elemente.ts: das ist die kleine Liste der
 * Gleichungswaage (Atommassen und CPK-Farben zum Rechnen). Hier geht es ums
 * Nachschlagen.
 */
import daten from "./daten.json";
import { sup } from "@/lib/chemie";

export type Kategorie =
  | "alkali" | "erdalkali" | "uebergang" | "lanthanoid" | "actinoid"
  | "metall" | "halbmetall" | "nichtmetall" | "halogen" | "edelgas";

export type RohElement = {
  z: number;
  symbol: string;
  masse: number | null;
  konfiguration: string;
  en: number | null;
  radius: number | null;
  ionisierung: number | null;
  oxidationszahlen: number[];
  zustand: "fest" | "flüssig" | "gasförmig" | null;
  /** Schmelz- und Siedepunkt in Kelvin, wie PubChem sie liefert. */
  schmelzpunkt: number | null;
  siedepunkt: number | null;
  /** g/cm³ bei Feststoffen, g/l bei Gasen. */
  dichte: number | null;
  entdeckt: string;
};

export type PseElement = RohElement & {
  name: string;
  kategorie: Kategorie;
  periode: number;
  /** Hauptgruppe 1–8, null bei Neben-, Lanthanoiden und Actinoiden. */
  hauptgruppe: number | null;
  /** Platz im Raster: Spalte 1–18, Zeile 1–10 (9/10 = f-Block). */
  spalte: number;
  zeile: number;
};

const NAMEN: Record<number, string> = {
  1: "Wasserstoff", 2: "Helium", 3: "Lithium", 4: "Beryllium", 5: "Bor",
  6: "Kohlenstoff", 7: "Stickstoff", 8: "Sauerstoff", 9: "Fluor", 10: "Neon",
  11: "Natrium", 12: "Magnesium", 13: "Aluminium", 14: "Silicium", 15: "Phosphor",
  16: "Schwefel", 17: "Chlor", 18: "Argon", 19: "Kalium", 20: "Calcium",
  21: "Scandium", 22: "Titan", 23: "Vanadium", 24: "Chrom", 25: "Mangan",
  26: "Eisen", 27: "Cobalt", 28: "Nickel", 29: "Kupfer", 30: "Zink",
  31: "Gallium", 32: "Germanium", 33: "Arsen", 34: "Selen", 35: "Brom",
  36: "Krypton", 37: "Rubidium", 38: "Strontium", 39: "Yttrium", 40: "Zirconium",
  41: "Niob", 42: "Molybdän", 43: "Technetium", 44: "Ruthenium", 45: "Rhodium",
  46: "Palladium", 47: "Silber", 48: "Cadmium", 49: "Indium", 50: "Zinn",
  51: "Antimon", 52: "Tellur", 53: "Iod", 54: "Xenon", 55: "Caesium",
  56: "Barium", 57: "Lanthan", 58: "Cer", 59: "Praseodym", 60: "Neodym",
  61: "Promethium", 62: "Samarium", 63: "Europium", 64: "Gadolinium", 65: "Terbium",
  66: "Dysprosium", 67: "Holmium", 68: "Erbium", 69: "Thulium", 70: "Ytterbium",
  71: "Lutetium", 72: "Hafnium", 73: "Tantal", 74: "Wolfram", 75: "Rhenium",
  76: "Osmium", 77: "Iridium", 78: "Platin", 79: "Gold", 80: "Quecksilber",
  81: "Thallium", 82: "Blei", 83: "Bismut", 84: "Polonium", 85: "Astat",
  86: "Radon", 87: "Francium", 88: "Radium", 89: "Actinium", 90: "Thorium",
  91: "Protactinium", 92: "Uran", 93: "Neptunium", 94: "Plutonium", 95: "Americium",
  96: "Curium", 97: "Berkelium", 98: "Californium", 99: "Einsteinium", 100: "Fermium",
  101: "Mendelevium", 102: "Nobelium", 103: "Lawrencium", 104: "Rutherfordium", 105: "Dubnium",
  106: "Seaborgium", 107: "Bohrium", 108: "Hassium", 109: "Meitnerium", 110: "Darmstadtium",
  111: "Roentgenium", 112: "Copernicium", 113: "Nihonium", 114: "Flerovium", 115: "Moscovium",
  116: "Livermorium", 117: "Tenness", 118: "Oganesson",
};

export const KATEGORIEN: Record<Kategorie, { label: string; farbe: string }> = {
  alkali: { label: "Alkalimetalle", farbe: "#f87171" },
  erdalkali: { label: "Erdalkalimetalle", farbe: "#fb923c" },
  uebergang: { label: "Übergangsmetalle", farbe: "#fbbf24" },
  lanthanoid: { label: "Lanthanoide", farbe: "#c084fc" },
  actinoid: { label: "Actinoide", farbe: "#e879a9" },
  metall: { label: "Metalle", farbe: "#a3b8cc" },
  halbmetall: { label: "Halbmetalle", farbe: "#5eead4" },
  nichtmetall: { label: "Nichtmetalle", farbe: "#86efac" },
  halogen: { label: "Halogene", farbe: "#60a5fa" },
  edelgas: { label: "Edelgase", farbe: "#a5b4fc" },
};

const HALBMETALLE = new Set([5, 14, 32, 33, 51, 52, 85]);
const NICHTMETALLE = new Set([1, 6, 7, 8, 15, 16, 34]);

function kategorieVon(z: number, spalte: number): Kategorie {
  if (z >= 57 && z <= 71) return "lanthanoid";
  if (z >= 89 && z <= 103) return "actinoid";
  if (spalte === 18) return "edelgas";
  if ([9, 17, 35, 53, 117].includes(z)) return "halogen";
  if (NICHTMETALLE.has(z)) return "nichtmetall";
  if (HALBMETALLE.has(z)) return "halbmetall";
  if (spalte === 1 && z !== 1) return "alkali";
  if (spalte === 2) return "erdalkali";
  if (spalte >= 3 && spalte <= 12) return "uebergang";
  return "metall";
}

/**
 * Platz im üblichen 18-spaltigen Raster. Lanthanoide und Actinoide stehen
 * ausgerückt in den Zeilen 9 und 10 — so wie im Schulbuch.
 */
function platzVon(z: number): { spalte: number; zeile: number; periode: number } {
  if (z === 1) return { spalte: 1, zeile: 1, periode: 1 };
  if (z === 2) return { spalte: 18, zeile: 1, periode: 1 };
  if (z >= 57 && z <= 71) return { spalte: 3 + (z - 57), zeile: 9, periode: 6 };
  if (z >= 89 && z <= 103) return { spalte: 3 + (z - 89), zeile: 10, periode: 7 };

  // Erstes Element jeder Periode und seine Breite (ohne f-Block).
  const start = [3, 11, 19, 37, 55, 87];
  const periode = start.findIndex((s, i) => z >= s && (i === 5 || z < start[i + 1])) + 2;
  const i = z - start[periode - 2];
  // Perioden 2/3: zwei Spalten links, dann der Sprung auf Spalte 13.
  if (periode <= 3) return { spalte: i < 2 ? i + 1 : i + 11, zeile: periode, periode };
  // Perioden 6/7: nach Spalte 2 folgt der f-Block, der hier übersprungen ist.
  const versatz = periode >= 6 && i >= 2 ? 14 : 0;
  return { spalte: i + 1 - versatz, zeile: periode, periode };
}

/**
 * Die Namen der Hauptgruppen. Elemente einer Gruppe haben gleich viele
 * Außenelektronen und verhalten sich darum ähnlich — die Namen fassen
 * zusammen, was sie verbindet.
 */
export const HAUPTGRUPPEN: Record<number, { name: string; roemisch: string; kurz: string }> = {
  1: { name: "Alkalimetalle", roemisch: "I", kurz: "weich, reagieren heftig mit Wasser" },
  2: { name: "Erdalkalimetalle", roemisch: "II", kurz: "härter als die Alkalimetalle, zwei Außenelektronen" },
  3: { name: "Borgruppe", roemisch: "III", kurz: "Erdmetalle, dazu das Halbmetall Bor" },
  4: { name: "Kohlenstoffgruppe", roemisch: "IV", kurz: "vier Außenelektronen — die Gruppe des Lebens und der Chips" },
  5: { name: "Stickstoffgruppe", roemisch: "V", kurz: "auch Pnictogene genannt" },
  6: { name: "Chalkogene", roemisch: "VI", kurz: "Erzbildner, mit Sauerstoff und Schwefel" },
  7: { name: "Halogene", roemisch: "VII", kurz: "Salzbildner — ihnen fehlt ein Elektron zum Oktett" },
  8: { name: "Edelgase", roemisch: "VIII", kurz: "volle Außenschale, reagieren fast nie" },
};

/**
 * Der Gruppenname eines Elements — mit zwei Ausnahmen: Wasserstoff steht
 * zwar in der ersten Spalte, ist aber kein Alkalimetall, und Helium steht
 * bei den Edelgasen, obwohl es nur zwei Außenelektronen hat.
 */
export function hauptgruppenName(e: PseElement): string | null {
  if (e.z === 1) return null;
  return e.hauptgruppe === null ? null : HAUPTGRUPPEN[e.hauptgruppe].name;
}

/** Hauptgruppe 1–8; Nebengruppen und f-Block haben keine. */
const hauptgruppeVon = (spalte: number, kat: Kategorie): number | null =>
  kat === "lanthanoid" || kat === "actinoid" ? null
    : spalte <= 2 ? spalte
      : spalte >= 13 ? spalte - 10
        : null;

export const PSE: PseElement[] = (daten as RohElement[]).map(roh => {
  const { spalte, zeile, periode } = platzVon(roh.z);
  const kategorie = kategorieVon(roh.z, spalte);
  return { ...roh, name: NAMEN[roh.z], kategorie, periode, spalte, zeile, hauptgruppe: hauptgruppeVon(spalte, kategorie) };
});

const NACH_SYMBOL = new Map(PSE.map(e => [e.symbol, e]));
const NACH_Z = new Map(PSE.map(e => [e.z, e]));

export const pseElement = (symbol: string): PseElement | undefined => NACH_SYMBOL.get(symbol);
export const pseNummer = (z: number): PseElement | undefined => NACH_Z.get(z);

/**
 * Die Elektronenkonfiguration zum Hinsehen: »[Ar]4s2 3d6« wird zu
 * »[Ar]4s² 3d⁶«. Die Zahl hinter dem Buchstaben sagt, wie viele Elektronen
 * im Orbital sitzen — sie gehört hoch, nicht in die Zeile.
 */
export const konfigurationHoch = (k: string): string =>
  k.replace(/([spdf])(\d+)/g, (_, buchstabe, zahl: string) => buchstabe + sup(Number(zahl)));

/** Kelvin → °C, auf eine Stelle gerundet. */
export const celsius = (k: number | null): number | null =>
  k === null ? null : Math.round((k - 273.15) * 10) / 10;

/** Außenelektronen aus der Konfiguration: nur für Hauptgruppen sinnvoll. */
export function aussenelektronen(e: PseElement): number | null {
  if (e.hauptgruppe === null) return null;
  return e.hauptgruppe;
}

/**
 * Radioaktiv: kein einziges stabiles Isotop. Das sind Technetium und
 * Promethium — die beiden Lücken zwischen stabilen Nachbarn — und alles ab
 * Polonium.
 */
export const radioaktiv = (e: PseElement): boolean =>
  e.z === 43 || e.z === 61 || e.z >= 84;

/**
 * Dichte für die Kachel. PubChem gibt alles in g/cm³; bei Gasen sind das
 * winzige Zahlen, deshalb dort mal 1000 als g/l (= kg/m³), so wie im
 * Tafelwerk.
 */
export function dichteKachel(e: PseElement): { wert: number; gas: boolean } | null {
  if (e.dichte === null) return null;
  return e.zustand === "gasförmig"
    ? { wert: e.dichte * 1000, gas: true }
    : { wert: e.dichte, gas: false };
}

/** Sucht über Symbol, deutschen Namen und Ordnungszahl. */
export function suche(text: string): PseElement[] {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  return PSE.filter(e =>
    e.symbol.toLowerCase() === q ||
    String(e.z) === q ||
    e.name.toLowerCase().startsWith(q) ||
    e.symbol.toLowerCase().startsWith(q));
}
