/**
 * Größen und Einheiten der Klassen 5/6 — Einheitenleitern, Umrechnung,
 * Vergleichsbeispiele. Reine Rechnung, kein React.
 *
 * Vorbild ist das Merkblatt »Größen und Einheiten« (Klasse 5): jede Größe
 * als Leiter von der größten zur kleinsten Einheit, zwischen Nachbarn die
 * Umrechnungszahl. Von einer Einheit zur nächstkleineren wird multipliziert,
 * zur nächstgrößeren geteilt.
 */

export type Einheit = {
  id: string;
  /** Kurzzeichen, z. B. »km«. */
  zeichen: string;
  name: string;
  /** Gleichwertige Schreibweise, z. B. 1 l = 1 dm³. */
  auch?: string;
  /** So viel ist ungefähr 1 dieser Einheit. */
  eins: string;
  /** Fläche/Volumen: die Länge, deren Quadrat bzw. Würfel die Einheit ist (1 a = (10 m)²). */
  seite?: string;
};

export type Beispiel = { emoji: string; text: string; /** in der Basiseinheit */ wert: number };

export type Kategorie = {
  id: string;
  name: string;
  icon: string;
  farbe: string;
  /** Von groß nach klein. */
  einheiten: Einheit[];
  /** schritte[i]: 1 einheiten[i] = schritte[i] einheiten[i + 1]. */
  schritte: number[];
  /** Index der Einheit, in der die Beispielwerte stehen. */
  basis: number;
  beispiele: Beispiel[];
  hinweis?: string;
  /** 2 bei Flächen, 3 bei Volumen: die Umrechnungszahl ist eine Längenzahl hoch 2 bzw. 3. */
  hoch?: 2 | 3;
};

export const KATEGORIEN: Kategorie[] = [
  {
    id: "laenge", name: "Länge", icon: "📏", farbe: "#3b82f6",
    einheiten: [
      { id: "km", zeichen: "km", name: "Kilometer", eins: "etwa 12 Minuten zu Fuß" },
      { id: "m", zeichen: "m", name: "Meter", eins: "ein großer Schritt eines Erwachsenen" },
      { id: "dm", zeichen: "dm", name: "Dezimeter", eins: "etwa eine Handbreite" },
      { id: "cm", zeichen: "cm", name: "Zentimeter", eins: "etwa so breit wie ein Fingernagel" },
      { id: "mm", zeichen: "mm", name: "Millimeter", eins: "etwa so dick wie eine Bankkarte" },
      { id: "um", zeichen: "µm", name: "Mikrometer", eins: "etwa so groß wie ein kleines Bakterium" },
    ],
    schritte: [1000, 10, 10, 10, 1000],
    basis: 1,
    beispiele: [
      { emoji: "🦠", text: "Bakterium", wert: 0.000002 },
      { emoji: "💇", text: "Haar (Dicke)", wert: 0.00007 },
      { emoji: "🐜", text: "Ameise", wert: 0.005 },
      { emoji: "✏️", text: "Bleistift", wert: 0.175 },
      { emoji: "🧒", text: "Kind mit 10 Jahren", wert: 1.4 },
      { emoji: "🚌", text: "Linienbus", wert: 12 },
      { emoji: "⚽", text: "Fußballfeld (Länge)", wert: 105 },
      { emoji: "🗼", text: "Eiffelturm", wert: 330 },
      { emoji: "🏔️", text: "Zugspitze (Höhe)", wert: 2962 },
      { emoji: "🏃", text: "Marathon", wert: 42195 },
      { emoji: "🌍", text: "Erde (Durchmesser)", wert: 12742000 },
    ],
  },
  {
    id: "flaeche", name: "Fläche", icon: "🟩", farbe: "#22c55e",
    einheiten: [
      { id: "km2", zeichen: "km²", name: "Quadratkilometer", seite: "1 km", eins: "etwa 140 Fußballfelder" },
      { id: "ha", zeichen: "ha", name: "Hektar", seite: "100 m", eins: "100 m × 100 m — etwa 1,4 Fußballfelder" },
      { id: "a", zeichen: "a", name: "Ar", seite: "10 m", eins: "10 m × 10 m — etwa 1,5 Klassenzimmer" },
      { id: "m2", zeichen: "m²", name: "Quadratmeter", seite: "1 m", eins: "eine große Tischplatte" },
      { id: "dm2", zeichen: "dm²", name: "Quadratdezimeter", seite: "1 dm", eins: "etwa eine Handfläche" },
      { id: "cm2", zeichen: "cm²", name: "Quadratzentimeter", seite: "1 cm", eins: "etwa ein Fingernagel" },
      { id: "mm2", zeichen: "mm²", name: "Quadratmillimeter", seite: "1 mm", eins: "etwa ein Stecknadelkopf" },
    ],
    schritte: [100, 100, 100, 100, 100, 100],
    hoch: 2,
    basis: 3,
    beispiele: [
      { emoji: "📌", text: "Stecknadelkopf", wert: 0.000001 },
      { emoji: "💅", text: "Fingernagel", wert: 0.0001 },
      { emoji: "📮", text: "Briefmarke", wert: 0.0006 },
      { emoji: "📄", text: "DIN-A4-Blatt", wert: 0.06237 },
      { emoji: "🚪", text: "Tür", wert: 1.8 },
      { emoji: "🏫", text: "Klassenzimmer", wert: 65 },
      { emoji: "🎾", text: "Tennisplatz", wert: 261 },
      { emoji: "⚽", text: "Fußballfeld", wert: 7140 },
      { emoji: "🏙️", text: "Erfurt", wert: 269e6 },
      { emoji: "🇩🇪", text: "Deutschland", wert: 357.6e9 },
    ],
  },
  {
    id: "volumen", name: "Volumen", icon: "🧊", farbe: "#06b6d4",
    einheiten: [
      { id: "m3", zeichen: "m³", name: "Kubikmeter", seite: "1 m", eins: "ein Würfel mit 1 m Kante — etwa 7 volle Badewannen" },
      { id: "hl", zeichen: "hl", name: "Hektoliter", eins: "etwa zwei Drittel einer vollen Badewanne" },
      { id: "l", zeichen: "l", name: "Liter", auch: "dm³", seite: "1 dm", eins: "eine Milchtüte" },
      { id: "dl", zeichen: "dl", name: "Deziliter", eins: "eine halbe Tasse" },
      { id: "cl", zeichen: "cl", name: "Zentiliter", eins: "zwei Teelöffel" },
      { id: "ml", zeichen: "ml", name: "Milliliter", auch: "cm³", seite: "1 cm", eins: "etwa 20 Tropfen" },
      { id: "mm3", zeichen: "mm³", name: "Kubikmillimeter", seite: "1 mm", eins: "ein winziges Sandkorn" },
    ],
    schritte: [10, 100, 10, 10, 10, 1000],
    hoch: 3,
    basis: 2,
    beispiele: [
      { emoji: "💧", text: "Tropfen", wert: 0.00005 },
      { emoji: "🥄", text: "Teelöffel", wert: 0.005 },
      { emoji: "☕", text: "Tasse", wert: 0.2 },
      { emoji: "🥫", text: "Getränkedose", wert: 0.33 },
      { emoji: "🥛", text: "Milchtüte", wert: 1 },
      { emoji: "🪣", text: "Eimer", wert: 10 },
      { emoji: "🛁", text: "Badewanne", wert: 150 },
      { emoji: "🏊", text: "50-m-Schwimmbecken", wert: 2.5e6 },
    ],
  },
  {
    id: "gewicht", name: "Gewicht", icon: "⚖️", farbe: "#a855f7",
    einheiten: [
      { id: "t", zeichen: "t", name: "Tonne", eins: "ein Kleinwagen" },
      { id: "kg", zeichen: "kg", name: "Kilogramm", eins: "eine Packung Mehl — oder 1 l Wasser" },
      { id: "g", zeichen: "g", name: "Gramm", eins: "eine Büroklammer" },
      { id: "mg", zeichen: "mg", name: "Milligramm", eins: "ein grobes Sandkorn" },
      { id: "ug", zeichen: "µg", name: "Mikrogramm", eins: "ein Staubkörnchen" },
    ],
    schritte: [1000, 1000, 1000, 1000],
    basis: 2,
    beispiele: [
      { emoji: "🦟", text: "Mücke", wert: 0.002 },
      { emoji: "📎", text: "Büroklammer", wert: 1 },
      { emoji: "🪙", text: "1-€-Münze", wert: 7.5 },
      { emoji: "🍫", text: "Tafel Schokolade", wert: 100 },
      { emoji: "⚽", text: "Fußball", wert: 430 },
      { emoji: "🎒", text: "Schulranzen (gepackt)", wert: 5000 },
      { emoji: "🧒", text: "Kind mit 10 Jahren", wert: 32000 },
      { emoji: "🚗", text: "Auto", wert: 1.4e6 },
      { emoji: "🐘", text: "Elefant", wert: 6e6 },
      { emoji: "🐋", text: "Blauwal", wert: 150e6 },
    ],
  },
  {
    id: "zeit", name: "Zeit", icon: "⏱️", farbe: "#ef4444",
    einheiten: [
      { id: "w", zeichen: "w", name: "Woche", eins: "Montag bis Sonntag" },
      { id: "d", zeichen: "d", name: "Tag", eins: "die Erde dreht sich einmal um sich selbst" },
      { id: "h", zeichen: "h", name: "Stunde", eins: "etwas länger als eine Schulstunde (45 min)" },
      { id: "min", zeichen: "min", name: "Minute", eins: "zweimal gründlich Hände waschen" },
      { id: "s", zeichen: "s", name: "Sekunde", eins: "etwa ein Herzschlag" },
      { id: "ms", zeichen: "ms", name: "Millisekunde", eins: "ein Lidschlag dauert etwa 300 ms" },
    ],
    schritte: [7, 24, 60, 60, 1000],
    basis: 4,
    beispiele: [
      { emoji: "📸", text: "Kamerablitz", wert: 0.001 },
      { emoji: "👁️", text: "Lidschlag", wert: 0.3 },
      { emoji: "❤️", text: "Herzschlag", wert: 0.8 },
      { emoji: "🏃", text: "100 m Weltrekord", wert: 9.58 },
      { emoji: "🪥", text: "Zähneputzen", wert: 180 },
      { emoji: "🏫", text: "Schulstunde", wert: 2700 },
      { emoji: "⚽", text: "Fußballspiel", wert: 5400 },
      { emoji: "🎬", text: "Spielfilm", wert: 7200 },
      { emoji: "😴", text: "Nachtschlaf", wert: 32400 },
      { emoji: "☀️", text: "Sommerferien", wert: 6 * 7 * 86400 },
      { emoji: "🎂", text: "ein Jahr", wert: 365 * 86400 },
    ],
    hinweis: "Zeit ist nicht dezimal: 1 h 30 min sind 1,5 h — nicht 1,3 h. Hier gilt · 60 und : 60, nicht · 10.",
  },
  {
    id: "euro", name: "Euro", icon: "💶", farbe: "#eab308",
    einheiten: [
      { id: "eur", zeichen: "€", name: "Euro", eins: "eine 1-€-Münze — oder 100 Ein-Cent-Münzen" },
      { id: "ct", zeichen: "ct", name: "Cent", eins: "die kleinste Münze" },
    ],
    schritte: [100],
    basis: 1,
    beispiele: [
      { emoji: "🟤", text: "1-Cent-Münze", wert: 1 },
      { emoji: "🟤", text: "5-Cent-Münze", wert: 5 },
      { emoji: "🟡", text: "10-Cent-Münze", wert: 10 },
      { emoji: "🟡", text: "50-Cent-Münze", wert: 50 },
      { emoji: "🪙", text: "1-€-Münze", wert: 100 },
      { emoji: "🪙", text: "2-€-Münze", wert: 200 },
      { emoji: "💶", text: "5-€-Schein", wert: 500 },
      { emoji: "💶", text: "20-€-Schein", wert: 2000 },
      { emoji: "💶", text: "100-€-Schein", wert: 10000 },
    ],
    hinweis: "Schreibweise: 3,50 € oder 3 € 50 ct. Nach dem Komma stehen immer zwei Stellen — die Cent.",
  },
  {
    id: "dollar", name: "US-Dollar", icon: "💵", farbe: "#15803d",
    einheiten: [
      { id: "usd", zeichen: "$", name: "Dollar", eins: "ein Dollarschein — oder 100 Pennys" },
      { id: "uct", zeichen: "¢", name: "Cent", eins: "ein Penny, die kleinste Münze" },
    ],
    schritte: [100],
    basis: 1,
    beispiele: [
      { emoji: "🟤", text: "Penny", wert: 1 },
      { emoji: "⚪", text: "Nickel", wert: 5 },
      { emoji: "⚪", text: "Dime", wert: 10 },
      { emoji: "⚪", text: "Quarter", wert: 25 },
      { emoji: "⚪", text: "Half Dollar", wert: 50 },
      { emoji: "💵", text: "1-$-Schein", wert: 100 },
      { emoji: "💵", text: "5-$-Schein", wert: 500 },
      { emoji: "💵", text: "20-$-Schein", wert: 2000 },
      { emoji: "💵", text: "100-$-Schein", wert: 10000 },
    ],
    hinweis: "Ein Quarter ist 25 ¢ — vier davon sind ein Dollar. Euro und Dollar lassen sich nicht fest umrechnen: der Wechselkurs ändert sich jeden Tag.",
  },
];

export const kategorie = (id: string) => KATEGORIEN.find(k => k.id === id) ?? KATEGORIEN[0];

/** Umrechnungszahl von Einheit i nach j: zur kleineren mal, zur größeren geteilt. */
export function schritt(k: Kategorie, i: number, j: number): { op: "·" | ":"; zahl: number } {
  let f = 1;
  for (let x = Math.min(i, j); x < Math.max(i, j); x++) f *= k.schritte[x];
  return { op: i <= j ? "·" : ":", zahl: f };
}

export const HOCH = { 2: "²", 3: "³" } as const;

/**
 * Dieselbe Umrechnung als Längenzahl hoch 2 bzw. 3: m² → cm² ist · 100²,
 * m³ → cm³ ist · 100³. `null`, wo keine Länge dahintersteht (hl, dl, cl:
 * 1 l = 10 dl, aber 10 ist keine ganze Zahl hoch 3) oder die Größe keine
 * Fläche/kein Volumen ist.
 */
export function laengenSchritt(k: Kategorie, i: number, j: number): { op: "·" | ":"; basis: number; hoch: 2 | 3 } | null {
  if (!k.hoch || i === j) return null;
  const { op, zahl } = schritt(k, i, j);
  const basis = Math.round(zahl ** (1 / k.hoch));
  if (basis ** k.hoch !== zahl) return null;
  // Nur, wenn beide Einheiten eine Seitenlänge haben — sonst wäre es Zufall.
  if (!k.einheiten[i].seite || !k.einheiten[j].seite) return null;
  return { op, basis, hoch: k.hoch };
}

/** Faktor von Einheit i nach Einheit j: Wert in j = Wert in i · faktor. */
export function faktor(k: Kategorie, i: number, j: number): number {
  const { op, zahl } = schritt(k, i, j);
  return op === "·" ? zahl : 1 / zahl;
}

const ggT = (a: number, b: number): number => (b ? ggT(b, a % b) : a);

/** Bricht ein Bruch mit Nenner n als Dezimalzahl ab? (nur Primfaktoren 2 und 5) */
function endlich(n: number): boolean {
  while (n % 2 === 0) n /= 2;
  while (n % 5 === 0) n /= 5;
  return n === 1;
}

export type Ergebnis = { wert: number; exakt: boolean; bruch?: [number, number] };

/** v in Einheit i umgerechnet nach Einheit j. */
export function umrechnen(k: Kategorie, v: number, i: number, j: number): Ergebnis {
  const { op, zahl } = schritt(k, i, j);
  if (op === "·") return { wert: v * zahl, exakt: true };
  const wert = v / zahl;
  // Mit ganzen Zahlen lässt sich der Bruch kürzen; Kommazahlen gelten als exakt, wenn sie abbrechen.
  if (Number.isInteger(v)) {
    const g = ggT(Math.abs(v), zahl) || 1;
    const nenner = zahl / g;
    return { wert, exakt: endlich(nenner), bruch: nenner === 1 ? undefined : [v / g, nenner] };
  }
  return { wert, exakt: endlich(zahl) };
}

const NNBSP = String.fromCharCode(0x202f); // schmales, festes Leerzeichen

/** Deutsche Schreibweise: 1 000 000 und 0,25 — ohne Exponent, ohne Rechenrauschen. */
export function zahl(x: number, stellen = 12): string {
  if (!Number.isFinite(x)) return "–";
  const r = Number(x.toPrecision(stellen));
  const neg = r < 0;
  // So viele Nachkommastellen, wie die gültigen Stellen hergeben — mehr wäre Rechenrauschen.
  const nk = r === 0 ? 0 : Math.max(0, Math.min(20, stellen - Math.floor(Math.log10(Math.abs(r))) - 1));
  let [ganz, nach = ""] = Math.abs(r).toFixed(nk).split(".");
  nach = nach.replace(/0+$/, "");
  ganz = ganz.replace(/\B(?=(\d{3})+(?!\d))/g, NNBSP);
  return (neg ? "−" : "") + ganz + (nach ? "," + nach : "");
}

/** Gerundet auf wenige gültige Stellen, für »≈«. */
export const ungefaehr = (x: number) => zahl(x, 3);

/** Wie viele Stellen wandert das Komma? Nur bei Zehnerpotenzen. */
export function kommaStellen(f: number): number | null {
  const n = Math.log10(f);
  return Math.abs(n - Math.round(n)) < 1e-9 ? Math.round(n) : null;
}

/**
 * Die passendste Einheit für einen Wert (in der Basiseinheit): die größte,
 * in der er mindestens 1 ist — so liest man »1,4 m«, nicht »1 400 mm«.
 */
export function bestEinheit(k: Kategorie, wertBasis: number): { i: number; wert: number } {
  for (let i = 0; i < k.einheiten.length; i++) {
    const w = wertBasis * faktor(k, k.basis, i);
    if (w >= 1 - 1e-9) return { i, wert: w };
  }
  const i = k.einheiten.length - 1;
  return { i, wert: wertBasis * faktor(k, k.basis, i) };
}
