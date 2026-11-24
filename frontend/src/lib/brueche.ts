/**
 * Bruchrechnung als Daten mit Rechenwegen: Kürzen, Erweitern, Hauptnenner,
 * die vier Grundrechenarten Schritt für Schritt, Bruchteile von Größen und
 * Umwandeln zwischen Bruch und Dezimalzahl über Zehner-, Hundertstel- und
 * Tausendstelbrüche. Reine Rechnung, ohne React.
 *
 * In Rechenweg-Texten steht ein Bruch als »a/b«; die Oberfläche setzt ihn gestapelt.
 */

export type Bruch = { z: number; n: number };

export const ggt = (a: number, b: number): number => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
export const kgv = (a: number, b: number) => Math.abs(a * b) / ggt(a, b);

/** Vorzeichen in den Zähler, Nenner positiv. */
export function normal(b: Bruch): Bruch { return b.n < 0 ? { z: -b.z, n: -b.n } : { ...b }; }
export function kuerze(b: Bruch): Bruch { const t = ggt(b.z, b.n) || 1; return normal({ z: b.z / t, n: b.n / t }); }
export const erweitere = (b: Bruch, k: number): Bruch => ({ z: b.z * k, n: b.n * k });
export const gleich = (a: Bruch, b: Bruch) => a.z * b.n === b.z * a.n;
export const wert = (b: Bruch) => b.z / b.n;

const MINUS = "−";
const zahl = (x: number) => (x < 0 ? MINUS + -x : String(x));
/** »3/4«, ganze Zahlen ohne Nenner wenn `ganzKurz` */
export function bt(b: Bruch, ganzKurz = false): string {
  const c = normal(b);
  if (ganzKurz && c.n === 1) return zahl(c.z);
  return (c.z < 0 ? MINUS : "") + Math.abs(c.z) + "/" + c.n;
}

/** Gemischte Zahl: 11/4 → { ganz: 2, rest: 3/4 } (Vorzeichen am Ganzen bzw. am Rest, wenn ganz = 0). */
export function gemischt(b: Bruch): { ganz: number; rest: Bruch } {
  const c = normal(b);
  const g = Math.trunc(c.z / c.n);
  return { ganz: g, rest: { z: g === 0 ? c.z : Math.abs(c.z) - Math.abs(g) * c.n, n: c.n } };
}
export function gemischtText(b: Bruch): string {
  const { ganz, rest } = gemischt(b);
  if (rest.z === 0) return zahl(ganz);
  if (ganz === 0) return bt(rest);
  return `${zahl(ganz)} ${bt(rest)}`;
}

export const art = (b: Bruch): "stamm" | "echt" | "unecht" | "scheinbruch" => {
  const c = normal(b);
  if (c.z % c.n === 0) return "scheinbruch";
  if (Math.abs(c.z) > c.n) return "unecht";
  return Math.abs(c.z) === 1 ? "stamm" : "echt";
};

const NENNERWORT: Record<number, string> = {
  1: "Ganze", 2: "Halbe", 3: "Drittel", 4: "Viertel", 5: "Fünftel", 6: "Sechstel", 7: "Siebtel", 8: "Achtel", 9: "Neuntel",
  10: "Zehntel", 11: "Elftel", 12: "Zwölftel", 16: "Sechzehntel", 20: "Zwanzigstel", 100: "Hundertstel", 1000: "Tausendstel",
};
const ZAHLWORT = ["null", "ein", "zwei", "drei", "vier", "fünf", "sechs", "sieben", "acht", "neun", "zehn", "elf", "zwölf",
  "dreizehn", "vierzehn", "fünfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn", "zwanzig"];
/** »drei Viertel«, »ein Halb«; ohne passendes Wort: »7 von 13 Teilen« */
export function wort(b: Bruch): string {
  const c = normal(b);
  const nw = NENNERWORT[c.n] ?? (c.n < 20 ? `${ZAHLWORT[c.n]}tel` : `${c.n}stel`);
  const zw = Math.abs(c.z) <= 20 ? ZAHLWORT[Math.abs(c.z)] : String(Math.abs(c.z));
  if (c.n === 2 && Math.abs(c.z) === 1) return `${c.z < 0 ? "minus " : ""}ein Halb`;
  return `${c.z < 0 ? "minus " : ""}${zw === "ein" && c.n !== 1 ? "ein" : zw} ${nw}`;
}

// ── Kürzen und Erweitern mit Rechenweg ───────────────────────────────

export function kuerzWeg(b: Bruch): { schritte: string[]; ergebnis: Bruch } {
  const t = ggt(b.z, b.n);
  if (t <= 1) return { schritte: [`${bt(b)} lässt sich nicht kürzen: Zähler und Nenner haben keinen gemeinsamen Teiler außer 1.`], ergebnis: b };
  const e = { z: b.z / t, n: b.n / t };
  return {
    schritte: [
      `Größter gemeinsamer Teiler von ${Math.abs(b.z)} und ${b.n}: ggT = ${t}`,
      `Zähler und Nenner durch ${t} teilen: ${bt(b)} = (${zahl(b.z)} : ${t}) / (${b.n} : ${t}) = ${bt(e)}`,
    ],
    ergebnis: e,
  };
}

// ── Rechnen ──────────────────────────────────────────────────────────

export type Op = "+" | "−" | "·" | ":";
export const OPS: readonly Op[] = ["+", "−", "·", ":"];

export type Rechenweg = { schritte: string[]; ergebnis: Bruch };

function gleichnamig(a: Bruch, b: Bruch, op: "+" | "−"): Rechenweg {
  const s: string[] = [];
  const hn = kgv(a.n, b.n);
  let ea = a, eb = b;
  if (a.n === b.n) s.push(`Die Brüche sind schon gleichnamig (Nenner ${a.n}).`);
  else {
    s.push(`Hauptnenner = kgV(${a.n}; ${b.n}) = ${hn}`);
    ea = erweitere(a, hn / a.n); eb = erweitere(b, hn / b.n);
    s.push(`Erweitern: ${bt(a)} = ${bt(ea)}` + (hn / a.n > 1 ? ` (mit ${hn / a.n})` : "") + `, ${bt(b)} = ${bt(eb)}` + (hn / b.n > 1 ? ` (mit ${hn / b.n})` : ""));
  }
  const z = op === "+" ? ea.z + eb.z : ea.z - eb.z;
  s.push(`Zähler ${op === "+" ? "addieren" : "subtrahieren"}, Nenner bleibt: ${bt(ea)} ${op} ${bt(eb)} = (${zahl(ea.z)} ${op} ${zahl(eb.z)}) / ${hn} = ${bt({ z, n: hn })}`);
  return { schritte: s, ergebnis: { z, n: hn } };
}

export function rechne(a: Bruch, op: Op, b: Bruch): Rechenweg {
  a = normal(a); b = normal(b);
  let w: Rechenweg;
  if (op === "+" || op === "−") w = gleichnamig(a, b, op);
  else if (op === "·") {
    const e = { z: a.z * b.z, n: a.n * b.n };
    w = { schritte: [`Zähler mal Zähler, Nenner mal Nenner: ${bt(a)} · ${bt(b)} = (${zahl(a.z)} · ${zahl(b.z)}) / (${a.n} · ${b.n}) = ${bt(e)}`], ergebnis: e };
  } else {
    if (b.z === 0) throw new Error("Durch 0 teilt man nicht.");
    const k = normal({ z: b.n, n: b.z });
    const e = normal({ z: a.z * k.z, n: a.n * k.n });
    w = { schritte: [
      `Durch einen Bruch teilen = mit dem Kehrwert malnehmen. Kehrwert von ${bt(b)} ist ${bt(k)}.`,
      `${bt(a)} : ${bt(b)} = ${bt(a)} · ${bt(k)} = (${zahl(a.z)} · ${zahl(k.z)}) / (${a.n} · ${k.n}) = ${bt(e)}`,
    ], ergebnis: e };
  }
  const k = kuerzWeg(w.ergebnis);
  if (ggt(w.ergebnis.z, w.ergebnis.n) > 1) w.schritte.push(`Kürzen mit ${ggt(w.ergebnis.z, w.ergebnis.n)}: ${bt(w.ergebnis)} = ${bt(k.ergebnis)}`);
  const end = kuerze(w.ergebnis);
  if (art(end) === "unecht") w.schritte.push(`Als gemischte Zahl: ${bt(end)} = ${gemischtText(end)}`);
  if (end.n === 1) w.schritte.push(`Das ist die ganze Zahl ${zahl(end.z)}.`);
  return { schritte: w.schritte, ergebnis: end };
}

/**
 * Kreuzmethode (»vedische Mathematik«) für + und −: links oben · rechts unten,
 * links unten · rechts oben — die Produkte addieren bzw. subtrahieren ergibt den
 * Zähler; unten einfach mal: Nenner · Nenner. Danach meist noch kürzen, weil
 * b · d nicht der kleinste gemeinsame Nenner sein muss.
 */
export function kreuzWeg(a: Bruch, op: "+" | "−", b: Bruch): { links: number; rechts: number; zaehler: number; nenner: number; schritte: string[]; ergebnis: Bruch } {
  a = normal(a); b = normal(b);
  const links = a.z * b.n, rechts = a.n * b.z, zaehler = op === "+" ? links + rechts : links - rechts, nenner = a.n * b.n;
  const roh = { z: zaehler, n: nenner }, k = kuerze(roh);
  const schritte = [
    `Links oben · rechts unten: ${zahl(a.z)} · ${b.n} = ${zahl(links)}`,
    `Links unten · rechts oben: ${a.n} · ${zahl(b.z)} = ${zahl(rechts)}`,
    `Zähler: ${zahl(links)} ${op} ${rechts < 0 ? `(${zahl(rechts)})` : rechts} = ${zahl(zaehler)}`,
    `Unten einfach mal: ${a.n} · ${b.n} = ${nenner}`,
    `Also ${bt(a)} ${op} ${bt(b)} = ${bt(roh)}`,
  ];
  if (k.n !== nenner) schritte.push(`Kürzen mit ${nenner / k.n}: ${bt(roh)} = ${bt(k)}`);
  return { links, rechts, zaehler, nenner, schritte, ergebnis: k };
}

export const REGELN: { op: Op; titel: string; regel: string; beispiel: string }[] = [
  { op: "+", titel: "Addieren", regel: "Gleichnamig machen (Hauptnenner), dann die Zähler addieren. Der Nenner bleibt. Oder über Kreuz: links oben · rechts unten + links unten · rechts oben, unten mal unten.", beispiel: "1/4 + 1/6 = 3/12 + 2/12 = 5/12" },
  { op: "−", titel: "Subtrahieren", regel: "Gleichnamig machen, dann die Zähler subtrahieren. Der Nenner bleibt.", beispiel: "3/4 − 1/3 = 9/12 − 4/12 = 5/12" },
  { op: "·", titel: "Multiplizieren", regel: "Zähler mal Zähler, Nenner mal Nenner. Vorher über Kreuz kürzen spart Arbeit.", beispiel: "2/3 · 3/4 = 6/12 = 1/2" },
  { op: ":", titel: "Dividieren", regel: "Mit dem Kehrwert des zweiten Bruchs malnehmen (Zähler und Nenner tauschen).", beispiel: "3/4 : 1/2 = 3/4 · 2/1 = 6/4 = 3/2" },
];

// ── Bruch ↔ Dezimalzahl ──────────────────────────────────────────────

/** Lässt sich der Bruch auf 10, 100 oder 1000 erweitern? Dann Faktor und Zehnerpotenz. */
export function zehnerbruch(b: Bruch): { faktor: number; nenner: 10 | 100 | 1000; bruch: Bruch } | null {
  const c = kuerze(b);
  for (const n of [10, 100, 1000] as const) if (n % c.n === 0) return { faktor: n / c.n, nenner: n, bruch: erweitere(c, n / c.n) };
  return null;
}

/** Dezimalzahl eines Bruchs als schriftliche Division; periodisch erkannt (Periode höchstens 30 Stellen). */
export function dezimal(b: Bruch): { minus: boolean; ganz: number; vor: string; periode: string } {
  const c = normal(b);
  const minus = c.z < 0;
  let r = Math.abs(c.z) % c.n;
  const ganz = Math.floor(Math.abs(c.z) / c.n);
  const gesehen = new Map<number, number>();
  let ziffern = "";
  while (r !== 0 && !gesehen.has(r) && ziffern.length < 40) {
    gesehen.set(r, ziffern.length);
    r *= 10;
    ziffern += Math.floor(r / c.n);
    r %= c.n;
  }
  if (r === 0) return { minus, ganz, vor: ziffern, periode: "" };
  const start = gesehen.get(r) ?? ziffern.length;
  return { minus, ganz, vor: ziffern.slice(0, start), periode: ziffern.slice(start) };
}
export function dezimalText(b: Bruch): string {
  const d = dezimal(b);
  const s = (d.minus ? MINUS : "") + d.ganz;
  if (!d.vor && !d.periode) return s;
  return s + "," + d.vor + (d.periode ? d.periode + " (" + d.periode + " periodisch)" : "");
}

/** Endliche Dezimalzahl (»0,375«) → Zehnerbruch → gekürzt, mit Rechenweg. */
export function ausDezimal(text: string): Rechenweg | null {
  const m = /^\s*(-?)(\d{1,6})(?:[,.](\d{1,4}))?\s*$/.exec(text.replace(/[−–]/g, "-"));
  if (!m) return null;
  const nach = m[3] ?? "";
  const n = 10 ** nach.length;
  const z = (Number(m[2]) * n + (nach ? Number(nach) : 0)) * (m[1] ? -1 : 1);
  const roh = { z, n };
  const s = nach
    ? [`${nach.length} Nachkommastelle${nach.length > 1 ? "n" : ""} → Nenner ${n} (${NENNERWORT[n]}): ${m[1] ? MINUS : ""}${m[2]},${nach} = ${bt(roh)}`]
    : [`Ganze Zahl: ${zahl(z)} = ${zahl(z)}/1`];
  const k = kuerzWeg(roh);
  if (ggt(z, n) > 1) s.push(...k.schritte);
  return { schritte: s, ergebnis: kuerze(roh) };
}

/** Wichtige Brüche zum Auswendigkönnen. */
export const WICHTIGE: { b: Bruch; dez: string; prozent: string }[] = [
  { b: { z: 1, n: 2 }, dez: "0,5", prozent: "50 %" },
  { b: { z: 1, n: 4 }, dez: "0,25", prozent: "25 %" },
  { b: { z: 3, n: 4 }, dez: "0,75", prozent: "75 %" },
  { b: { z: 1, n: 5 }, dez: "0,2", prozent: "20 %" },
  { b: { z: 2, n: 5 }, dez: "0,4", prozent: "40 %" },
  { b: { z: 1, n: 8 }, dez: "0,125", prozent: "12,5 %" },
  { b: { z: 3, n: 8 }, dez: "0,375", prozent: "37,5 %" },
  { b: { z: 1, n: 10 }, dez: "0,1", prozent: "10 %" },
  { b: { z: 1, n: 20 }, dez: "0,05", prozent: "5 %" },
  { b: { z: 1, n: 3 }, dez: "0,3 periodisch", prozent: "33,3 %" },
  { b: { z: 2, n: 3 }, dez: "0,6 periodisch", prozent: "66,6 %" },
  { b: { z: 1, n: 6 }, dez: "0,16 periodisch (6 periodisch)", prozent: "16,6 %" },
  { b: { z: 1, n: 100 }, dez: "0,01", prozent: "1 %" },
  { b: { z: 3, n: 2 }, dez: "1,5", prozent: "150 %" },
];

// ── Bruchteile von Größen ────────────────────────────────────────────

export type Groesse = { wert: number; einheit: string; ding: string };
export type Bruchteilaufgabe = {
  frage: string; bruch: Bruch; ganzes: Groesse; teil: number;
  gesucht: "teil" | "ganzes"; loesung: number; schritte: string[];
};

const KONTEXTE: { ding: string; einheit: string; werte: number[] }[] = [
  { ding: "eine Tafel Schokolade", einheit: "g", werte: [100, 200, 300] },
  { ding: "ein Sack Kartoffeln", einheit: "kg", werte: [5, 10, 12.5, 25] },
  { ding: "das Taschengeld", einheit: "€", werte: [20, 24, 30, 40, 60] },
  { ding: "eine Schulstunde", einheit: "min", werte: [45, 90, 60] },
  { ding: "eine Rolle Band", einheit: "m", werte: [12, 24, 36, 50] },
  { ding: "ein Kanister Wasser", einheit: "ℓ", werte: [10, 20, 30] },
  { ding: "die Klasse", einheit: "Kinder", werte: [24, 28, 30, 32] },
  { ding: "ein Tag", einheit: "h", werte: [24] },
];

const de = (x: number) => x.toLocaleString("de-DE", { maximumFractionDigits: 3 });

export function bruchteilWeg(b: Bruch, g: Groesse): { teil: number; schritte: string[] } {
  const eins = g.wert / b.n, teil = eins * b.z;
  return { teil, schritte: [
    `1/${b.n} von ${de(g.wert)} ${g.einheit}: ${de(g.wert)} ${g.einheit} : ${b.n} = ${de(eins)} ${g.einheit}`,
    `${bt(b)} sind ${b.z}-mal so viel: ${de(eins)} ${g.einheit} · ${b.z} = ${de(teil)} ${g.einheit}`,
  ] };
}

export function ganzesWeg(b: Bruch, teil: number, einheit: string): { ganzes: number; schritte: string[] } {
  const eins = teil / b.z, ganzes = eins * b.n;
  return { ganzes, schritte: [
    `${bt(b)} sind ${de(teil)} ${einheit} → 1/${b.n} ist ${de(teil)} ${einheit} : ${b.z} = ${de(eins)} ${einheit}`,
    `Das Ganze sind ${b.n}/${b.n}: ${de(eins)} ${einheit} · ${b.n} = ${de(ganzes)} ${einheit}`,
  ] };
}

export type Zufall = () => number;
const eins = <T,>(r: Zufall, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

/** Würfelt eine Bruchteil-Aufgabe mit glatten Zahlen (Teile gehen auf). */
export function bruchteilAufgabe(r: Zufall = Math.random, rueckwaerts = false): Bruchteilaufgabe {
  for (;;) {
    const k = eins(r, KONTEXTE);
    const w = eins(r, k.werte);
    const n = eins(r, [2, 3, 4, 5, 6, 8, 10]);
    const z = 1 + Math.floor(r() * (n - 1));
    const b = kuerze({ z, n });
    if (!Number.isInteger((w / b.n) * 1000) || (k.einheit === "Kinder" && !Number.isInteger(w / b.n))) continue;
    const g = { wert: w, einheit: k.einheit, ding: k.ding };
    const { teil, schritte } = bruchteilWeg(b, g);
    if (!rueckwaerts) return { frage: `Wie viel sind ${bt(b)} von ${de(w)} ${k.einheit} (${k.ding})?`, bruch: b, ganzes: g, teil, gesucht: "teil", loesung: teil, schritte };
    const gw = ganzesWeg(b, teil, k.einheit);
    return { frage: `${bt(b)} von ${k.ding} sind ${de(teil)} ${k.einheit}. Wie viel ist das Ganze?`, bruch: b, ganzes: g, teil, gesucht: "ganzes", loesung: gw.ganzes, schritte: gw.schritte };
  }
}

// ── Üben: Rechenaufgaben ─────────────────────────────────────────────

export function rechenAufgabe(r: Zufall, op: Op, stufe: 1 | 2 | 3): { a: Bruch; b: Bruch } {
  const nenner = stufe === 1 ? [2, 3, 4, 5, 6, 8, 10] : stufe === 2 ? [2, 3, 4, 5, 6, 7, 8, 9, 10, 12] : [3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 16];
  const ein = (): Bruch => { const n = eins(r, nenner); return { z: 1 + Math.floor(r() * (stufe === 3 ? 2 * n : n - 1)), n }; };
  let a = ein(), b = ein();
  if (stufe === 1 && (op === "+" || op === "−")) b = { z: 1 + Math.floor(r() * (a.n - 1)), n: a.n };
  if (op === "−" && wert(a) < wert(b)) [a, b] = [b, a];
  if (op === "−" && gleich(a, b)) a = { z: a.z + a.n, n: a.n };
  return { a, b };
}

/** Getippten Bruch lesen: »3/4«, »-5/2«, »2«, »1 1/2« (gemischt). */
export function leseBruch(text: string): Bruch | null {
  const t = text.trim().replace(/[−–]/g, "-");
  let m = /^(-?)(\d{1,6})\s+(\d{1,6})\/(\d{1,6})$/.exec(t);
  if (m) { const n = Number(m[4]); if (!n) return null; const z = Number(m[2]) * n + Number(m[3]); return { z: m[1] ? -z : z, n }; }
  m = /^(-?\d{1,7})\s*\/\s*(-?\d{1,7})$/.exec(t);
  if (m) { const n = Number(m[2]); return n ? normal({ z: Number(m[1]), n }) : null; }
  m = /^(-?\d{1,7})$/.exec(t);
  return m ? { z: Number(m[1]), n: 1 } : null;
}
