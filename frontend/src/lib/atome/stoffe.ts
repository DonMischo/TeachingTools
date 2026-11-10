/**
 * Die Stoffe des Teilchenmodells: Schmelz- und Siedepunkt bei Normaldruck,
 * Dichte, Molmasse und wie ein Teilchen aussieht.
 *
 * Werte aus den üblichen Tabellen (CRC Handbook, gerundet). Wo ein Stoff sich
 * zersetzt, bevor er siedet, steht `zersetzt` statt eines Siedepunkts; wo er
 * sublimiert, sind Schmelz- und Siedepunkt gleich (Trockeneis, Iod nicht —
 * Iod schmilzt bei Normaldruck wirklich, es verdampft nur schon vorher stark).
 */

/** Ein Atom im Teilchenbild: Symbol, Lage und Größe in Teilchenradien. */
export type TAtom = [symbol: string, dx: number, dy: number, groesse: number];

/** Eine Form eines Teilchens; Ionenverbindungen haben zwei (Kation und Anion). */
export type Form = { atome: TAtom[]; ladung?: "+" | "−" | "2+" | "2−" };

export type Art = "polar" | "unpolar" | "beide" | "metall" | "ionisch" | "edelgas";

export type Stoff = {
  id: string;
  name: string;
  formel: string;
  gruppe: "Metalle" | "Nichtmetalle" | "Verbindungen";
  /** °C; null = wird bei Normaldruck nie fest (Helium). */
  schmelz: number | null;
  /** °C; null = zersetzt sich vorher. */
  siede: number | null;
  zersetzt?: number;
  /** g/cm³ des festen bzw. flüssigen Stoffs. */
  dichte: number;
  /** g/mol je Teilchen (bei Ionen je Formeleinheit). */
  masse: number;
  art: Art;
  /** Löst sich in Flüssigkeiten dieser Art, bis zu `loeslichkeit` Teilchen je Lösemittelteilchen. */
  loeslichIn?: "polar" | "unpolar";
  loeslichkeit?: number;
  /** Stoßradius des Teilchens im Bild (px). */
  r: number;
  formen: Form[];
  hinweis?: string;
  /** Nur für eine Reaktion gebraucht, nicht in der Auswahl. */
  nurReaktion?: boolean;
};

// Kleine Bausteine für die Teilchenbilder.
const kugel = (s: string, g = 1): Form => ({ atome: [[s, 0, 0, g]] });
const zwei = (s: string, t = s): Form => ({ atome: [[s, -0.45, 0, 0.72], [t, 0.45, 0, 0.72]] });
const ion = (s: string, ladung: Form["ladung"], g = 1): Form => ({ atome: [[s, 0, 0, g]], ladung });
const ring = (s: string, n: number, rad = 0.65, g = 0.38): Form => ({
  atome: Array.from({ length: n }, (_, i): TAtom => [s, rad * Math.cos(2 * Math.PI * i / n), rad * Math.sin(2 * Math.PI * i / n), g]),
});
/** Zickzack-Kette aus Kohlenstoff (H weggelassen), passt in den Radius. */
const kette = (n: number, extra: TAtom[] = []): Form => ({
  atome: [
    ...Array.from({ length: n }, (_, i): TAtom => ["C", -0.8 + (1.6 * i) / Math.max(1, n - 1), i % 2 ? 0.18 : -0.18, 0.34]),
    ...extra,
  ],
});

export const STOFFE: Stoff[] = [
  // ── Metalle ──
  { id: "fe", name: "Eisen", formel: "Fe", gruppe: "Metalle", schmelz: 1538, siede: 2862, dichte: 7.87, masse: 55.8, art: "metall", r: 8, formen: [kugel("Fe")] },
  { id: "cu", name: "Kupfer", formel: "Cu", gruppe: "Metalle", schmelz: 1085, siede: 2562, dichte: 8.96, masse: 63.5, art: "metall", r: 8, formen: [kugel("Cu")] },
  { id: "al", name: "Aluminium", formel: "Al", gruppe: "Metalle", schmelz: 660, siede: 2470, dichte: 2.70, masse: 27.0, art: "metall", r: 8.5, formen: [kugel("Al")] },
  { id: "au", name: "Gold", formel: "Au", gruppe: "Metalle", schmelz: 1064, siede: 2856, dichte: 19.3, masse: 197, art: "metall", r: 8.5, formen: [kugel("Au")] },
  { id: "ag", name: "Silber", formel: "Ag", gruppe: "Metalle", schmelz: 962, siede: 2162, dichte: 10.5, masse: 107.9, art: "metall", r: 8.5, formen: [kugel("Ag")] },
  { id: "pb", name: "Blei", formel: "Pb", gruppe: "Metalle", schmelz: 327, siede: 1749, dichte: 11.3, masse: 207, art: "metall", r: 9, formen: [kugel("Pb")] },
  { id: "sn", name: "Zinn", formel: "Sn", gruppe: "Metalle", schmelz: 232, siede: 2602, dichte: 7.29, masse: 118.7, art: "metall", r: 9, formen: [kugel("Sn")] },
  { id: "zn", name: "Zink", formel: "Zn", gruppe: "Metalle", schmelz: 420, siede: 907, dichte: 7.14, masse: 65.4, art: "metall", r: 8, formen: [kugel("Zn")] },
  { id: "hg", name: "Quecksilber", formel: "Hg", gruppe: "Metalle", schmelz: -38.8, siede: 357, dichte: 13.5, masse: 200.6, art: "metall", r: 8.5, formen: [kugel("Hg")], hinweis: "Das einzige Metall, das bei Raumtemperatur flüssig ist." },
  { id: "w", name: "Wolfram", formel: "W", gruppe: "Metalle", schmelz: 3422, siede: 5555, dichte: 19.3, masse: 183.8, art: "metall", r: 8.5, formen: [kugel("W")], hinweis: "Das Metall mit dem höchsten Schmelzpunkt — darum war es der Glühfaden der Glühlampe." },
  { id: "na", name: "Natrium", formel: "Na", gruppe: "Metalle", schmelz: 97.8, siede: 883, dichte: 0.97, masse: 23.0, art: "metall", r: 10, formen: [kugel("Na")], hinweis: "So weich, dass man es mit dem Messer schneiden kann — und leichter als Wasser." },
  { id: "mg", name: "Magnesium", formel: "Mg", gruppe: "Metalle", schmelz: 650, siede: 1090, dichte: 1.74, masse: 24.3, art: "metall", r: 9, formen: [kugel("Mg")] },
  { id: "ga", name: "Gallium", formel: "Ga", gruppe: "Metalle", schmelz: 29.8, siede: 2400, dichte: 5.91, masse: 69.7, art: "metall", r: 8.5, formen: [kugel("Ga")], hinweis: "Schmilzt in der Hand (29,8 °C), siedet aber erst bei 2400 °C." },
  { id: "ti", name: "Titan", formel: "Ti", gruppe: "Metalle", schmelz: 1668, siede: 3287, dichte: 4.51, masse: 47.9, art: "metall", r: 8.5, formen: [kugel("Ti")] },

  // ── Nichtmetalle (Elemente) ──
  { id: "h2", name: "Wasserstoff", formel: "H2", gruppe: "Nichtmetalle", schmelz: -259.2, siede: -252.9, dichte: 0.07, masse: 2.0, art: "unpolar", r: 6, formen: [zwei("H")] },
  { id: "he", name: "Helium", formel: "He", gruppe: "Nichtmetalle", schmelz: null, siede: -268.9, dichte: 0.125, masse: 4.0, art: "edelgas", r: 5.5, formen: [kugel("He", 0.8)], hinweis: "Wird bei Normaldruck nie fest — auch nicht am absoluten Nullpunkt." },
  { id: "ne", name: "Neon", formel: "Ne", gruppe: "Nichtmetalle", schmelz: -248.6, siede: -246.0, dichte: 1.2, masse: 20.2, art: "edelgas", r: 6.5, formen: [kugel("Ne", 0.85)] },
  { id: "ar", name: "Argon", formel: "Ar", gruppe: "Nichtmetalle", schmelz: -189.3, siede: -185.8, dichte: 1.4, masse: 39.9, art: "edelgas", r: 7.5, formen: [kugel("Ar", 0.9)] },
  { id: "n2", name: "Stickstoff", formel: "N2", gruppe: "Nichtmetalle", schmelz: -210.0, siede: -195.8, dichte: 0.81, masse: 28.0, art: "unpolar", r: 7.5, formen: [zwei("N")] },
  { id: "o2", name: "Sauerstoff", formel: "O2", gruppe: "Nichtmetalle", schmelz: -218.8, siede: -183.0, dichte: 1.14, masse: 32.0, art: "unpolar", r: 7.5, formen: [zwei("O")] },
  { id: "cl2", name: "Chlor", formel: "Cl2", gruppe: "Nichtmetalle", schmelz: -101.5, siede: -34.0, dichte: 1.56, masse: 70.9, art: "unpolar", r: 9, formen: [zwei("Cl")] },
  { id: "br2", name: "Brom", formel: "Br2", gruppe: "Nichtmetalle", schmelz: -7.2, siede: 58.8, dichte: 3.10, masse: 159.8, art: "unpolar", r: 9.5, formen: [zwei("Br")], hinweis: "Neben Quecksilber das einzige Element, das bei Raumtemperatur flüssig ist." },
  { id: "i2", name: "Iod", formel: "I2", gruppe: "Nichtmetalle", schmelz: 113.7, siede: 184.3, dichte: 4.93, masse: 253.8, art: "unpolar", r: 10, formen: [zwei("I")], loeslichIn: "unpolar", loeslichkeit: 0.15 },
  { id: "s8", name: "Schwefel", formel: "S8", gruppe: "Nichtmetalle", schmelz: 115.2, siede: 444.6, dichte: 2.07, masse: 256.5, art: "unpolar", r: 11, formen: [ring("S", 8)], hinweis: "Schwefel besteht aus Ringen von acht Atomen (S₈)." },
  { id: "p4", name: "Phosphor (weiß)", formel: "P4", gruppe: "Nichtmetalle", schmelz: 44.1, siede: 280.5, dichte: 1.82, masse: 123.9, art: "unpolar", r: 9.5, formen: [ring("P", 4, 0.5, 0.45)] },
  { id: "s", name: "Schwefel (als Atom)", formel: "S", gruppe: "Nichtmetalle", schmelz: 115.2, siede: 444.6, dichte: 2.07, masse: 32.1, art: "unpolar", r: 8, formen: [kugel("S")], nurReaktion: true },
  { id: "c", name: "Kohlenstoff (Graphit)", formel: "C", gruppe: "Nichtmetalle", schmelz: 3642, siede: 3642, dichte: 2.26, masse: 12.0, art: "unpolar", r: 7, formen: [kugel("C")], hinweis: "Sublimiert bei Normaldruck: aus fest wird direkt gasförmig." },

  // ── Verbindungen ──
  { id: "h2o", name: "Wasser", formel: "H2O", gruppe: "Verbindungen", schmelz: 0, siede: 100, dichte: 1.00, masse: 18.0, art: "polar", r: 7.5, formen: [{ atome: [["O", 0, -0.12, 0.78], ["H", -0.62, 0.42, 0.5], ["H", 0.62, 0.42, 0.5]] }] },
  { id: "ethanol", name: "Ethanol (Alkohol)", formel: "C2H5OH", gruppe: "Verbindungen", schmelz: -114.1, siede: 78.4, dichte: 0.79, masse: 46.1, art: "beide", r: 9.5, formen: [{ atome: [["C", -0.62, 0.1, 0.48], ["C", 0, -0.18, 0.48], ["O", 0.6, 0.12, 0.44], ["H", 0.95, -0.2, 0.28]] }] },
  { id: "methanol", name: "Methanol", formel: "CH3OH", gruppe: "Verbindungen", schmelz: -97.6, siede: 64.7, dichte: 0.79, masse: 32.0, art: "polar", r: 8.5, formen: [{ atome: [["C", -0.35, 0, 0.55], ["O", 0.35, 0, 0.5], ["H", 0.78, -0.35, 0.32]] }] },
  { id: "aceton", name: "Aceton", formel: "C3H6O", gruppe: "Verbindungen", schmelz: -94.7, siede: 56.1, dichte: 0.79, masse: 58.1, art: "beide", r: 10, formen: [{ atome: [["C", -0.7, 0.25, 0.42], ["C", 0, 0, 0.45], ["C", 0.7, 0.25, 0.42], ["O", 0, -0.7, 0.42]] }] },
  { id: "glycerin", name: "Glycerin", formel: "C3H8O3", gruppe: "Verbindungen", schmelz: 17.8, siede: 290, dichte: 1.26, masse: 92.1, art: "polar", r: 10.5, formen: [{ atome: [["C", -0.6, 0, 0.38], ["C", 0, 0.15, 0.38], ["C", 0.6, 0, 0.38], ["O", -0.6, -0.65, 0.34], ["O", 0, 0.8, 0.34], ["O", 0.6, -0.65, 0.34]] }] },
  { id: "hexan", name: "Hexan (Benzin)", formel: "C6H14", gruppe: "Verbindungen", schmelz: -95.3, siede: 68.7, dichte: 0.66, masse: 86.2, art: "unpolar", r: 11, formen: [kette(6)] },
  { id: "oel", name: "Speiseöl", formel: "C57H104O6", gruppe: "Verbindungen", schmelz: -10, siede: null, zersetzt: 300, dichte: 0.92, masse: 885, art: "unpolar", r: 12, formen: [kette(7, [["O", 0.2, 0.55, 0.3]])], hinweis: "Ein Gemisch aus Fetten — über etwa 300 °C (Rauchpunkt) zersetzt es sich, statt zu sieden." },
  { id: "paraffin", name: "Kerzenwachs (Paraffin)", formel: "C25H52", gruppe: "Verbindungen", schmelz: 55, siede: 370, dichte: 0.90, masse: 352, art: "unpolar", r: 12, formen: [kette(8)] },
  { id: "co2", name: "Kohlenstoffdioxid", formel: "CO2", gruppe: "Verbindungen", schmelz: -78.5, siede: -78.5, dichte: 1.56, masse: 44.0, art: "unpolar", r: 8.5, formen: [{ atome: [["O", -0.72, 0, 0.55], ["C", 0, 0, 0.58], ["O", 0.72, 0, 0.55]] }], hinweis: "Sublimiert bei Normaldruck: Trockeneis wird direkt zu Gas. Flüssig gibt es CO₂ nur unter Druck." },
  { id: "nh3", name: "Ammoniak", formel: "NH3", gruppe: "Verbindungen", schmelz: -77.7, siede: -33.3, dichte: 0.68, masse: 17.0, art: "polar", r: 7.5, formen: [{ atome: [["N", 0, 0, 0.72], ["H", 0, -0.72, 0.42], ["H", -0.65, 0.42, 0.42], ["H", 0.65, 0.42, 0.42]] }] },
  { id: "ch4", name: "Methan (Erdgas)", formel: "CH4", gruppe: "Verbindungen", schmelz: -182.5, siede: -161.5, dichte: 0.42, masse: 16.0, art: "unpolar", r: 7.5, formen: [{ atome: [["C", 0, 0, 0.62], ["H", -0.6, -0.6, 0.38], ["H", 0.6, -0.6, 0.38], ["H", -0.6, 0.6, 0.38], ["H", 0.6, 0.6, 0.38]] }] },
  { id: "butan", name: "Butan (Feuerzeuggas)", formel: "C4H10", gruppe: "Verbindungen", schmelz: -138.3, siede: -0.5, dichte: 0.60, masse: 58.1, art: "unpolar", r: 10, formen: [kette(4)] },
  { id: "hcl", name: "Chlorwasserstoff", formel: "HCl", gruppe: "Verbindungen", schmelz: -114.2, siede: -85.1, dichte: 1.19, masse: 36.5, art: "polar", r: 8, formen: [{ atome: [["H", -0.55, 0, 0.5], ["Cl", 0.22, 0, 0.82]] }] },
  { id: "nacl", name: "Kochsalz", formel: "NaCl", gruppe: "Verbindungen", schmelz: 801, siede: 1465, dichte: 2.16, masse: 58.4, art: "ionisch", loeslichIn: "polar", loeslichkeit: 0.35, r: 8, formen: [ion("Na", "+", 0.75), ion("Cl", "−", 1)], hinweis: "Ein Ionengitter: Natrium-Ionen (+) und Chlorid-Ionen (−) wechseln sich ab." },
  { id: "zucker", name: "Zucker (Saccharose)", formel: "C12H22O11", gruppe: "Verbindungen", schmelz: 186, siede: null, zersetzt: 186, dichte: 1.59, masse: 342.3, art: "polar", loeslichIn: "polar", loeslichkeit: 1.5, r: 11, formen: [{ atome: [...ring("C", 5, 0.5, 0.3).atome, ["O", 0, 0, 0.3], ["O", -0.85, 0.3, 0.26], ["O", 0.85, 0.3, 0.26]] }], hinweis: "Schmilzt nicht sauber, sondern karamellisiert und verkohlt ab etwa 186 °C." },
  { id: "sio2", name: "Sand (Quarz)", formel: "SiO2", gruppe: "Verbindungen", schmelz: 1713, siede: 2950, dichte: 2.65, masse: 60.1, art: "polar", r: 8.5, formen: [{ atome: [["Si", 0, 0, 0.6], ["O", -0.7, 0.2, 0.42], ["O", 0.7, 0.2, 0.42]] }], hinweis: "Löst sich in Wasser nicht — es sinkt zu Boden." },
  { id: "caco3", name: "Kalk (Calciumcarbonat)", formel: "CaCO3", gruppe: "Verbindungen", schmelz: null, siede: null, zersetzt: 825, dichte: 2.71, masse: 100.1, art: "ionisch", r: 9, formen: [ion("Ca", "2+", 0.8), { atome: [["C", 0, 0, 0.4], ["O", 0, -0.6, 0.38], ["O", -0.55, 0.35, 0.38], ["O", 0.55, 0.35, 0.38]], ladung: "2−" }] },
  { id: "cao", name: "Branntkalk (Calciumoxid)", formel: "CaO", gruppe: "Verbindungen", schmelz: 2613, siede: 2850, dichte: 3.34, masse: 56.1, art: "ionisch", r: 8.5, formen: [ion("Ca", "2+", 0.8), ion("O", "2−", 0.9)] },
  { id: "fes", name: "Eisensulfid", formel: "FeS", gruppe: "Verbindungen", schmelz: 1194, siede: null, zersetzt: 1194, dichte: 4.84, masse: 87.9, art: "ionisch", r: 8.5, formen: [ion("Fe", "2+", 0.8), ion("S", "2−", 1)] },
  { id: "mgo", name: "Magnesiumoxid", formel: "MgO", gruppe: "Verbindungen", schmelz: 2852, siede: 3600, dichte: 3.58, masse: 40.3, art: "ionisch", r: 8, formen: [ion("Mg", "2+", 0.75), ion("O", "2−", 0.9)] },
  { id: "cuo", name: "Kupferoxid", formel: "CuO", gruppe: "Verbindungen", schmelz: 1326, siede: null, zersetzt: 1326, dichte: 6.31, masse: 79.5, art: "ionisch", r: 8, formen: [ion("Cu", "2+", 0.75), ion("O", "2−", 0.9)] },
  { id: "nh4cl", name: "Salmiak (Ammoniumchlorid)", formel: "NH4Cl", gruppe: "Verbindungen", schmelz: null, siede: null, zersetzt: 338, dichte: 1.53, masse: 53.5, art: "ionisch", loeslichIn: "polar", loeslichkeit: 0.35, r: 8.5, formen: [{ atome: [["N", 0, 0, 0.6], ["H", -0.55, -0.55, 0.32], ["H", 0.55, -0.55, 0.32], ["H", -0.55, 0.55, 0.32], ["H", 0.55, 0.55, 0.32]], ladung: "+" }, ion("Cl", "−", 1)] },
];

export const stoff = (id: string): Stoff => {
  const s = STOFFE.find(x => x.id === id);
  if (!s) throw new Error(`Unbekannter Stoff ${id}`);
  return s;
};

export type Phase = "fest" | "flüssig" | "gasförmig" | "zersetzt";

/** Der Zustand eines Stoffs bei T (°C) unter Normaldruck. */
export function phaseVon(s: Stoff, T: number): Phase {
  if (s.zersetzt !== undefined && T >= s.zersetzt) return "zersetzt";
  if (s.schmelz !== null && T < s.schmelz) return "fest";
  if (s.siede !== null && T >= s.siede) return "gasförmig";
  if (s.schmelz === null && s.siede === null) return "fest";
  return "flüssig";
}

/** Zwei Flüssigkeiten mischen sich, wenn sie »gleich gebaut« sind. */
export function mischbar(a: Stoff, b: Stoff): boolean {
  if (a.id === b.id) return true;
  if (a.art === "metall" || b.art === "metall") return a.art === b.art;
  if (a.art === "ionisch" || b.art === "ionisch") return a.art === b.art;
  if (a.art === "beide" || b.art === "beide") return true;
  return a.art === b.art || (a.art === "edelgas" && b.art === "unpolar") || (b.art === "edelgas" && a.art === "unpolar");
}

/** Löst sich der Feststoff a im flüssigen Stoff b? */
export function loestSichIn(a: Stoff, b: Stoff): boolean {
  if (!a.loeslichIn) return false;
  // Ethanol löst Iod (Iodtinktur), aber kaum Salz.
  return b.art === a.loeslichIn || (b.art === "beide" && a.loeslichIn === "unpolar");
}

/** Was beim Mischen passiert — als Satz fürs Panel. */
export function mischText(a: Stoff, b: Stoff, T: number): string {
  const pa = phaseVon(a, T), pb = phaseVon(b, T);
  const gas = (p: Phase) => p === "gasförmig";
  const fluessig = (p: Phase) => p === "flüssig" || p === "zersetzt";
  if (gas(pa) && gas(pb)) return `Zwei Gase mischen sich immer: die Teilchen fliegen frei herum, bis ${a.name} und ${b.name} überall gleich verteilt sind (Diffusion).`;
  if (gas(pa) !== gas(pb)) {
    const [g, x] = gas(pa) ? [a, b] : [b, a];
    return `${g.name} ist gasförmig und füllt den Raum über ${x.name}. Ein Gas hat keine eigene Form und kein festes Volumen.`;
  }
  if (fluessig(pa) && fluessig(pb)) {
    if (mischbar(a, b)) return `${a.name} und ${b.name} sind ähnlich gebaut — die Teilchen ziehen sich gegenseitig an, und es entsteht eine einheitliche Mischung (Lösung).`;
    const [leicht, schwer] = a.dichte < b.dichte ? [a, b] : [b, a];
    return `${a.name} und ${b.name} mischen sich nicht: gleiche Teilchen halten zusammen. Es bilden sich zwei Schichten — ${leicht.name} (${leicht.dichte.toLocaleString("de-DE")} g/cm³) schwimmt oben auf ${schwer.name}.`;
  }
  const [f, l] = pa === "fest" ? [a, b] : [b, a];
  if (phaseVon(l, T) === "fest") return `Beide sind fest — die Teilchen sitzen auf ihren Plätzen. Ein Gemenge aus zwei Feststoffen mischt sich nur, wenn man es umrührt oder schmilzt.`;
  if (loestSichIn(f, l)) return `${f.name} löst sich in ${l.name}: die Flüssigkeitsteilchen lösen die Teilchen einzeln aus dem Gitter und umhüllen sie. Wärmer geht es schneller. Ist die Lösung gesättigt, bleibt ein Bodensatz.`;
  return `${f.name} löst sich in ${l.name} nicht. Es ${f.dichte > l.dichte ? "liegt am Boden" : "bleibt als fester Block liegen, auch wenn es leichter ist"} — die Teilchen bleiben in ihrem Gitter.`;
}

export const GRUPPEN = ["Metalle", "Nichtmetalle", "Verbindungen"] as const;
