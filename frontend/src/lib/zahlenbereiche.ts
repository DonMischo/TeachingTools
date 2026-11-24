/**
 * Zahlenbereiche ℕ ⊂ ℤ ⊂ ℚ ⊂ ℝ — Zahlen als Daten (nicht als Gleitkommazahl),
 * damit »√16« und »12/4« richtig als natürliche Zahlen erkannt werden und
 * »0,3 periodisch« als rational. Reine Rechnung, ohne React.
 *
 * ℕ enthält hier die 0 (so steht es in den Thüringer Lehrbüchern).
 */

export type Bereich = "N" | "Z" | "Q" | "R";
export const BEREICHE: readonly Bereich[] = ["N", "Z", "Q", "R"];

export const ZEICHEN: Record<Bereich, string> = { N: "ℕ", Z: "ℤ", Q: "ℚ", R: "ℝ" };
export const FARBE: Record<Bereich, string> = { N: "#16a34a", Z: "#2563eb", Q: "#d97706", R: "#c026d3" };

export type Zahl =
  | { art: "ganz"; n: number }
  | { art: "bruch"; z: number; n: number }
  /** endliche Dezimalzahl: ganze Stellen + Nachkommaziffern; oder periodisch (periode = Ziffern unter dem Strich) */
  | { art: "dez"; minus: boolean; ganz: number; vor: string; periode: string }
  /** ±√r */
  | { art: "wurzel"; minus: boolean; r: number }
  | { art: "konst"; name: "π" | "e" | "φ" };

const ggt = (a: number, b: number): number => (b === 0 ? Math.abs(a) : ggt(b, a % b));

/** Ist die Zahl ganzzahlig, liefert das ihren Wert, sonst null. */
export function alsGanze(x: Zahl): number | null {
  switch (x.art) {
    case "ganz": return x.n;
    case "bruch": return x.z % x.n === 0 ? x.z / x.n : null;
    case "dez": {
      // 0,9 periodisch = 1
      if (/^9+$/.test(x.periode) && /^9*$/.test(x.vor)) return (x.minus ? -1 : 1) * (x.ganz + 1);
      return /^0*$/.test(x.vor) && /^0*$/.test(x.periode) ? (x.minus ? -x.ganz : x.ganz) : null;
    }
    case "wurzel": {
      const s = Math.round(Math.sqrt(x.r));
      return s * s === x.r ? (x.minus ? -s : s) : null;
    }
    default: return null;
  }
}

export const istRational = (x: Zahl) => x.art === "ganz" || x.art === "bruch" || x.art === "dez" || alsGanze(x) !== null;

/** Alle Bereiche, in denen die Zahl liegt (aufsteigend). */
export function bereicheVon(x: Zahl): Bereich[] {
  const g = alsGanze(x);
  if (g !== null) return g >= 0 ? ["N", "Z", "Q", "R"] : ["Z", "Q", "R"];
  return istRational(x) ? ["Q", "R"] : ["R"];
}

/** Der kleinste Bereich, in dem die Zahl liegt. */
export const kleinsterBereich = (x: Zahl): Bereich => bereicheVon(x)[0];

/** Näherungswert (für den Zahlenstrahl). */
export function wert(x: Zahl): number {
  switch (x.art) {
    case "ganz": return x.n;
    case "bruch": return x.z / x.n;
    case "dez": {
      const v = x.vor, p = x.periode;
      let w = x.ganz + (v ? Number("0." + v) : 0);
      if (p) w += Number(p) / (10 ** p.length - 1) / 10 ** v.length;
      return x.minus ? -w : w;
    }
    case "wurzel": return (x.minus ? -1 : 1) * Math.sqrt(x.r);
    case "konst": return x.name === "π" ? Math.PI : x.name === "e" ? Math.E : (1 + Math.sqrt(5)) / 2;
  }
}

const MINUS = "−";
/** Schreibweise als Text (Bruch als a/b, Periode in Klammern hinter »P:«) — für Tests und aria-label. */
export function text(x: Zahl): string {
  switch (x.art) {
    case "ganz": return x.n < 0 ? MINUS + -x.n : String(x.n);
    case "bruch": return (x.z < 0 ? MINUS : "") + Math.abs(x.z) + "/" + x.n;
    case "dez": return (x.minus ? MINUS : "") + x.ganz + "," + x.vor + (x.periode ? `(${x.periode} periodisch)` : "");
    case "wurzel": return (x.minus ? MINUS : "") + "√" + x.r;
    case "konst": return x.name;
  }
}

/** Gleiche Zahlen (z. B. 6/2 und 3) zählen beim Würfeln nur einmal. */
export const schluessel = (x: Zahl) => text(x);

/** Warum liegt die Zahl genau dort? — ein Satz für die Rückmeldung. */
export function begruendung(x: Zahl): string {
  const g = alsGanze(x);
  if (x.art === "bruch" && g !== null) return `${text(x)} lässt sich kürzen: ${x.z} : ${x.n} = ${g < 0 ? MINUS + -g : g}.`;
  if (x.art === "wurzel" && g !== null) return `${text(x)} = ${g < 0 ? MINUS + -g : g}, denn ${Math.abs(g)} · ${Math.abs(g)} = ${x.r}.`;
  if (x.art === "dez" && g !== null) return `${text(x)} ist dasselbe wie ${g} (0,999… = 1).`;
  if (g !== null) return g >= 0 ? "Eine Zahl zum Zählen — natürlich, also auch ganz, rational und reell." : "Negativ und ganz: in ℤ, aber nicht in ℕ.";
  if (x.art === "bruch") return "Ein echter Bruch, der nicht aufgeht: rational, aber nicht ganz.";
  if (x.art === "dez") return x.periode
    ? "Periodische Dezimalzahlen sind Brüche (z. B. 0,3 periodisch = 1/3): rational."
    : "Endliche Dezimalzahlen sind Zehnerbrüche (z. B. 0,25 = 25/100): rational.";
  if (x.art === "wurzel") return `${x.r} ist keine Quadratzahl — die Wurzel hat unendlich viele Nachkommastellen ohne Periode: irrational, nur in ℝ.`;
  return `${text(x)} hat unendlich viele Nachkommastellen ohne Periode: irrational, nur in ℝ.`;
}

/**
 * Getippte Zahl lesen: »7«, »−3«, »3/4«, »-2,5«, »0,(3)« (Periode in Klammern),
 * »√2« oder »wurzel 2«, »pi«/»π«, »e«, »phi«. null = nicht verstanden.
 */
export function leseZahl(eingabe: string): Zahl | null {
  const t = eingabe.trim().replace(/\s+/g, "").replace(/[−–]/g, "-").replace(/\./g, ",").toLowerCase();
  if (!t) return null;
  if (t === "pi" || t === "π") return { art: "konst", name: "π" };
  if (t === "e") return { art: "konst", name: "e" };
  if (t === "phi" || t === "φ") return { art: "konst", name: "φ" };
  let m = /^(-?)(?:√|wurzel|sqrt)\(?(\d{1,6})\)?$/.exec(t);
  if (m) return { art: "wurzel", minus: m[1] === "-", r: Number(m[2]) };
  m = /^(-?\d{1,9})\/(-?\d{1,9})$/.exec(t);
  if (m) {
    let z = Number(m[1]), n = Number(m[2]);
    if (n === 0) return null;
    if (n < 0) { z = -z; n = -n; }
    return { art: "bruch", z, n };
  }
  m = /^(-?)(\d{1,12})(?:,(\d{0,12})(?:\((\d{1,12})\))?)?$/.exec(t);
  if (m) {
    if (m[3] === undefined && m[4] === undefined) return { art: "ganz", n: Number(m[1] + m[2]) || 0 };
    return { art: "dez", minus: m[1] === "-", ganz: Number(m[2]), vor: m[3] ?? "", periode: m[4] ?? "" };
  }
  return null;
}

// ── Würfeln ──────────────────────────────────────────────────────────

export type Zufall = () => number;
const zz = (r: Zufall, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const eins = <T,>(r: Zufall, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

/** Würfelt eine Zahl; mit `ziel` aus genau diesem kleinsten Bereich. Stufe 1 ohne Fallen, ab Stufe 2 auch √16, 12/4, 0,9 periodisch. */
export function wuerfleZahl(r: Zufall = Math.random, stufe: 1 | 2 | 3 = 2, ziel?: Bereich): Zahl {
  const b = ziel ?? eins(r, BEREICHE);
  const falle = stufe >= 2 && r() < (stufe === 3 ? 0.45 : 0.25);
  if (b === "N") {
    if (!falle) return { art: "ganz", n: zz(r, 0, stufe === 1 ? 20 : 999) };
    const k = zz(r, 1, 9), m = zz(r, 2, 6);
    return eins<Zahl>(r, [
      { art: "wurzel", minus: false, r: k * k },
      { art: "bruch", z: k * m, n: m },
      { art: "dez", minus: false, ganz: k, vor: "0", periode: "" },
    ]);
  }
  if (b === "Z") {
    if (!falle) return { art: "ganz", n: -zz(r, 1, stufe === 1 ? 20 : 500) };
    const k = zz(r, 2, 9);
    return eins<Zahl>(r, [
      { art: "wurzel", minus: true, r: k * k },
      { art: "bruch", z: -k * 3, n: 3 },
    ]);
  }
  if (b === "Q") {
    const art = eins(r, stufe === 1 ? ["bruch", "dez"] : ["bruch", "dez", "periode", "bruch"]);
    const minus = stufe >= 2 && r() < 0.35;
    if (art === "bruch") {
      let n = zz(r, 2, 12), z = zz(r, 1, 3 * n);
      while (z % n === 0) z++;
      const t = ggt(z, n);
      return { art: "bruch", z: (minus ? -1 : 1) * (z / t), n: n / t };
    }
    if (art === "dez") return { art: "dez", minus, ganz: zz(r, 0, 20), vor: String(zz(r, 1, 99)).replace(/0+$/, "") || "5", periode: "" };
    return { art: "dez", minus, ganz: zz(r, 0, 5), vor: eins(r, ["", "", "1", "8"]), periode: eins(r, ["3", "6", "1", "27", "142857", "45"]) };
  }
  // R ohne Q
  if (r() < 0.6) {
    let q = zz(r, 2, stufe === 1 ? 20 : 99);
    while (Number.isInteger(Math.sqrt(q))) q++;
    return { art: "wurzel", minus: stufe >= 2 && r() < 0.3, r: q };
  }
  return { art: "konst", name: eins(r, stufe === 1 ? ["π"] : ["π", "e", "φ"]) };
}

// ── Steckbriefe ──────────────────────────────────────────────────────

export type Steckbrief = {
  b: Bereich; name: string; menge: string; warum: string;
  /** Rechnungen, die in diesem Bereich immer gehen (Ergebnis bleibt im Bereich) */
  geht: string[]; gehtNicht: string[];
  eigenschaften: string[]; beispiele: string[];
};

export const STECKBRIEFE: Steckbrief[] = [
  { b: "N", name: "natürliche Zahlen", menge: "{0; 1; 2; 3; …}",
    warum: "Zum Zählen: Wie viele Äpfel? Wie viele Kinder?",
    geht: ["a + b", "a · b"], gehtNicht: ["3 − 5 = ?", "3 : 4 = ?"],
    eigenschaften: ["kleinste Zahl ist 0, eine größte gibt es nicht", "jede Zahl hat genau einen Nachfolger", "zwischen 3 und 4 liegt keine natürliche Zahl", "auf dem Zahlenstrahl einzelne Punkte"],
    beispiele: ["0", "7", "2026", "√25 = 5", "12/4 = 3"] },
  { b: "Z", name: "ganze Zahlen", menge: "{…; −2; −1; 0; 1; 2; …}",
    warum: "3 − 5 hat in ℕ kein Ergebnis. Temperaturen unter null, Schulden, Stockwerke unter der Erde brauchen negative Zahlen.",
    geht: ["a + b", "a − b", "a · b"], gehtNicht: ["3 : 4 = ?"],
    eigenschaften: ["ℕ plus die Gegenzahlen −1, −2, …", "keine kleinste und keine größte Zahl", "jede Zahl hat einen Vorgänger und einen Nachfolger", "Betrag |−4| = 4: Abstand zur 0"],
    beispiele: ["−12", "0", "45", "−√9 = −3", "−6/2 = −3"] },
  { b: "Q", name: "rationale Zahlen", menge: "{ a/b | a ∈ ℤ, b ∈ ℕ, b ≠ 0 }",
    warum: "3 : 4 hat in ℤ kein Ergebnis. Halbe Pizza, 0,75 Liter, −2,5 °C: Brüche und Dezimalzahlen.",
    geht: ["a + b", "a − b", "a · b", "a : b (b ≠ 0)"], gehtNicht: ["x · x = 2 → x = ?"],
    eigenschaften: ["jeder Bruch, jede endliche oder periodische Dezimalzahl", "zwischen zwei rationalen Zahlen liegt immer noch eine (z. B. der Mittelwert) — ℚ ist dicht", "trotzdem hat der Zahlenstrahl Lücken: √2 fehlt", "dieselbe Zahl hat viele Brüche: 1/2 = 2/4 = 0,5"],
    beispiele: ["3/4", "−2,5", "0,3 periodisch = 1/3", "1,25 = 5/4", "−7"] },
  { b: "R", name: "reelle Zahlen", menge: "ℚ und alle irrationalen Zahlen",
    warum: "Die Diagonale im Quadrat mit Seite 1 ist √2 lang — das ist kein Bruch. ℝ füllt die Lücken des Zahlenstrahls.",
    geht: ["a + b", "a − b", "a · b", "a : b (b ≠ 0)", "√a (a ≥ 0)"], gehtNicht: ["√(−4) = ?"],
    eigenschaften: ["jeder Punkt des Zahlenstrahls ist eine reelle Zahl — keine Lücken mehr", "irrational = unendlich viele Nachkommastellen ohne Periode", "√2, √3, π, e sind irrational", "Wurzel aus negativen Zahlen gibt es auch in ℝ nicht"],
    beispiele: ["√2 ≈ 1,414…", "π ≈ 3,14159…", "e ≈ 2,718…", "−√7", "0,1010010001…"] },
];

/** Gilt die Rechnung in allen Fällen innerhalb des Bereichs? (für die Abgeschlossenheits-Tabelle) */
export const ABGESCHLOSSEN: Record<Bereich, Record<"+" | "−" | "·" | ":", boolean>> = {
  N: { "+": true, "−": false, "·": true, ":": false },
  Z: { "+": true, "−": true, "·": true, ":": false },
  Q: { "+": true, "−": true, "·": true, ":": true },
  R: { "+": true, "−": true, "·": true, ":": true },
};

/** Für die Abgeschlossenheit: ein Gegenbeispiel, das aus dem Bereich herausführt. */
export const GEGENBEISPIEL: Partial<Record<`${Bereich}${"−" | ":"}`, string>> = {
  "N−": "3 − 5 = −2 ∉ ℕ",
  "N:": "3 : 4 = 0,75 ∉ ℕ",
  "Z:": "3 : 4 = 0,75 ∉ ℤ",
};

/** Antwort im Sortier-Spiel prüfen: genau die richtigen Bereiche gewählt? */
export function pruefeAuswahl(x: Zahl, gewaehlt: Iterable<Bereich>): { richtig: boolean; fehlt: Bereich[]; zuviel: Bereich[] } {
  const soll = new Set(bereicheVon(x));
  const ist = new Set(gewaehlt);
  const fehlt = BEREICHE.filter(b => soll.has(b) && !ist.has(b));
  const zuviel = BEREICHE.filter(b => !soll.has(b) && ist.has(b));
  return { richtig: fehlt.length === 0 && zuviel.length === 0, fehlt, zuviel };
}

/** Zahlenregen: welche Zahlen soll man fangen? */
export type Fangziel = { id: string; text: string; passt: (x: Zahl) => boolean };
export const FANGZIELE: Fangziel[] = [
  { id: "N", text: "natürliche Zahlen (ℕ)", passt: x => bereicheVon(x).includes("N") },
  { id: "ZohneN", text: "ganz, aber nicht natürlich (ℤ ohne ℕ)", passt: x => kleinsterBereich(x) === "Z" },
  { id: "Z", text: "ganze Zahlen (ℤ)", passt: x => bereicheVon(x).includes("Z") },
  { id: "QohneZ", text: "rational, aber nicht ganz (ℚ ohne ℤ)", passt: x => kleinsterBereich(x) === "Q" },
  { id: "Q", text: "rationale Zahlen (ℚ)", passt: x => bereicheVon(x).includes("Q") },
  { id: "RohneQ", text: "irrationale Zahlen (ℝ ohne ℚ)", passt: x => kleinsterBereich(x) === "R" },
];
