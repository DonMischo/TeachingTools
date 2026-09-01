/**
 * Lineare Gleichungen als Waagen-Modell.
 *
 * Eine Seite der Gleichung ist eine Liste von Termen: x-Terme, Zahlen und
 * Gruppen (Klammern). Eine Gruppe `k·(x·x + c)` bleibt als eigener Term
 * erhalten, bis sie ausmultipliziert wird — nur so kann die Waage die Klammer
 * auch als Gruppe zeichnen.
 *
 * Reine Logik ohne React; die Seite /simulationen/gleichungswaage zeichnet damit.
 */

import { fromLatex, numToLatex } from "./latex";

export type XTerm = { t: "x"; n: number };
export type NTerm = { t: "n"; n: number };
export type GTerm = { t: "g"; k: number; x: number; c: number };
export type Term = XTerm | NTerm | GTerm;

export type Side = Term[];
export type Equation = { left: Side; right: Side };

/** Eine Äquivalenzumformung — wird immer auf beide Seiten angewendet. */
export type Op =
  | { op: "add"; kind: "x" | "n"; n: number } // n < 0 ⇒ Subtraktion
  | { op: "mul"; n: number }
  | { op: "div"; n: number }
  | { op: "expand" }; // Klammern auflösen

export const MINUS = "−"; // typografisches Minus

/** Rundet Float-Rauschen weg (0.30000000000000004 → 0.3). */
export function clean(n: number): number {
  const r = Math.round(n * 1e6) / 1e6;
  return Object.is(r, -0) ? 0 : r;
}

// ── Koeffizienten ─────────────────────────────────────────────────────────────

/** Koeffizienten der ganzen Seite, Klammern eingerechnet. */
export function coeffs(side: Side): { x: number; c: number } {
  let x = 0;
  let c = 0;
  for (const t of side) {
    if (t.t === "x") x += t.n;
    else if (t.t === "n") c += t.n;
    else {
      x += t.k * t.x;
      c += t.k * t.c;
    }
  }
  return { x: clean(x), c: clean(c) };
}

/** Koeffizienten außerhalb der Klammern — das, was ohne Ausmultiplizieren zählt. */
export function outerCoeffs(side: Side): { x: number; c: number } {
  let x = 0;
  let c = 0;
  for (const t of side) {
    if (t.t === "x") x += t.n;
    else if (t.t === "n") c += t.n;
  }
  return { x: clean(x), c: clean(c) };
}

export const hasGroup = (side: Side): boolean => side.some(t => t.t === "g");
export const hasGroups = (eq: Equation): boolean => hasGroup(eq.left) || hasGroup(eq.right);

// ── Umformen ──────────────────────────────────────────────────────────────────

/** Fasst gleichartige Terme zusammen; Klammern bleiben stehen und kommen zuerst. */
export function simplify(side: Side): Side {
  const out: Side = [];
  for (const t of side) {
    if (t.t !== "g") continue;
    const k = clean(t.k);
    const x = clean(t.x);
    const c = clean(t.c);
    if (k === 0 || (x === 0 && c === 0)) continue;
    out.push({ t: "g", k, x, c });
  }
  const o = outerCoeffs(side);
  if (o.x !== 0) out.push({ t: "x", n: o.x });
  if (o.c !== 0) out.push({ t: "n", n: o.c });
  return out.length ? out : [{ t: "n", n: 0 }];
}

/** Klammern ausmultiplizieren. */
export function expandSide(side: Side): Side {
  const { x, c } = coeffs(side);
  const out: Side = [];
  if (x !== 0) out.push({ t: "x", n: x });
  if (c !== 0) out.push({ t: "n", n: c });
  return out.length ? out : [{ t: "n", n: 0 }];
}

function scaleSide(side: Side, f: number): Side {
  return simplify(
    side.map<Term>(t =>
      t.t === "g"
        ? { t: "g", k: clean(t.k * f), x: t.x, c: t.c }
        : t.t === "x"
          ? { t: "x", n: clean(t.n * f) }
          : { t: "n", n: clean(t.n * f) },
    ),
  );
}

export function applyOp(eq: Equation, op: Op): Equation {
  switch (op.op) {
    case "add": {
      const term: Term = op.kind === "x" ? { t: "x", n: op.n } : { t: "n", n: op.n };
      return { left: simplify([...eq.left, term]), right: simplify([...eq.right, term]) };
    }
    case "mul":
      return { left: scaleSide(eq.left, op.n), right: scaleSide(eq.right, op.n) };
    case "div":
      return { left: scaleSide(eq.left, 1 / op.n), right: scaleSide(eq.right, 1 / op.n) };
    case "expand":
      return { left: expandSide(eq.left), right: expandSide(eq.right) };
  }
}

// ── Lösen ─────────────────────────────────────────────────────────────────────

export type Solution = { kind: "one"; x: number } | { kind: "none" } | { kind: "all" };

export function solve(eq: Equation): Solution {
  const l = coeffs(eq.left);
  const r = coeffs(eq.right);
  const a = clean(l.x - r.x);
  const b = clean(r.c - l.c);
  if (a === 0) return b === 0 ? { kind: "all" } : { kind: "none" };
  return { kind: "one", x: clean(b / a) };
}

/** Ist die Gleichung fertig umgeformt (x = Zahl)? Dann der Wert, sonst null. */
export function isSolved(eq: Equation): number | null {
  const check = (a: Side, b: Side): number | null => {
    const [ta] = a;
    const [tb] = b;
    if (a.length !== 1 || b.length !== 1) return null;
    if (ta.t !== "x" || ta.n !== 1 || tb.t !== "n") return null;
    return tb.n;
  };
  const l = check(eq.left, eq.right);
  return l !== null ? l : check(eq.right, eq.left);
}

/** Gewicht einer Seite für ein gegebenes x — das ist die Schalenlast. */
export function evalSide(side: Side, x: number): number {
  const c = coeffs(side);
  return clean(c.x * x + c.c);
}

// ── Formatieren ───────────────────────────────────────────────────────────────

export function fmtNum(n: number): string {
  const v = clean(n);
  const s = Number.isInteger(v) ? String(v) : v.toLocaleString("de-DE", { maximumFractionDigits: 3 });
  return s.replace("-", MINUS);
}

/**
 * Zerlegt eine Zahl in einen einfachen Bruch, sonst null.
 *
 * Nur kleine Nenner — genau die, bei denen ein Bruch besser liest als eine
 * Dezimalzahl: ½ statt 0,5. Bei 0,333… käme kein sauberer Bruch heraus, also
 * bleibt es dort bei der Dezimalzahl.
 */
export function asFraction(n: number): { num: number; den: number } | null {
  const v = Math.abs(n);
  if (!Number.isFinite(v) || v === 0 || Number.isInteger(clean(v))) return null;
  // Nicht vorher runden: clean() macht aus ⅓ die 0,333333, und die ist durch
  // kein kleines Nenner-Vielfaches mehr ganz.
  for (const den of [2, 3, 4, 5, 6, 8, 10]) {
    const raw = v * den;
    const num = Math.round(raw);
    // Toleranz mal Nenner: clean() rundet auf sechs Stellen, ein Drittel kommt
    // also als 0,333333 an — mal 3 fehlt dann schon 1e-6.
    if (num > 0 && Math.abs(raw - num) < den * 1e-6) {
      // Schon gekürzt? 2/4 soll als ½ erscheinen.
      const g = (a: number, b: number): number => (b ? g(b, a % b) : a);
      const d = g(num, den);
      return { num: num / d, den: den / d };
    }
  }
  return null;
}

/** Bruchschreibweise, wo ein Bruch gemeint ist — sonst wie fmtNum. */
export function fmtFrac(n: number): string {
  const f = asFraction(n);
  if (!f) return fmtNum(n);
  const sign = clean(n) < 0 ? MINUS : "";
  return `${sign}${f.num}/${f.den}`;
}

function body(t: Term): string {
  if (t.t === "x") {
    const a = Math.abs(t.n);
    // Der Faktor vor dem x ist die Stelle, an der ein Bruch als Bruch gehört:
    // »½x«, nicht »0,5x«. Ergebnisse und Messwerte bleiben Dezimalzahlen.
    return a === 1 ? "x" : `${fmtFrac(a)}x`;
  }
  if (t.t === "n") return fmtNum(Math.abs(t.n));
  const k = Math.abs(t.k);
  const inner: Side = [];
  if (clean(t.x) !== 0) inner.push({ t: "x", n: t.x });
  if (clean(t.c) !== 0) inner.push({ t: "n", n: t.c });
  const innerStr = inner.length ? formatSide(inner) : "0";
  return `${k === 1 ? "" : `${fmtNum(k)}·`}(${innerStr})`;
}

const isNeg = (t: Term): boolean => (t.t === "g" ? t.k < 0 : t.n < 0);

export function formatSide(side: Side): string {
  if (!side.length) return "0";
  return side
    .map((t, i) =>
      i === 0
        ? (isNeg(t) ? MINUS + body(t) : body(t))
        : ` ${isNeg(t) ? MINUS : "+"} ${body(t)}`,
    )
    .join("");
}

export function formatEquation(eq: Equation): string {
  return `${formatSide(eq.left)} = ${formatSide(eq.right)}`;
}

// ── LaTeX ─────────────────────────────────────────────────────────────────────

function bodyLatex(t: Term): string {
  if (t.t === "x") {
    const a = Math.abs(t.n);
    if (a === 1) return "x";
    const f = asFraction(a);
    return f ? `\\frac{${f.num}}{${f.den}}x` : `${numToLatex(fmtNum(a))}x`;
  }
  if (t.t === "n") return numToLatex(fmtNum(Math.abs(t.n)));
  const k = Math.abs(t.k);
  const inner: Side = [];
  if (clean(t.x) !== 0) inner.push({ t: "x", n: t.x });
  if (clean(t.c) !== 0) inner.push({ t: "n", n: t.c });
  const innerTex = inner.length ? sideToLatex(inner) : "0";
  return `${k === 1 ? "" : `${numToLatex(fmtNum(k))} \\cdot `}\\left( ${innerTex} \\right)`;
}

export function sideToLatex(side: Side): string {
  if (!side.length) return "0";
  return side
    .map((t, i) => (i === 0 ? (isNeg(t) ? `-${bodyLatex(t)}` : bodyLatex(t)) : ` ${isNeg(t) ? "-" : "+"} ${bodyLatex(t)}`))
    .join("");
}

export const equationToLatex = (eq: Equation): string =>
  `${sideToLatex(eq.left)} = ${sideToLatex(eq.right)}`;

/** Die Notation hinter dem Strich, z. B. "− 4" oder ": 2". */
export function formatOp(op: Op): string {
  switch (op.op) {
    case "add": {
      const a = Math.abs(op.n);
      const b = op.kind === "x" ? (a === 1 ? "x" : `${fmtFrac(a)}x`) : fmtNum(a);
      return `${op.n < 0 ? MINUS : "+"} ${b}`;
    }
    case "mul":
      return `· ${fmtNum(op.n)}`;
    case "div":
      return `: ${fmtNum(op.n)}`;
    case "expand":
      return "Klammern auflösen";
  }
}

// ── Vorschläge ────────────────────────────────────────────────────────────────

/** Alle sinnvollen nächsten Schritte — nicht nur der richtige. */
export function suggestions(eq: Equation): Op[] {
  const out: Op[] = [];
  const push = (o: Op) => {
    if (!out.some(p => formatOp(p) === formatOp(o))) out.push(o);
  };

  if (hasGroups(eq)) push({ op: "expand" });

  // Eine Seite ist genau eine Klammer ⇒ man darf auch durch den Faktor teilen.
  for (const side of [eq.left, eq.right]) {
    const only = side.length === 1 ? side[0] : null;
    if (only && only.t === "g" && Math.abs(only.k) !== 1) push({ op: "div", n: only.k });
  }

  const l = outerCoeffs(eq.left);
  const r = outerCoeffs(eq.right);
  for (const s of [l, r]) {
    if (s.c !== 0) push({ op: "add", kind: "n", n: -s.c });
    if (s.x !== 0) push({ op: "add", kind: "x", n: -s.x });
  }

  if (!hasGroups(eq)) {
    const pureX = (s: { x: number; c: number }) => s.x !== 0 && s.c === 0;
    const pureC = (s: { x: number; c: number }) => s.x === 0;
    if (pureX(l) && pureC(r) && Math.abs(l.x) !== 1) push({ op: "div", n: l.x });
    if (pureX(r) && pureC(l) && Math.abs(r.x) !== 1) push({ op: "div", n: r.x });
  }

  return out.slice(0, 6);
}

// ── Eingabe lesen ─────────────────────────────────────────────────────────────

class ParseError extends Error {}

type Tok =
  | { k: "num"; v: number }
  | { k: "x" }
  | { k: "op"; v: "+" | "-" | "*" | "/" }
  | { k: "(" }
  | { k: ")" }
  | { k: "=" };

function tokenize(src: string): Tok[] {
  const s = src.replace(/\s+/g, "");
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.,]/.test(s[j])) j++;
      const raw = s.slice(i, j).replace(",", ".");
      const v = Number(raw);
      if (!isFinite(v)) throw new ParseError(`»${s.slice(i, j)}« ist keine Zahl.`);
      toks.push({ k: "num", v });
      i = j;
      continue;
    }
    i++;
    if (ch === "x" || ch === "X") toks.push({ k: "x" });
    else if (ch === "+") toks.push({ k: "op", v: "+" });
    else if (ch === "-" || ch === MINUS || ch === "–") toks.push({ k: "op", v: "-" });
    else if (ch === "*" || ch === "·" || ch === "×") toks.push({ k: "op", v: "*" });
    else if (ch === "/" || ch === ":") toks.push({ k: "op", v: "/" });
    else if (ch === "(" || ch === "[") toks.push({ k: "(" });
    else if (ch === ")" || ch === "]") toks.push({ k: ")" });
    else if (ch === "=") toks.push({ k: "=" });
    else throw new ParseError(`Unerwartetes Zeichen: »${ch}«`);
  }
  return toks;
}

function parseSide(toks: Tok[]): Side {
  let i = 0;
  const peek = (): Tok | undefined => toks[i];

  /** Ein nachgestelltes „·2" oder „:2" auf den eben gelesenen Faktor. */
  const trailing = (): number => {
    let f = 1;
    for (;;) {
      const t = peek();
      if (!t || t.k !== "op" || (t.v !== "*" && t.v !== "/")) return f;
      const next = toks[i + 1];
      if (!next || next.k !== "num") return f;
      f = t.v === "*" ? f * next.v : f / next.v;
      i += 2;
    }
  };

  const term = (sign: number): Term => {
    let coef = sign;
    let hadNum = false;
    const t0 = peek();
    if (t0 && t0.k === "num") {
      coef = sign * t0.v;
      hadNum = true;
      i++;
      const star = peek();
      if (star && star.k === "op" && star.v === "*") i++;
    }
    const t1 = peek();
    if (t1 && t1.k === "(") {
      i++;
      const inner = expr();
      const close = peek();
      if (!close || close.k !== ")") throw new ParseError("Eine Klammer wurde nicht geschlossen.");
      i++;
      const c = coeffs(inner);
      return { t: "g", k: clean(coef * trailing()), x: c.x, c: c.c };
    }
    if (t1 && t1.k === "x") {
      i++;
      return { t: "x", n: clean(coef * trailing()) };
    }
    if (hadNum) return { t: "n", n: clean(coef * trailing()) };
    throw new ParseError("Da fehlt eine Zahl oder ein x.");
  };

  const expr = (): Side => {
    const terms: Side = [];
    let sign = 1;
    const first = peek();
    if (first && first.k === "op" && (first.v === "+" || first.v === "-")) {
      sign = first.v === "-" ? -1 : 1;
      i++;
    }
    terms.push(term(sign));
    for (;;) {
      const t = peek();
      if (!t || t.k !== "op" || (t.v !== "+" && t.v !== "-")) break;
      i++;
      terms.push(term(t.v === "-" ? -1 : 1));
    }
    return terms;
  };

  if (!toks.length) throw new ParseError("Eine Seite der Gleichung ist leer.");
  const side = expr();
  if (i < toks.length) throw new ParseError("Das Ende der Gleichung konnte ich nicht lesen.");
  return side;
}

export function parseEquation(input: string): { ok: true; eq: Equation } | { ok: false; error: string } {
  try {
    const toks = tokenize(fromLatex(input));
    const at = toks.findIndex(t => t.k === "=");
    if (at < 0) return { ok: false, error: "Es fehlt ein »=«." };
    if (toks.slice(at + 1).some(t => t.k === "=")) return { ok: false, error: "Nur ein »=« ist erlaubt." };
    const eq: Equation = {
      left: simplify(parseSide(toks.slice(0, at))),
      right: simplify(parseSide(toks.slice(at + 1))),
    };
    if (coeffs(eq.left).x === 0 && coeffs(eq.right).x === 0)
      return { ok: false, error: "In der Gleichung kommt kein x vor." };
    return { ok: true, eq };
  } catch (e) {
    return { ok: false, error: e instanceof ParseError ? e.message : "Das konnte ich nicht lesen." };
  }
}

// ── Aufgaben ──────────────────────────────────────────────────────────────────

export const LEVELS = [
  { level: 1, label: "x + 4 = 9", hint: "eine Zahl wegnehmen" },
  { level: 2, label: "3x + 4 = 19", hint: "Zahl und Faktor" },
  { level: 3, label: "3x + 4 = x + 10", hint: "x auf beiden Seiten" },
  { level: 4, label: "2·(x + 3) = 14", hint: "mit Klammer" },
  { level: 5, label: "12 − 2x = 4", hint: "Minus üben" },
  { level: 6, label: "½x + 3 = 7", hint: "Bruch vor dem x" },
  { level: 7, label: "4x = 10", hint: "Ergebnis ist ein Bruch" },
] as const;

const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

/**
 * Bleibt die Waage lesbar? Zu große Zahlen ergeben zu viele Klötzchen.
 *
 * `fractionalX` erlaubt ein gebrochenes Ergebnis (4x = 10 → x = 2,5). Sonst
 * bleibt es bei ganzen Lösungen: die Klötzchen sollen aufgehen.
 */
function readable(eq: Equation, fractionalX = false): boolean {
  const mag = (side: Side) =>
    Math.max(
      ...side.map(t =>
        t.t === "g" ? Math.max(Math.abs(t.k * t.x), Math.abs(t.k * t.c), Math.abs(t.k)) : Math.abs(t.n),
      ),
    );
  const sol = solve(eq);
  if (sol.kind !== "one" || isSolved(eq) !== null) return false;
  if (sol.x < 1 || mag(eq.left) > 20 || mag(eq.right) > 20) return false;
  if (fractionalX) {
    // Halbe und Viertel sind noch ablesbar, Drittel als Dezimalzahl nicht.
    const q = clean(sol.x * 4);
    return !Number.isInteger(sol.x) && Number.isInteger(q);
  }
  return Number.isInteger(sol.x);
}

export function generateTask(level: number): Equation {
  for (let tries = 0; tries < 80; tries++) {
    let eq: Equation;
    let fractionalX = false;
    // Minus soll nicht die Ausnahme sein: in den ersten Stufen ueberwiegt es,
    // damit auch das Wegnehmen geuebt wird und nicht nur das Ergaenzen.
    const sign = () => pick([1, -1, -1]);
    if (level <= 1) {
      const s = ri(1, 12);
      const b = ri(1, 10) * sign();
      eq = { left: simplify([{ t: "x", n: 1 }, { t: "n", n: b }]), right: [{ t: "n", n: s + b }] };
    } else if (level === 2) {
      const s = ri(1, 8);
      const a = ri(2, 5);
      const b = ri(1, 10) * sign();
      eq = { left: simplify([{ t: "x", n: a }, { t: "n", n: b }]), right: [{ t: "n", n: a * s + b }] };
    } else if (level === 5) {
      // Minus vor dem x: »12 − 2x = 4«. Dazu die Umkehrung »4 = 12 − 2x«,
      // damit das x auch mal rechts steht.
      const s = ri(1, 6);
      const a = ri(1, 4);
      const b = a * s + ri(1, 10);
      const lhs: Side = simplify([{ t: "n", n: b }, { t: "x", n: -a }]);
      const rhs: Side = [{ t: "n", n: b - a * s }];
      eq = Math.random() < 0.5 ? { left: lhs, right: rhs } : { left: rhs, right: lhs };
    } else if (level === 6) {
      // Bruch vor dem x, Ergebnis ganz: »x/2 + 3 = 7«.
      const den = pick([2, 3, 4]);
      const k = ri(1, 5);                // Lösung x = k · den, damit x/den aufgeht
      // Echter, gekürzter Bruch: 2/2 wäre eine 1 und damit gar kein Bruch mehr.
      const num = pick(den === 2 ? [1] : den === 3 ? [1, 1, 2] : [1, 1, 3]);
      const b = ri(1, 9) * sign();
      // Der Faktor bleibt ungerundet (⅓ ist keine 0,333333), die rechte Seite
      // wird ganzzahlig gerechnet: (num/den) · (k·den) = num · k.
      const left = simplify([{ t: "x", n: num / den }, { t: "n", n: b }]);
      eq = { left, right: [{ t: "n", n: num * k + b }] };
    } else if (level === 7) {
      // Ergebnis ist ein Bruch: »4x = 10« → x = 2,5.
      fractionalX = true;
      const a = pick([2, 4]);
      const half = ri(1, 5) * 2 + 1;     // ungerade ⇒ geteilt durch 2 bleibt ein Rest
      const b = ri(0, 8) * sign();
      eq = { left: simplify([{ t: "x", n: a }, { t: "n", n: b }]), right: [{ t: "n", n: clean((a * half) / 2 + b) }] };
    } else if (level === 3) {
      const s = ri(1, 8);
      const a = ri(2, 6);
      const c = ri(1, a - 1);
      const b = ri(0, 9);
      eq = {
        left: simplify([{ t: "x", n: a }, { t: "n", n: b }]),
        right: simplify([{ t: "x", n: c }, { t: "n", n: a * s + b - c * s }]),
      };
    } else {
      const k = ri(2, 3);
      const b = pick([1, 2, 3, 4, -1, -2, -3]);
      const s = ri(1, 6);
      const inner = s + b; // Wert einer Klammer
      if (inner < 1 || inner > 6) continue;
      const group: GTerm = { t: "g", k, x: 1, c: b };
      if (Math.random() < 0.5) {
        eq = { left: [group], right: [{ t: "n", n: k * inner }] };
      } else {
        const c = ri(1, k - 1);
        eq = { left: [group], right: simplify([{ t: "x", n: c }, { t: "n", n: k * inner - c * s }]) };
      }
    }
    if (readable(eq, fractionalX)) return eq;
  }
  return {
    left: simplify([{ t: "x", n: 3 }, { t: "n", n: 4 }]),
    right: simplify([{ t: "x", n: 1 }, { t: "n", n: 10 }]),
  };
}
