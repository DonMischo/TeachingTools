/**
 * Lineare Gleichungssysteme mit zwei Variablen — exakt mit Brüchen gerechnet.
 * Ein Term ist a·x + b·y + k, eine Gleichung zwei Terme. Umformungen wirken auf
 * beide Seiten (wie in der Gleichungswaage), dazu die Zeilenrechnung für das
 * Additionsverfahren, Einsetzen, Lösen und Aufgaben aus dem Alltag.
 * Reine Rechnung, ohne React.
 */
import { kuerze, type Bruch } from "./brueche";

export type Q = Bruch;
export const q = (z: number, n = 1): Q => { const r = kuerze({ z, n }); return r.z === 0 ? { z: 0, n: 1 } : r; };
export const NULL: Q = { z: 0, n: 1 };
export const EINS: Q = { z: 1, n: 1 };
export const plus = (a: Q, b: Q) => q(a.z * b.n + b.z * a.n, a.n * b.n);
export const minus = (a: Q, b: Q) => q(a.z * b.n - b.z * a.n, a.n * b.n);
export const mal = (a: Q, b: Q) => q(a.z * b.z, a.n * b.n);
export const durch = (a: Q, b: Q) => q(a.z * b.n, a.n * b.z);
export const neg = (a: Q): Q => q(-a.z, a.n);
export const istNull = (a: Q) => a.z === 0;
export const qGleich = (a: Q, b: Q) => a.z === b.z && a.n === b.n;
export const qWert = (a: Q) => a.z / a.n;

export type Var = "x" | "y";
export type Term = { x: Q; y: Q; k: Q };
export type Gleichung = { l: Term; r: Term };
export const T = (x: number | Q, y: number | Q, k: number | Q): Term => {
  const f = (v: number | Q) => (typeof v === "number" ? q(v) : v);
  return { x: f(x), y: f(y), k: f(k) };
};

const tPlus = (a: Term, b: Term): Term => ({ x: plus(a.x, b.x), y: plus(a.y, b.y), k: plus(a.k, b.k) });
const tMal = (a: Term, f: Q): Term => ({ x: mal(a.x, f), y: mal(a.y, f), k: mal(a.k, f) });
export const tNeg = (a: Term) => tMal(a, q(-1));

// ── Schreiben ────────────────────────────────────────────────────────

const M = "−";
/** Bruch als Text; im Rechenweg setzt die Oberfläche »a/b« gestapelt */
export function qt(a: Q): string { return (a.z < 0 ? M : "") + Math.abs(a.z) + (a.n === 1 ? "" : "/" + a.n); }
export function qDeutsch(a: Q): string {
  if (a.n === 1) return qt(a);
  const d = a.z / a.n;
  const r = Math.round(d * 1000) / 1000;
  return Math.abs(d - r) < 1e-12 ? (d < 0 ? M : "") + Math.abs(r).toLocaleString("de-DE") : qt(a);
}

/** »2x + 3y − 4« (ohne Nullglieder; leer = »0«) */
export function termText(t: Term): string {
  const teile: string[] = [];
  const glied = (c: Q, v: string) => {
    if (istNull(c)) return;
    const betrag = { z: Math.abs(c.z), n: c.n };
    const zahl = v && betrag.z === 1 && betrag.n === 1 ? "" : qt(betrag);
    const s = zahl + v;
    teile.push(teile.length === 0 ? (c.z < 0 ? M : "") + s : (c.z < 0 ? ` ${M} ` : " + ") + s);
  };
  glied(t.x, "x"); glied(t.y, "y"); glied(t.k, "");
  return teile.length ? teile.join("") : "0";
}
export const gleichungText = (g: Gleichung) => `${termText(g.l)} = ${termText(g.r)}`;

// ── Lesen ────────────────────────────────────────────────────────────

/** »2x + 3y - 4«, »1/2x«, »-y«, »0,5x« → Term; null = nicht verstanden */
export function leseTerm(text: string): Term | null {
  const s = text.replace(/\s+/g, "").replace(/[−–]/g, "-").replace(/\*/g, "").replace(/·/g, "").toLowerCase();
  if (!s) return null;
  const glieder = s.match(/[+-]?[^+-]+/g);
  if (!glieder || glieder.join("") !== s) return null;
  let t = T(0, 0, 0);
  for (const g of glieder) {
    const m = /^([+-]?)(\d+(?:,\d+)?(?:\/\d+)?)?([xy]?)$/.exec(g);
    if (!m || (!m[2] && !m[3])) return null;
    let c: Q = EINS;
    if (m[2]) {
      if (m[2].includes("/")) { const [a, b] = m[2].split("/").map(Number); if (!b) return null; c = q(a, b); }
      else if (m[2].includes(",")) { const [a, b] = m[2].split(","); c = q(Number(a + b), 10 ** b.length); }
      else c = q(Number(m[2]));
    }
    if (m[1] === "-") c = neg(c);
    const v = (m[3] || "k") as "x" | "y" | "k";
    t = { ...t, [v]: plus(t[v], c) };
  }
  return t;
}

export function leseGleichung(text: string): Gleichung | null {
  const teile = text.split("=");
  if (teile.length !== 2) return null;
  const l = leseTerm(teile[0]), r = leseTerm(teile[1]);
  return l && r ? { l, r } : null;
}

// ── Umformen (beide Seiten) ──────────────────────────────────────────

export type Umformung = { art: "+"; t: Term } | { art: "·"; f: Q } | { art: ":"; f: Q };

export function opText(o: Umformung): string {
  if (o.art === "+") {
    const negativ = termText(o.t).startsWith(M);
    return negativ ? `${M} ${termText(tNeg(o.t))}` : `+ ${termText(o.t)}`;
  }
  return `${o.art} ${o.f.z < 0 ? `(${qt(o.f)})` : qt(o.f)}`;
}

/** »−3«, »+2x«, »:4«, »·(−2)«, »*1/2« → Umformung. Bei + und − ist der Term das, was addiert bzw. abgezogen wird. */
export function leseUmformung(text: string): Umformung | null {
  const s = text.replace(/\s+/g, "").replace(/[−–]/g, "-").replace(/[()]/g, "");
  const m = /^([+\-·*:\/])(.+)$/.exec(s);
  if (!m) return null;
  if (m[1] === "+" || m[1] === "-") {
    const t = leseTerm(m[2]);
    if (!t) return null;
    return { art: "+", t: m[1] === "-" ? tNeg(t) : t };
  }
  const t = leseTerm(m[2]);
  if (!t || !istNull(t.x) || !istNull(t.y) || istNull(t.k)) return null;
  return { art: m[1] === ":" || m[1] === "/" ? ":" : "·", f: t.k };
}

export function forme(g: Gleichung, o: Umformung): Gleichung {
  if (o.art === "+") return { l: tPlus(g.l, o.t), r: tPlus(g.r, o.t) };
  const f = o.art === "·" ? o.f : durch(EINS, o.f);
  return { l: tMal(g.l, f), r: tMal(g.r, f) };
}

/** Steht die Variable allein links (1·v = Rest ohne v)? */
export function istFreigestellt(g: Gleichung, v: Var): boolean {
  const andere: Var = v === "x" ? "y" : "x";
  return qGleich(g.l[v], EINS) && istNull(g.l[andere]) && istNull(g.l.k) && istNull(g.r[v]);
}

/**
 * Nächster sinnvoller Schritt, um v freizustellen: v-Glieder nach links,
 * alles andere nach rechts, dann durch den Faktor teilen. null = schon fertig
 * (oder unmöglich, weil v herausfällt).
 */
export function vorschlag(g: Gleichung, v: Var): Umformung | null {
  if (istFreigestellt(g, v)) return null;
  const andere: Var = v === "x" ? "y" : "x";
  if (!istNull(g.r[v])) return { art: "+", t: { x: NULL, y: NULL, k: NULL, [v]: neg(g.r[v]) } as Term };
  if (!istNull(g.l.k)) return { art: "+", t: T(0, 0, neg(g.l.k)) };
  if (!istNull(g.l[andere])) return { art: "+", t: { x: NULL, y: NULL, k: NULL, [andere]: neg(g.l[andere]) } as Term };
  if (istNull(g.l[v])) return null;
  return { art: ":", f: g.l[v] };
}

/** Variable freistellen mit allen Schritten (Seiten vorher tauschen, falls v nur rechts steht). */
export function stelleFrei(g: Gleichung, v: Var): { schritte: { g: Gleichung; op: Umformung | null }[]; ergebnis: Gleichung } | null {
  let a = g;
  if (istNull(a.l[v]) && !istNull(a.r[v])) a = { l: a.r, r: a.l };
  const schritte: { g: Gleichung; op: Umformung | null }[] = [{ g: a, op: null }];
  for (let i = 0; i < 8; i++) {
    const o = vorschlag(a, v);
    if (!o) break;
    a = forme(a, o);
    schritte.push({ g: a, op: o });
  }
  return istFreigestellt(a, v) ? { schritte, ergebnis: a } : null;
}

// ── Systeme ──────────────────────────────────────────────────────────

/** a·x + b·y = c */
export type Normal = { a: Q; b: Q; c: Q };
export const normal = (g: Gleichung): Normal => ({ a: minus(g.l.x, g.r.x), b: minus(g.l.y, g.r.y), c: minus(g.r.k, g.l.k) });
export const ausNormal = (n: Normal): Gleichung => ({ l: { x: n.a, y: n.b, k: NULL }, r: T(0, 0, n.c) });

export type Loesung = { art: "eine"; x: Q; y: Q } | { art: "keine" } | { art: "unendlich" };

export function loeseSystem(g1: Gleichung, g2: Gleichung): Loesung {
  const p = normal(g1), r = normal(g2);
  const det = minus(mal(p.a, r.b), mal(p.b, r.a));
  if (!istNull(det)) return { art: "eine", x: durch(minus(mal(p.c, r.b), mal(p.b, r.c)), det), y: durch(minus(mal(p.a, r.c), mal(p.c, r.a)), det) };
  // gleiche Richtung: Vielfache oder parallel?
  const gleich = istNull(minus(mal(p.a, r.c), mal(p.c, r.a))) && istNull(minus(mal(p.b, r.c), mal(p.c, r.b)));
  return gleich ? { art: "unendlich" } : { art: "keine" };
}

/** Faktoren für das Additionsverfahren: f1·I + f2·II lässt v herausfallen (kleinste ganze Zahlen). */
export function additionsFaktoren(g1: Gleichung, g2: Gleichung, v: Var): [number, number] | null {
  const a = normal(g1)[v === "x" ? "a" : "b"], b = normal(g2)[v === "x" ? "a" : "b"];
  if (istNull(a) || istNull(b)) return null;
  // a·f1 + b·f2 = 0 → f1 = b, f2 = −a (auf ganze Zahlen gebracht und gekürzt)
  const ga = a.z * b.n, gb = b.z * a.n;
  const t = ggtZ(ga, gb);
  let f1 = gb / t, f2 = -ga / t;
  if (f1 < 0) { f1 = -f1; f2 = -f2; }
  return [f1, f2];
}
const ggtZ = (a: number, b: number): number => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };

/** Zeile f1·I + f2·II (beide in Normalform) */
export function addiere(g1: Gleichung, f1: number, g2: Gleichung, f2: number): Normal {
  const p = normal(g1), r = normal(g2);
  return { a: plus(mal(p.a, q(f1)), mal(r.a, q(f2))), b: plus(mal(p.b, q(f1)), mal(r.b, q(f2))), c: plus(mal(p.c, q(f1)), mal(r.c, q(f2))) };
}
export const malNormal = (n: Normal, f: number): Normal => ({ a: mal(n.a, q(f)), b: mal(n.b, q(f)), c: mal(n.c, q(f)) });

/** Ersetzt v in g durch den Term `durchTerm` (ohne v); Ergebnis zusammengefasst. */
export function einsetzen(g: Gleichung, v: Var, durchTerm: Term): Gleichung {
  const ersetze = (t: Term): Term => tPlus({ ...t, [v]: NULL } as Term, tMal(durchTerm, t[v]));
  return { l: ersetze(g.l), r: ersetze(g.r) };
}

/** Die Gleichung mit eingesetzter Klammer als Text: »2x + 3·(3x − 1) = 7« */
export function einsetzText(g: Gleichung, v: Var, durchTerm: Term): string {
  const seite = (t: Term) => {
    const c = t[v];
    if (istNull(c)) return termText(t);
    const rest = { ...t, [v]: NULL } as Term;
    const betrag = { z: Math.abs(c.z), n: c.n };
    const klammer = `${qGleich(betrag, EINS) ? "" : qt(betrag) + "·"}(${termText(durchTerm)})`;
    if (termText(rest) === "0") return (c.z < 0 ? M : "") + klammer;
    return `${termText(rest)} ${c.z < 0 ? M : "+"} ${klammer}`;
  };
  return `${seite(g.l)} = ${seite(g.r)}`;
}

/** Wert eines Terms für x, y */
export const auswerten = (t: Term, x: Q, y: Q): Q => plus(plus(mal(t.x, x), mal(t.y, y)), t.k);
export const erfuellt = (g: Gleichung, x: Q, y: Q) => qGleich(auswerten(g.l, x, y), auswerten(g.r, x, y));

/** Gerade y = m·x + n (null bei senkrechter Gerade b = 0) */
export function gerade(g: Gleichung): { m: number; n: number } | { senkrecht: number } {
  const p = normal(g);
  if (istNull(p.b)) return { senkrecht: istNull(p.a) ? NaN : qWert(durch(p.c, p.a)) };
  return { m: -qWert(durch(p.a, p.b)), n: qWert(durch(p.c, p.b)) };
}

// ── Aufgaben ─────────────────────────────────────────────────────────

export type Zufall = () => number;
const zz = (r: Zufall, a: number, b: number) => a + Math.floor(r() * (b - a + 1));
const nichtNull = (r: Zufall, a: number, b: number) => { let v = 0; while (v === 0) v = zz(r, a, b); return v; };

/** System mit ganzzahliger Lösung. Stufe 1: ein Koeffizient 1 (Einsetzen bequem), 3: auch negative und größere. */
export function wuerfleSystem(r: Zufall = Math.random, stufe: 1 | 2 | 3 = 2): { g1: Gleichung; g2: Gleichung; x: number; y: number } {
  for (;;) {
    const x = zz(r, stufe === 1 ? 0 : -5, 6), y = zz(r, stufe === 1 ? 0 : -5, 6);
    const gr = stufe === 3 ? 7 : 4;
    const a1 = stufe === 1 ? zz(r, 1, 4) : nichtNull(r, -gr, gr), b1 = stufe === 1 ? 1 : nichtNull(r, -gr, gr);
    const a2 = stufe === 1 ? 1 : nichtNull(r, -gr, gr), b2 = stufe === 1 ? nichtNull(r, -3, 4) : nichtNull(r, -gr, gr);
    if (a1 * b2 - a2 * b1 === 0) continue;
    const g1 = ausNormal({ a: q(a1), b: q(b1), c: q(a1 * x + b1 * y) });
    const g2 = ausNormal({ a: q(a2), b: q(b2), c: q(a2 * x + b2 * y) });
    return { g1, g2, x, y };
  }
}

/**
 * Sachaufgaben mit echten Preisen (Stand 2025/26, gerundet). Die Unbekannten
 * sind zwei Preise bzw. Mengen; die Aufgabe nennt zwei Einkäufe.
 */
export type Sachkontext = { id: string; titel: string; x: string; y: string; einheit: string; preisX: number; preisY: number; satz: (a: number, b: number, summe: string) => string; quelle: string };
export const SACHKONTEXTE: Sachkontext[] = [
  { id: "kino", titel: "Kino", x: "Erwachsenenkarte", y: "Kinderkarte", einheit: "€", preisX: 11.5, preisY: 8,
    satz: (a, b, s) => `${a} Erwachsene und ${b} Kinder zahlen zusammen ${s}.`, quelle: "Kinopreise in Thüringer Multiplexkinos 2025: Erwachsene 10–12 €, Kinder 7–8 €" },
  { id: "freibad", titel: "Freibad", x: "Tageskarte Erwachsene", y: "ermäßigte Tageskarte", einheit: "€", preisX: 4.5, preisY: 2.5,
    satz: (a, b, s) => `${a} Erwachsene und ${b} Schüler zahlen ${s} Eintritt.`, quelle: "Erfurter Freibäder 2025: 4,50 € bzw. 2,50 € ermäßigt" },
  { id: "baecker", titel: "Bäckerei", x: "Brötchen", y: "Brezel", einheit: "€", preisX: 0.45, preisY: 1.1,
    satz: (a, b, s) => `${a} Brötchen und ${b} Brezeln kosten ${s}.`, quelle: "Bäckereipreise 2025: Brötchen 0,40–0,55 €, Brezel 0,95–1,30 €" },
  { id: "doener", titel: "Imbiss", x: "Döner", y: "Ayran", einheit: "€", preisX: 7.5, preisY: 2,
    satz: (a, b, s) => `Für ${a} Döner und ${b} Ayran bezahlt die Gruppe ${s}.`, quelle: "Dönerpreise 2025 in Thüringen meist 7–8 €" },
  { id: "bus", titel: "Nahverkehr", x: "Einzelfahrschein", y: "Kinderfahrschein", einheit: "€", preisX: 2.9, preisY: 1.6,
    satz: (a, b, s) => `${a} Einzelfahrscheine und ${b} Kinderfahrscheine kosten ${s}.`, quelle: "EVAG Erfurt 2025: Einzelfahrt Tarifzone 2,90 €, Kind 1,60 € (gerundet)" },
];

const euro = (v: number) => v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

export function sachaufgabe(r: Zufall = Math.random) {
  const k = SACHKONTEXTE[Math.floor(r() * SACHKONTEXTE.length)];
  for (;;) {
    const a1 = zz(r, 1, 5), b1 = zz(r, 1, 5), a2 = zz(r, 1, 5), b2 = zz(r, 1, 5);
    if (a1 * b2 - a2 * b1 === 0) continue;
    const s1 = Math.round((a1 * k.preisX + b1 * k.preisY) * 100) / 100, s2 = Math.round((a2 * k.preisX + b2 * k.preisY) * 100) / 100;
    // In Cent rechnen, damit die Brüche ganzzahlig bleiben
    const g1 = ausNormal({ a: q(a1), b: q(b1), c: q(Math.round(s1 * 100), 100) });
    const g2 = ausNormal({ a: q(a2), b: q(b2), c: q(Math.round(s2 * 100), 100) });
    return { kontext: k, text: [k.satz(a1, b1, euro(s1)), k.satz(a2, b2, euro(s2))], g1, g2, x: k.preisX, y: k.preisY };
  }
}

/**
 * Tarifvergleich (Grundbetrag + Preis je Einheit) — Werte Stand 2025/26,
 * gerundet aus typischen Angeboten. Schnittpunkt = ab wann lohnt sich B?
 */
export type Tarif = { name: string; grund: number; jeEinheit: number };
export type Tarifvergleich = { id: string; titel: string; einheit: string; menge: string; frage: string; a: Tarif; b: Tarif; bereich: [number, number]; quelle: string };
export const TARIFE: Tarifvergleich[] = [
  { id: "handy", titel: "Handytarif", einheit: "GB", menge: "Datenvolumen im Monat", frage: "Wie viele GB im Monat?",
    a: { name: "Flex (pro GB)", grund: 3.99, jeEinheit: 1.5 }, b: { name: "Basic", grund: 7.99, jeEinheit: 0.5 }, bereich: [0, 12],
    quelle: "Prepaid-Tarife 2025: Grundpreise 4–10 €/Monat, Nachbuchen 0,50–2 € je GB" },
  { id: "strom", titel: "Stromtarif", einheit: "kWh", menge: "Verbrauch im Jahr", frage: "Wie viele kWh im Jahr?",
    a: { name: "Grundversorgung", grund: 165, jeEinheit: 0.38 }, b: { name: "Ökostrom-Sondertarif", grund: 215, jeEinheit: 0.3 }, bereich: [0, 3000],
    quelle: "Strompreise 2025: Grundversorgung um 38 ct/kWh, Sondertarife 28–32 ct/kWh, Grundpreis 10–18 €/Monat" },
  { id: "scooter", titel: "E-Scooter", einheit: "min", menge: "Fahrzeit", frage: "Wie viele Minuten?",
    a: { name: "Anbieter Blitz", grund: 1, jeEinheit: 0.25 }, b: { name: "Anbieter Wiesel", grund: 0, jeEinheit: 0.32 }, bereich: [0, 30],
    quelle: "E-Scooter 2025: Entsperren 0–1 €, 0,19–0,35 € je Minute" },
  { id: "fitness", titel: "Fitnessstudio", einheit: "Monate", menge: "Mitgliedsdauer", frage: "Wie viele Monate?",
    a: { name: "Studio ohne Startgebühr", grund: 0, jeEinheit: 29.9 }, b: { name: "Studio mit Startgebühr", grund: 49, jeEinheit: 22.9 }, bereich: [0, 12],
    quelle: "Fitnessketten 2025: 20–35 €/Monat, Startpaket 0–50 €" },
  { id: "taxi", titel: "Taxi oder Fahrdienst", einheit: "km", menge: "Fahrstrecke", frage: "Wie viele Kilometer?",
    a: { name: "Taxi", grund: 4.5, jeEinheit: 2.3 }, b: { name: "Fahrdienst", grund: 9, jeEinheit: 1.6 }, bereich: [0, 15],
    quelle: "Taxitarife Thüringen 2025: Grundpreis um 4,50 €, 2,20–2,50 € je km" },
];

export const kosten = (t: Tarif, menge: number) => t.grund + t.jeEinheit * menge;
/** Gleich teuer bei … (null, wenn parallel) */
export function gleichstand(v: Tarifvergleich): number | null {
  const d = v.a.jeEinheit - v.b.jeEinheit;
  return d === 0 ? null : (v.b.grund - v.a.grund) / d;
}
