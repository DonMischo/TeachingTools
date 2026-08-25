/**
 * Formeln mit beliebigen Variablen — der Variablenmodus der Gleichungswaage.
 *
 * Anders als @/lib/gleichung (linear in einem x, mit Klammer-Kisten) rechnet
 * dieses Modul mit Monomen: `c · a^i · b^j …`, Exponenten dürfen negativ sein.
 * Damit sind physikalische Formeln abgedeckt — F = m·a, p = F/A, E = ½·m·v².
 * Klammern werden schon beim Lesen ausmultipliziert; die Klammerregel bleibt
 * die Show des Zahlenmodus.
 */
import { clean, fmtNum, MINUS } from "./gleichung";
import { fromLatex, numToLatex } from "./latex";

/** `c · Π var^exp` — Exponent 0 kommt in `v` nicht vor. */
export type Mono = { c: number; v: Record<string, number> };
export type Expr = Mono[];
export type Feq = { left: Expr; right: Expr };

export type FOp =
  | { op: "add"; m: Mono } // m.c < 0 ⇒ abziehen
  | { op: "mul"; m: Mono }
  | { op: "div"; m: Mono };

export const ONE: Mono = { c: 1, v: {} };

export const num = (c: number): Mono => ({ c, v: {} });
export const varMono = (name: string, exp = 1, c = 1): Mono => ({ c, v: { [name]: exp } });

// ── Rechnen ───────────────────────────────────────────────────────────────────

export function monoKey(m: Mono): string {
  const keys = Object.keys(m.v).sort();
  return keys.length ? keys.map(k => `${k}^${m.v[k]}`).join("·") : "1";
}

export const degree = (m: Mono): number => Object.values(m.v).reduce((s, e) => s + e, 0);

export function mulMono(a: Mono, b: Mono): Mono {
  const v: Record<string, number> = { ...a.v };
  for (const [k, e] of Object.entries(b.v)) {
    const n = (v[k] ?? 0) + e;
    if (n === 0) delete v[k];
    else v[k] = n;
  }
  return { c: clean(a.c * b.c), v };
}

export function invMono(m: Mono): Mono {
  const v: Record<string, number> = {};
  for (const [k, e] of Object.entries(m.v)) v[k] = -e;
  return { c: clean(1 / m.c), v };
}

export const negMono = (m: Mono): Mono => ({ c: clean(-m.c), v: { ...m.v } });

/** Gleichartige Monome zusammenfassen, Nullen raus, feste Reihenfolge. */
export function simplifyExpr(e: Expr): Expr {
  const map = new Map<string, Mono>();
  for (const m of e) {
    const k = monoKey(m);
    const cur = map.get(k);
    if (cur) cur.c = clean(cur.c + m.c);
    else map.set(k, { c: clean(m.c), v: { ...m.v } });
  }
  const out = [...map.values()].filter(m => m.c !== 0);
  out.sort((a, b) => degree(b) - degree(a) || monoKey(a).localeCompare(monoKey(b)));
  return out.length ? out : [num(0)];
}

export function mulExpr(a: Expr, b: Expr): Expr {
  const out: Expr = [];
  for (const x of a) for (const y of b) out.push(mulMono(x, y));
  return simplifyExpr(out);
}

export const negExpr = (e: Expr): Expr => e.map(negMono);

export function applyFOp(eq: Feq, op: FOp): Feq {
  switch (op.op) {
    case "add":
      return { left: simplifyExpr([...eq.left, op.m]), right: simplifyExpr([...eq.right, op.m]) };
    case "mul":
      return { left: mulExpr(eq.left, [op.m]), right: mulExpr(eq.right, [op.m]) };
    case "div": {
      const inv = invMono(op.m);
      return { left: mulExpr(eq.left, [inv]), right: mulExpr(eq.right, [inv]) };
    }
  }
}

// ── Variablen und Werte ───────────────────────────────────────────────────────

/** Alle Variablen in der Reihenfolge ihres ersten Auftretens. */
export function varsOf(eq: Feq): string[] {
  const seen: string[] = [];
  for (const m of [...eq.left, ...eq.right])
    for (const k of Object.keys(m.v)) if (!seen.includes(k)) seen.push(k);
  return seen;
}

export const hasVar = (m: Mono, name: string): boolean => (m.v[name] ?? 0) !== 0;

export type Values = Record<string, number | null>;

/** Wert eines Monoms; null, sobald eine Variable keinen Wert hat. */
export function evalMono(m: Mono, values: Values): number | null {
  let r = m.c;
  for (const [k, e] of Object.entries(m.v)) {
    const val = values[k];
    if (val === null || val === undefined) return null;
    if (val === 0 && e < 0) return null;
    r *= Math.pow(val, e);
  }
  return clean(r);
}

export function evalExpr(e: Expr, values: Values): number | null {
  let s = 0;
  for (const m of e) {
    const v = evalMono(m, values);
    if (v === null) return null;
    s += v;
  }
  return clean(s);
}

/**
 * Wert der gesuchten Größe aus den übrigen Werten. Löst `A·t^e + B = 0` —
 * das deckt die Schulformeln ab. Kommt t mit mehreren Exponenten vor,
 * gibt es null zurück statt zu raten.
 */
export function solveFor(eq: Feq, target: string, values: Values): number | null {
  const diff = simplifyExpr([...eq.left, ...negExpr(eq.right)]);
  const byExp = new Map<number, number>();
  for (const m of diff) {
    const e = m.v[target] ?? 0;
    const rest: Mono = { c: m.c, v: { ...m.v } };
    delete rest.v[target];
    const val = evalMono(rest, values);
    if (val === null) return null;
    byExp.set(e, clean((byExp.get(e) ?? 0) + val));
  }
  const exps = [...byExp.entries()].filter(([, a]) => a !== 0);
  const powers = exps.filter(([e]) => e !== 0);
  if (powers.length !== 1) return null;
  const [e, a] = powers[0];
  const b = byExp.get(0) ?? 0;
  const rhs = clean(-b / a);
  if (e === 1) return rhs;
  if (rhs < 0 && Math.abs(e) % 2 === 0) return null; // keine reelle Lösung
  const root = Math.sign(rhs) * Math.pow(Math.abs(rhs), 1 / e);
  return clean(root);
}

/** Steht die gesuchte Größe allein auf einer Seite? */
export function isolated(eq: Feq, target: string): boolean {
  const alone = (e: Expr) => e.length === 1 && e[0].c === 1 && monoKey(e[0]) === `${target}^1`;
  const free = (e: Expr) => !e.some(m => hasVar(m, target));
  return (alone(eq.left) && free(eq.right)) || (alone(eq.right) && free(eq.left));
}

// ── Formatieren ───────────────────────────────────────────────────────────────

const SUP: Record<string, string> = { "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };

const withExp = (name: string, e: number): string =>
  e === 1 ? name : `${name}${String(e).split("").map(d => SUP[d] ?? `^${d}`).join("")}`;

/** Der Betrag eines Monoms, Brüche als Zähler/Nenner. */
export function monoBody(m: Mono): string {
  const a = Math.abs(m.c);
  const up = Object.entries(m.v).filter(([, e]) => e > 0);
  const down = Object.entries(m.v).filter(([, e]) => e < 0);
  const upStr = up.map(([k, e]) => withExp(k, e)).join("·");
  const numPart = a === 1 && upStr ? upStr : upStr ? `${fmtNum(a)}·${upStr}` : fmtNum(a);
  if (!down.length) return numPart;
  const downStr = down.map(([k, e]) => withExp(k, -e)).join("·");
  return `${numPart}/${down.length > 1 ? `(${downStr})` : downStr}`;
}

export function formatExpr(e: Expr): string {
  if (!e.length) return "0";
  return e
    .map((m, i) => (i === 0 ? (m.c < 0 ? MINUS + monoBody(m) : monoBody(m)) : ` ${m.c < 0 ? MINUS : "+"} ${monoBody(m)}`))
    .join("");
}

export const formatFeq = (eq: Feq): string => `${formatExpr(eq.left)} = ${formatExpr(eq.right)}`;

// ── LaTeX ─────────────────────────────────────────────────────────────────────

const varLatex = (name: string, exp: number): string => {
  // v0 und s_1 sind Größen mit Index — in LaTeX gehört der tief.
  const m = /^([A-Za-zΑ-Ωα-ωÄÖÜäöü])_?(\d+)$/.exec(name);
  const base = m ? `${m[1]}_{${m[2]}}` : name;
  return exp === 1 ? base : `${base}^{${exp}}`;
};

/** Der Betrag eines Monoms als LaTeX — Brüche werden echte Brüche. */
export function monoLatex(m: Mono): string {
  const a = Math.abs(m.c);
  const up = Object.entries(m.v).filter(([, e]) => e > 0);
  const down = Object.entries(m.v).filter(([, e]) => e < 0);
  const upTex = up.map(([k, e]) => varLatex(k, e)).join(" \\cdot ");
  const num = a === 1 && upTex ? upTex : upTex ? `${numToLatex(fmtNum(a))} \\cdot ${upTex}` : numToLatex(fmtNum(a));
  if (!down.length) return num;
  const denTex = down.map(([k, e]) => varLatex(k, -e)).join(" \\cdot ");
  return `\\frac{${num}}{${denTex}}`;
}

export function exprToLatex(e: Expr): string {
  if (!e.length) return "0";
  return e
    .map((m, i) => (i === 0 ? (m.c < 0 ? `-${monoLatex(m)}` : monoLatex(m)) : ` ${m.c < 0 ? "-" : "+"} ${monoLatex(m)}`))
    .join("");
}

export const feqToLatex = (eq: Feq): string =>
  `${exprToLatex(eq.left)} = ${exprToLatex(eq.right)}`;

export function formatFOp(op: FOp): string {
  switch (op.op) {
    case "add":
      return `${op.m.c < 0 ? MINUS : "+"} ${monoBody(op.m)}`;
    case "mul":
      return `· ${monoBody(op.m)}`;
    case "div":
      return `: ${monoBody(op.m)}`;
  }
}

// ── Vorschläge ────────────────────────────────────────────────────────────────

/** Sinnvolle nächste Schritte, um `target` freizustellen. */
export function suggestFOps(eq: Feq, target: string): FOp[] {
  const out: FOp[] = [];
  const push = (o: FOp) => {
    if (!out.some(p => formatFOp(p) === formatFOp(o))) out.push(o);
  };

  const inLeft = eq.left.some(m => hasVar(m, target));
  const home = inLeft ? eq.left : eq.right;
  const away = inLeft ? eq.right : eq.left;
  if (!inLeft && !eq.right.some(m => hasVar(m, target))) return out;

  // Steht die Größe auf beiden Seiten, erst zusammenholen.
  for (const m of away) if (hasVar(m, target)) push({ op: "add", m: negMono(m) });

  // Alles wegnehmen, was neben ihr steht.
  for (const m of home) if (!hasVar(m, target)) push({ op: "add", m: negMono(m) });

  const carrier = home.filter(m => hasVar(m, target));
  if (carrier.length === 1) {
    const m = carrier[0];
    if (Math.abs(m.c) !== 1) push({ op: "div", m: num(m.c) });
    for (const [k, e] of Object.entries(m.v)) {
      if (k === target) continue;
      if (e > 0) push({ op: "div", m: varMono(k, e) });
      else push({ op: "mul", m: varMono(k, -e) });
    }
    const te = m.v[target] ?? 0;
    if (te < 0) push({ op: "mul", m: varMono(target, -te) });
  }

  return out.slice(0, 6);
}

// ── Eingabe lesen ─────────────────────────────────────────────────────────────

class FormelError extends Error {}

type Tok =
  | { k: "num"; v: number }
  | { k: "id"; v: string }
  | { k: "op"; v: "+" | "-" | "*" | "/" | "^" }
  | { k: "(" }
  | { k: ")" }
  | { k: "=" };

/** Variablennamen: ein Buchstabe, optional mit Index (v0, s_1, Δt). */
const LETTER = /[A-Za-zΑ-Ωα-ωÄÖÜäöü]/;

function tokenize(src: string): Tok[] {
  const s = src.replace(/\s+/g, "");
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.,]/.test(s[j])) j++;
      const v = Number(s.slice(i, j).replace(",", "."));
      if (!isFinite(v)) throw new FormelError(`»${s.slice(i, j)}« ist keine Zahl.`);
      toks.push({ k: "num", v });
      i = j;
      continue;
    }
    if (LETTER.test(ch)) {
      let j = i + 1;
      if (s[j] === "_") j++;
      while (j < s.length && /[0-9]/.test(s[j])) j++;
      // s_1 und s1 meinen dieselbe Größe — der Unterstrich ist nur Schreibweise.
      toks.push({ k: "id", v: s.slice(i, j).replace("_", "") });
      i = j;
      continue;
    }
    i++;
    if (ch === "+") toks.push({ k: "op", v: "+" });
    else if (ch === "-" || ch === MINUS || ch === "–") toks.push({ k: "op", v: "-" });
    else if (ch === "*" || ch === "·" || ch === "×") toks.push({ k: "op", v: "*" });
    else if (ch === "/" || ch === ":") toks.push({ k: "op", v: "/" });
    else if (ch === "^") toks.push({ k: "op", v: "^" });
    else if (ch === "²" || ch === "³") toks.push({ k: "op", v: "^" }, { k: "num", v: ch === "²" ? 2 : 3 });
    else if (ch === "(" || ch === "[") toks.push({ k: "(" });
    else if (ch === ")" || ch === "]") toks.push({ k: ")" });
    else if (ch === "=") toks.push({ k: "=" });
    else throw new FormelError(`Unerwartetes Zeichen: »${ch}«`);
  }
  return toks;
}

function parseExprToks(toks: Tok[]): Expr {
  let i = 0;
  const peek = (): Tok | undefined => toks[i];
  const startsAtom = (t: Tok | undefined) => !!t && (t.k === "num" || t.k === "id" || t.k === "(");

  const atom = (): Expr => {
    const t = peek();
    if (!t) throw new FormelError("Da fehlt noch etwas.");
    if (t.k === "num") {
      i++;
      return [num(t.v)];
    }
    if (t.k === "id") {
      i++;
      return [varMono(t.v)];
    }
    if (t.k === "(") {
      i++;
      const inner = expr();
      const close = peek();
      if (!close || close.k !== ")") throw new FormelError("Eine Klammer wurde nicht geschlossen.");
      i++;
      return inner;
    }
    throw new FormelError("Da fehlt eine Zahl oder eine Variable.");
  };

  const power = (): Expr => {
    let base = atom();
    const t = peek();
    if (t && t.k === "op" && t.v === "^") {
      i++;
      const e = peek();
      if (!e || e.k !== "num" || !Number.isInteger(e.v)) throw new FormelError("Hochzahlen müssen ganze Zahlen sein.");
      i++;
      const n = e.v;
      if (n < 0) {
        if (base.length !== 1) throw new FormelError("Eine Summe kann ich nicht in den Nenner nehmen.");
        base = [{ c: Math.pow(base[0].c, n), v: Object.fromEntries(Object.entries(base[0].v).map(([k, x]) => [k, x * n])) }];
      } else {
        let r: Expr = [ONE];
        for (let p = 0; p < n; p++) r = mulExpr(r, base);
        base = r;
      }
    }
    return base;
  };

  const term = (): Expr => {
    let r = power();
    for (;;) {
      const t = peek();
      if (t && t.k === "op" && (t.v === "*" || t.v === "/")) {
        i++;
        const rhs = power();
        if (t.v === "*") r = mulExpr(r, rhs);
        else {
          if (rhs.length !== 1) throw new FormelError("Durch eine Summe kann ich nicht teilen.");
          if (rhs[0].c === 0) throw new FormelError("Durch 0 kann man nicht teilen.");
          r = mulExpr(r, [invMono(rhs[0])]);
        }
        continue;
      }
      if (startsAtom(t)) {
        r = mulExpr(r, power()); // 2a, m·a ohne Malpunkt
        continue;
      }
      return r;
    }
  };

  const expr = (): Expr => {
    let sign = 1;
    const first = peek();
    if (first && first.k === "op" && (first.v === "+" || first.v === "-")) {
      sign = first.v === "-" ? -1 : 1;
      i++;
    }
    let r = sign === -1 ? negExpr(term()) : term();
    for (;;) {
      const t = peek();
      if (!t || t.k !== "op" || (t.v !== "+" && t.v !== "-")) break;
      i++;
      const rhs = term();
      r = simplifyExpr([...r, ...(t.v === "-" ? negExpr(rhs) : rhs)]);
    }
    return r;
  };

  if (!toks.length) throw new FormelError("Eine Seite der Gleichung ist leer.");
  const out = expr();
  if (i < toks.length) throw new FormelError("Das Ende der Formel konnte ich nicht lesen.");
  return simplifyExpr(out);
}

/** Ein einzelner Term für die freie Eingabe einer Umformung: 2, a, m·a, t². */
export function parseSingleMono(src: string): { ok: true; m: Mono } | { ok: false; error: string } {
  try {
    const e = parseExprToks(tokenize(fromLatex(src)));
    if (e.length !== 1) return { ok: false, error: "Bitte nur einen Term, z. B. 2, a oder m·a." };
    return { ok: true, m: e[0] };
  } catch (err) {
    return { ok: false, error: err instanceof FormelError ? err.message : "Das konnte ich nicht lesen." };
  }
}

export function parseFormel(input: string): { ok: true; eq: Feq } | { ok: false; error: string } {
  try {
    const toks = tokenize(fromLatex(input));
    const at = toks.findIndex(t => t.k === "=");
    if (at < 0) return { ok: false, error: "Es fehlt ein »=«." };
    if (toks.slice(at + 1).some(t => t.k === "=")) return { ok: false, error: "Nur ein »=« ist erlaubt." };
    const eq: Feq = { left: parseExprToks(toks.slice(0, at)), right: parseExprToks(toks.slice(at + 1)) };
    if (!varsOf(eq).length) return { ok: false, error: "In der Formel kommt keine Variable vor." };
    return { ok: true, eq };
  } catch (e) {
    return { ok: false, error: e instanceof FormelError ? e.message : "Das konnte ich nicht lesen." };
  }
}

// ── Vorlagen ──────────────────────────────────────────────────────────────────

export type Preset = { formel: string; label: string; target: string; values: Record<string, number> };

export const PRESETS: Preset[] = [
  { formel: "F = m·a", label: "Kraft", target: "m", values: { F: 12, a: 3 } },
  { formel: "U = R·I", label: "Ohmsches Gesetz", target: "R", values: { U: 12, I: 3 } },
  { formel: "s = v·t", label: "Weg", target: "t", values: { s: 12, v: 4 } },
  { formel: "p = F/A", label: "Druck", target: "A", values: { p: 3, F: 12 } },
  { formel: "V = a·b·c", label: "Quader", target: "c", values: { V: 24, a: 4, b: 3 } },
  { formel: "E = m·g·h", label: "Lageenergie", target: "h", values: { E: 24, m: 3, g: 2 } },
  { formel: "s = v·t + s0", label: "Weg mit Startpunkt", target: "v", values: { s: 14, t: 3, s0: 2 } },
];

/** Startwerte: die gesuchte Größe bleibt leer, sie ergibt sich aus dem Rest. */
export function initialValues(eq: Feq, target: string, preset?: Record<string, number>): Values {
  const out: Values = {};
  let next = 2;
  for (const v of varsOf(eq)) {
    if (v === target) {
      out[v] = null;
      continue;
    }
    out[v] = preset?.[v] ?? next++;
  }
  return out;
}
