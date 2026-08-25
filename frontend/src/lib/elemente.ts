/**
 * Kleine Elementdatenbank für die Chemie-Waage.
 *
 * Enthält die Elemente, die im Schulunterricht vorkommen — mit Atommasse
 * (für das Gewicht auf der Waage), CPK-Farbe (für die Atomkugeln),
 * Hauptgruppe/Außenelektronen und den üblichen Bindigkeiten (für den
 * Oktett-Hinweis).
 */

export type Element = {
  z: number;
  symbol: string;
  name: string;
  mass: number;
  color: string;
  /** Hauptgruppe 1–8; null bei Nebengruppenelementen. */
  group: number | null;
  /** Außenelektronen (nur Hauptgruppen). */
  outer: number | null;
  /** Übliche Bindigkeiten (Bindungen je Atom). */
  valence: number[];
  metal: boolean;
};

const E = (
  z: number, symbol: string, name: string, mass: number, color: string,
  group: number | null, valence: number[], metal = false,
): Element => ({ z, symbol, name, mass, color, group, outer: group, valence, metal });

export const ELEMENTS: Element[] = [
  E(1, "H", "Wasserstoff", 1.008, "#e6e6e6", 1, [1]),
  E(2, "He", "Helium", 4.003, "#a6e7f0", 8, [0]),
  E(3, "Li", "Lithium", 6.94, "#cc80ff", 1, [1], true),
  E(4, "Be", "Beryllium", 9.012, "#a8d500", 2, [2], true),
  E(5, "B", "Bor", 10.81, "#ffb5b5", 3, [3]),
  E(6, "C", "Kohlenstoff", 12.011, "#4d4d4d", 4, [4]),
  E(7, "N", "Stickstoff", 14.007, "#3050f8", 5, [3]),
  E(8, "O", "Sauerstoff", 15.999, "#ff2d2d", 6, [2]),
  E(9, "F", "Fluor", 18.998, "#7ecb45", 7, [1]),
  E(10, "Ne", "Neon", 20.18, "#8fd8ea", 8, [0]),
  E(11, "Na", "Natrium", 22.99, "#ab5cf2", 1, [1], true),
  E(12, "Mg", "Magnesium", 24.305, "#66d100", 2, [2], true),
  E(13, "Al", "Aluminium", 26.982, "#bfa6a6", 3, [3], true),
  E(14, "Si", "Silicium", 28.085, "#dfae87", 4, [4]),
  E(15, "P", "Phosphor", 30.974, "#ff8000", 5, [3, 5]),
  E(16, "S", "Schwefel", 32.06, "#e8d21c", 6, [2, 4, 6]),
  E(17, "Cl", "Chlor", 35.45, "#3bc93b", 7, [1, 3, 5, 7]),
  E(18, "Ar", "Argon", 39.95, "#66c3d9", 8, [0]),
  E(19, "K", "Kalium", 39.098, "#8f40d4", 1, [1], true),
  E(20, "Ca", "Calcium", 40.078, "#37c400", 2, [2], true),
  E(24, "Cr", "Chrom", 51.996, "#8a99c7", null, [2, 3, 6], true),
  E(25, "Mn", "Mangan", 54.938, "#9c7ac7", null, [2, 4, 7], true),
  E(26, "Fe", "Eisen", 55.845, "#e06633", null, [2, 3], true),
  E(27, "Co", "Cobalt", 58.933, "#f090a0", null, [2, 3], true),
  E(28, "Ni", "Nickel", 58.693, "#50d050", null, [2, 3], true),
  E(29, "Cu", "Kupfer", 63.546, "#c88033", null, [1, 2], true),
  E(30, "Zn", "Zink", 65.38, "#7d80b0", null, [2], true),
  E(35, "Br", "Brom", 79.904, "#a62929", 7, [1]),
  E(47, "Ag", "Silber", 107.868, "#b8b8c0", null, [1], true),
  E(50, "Sn", "Zinn", 118.71, "#668080", 4, [2, 4], true),
  E(53, "I", "Iod", 126.904, "#940094", 7, [1]),
  E(56, "Ba", "Barium", 137.327, "#00a900", 2, [2], true),
  E(78, "Pt", "Platin", 195.08, "#a5a5b5", null, [2, 4], true),
  E(79, "Au", "Gold", 196.967, "#d4a017", null, [1, 3], true),
  E(80, "Hg", "Quecksilber", 200.59, "#9a9ab0", null, [1, 2], true),
  E(82, "Pb", "Blei", 207.2, "#6b6d75", 4, [2, 4], true),
];

const BY_SYMBOL = new Map(ELEMENTS.map(e => [e.symbol, e]));

export const element = (symbol: string): Element | undefined => BY_SYMBOL.get(symbol);

/**
 * Wie viele Elektronen bis zur vollen Außenschale fehlen. Wasserstoff und
 * Helium streben kein Oktett an, sondern die 2er-Schale des Heliums.
 */
export function missingElectrons(e: Element): number | null {
  if (e.outer === null || e.metal) return null;
  return e.z <= 2 ? 2 - e.outer : 8 - e.outer;
}

export const shellGoal = (e: Element): string => (e.z <= 2 ? "zur vollen Schale" : "zum Oktett");

/** Schwarze oder weiße Schrift auf der Atomkugel — je nach Helligkeit. */
export function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#1a1a1a" : "#ffffff";
}
