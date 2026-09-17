/**
 * Einheiten fürs Physiklabor.
 *
 * Die Regel, an der alles hängt: **gerechnet wird ausschließlich in
 * SI-Basiseinheiten** — Meter, Kilogramm, Sekunde, Ampere, Kelvin, Radiant.
 * Kein Solver, kein Gerät und keine Szene kennt Zentimeter, Gramm, Milliampere
 * oder Grad Celsius. Umgerechnet wird erst hier, beim Anzeigen.
 *
 * Das ist keine Förmlichkeit: sobald ein Wert als »47« irgendwo liegt und
 * seine Einheit nur in einer Beschriftung steht, multipliziert es früher oder
 * später jemand mit 1000. Deshalb ist diese Datei die einzige Stelle im
 * Labor, an der Vorsätze (m, k, µ) und Schuleinheiten (°C, km/h, °) vorkommen.
 *
 * Alle Messgeräte — Oszilloskop, Multimeter, Tabelle, CSV — hängen über
 * `Signal.einheit` an `formatiere` und zeigen dadurch von allein dasselbe an.
 */

/** SI-Einheiten, in denen das Labor rechnet. */
export type Einheit =
  | "" | "m" | "kg" | "s" | "A" | "K"
  | "N" | "V" | "Ohm" | "F" | "H" | "W" | "J" | "Hz" | "C" | "lx" | "Nm"
  | "rad" | "m/s" | "m/s^2";

/** Einheiten, die es nur zum Anzeigen gibt — nie zum Rechnen. */
export type AnzeigeEinheit = "grad" | "°C" | "km/h";

/** Wie die SI-Einheit geschrieben wird. */
const ZEICHEN: Record<Einheit, string> = {
  "": "", m: "m", kg: "kg", s: "s", A: "A", K: "K",
  N: "N", V: "V", Ohm: "Ω", F: "F", H: "H", W: "W", J: "J", Hz: "Hz", C: "C", lx: "lx", Nm: "N·m",
  rad: "rad", "m/s": "m/s", "m/s^2": "m/s²",
};

/** Einheiten, denen man keinen Vorsatz voranstellt. */
const OHNE_VORSATZ = new Set<Einheit>(["", "rad"]);

const VORSAETZE: { faktor: number; zeichen: string }[] = [
  { faktor: 1e9, zeichen: "G" },
  { faktor: 1e6, zeichen: "M" },
  { faktor: 1e3, zeichen: "k" },
  { faktor: 1, zeichen: "" },
  { faktor: 1e-3, zeichen: "m" },
  { faktor: 1e-6, zeichen: "µ" },
  { faktor: 1e-9, zeichen: "n" },
  { faktor: 1e-12, zeichen: "p" },
];

const UMRECHNUNG: Record<AnzeigeEinheit, { si: Einheit; hin: (x: number) => number; her: (x: number) => number; zeichen: string }> = {
  grad: { si: "rad", hin: r => (r * 180) / Math.PI, her: d => (d * Math.PI) / 180, zeichen: "°" },
  "°C": { si: "K", hin: k => k - 273.15, her: c => c + 273.15, zeichen: "°C" },
  "km/h": { si: "m/s", hin: v => v * 3.6, her: v => v / 3.6, zeichen: "km/h" },
};

/** Drei geltende Ziffern, deutsches Komma, keine überflüssigen Nullen. */
function zahl(x: number): string {
  const gerundet = Number(x.toPrecision(3));
  return String(gerundet).replace(".", ",");
}

/** Wählt den Vorsatz, bei dem die Mantisse zwischen 1 und 1000 liegt. */
function vorsatz(betrag: number, kleinster = 1e-12): { faktor: number; zeichen: string } {
  if (betrag === 0 || !Number.isFinite(betrag)) return { faktor: 1, zeichen: "" };
  const passend = VORSAETZE.find(v => v.faktor >= kleinster && betrag >= v.faktor);
  return passend ?? VORSAETZE.find(v => v.faktor === kleinster) ?? { faktor: 1, zeichen: "" };
}

/**
 * Ein SI-Wert als lesbarer Text. Mit `anzeige` in der Schuleinheit — die
 * bekommt dann keinen Vorsatz, denn »Millikilometer pro Stunde« gibt es nicht.
 */
export function formatiere(wert: number, einheit: Einheit, anzeige?: AnzeigeEinheit): string {
  if (anzeige) {
    const u = UMRECHNUNG[anzeige];
    return `${zahl(u.hin(wert))} ${u.zeichen}`;
  }
  if (OHNE_VORSATZ.has(einheit)) {
    const z = ZEICHEN[einheit];
    return z ? `${zahl(wert)} ${z}` : zahl(wert);
  }
  // Das Kilogramm ist die einzige Basiseinheit mit eingebautem Vorsatz: der
  // Vorsatz gehört ans Gramm. Oberhalb von Tonnen bleibt es bei kg — kein
  // Schulbuch schreibt »Megagramm«.
  if (einheit === "kg") {
    const v = vorsatz(Math.abs(wert) * 1000, 1e-3);
    const gedeckelt = v.faktor > 1e3 ? { faktor: 1e3, zeichen: "k" } : v;
    return `${zahl((wert * 1000) / gedeckelt.faktor)} ${gedeckelt.zeichen}g`;
  }
  const v = vorsatz(Math.abs(wert));
  return `${zahl(wert / v.faktor)} ${v.zeichen}${ZEICHEN[einheit]}`;
}

/** Was jemand in einer Schuleinheit eingetippt hat, zurück in SI. */
export function nachSI(wert: number, _einheit: Einheit, anzeige?: AnzeigeEinheit): number {
  return anzeige ? UMRECHNUNG[anzeige].her(wert) : wert;
}

/** Bogenmaß → Grad. Gerechnet wird in rad, gelesen in Grad. */
export const grad = (rad: number) => (rad * 180) / Math.PI;

/** Grad → Bogenmaß. */
export const bogen = (grad: number) => (grad * Math.PI) / 180;

/** Fallbeschleunigung, m/s². */
export const G = 9.81;
