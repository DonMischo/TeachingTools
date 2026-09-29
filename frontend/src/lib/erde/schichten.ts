/**
 * Schalenbau der Erde — Schichten, Stoffe und das Tiefenprofil.
 *
 * Die Zahlen folgen dem Preliminary Reference Earth Model (PREM, Dziewonski &
 * Anderson 1981) für Dichte, Wellengeschwindigkeit, Druck und Schwere; die
 * Diskontinuitäten tragen ihre heutigen Namen (410, 660 km). Temperatur und
 * Viskosität sind nicht gemessen, sondern erschlossen — dort stehen die
 * üblichen Lehrbuchwerte, mit großer Unsicherheit besonders im Kern.
 *
 * Tabellen sind Stützstellen (Tiefe km → Wert). Eine Unstetigkeit steht als
 * zwei Einträge mit gleicher Tiefe; `profilWert` liefert dort den Wert
 * *darunter*, sonst linear dazwischen.
 */

export const ERDRADIUS = 6371; // km

export type Zustand = "fest" | "plastisch" | "flüssig";

export interface Schicht {
  id: string;
  name: string;
  /** Oberkante und Unterkante in km Tiefe. */
  von: number;
  bis: number;
  farbe: string;
  zustand: Zustand;
  /** Wie sich die Schicht verhält, in einem Satz. */
  beschaffenheit: string;
  gesteine: string;
  minerale: string[];
  /** Die Grenze an der Unterkante, falls sie einen Namen hat. */
  grenzeUnten?: string;
  /** Womit man die Zähigkeit vergleichen kann. */
  vergleich: string;
  merke: string;
}

export const SCHICHTEN: Schicht[] = [
  {
    id: "kruste", name: "Erdkruste", von: 0, bis: 35, farbe: "#8a6a4f", zustand: "fest",
    beschaffenheit: "Fest und spröde — sie bricht bei Erdbeben. Kontinente 30–70 km dick, Ozeanboden nur 5–10 km.",
    gesteine: "Kontinente: Granit, Gneis, Sedimente (Ø Dichte 2,7 g/cm³). Ozeanboden: Basalt und Gabbro (2,9–3,0 g/cm³).",
    minerale: ["Feldspat (≈ 50 %)", "Quarz", "Glimmer", "Pyroxen", "Amphibol", "Olivin (im Ozeanboden)"],
    grenzeUnten: "Mohorovičić-Diskontinuität (»Moho«)",
    vergleich: "starr wie Stein — fließt nur über Jahrmillionen in großer Tiefe",
    merke: "Die Kruste ist dünner als die Schale eines Apfels im Vergleich zum Apfel. Die tiefste Bohrung (Kola, 12,3 km) hat sie nicht durchstoßen.",
  },
  {
    id: "lithomantel", name: "Lithosphärischer Mantel", von: 35, bis: 100, farbe: "#7c5a3c", zustand: "fest",
    beschaffenheit: "Fester, kühler Mantel. Zusammen mit der Kruste bildet er die starre Lithosphäre — die Platten der Plattentektonik.",
    gesteine: "Peridotit (dunkelgrünes Gestein, 3,3 g/cm³)",
    minerale: ["Olivin (≈ 60 %)", "Orthopyroxen", "Klinopyroxen", "Spinell bzw. Granat"],
    grenzeUnten: "Lithosphäre–Asthenosphäre-Grenze (keine Stoff-, sondern eine Temperaturgrenze, ≈ 1300 °C)",
    vergleich: "starr — die Platte bewegt sich als Ganzes",
    merke: "Lithosphäre = Kruste + oberster Mantel. Sie ist unter Ozeanen 10–100 km dick, unter alten Kontinenten bis 250 km.",
  },
  {
    id: "astheno", name: "Asthenosphäre", von: 100, bis: 250, farbe: "#c8672f", zustand: "plastisch",
    beschaffenheit: "Heiß und nahe am Schmelzpunkt, darum weich und fließfähig (»Fließzone«). Bis ~1 % Schmelze zwischen den Körnern. Auf ihr gleiten die Platten.",
    gesteine: "Peridotit, stellenweise teilweise aufgeschmolzen",
    minerale: ["Olivin", "Pyroxen", "Granat", "Spuren von Schmelze"],
    vergleich: "fest, aber zäh fließend — etwa 10²⁰ Pa·s, 10²³-mal zäher als Wasser",
    merke: "Erdbebenwellen werden hier langsamer (Low-Velocity-Zone). Aus ihr stammt das Magma an Mittelozeanischen Rücken.",
  },
  {
    id: "oberermantel", name: "Oberer Mantel", von: 250, bis: 410, farbe: "#d0572a", zustand: "plastisch",
    beschaffenheit: "Fest, fließt aber über Jahrmillionen wenige Zentimeter pro Jahr (Mantelkonvektion).",
    gesteine: "Peridotit",
    minerale: ["Olivin", "Pyroxen", "Granat"],
    grenzeUnten: "410-km-Diskontinuität (Olivin → Wadsleyit)",
    vergleich: "etwa 10²⁰–10²¹ Pa·s",
    merke: "Fest heißt nicht starr: Auch Gletschereis ist fest und fließt trotzdem.",
  },
  {
    id: "uebergang", name: "Übergangszone", von: 410, bis: 660, farbe: "#bf4a26", zustand: "plastisch",
    beschaffenheit: "Unter dem Druck ordnen sich die Atome dichter: Olivin wird zu Wadsleyit, ab 520 km zu Ringwoodit. Die Dichte springt.",
    gesteine: "Peridotit in Hochdruckform",
    minerale: ["Wadsleyit (410–520 km)", "Ringwoodit (520–660 km)", "Majorit-Granat"],
    grenzeUnten: "660-km-Diskontinuität (Ringwoodit → Bridgmanit + Ferroperiklas)",
    vergleich: "etwa 10²¹ Pa·s",
    merke: "Ringwoodit kann Wasser einbauen — hier liegt vielleicht mehr Wasser als in allen Ozeanen (Diamant-Einschluss 2014).",
  },
  {
    id: "unterermantel", name: "Unterer Mantel", von: 660, bis: 2700, farbe: "#a8361d", zustand: "plastisch",
    beschaffenheit: "Die größte Schicht der Erde (≈ 55 % des Volumens). Fest und sehr zäh, trotzdem steigen und sinken hier Gesteinsmassen.",
    gesteine: "Hochdruck-Peridotit",
    minerale: ["Bridgmanit (≈ 80 %, häufigstes Mineral der Erde)", "Ferroperiklas", "Calcium-Perowskit"],
    vergleich: "etwa 10²²–10²³ Pa·s — zäher als der obere Mantel",
    merke: "Bridgmanit ist das häufigste Mineral der Erde — und erst 2014 bekam es einen Namen, weil man es vorher nur aus Experimenten kannte.",
  },
  {
    id: "dzwei", name: "D″-Schicht", von: 2700, bis: 2891, farbe: "#7f2416", zustand: "plastisch",
    beschaffenheit: "Grenzschicht über dem Kern: der Kern heizt sie von unten, Temperatursprung um über 1000 °C. Hier liegen alte, versunkene Platten und riesige Gesteinsbeulen (LLSVPs).",
    gesteine: "Hochdruck-Peridotit, vermutlich Reste subduzierter Platten",
    minerale: ["Post-Perowskit", "Bridgmanit", "Ferroperiklas"],
    grenzeUnten: "Kern-Mantel-Grenze (Gutenberg-Diskontinuität)",
    vergleich: "weicher als darüber, weil heißer",
    merke: "Hier beginnen vermutlich die Manteldiapire (Plumes), die Hotspots wie Hawaii oder Island speisen.",
  },
  {
    id: "aussenkern", name: "Äußerer Kern", von: 2891, bis: 5150, farbe: "#f0a22e", zustand: "flüssig",
    beschaffenheit: "Flüssiges Eisen-Nickel, dünnflüssig wie Wasser. Die Strömungen darin erzeugen das Magnetfeld der Erde (Geodynamo).",
    gesteine: "kein Gestein: Metallschmelze",
    minerale: ["Eisen (≈ 85 %)", "Nickel (≈ 5 %)", "leichte Elemente: Schwefel, Sauerstoff, Silizium, Wasserstoff (≈ 10 %)"],
    grenzeUnten: "Innenkern-Grenze (Lehmann-Diskontinuität)",
    vergleich: "etwa 0,01 Pa·s — so dünnflüssig wie Wasser",
    merke: "S-Wellen (Scherwellen) kommen durch eine Flüssigkeit nicht hindurch. So hat man 1914 erkannt, dass der äußere Kern flüssig ist.",
  },
  {
    id: "innenkern", name: "Innerer Kern", von: 5150, bis: 6371, farbe: "#ffe08a", zustand: "fest",
    beschaffenheit: "Fast so heiß wie die Sonnenoberfläche, aber fest: der gewaltige Druck (über 3,3 Mio. bar) hebt den Schmelzpunkt über die Temperatur. Er wächst, weil der Kern abkühlt.",
    gesteine: "kein Gestein: Eisen-Nickel-Kristalle",
    minerale: ["Eisen (hexagonal dicht gepackt, ε-Fe)", "Nickel", "wenig leichte Elemente"],
    vergleich: "fest, aber nicht starr — Schätzungen 10¹⁶–10²¹ Pa·s",
    merke: "Inge Lehmann entdeckte ihn 1936 an schwachen Wellen, die im »Schattenbereich« ankamen, wo eigentlich nichts hätte ankommen dürfen.",
  },
];

export const SCHICHT_NACH_ID: Record<string, Schicht> = Object.fromEntries(SCHICHTEN.map(s => [s.id, s]));

export function schichtBei(tiefe: number): Schicht {
  for (const s of SCHICHTEN) if (tiefe < s.bis) return s;
  return SCHICHTEN[SCHICHTEN.length - 1];
}

type Tabelle = [number, number][];

/** Dichte in g/cm³ (PREM, Diskontinuitäten auf 410/660 gelegt). */
const DICHTE: Tabelle = [
  [0, 2.6], [15, 2.6], [15, 2.9], [24.4, 2.9], [24.4, 3.38], [220, 3.36], [220, 3.44],
  [410, 3.54], [410, 3.72], [660, 3.99], [660, 4.38], [1500, 4.9], [2200, 5.24],
  [2741, 5.49], [2891, 5.57], [2891, 9.9], [4000, 11.0], [5150, 12.17], [5150, 12.76], [6371, 13.09],
];

/** P-Wellen-Geschwindigkeit in km/s. */
const VP: Tabelle = [
  [0, 5.8], [15, 5.8], [15, 6.8], [24.4, 6.8], [24.4, 8.11], [220, 7.99], [220, 8.56],
  [410, 8.9], [410, 9.13], [660, 10.27], [660, 10.75], [1500, 12.1], [2200, 13.0],
  [2741, 13.68], [2891, 13.72], [2891, 8.06], [4000, 9.4], [5150, 10.36], [5150, 11.03], [6371, 11.26],
];

/** S-Wellen-Geschwindigkeit in km/s; im flüssigen Kern null. */
const VS: Tabelle = [
  [0, 3.2], [15, 3.2], [15, 3.9], [24.4, 3.9], [24.4, 4.49], [80, 4.4], [220, 4.43], [220, 4.64],
  [410, 4.87], [410, 5.07], [660, 5.57], [660, 5.95], [1500, 6.6], [2200, 7.0],
  [2741, 7.27], [2891, 7.26], [2891, 0], [5150, 0], [5150, 3.5], [6371, 3.67],
];

/** Druck in GPa (1 GPa = 10 000 bar). */
const DRUCK: Tabelle = [
  [0, 0], [24.4, 0.6], [100, 3.2], [220, 7.1], [410, 13.4], [660, 23.8], [1500, 62],
  [2200, 97], [2891, 135.8], [4000, 240], [5150, 328.9], [6371, 363.9],
];

/** Schwerebeschleunigung in m/s². */
const SCHWERE: Tabelle = [
  [0, 9.82], [660, 9.98], [1500, 9.95], [2200, 10.1], [2891, 10.68], [4000, 8.2], [5150, 4.4], [6371, 0],
];

/** Temperatur in °C — erschlossen, im Kern auf ±500 °C unsicher. */
const TEMPERATUR: Tabelle = [
  [0, 15], [35, 500], [100, 1300], [250, 1420], [410, 1500], [660, 1650], [1500, 2000],
  [2700, 2500], [2891, 3700], [5150, 5100], [6371, 5400],
];

/**
 * Temperatur, bei der das Material zu schmelzen beginnt (vereinfacht).
 * Im Mantel: Peridotit mit etwas Wasser; im Kern: Eisenlegierung.
 */
const SCHMELZEN: Tabelle = [
  [0, 1050], [60, 1180], [100, 1330], [150, 1400], [250, 1550], [410, 1850], [660, 2150],
  [1500, 2900], [2891, 3900], [2891, 3500], [5150, 5100], [6371, 5500],
];

/** log₁₀ der Viskosität in Pa·s (Größenordnungen). */
const VISKOSITAET: Tabelle = [
  [0, 24], [100, 23], [100, 20], [250, 20], [250, 20.5], [410, 20.8], [410, 21], [660, 21.3],
  [660, 22], [2000, 22.7], [2700, 22.3], [2891, 21], [2891, -2], [5150, -2], [5150, 18], [6371, 18],
];

export const TABELLEN = {
  dichte: DICHTE, vp: VP, vs: VS, druck: DRUCK, schwere: SCHWERE,
  temperatur: TEMPERATUR, schmelzen: SCHMELZEN, viskositaet: VISKOSITAET,
} as const;

export type Groesse = keyof typeof TABELLEN;

/** Wert einer Größe in einer Tiefe; an Sprüngen der Wert darunter. */
export function profilWert(groesse: Groesse, tiefe: number): number {
  const t = TABELLEN[groesse];
  const z = Math.min(Math.max(tiefe, 0), ERDRADIUS);
  for (let i = t.length - 1; i >= 0; i--) {
    if (t[i][0] <= z) {
      const [z0, w0] = t[i];
      const naechster = t[i + 1];
      if (!naechster) return w0;
      const [z1, w1] = naechster;
      return z1 === z0 ? w1 : w0 + (w1 - w0) * (z - z0) / (z1 - z0);
    }
  }
  return t[0][1];
}

/** Wert knapp *über* einer Tiefe — für die Oberseite einer Unstetigkeit. */
export function profilWertOben(groesse: Groesse, tiefe: number): number {
  const t = TABELLEN[groesse];
  for (let i = 0; i < t.length - 1; i++) {
    if (t[i][0] < tiefe && t[i + 1][0] >= tiefe) {
      const [z0, w0] = t[i];
      const [z1, w1] = t[i + 1];
      return w0 + (w1 - w0) * (tiefe - z0) / (z1 - z0);
    }
  }
  return profilWert(groesse, tiefe);
}

/**
 * Masse einer Kugelschale in kg, aus der Dichtetabelle integriert.
 * Mit ihr lassen sich Anteile an Masse und Volumen ausrechnen — und die Summe
 * muss die Erdmasse (5,97·10²⁴ kg) treffen.
 */
export function schalenMasse(von: number, bis: number, schritte = 400): number {
  let m = 0;
  const dz = (bis - von) / schritte;
  for (let i = 0; i < schritte; i++) {
    const z = von + (i + 0.5) * dz;
    const r = (ERDRADIUS - z) * 1000; // m
    const rho = profilWert("dichte", z) * 1000; // kg/m³
    m += 4 * Math.PI * r * r * rho * dz * 1000;
  }
  return m;
}

export function schalenVolumen(von: number, bis: number): number {
  const ra = ERDRADIUS - von, ri = ERDRADIUS - bis;
  return (4 / 3) * Math.PI * (ra ** 3 - ri ** 3) * 1e9; // m³
}

/** Zusammensetzung in Massenprozent — ganze Erde gegen Kruste. */
export const ELEMENTE: { symbol: string; name: string; erde: number; kruste: number }[] = [
  { symbol: "Fe", name: "Eisen", erde: 32.1, kruste: 5.6 },
  { symbol: "O", name: "Sauerstoff", erde: 30.1, kruste: 46.1 },
  { symbol: "Si", name: "Silizium", erde: 15.1, kruste: 28.2 },
  { symbol: "Mg", name: "Magnesium", erde: 13.9, kruste: 2.3 },
  { symbol: "S", name: "Schwefel", erde: 2.9, kruste: 0.04 },
  { symbol: "Ni", name: "Nickel", erde: 1.8, kruste: 0.01 },
  { symbol: "Ca", name: "Calcium", erde: 1.5, kruste: 4.2 },
  { symbol: "Al", name: "Aluminium", erde: 1.4, kruste: 8.2 },
  { symbol: "Na", name: "Natrium", erde: 0.2, kruste: 2.4 },
  { symbol: "K", name: "Kalium", erde: 0.02, kruste: 2.1 },
];

/** Zum Vergleich auf der Viskositätsskala (log₁₀ Pa·s). */
export const ZAEHIGKEITEN: { name: string; log: number }[] = [
  { name: "Luft", log: -4.7 },
  { name: "Wasser", log: -3 },
  { name: "Olivenöl", log: -1 },
  { name: "Honig", log: 1 },
  { name: "Asphalt", log: 8 },
  { name: "Gletschereis", log: 13 },
];
