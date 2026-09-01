/**
 * Funktionsterme lesen, ausrechnen und Schritt für Schritt einsetzen.
 *
 * Für die Simulation »Funktionen«: ein Term wie »2x + 1«, »x^2 - 3« oder
 * »sin(x)« wird zu einem Baum geparst. Aus dem Baum kommen dann drei Dinge:
 * der Wert an einer Stelle (Wertetabelle und Graph), der Term als Text — und
 * der Rechenweg beim Einsetzen, damit sichtbar wird, wo die Zahlen in der
 * Wertetabelle herkommen.
 *
 * Reine Rechnung ohne React, damit sie prüfbar ist.
 *
 * Nicht abgedeckt: mehrere Variablen, Ableitungen, Beträge mit |…| (dafür
 * gibt es abs(…)).
 */

// ── Baum ──────────────────────────────────────────────────────────────────────

export type FnName = "sin" | "cos" | "tan" | "sqrt" | "abs" | "ln" | "log" | "exp";

export type Node =
  | { k: "num"; v: number; subst?: true }
  | { k: "x" }
  | { k: "bin"; op: "+" | "-" | "*" | "/" | "^"; a: Node; b: Node }
  | { k: "neg"; a: Node }
  | { k: "fn"; name: FnName; a: Node };

export class FunktionsError extends Error {}

const FNS: Record<FnName, (v: number) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  sqrt: Math.sqrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  exp: Math.exp,
};

const FN_NAMES = Object.keys(FNS) as FnName[];

// ── Lesen ─────────────────────────────────────────────────────────────────────

type Tok =
  | { k: "num"; v: number }
  | { k: "x" }
  | { k: "fn"; name: FnName }
  | { k: "op"; v: "+" | "-" | "*" | "/" | "^" }
  | { k: "(" }
  | { k: ")" };

/** π und e dürfen ausgeschrieben oder als Zeichen dastehen. */
const CONSTS: Record<string, number> = { pi: Math.PI, "π": Math.PI };

function tokenize(src: string): Tok[] {
  // »f(x) =« davor ist erlaubt — Schüler schreiben den Term oft komplett hin.
  const cleaned = src.replace(/^\s*f\s*\(\s*x\s*\)\s*=/i, "").replace(/^\s*y\s*=/i, "");
  const s = cleaned.replace(/\s+/g, "").replace(/,/g, ".");
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const v = Number(s.slice(i, j));
      if (!Number.isFinite(v)) throw new FunktionsError(`»${s.slice(i, j)}« ist keine Zahl.`);
      toks.push({ k: "num", v });
      i = j;
      continue;
    }
    if (/[a-zA-Zπ]/.test(ch)) {
      let j = i;
      while (j < s.length && /[a-zA-Zπ]/.test(s[j])) j++;
      let word = s.slice(i, j).toLowerCase();
      // »2sinx« gibt es nicht, aber »xsin(x)« schon: das Wort von links her
      // in bekannte Stücke zerlegen, damit »x« als Faktor stehen bleibt.
      while (word.length) {
        const fn = FN_NAMES.find(f => word.startsWith(f));
        if (fn) {
          toks.push({ k: "fn", name: fn });
          word = word.slice(fn.length);
          continue;
        }
        const cst = Object.keys(CONSTS).find(c => word.startsWith(c));
        if (cst) {
          toks.push({ k: "num", v: CONSTS[cst] });
          word = word.slice(cst.length);
          continue;
        }
        if (word.startsWith("x")) {
          toks.push({ k: "x" });
          word = word.slice(1);
          continue;
        }
        if (word.startsWith("e")) {
          toks.push({ k: "num", v: Math.E });
          word = word.slice(1);
          continue;
        }
        throw new FunktionsError(`»${word}« kenne ich nicht. Erlaubt sind x, Zahlen, π und ${FN_NAMES.join(", ")}.`);
      }
      i = j;
      continue;
    }
    i++;
    if (ch === "+") toks.push({ k: "op", v: "+" });
    else if (ch === "-" || ch === "−" || ch === "–") toks.push({ k: "op", v: "-" });
    else if (ch === "*" || ch === "·" || ch === "×") toks.push({ k: "op", v: "*" });
    else if (ch === "/" || ch === ":") toks.push({ k: "op", v: "/" });
    else if (ch === "^") toks.push({ k: "op", v: "^" });
    else if (ch === "(" || ch === "[") toks.push({ k: "(" });
    else if (ch === ")" || ch === "]") toks.push({ k: ")" });
    else throw new FunktionsError(`Unerwartetes Zeichen: »${ch}«`);
  }
  return toks;
}

/**
 * Term → Baum. Punkt vor Strich, Potenz rechtsassoziativ, und das
 * stillschweigende Mal: »2x«, »3sin(x)«, »2(x+1)« und »x(x+1)«.
 */
function parseTokens(toks: Tok[]): Node {
  let i = 0;
  const peek = () => toks[i];

  const expr = (): Node => {
    let left = term();
    for (;;) {
      const t = peek();
      if (t?.k === "op" && (t.v === "+" || t.v === "-")) {
        i++;
        left = { k: "bin", op: t.v, a: left, b: term() };
      } else return left;
    }
  };

  const term = (): Node => {
    let left = unary();
    for (;;) {
      const t = peek();
      if (t?.k === "op" && (t.v === "*" || t.v === "/")) {
        i++;
        left = { k: "bin", op: t.v, a: left, b: unary() };
      } else if (t && (t.k === "num" || t.k === "x" || t.k === "fn" || t.k === "(")) {
        // Stillschweigendes Mal — »2x« ist 2 · x. Bewusst power() und nicht
        // unary(): sonst würde »2 - 3« zu 2 · (−3).
        left = { k: "bin", op: "*", a: left, b: power() };
      } else return left;
    }
  };

  /**
   * Das Vorzeichen bindet schwächer als die Potenz: »−x²« ist −(x²), nicht
   * (−x)². Deshalb steht unary über power und nicht darunter.
   */
  const unary = (): Node => {
    const t = peek();
    if (t?.k === "op" && t.v === "-") {
      i++;
      return { k: "neg", a: unary() };
    }
    if (t?.k === "op" && t.v === "+") {
      i++;
      return unary();
    }
    return power();
  };

  const power = (): Node => {
    const base = atom();
    const t = peek();
    if (t?.k === "op" && t.v === "^") {
      i++;
      // Rechtsassoziativ, und »2^-3« soll gehen: der Exponent darf ein
      // Vorzeichen haben.
      return { k: "bin", op: "^", a: base, b: unary() };
    }
    return base;
  };

  const atom = (): Node => {
    const t = peek();
    if (!t) throw new FunktionsError("Der Term hört mitten drin auf.");
    if (t.k === "num") { i++; return { k: "num", v: t.v }; }
    if (t.k === "x") { i++; return { k: "x" }; }
    if (t.k === "fn") {
      i++;
      const open = peek();
      if (open?.k !== "(") throw new FunktionsError(`Nach ${t.name} fehlt eine Klammer: ${t.name}(x)`);
      i++;
      const inner = expr();
      if (peek()?.k !== ")") throw new FunktionsError("Eine Klammer wurde nicht geschlossen.");
      i++;
      return { k: "fn", name: t.name, a: inner };
    }
    if (t.k === "(") {
      i++;
      const inner = expr();
      if (peek()?.k !== ")") throw new FunktionsError("Eine Klammer wurde nicht geschlossen.");
      i++;
      return inner;
    }
    throw new FunktionsError("Da fehlt eine Zahl oder ein x.");
  };

  const out = expr();
  if (i < toks.length) throw new FunktionsError("Der Term hat einen Rest, den ich nicht lesen kann.");
  return out;
}

export function parseFunction(src: string): { ok: true; node: Node } | { ok: false; error: string } {
  try {
    if (!src.trim()) return { ok: false, error: "Schreibe einen Term, z. B. 2x + 1" };
    return { ok: true, node: parseTokens(tokenize(src)) };
  } catch (e) {
    return { ok: false, error: e instanceof FunktionsError ? e.message : "Das konnte ich nicht lesen." };
  }
}

// ── Ausrechnen ────────────────────────────────────────────────────────────────

/**
 * Wert an der Stelle x — oder null, wo die Funktion nicht definiert ist
 * (1/0, sqrt(-1), tan an der Polstelle). Der Graph lässt dort eine Lücke.
 */
export function evalAt(n: Node, x: number): number | null {
  const v = raw(n, x);
  return Number.isFinite(v) ? v : null;
}

function raw(n: Node, x: number): number {
  switch (n.k) {
    case "num": return n.v;
    case "x": return x;
    case "neg": return -raw(n.a, x);
    case "fn": return FNS[n.name](raw(n.a, x));
    case "bin": {
      const a = raw(n.a, x);
      const b = raw(n.b, x);
      switch (n.op) {
        case "+": return a + b;
        case "-": return a - b;
        case "*": return a * b;
        case "/": return a / b;
        case "^": return Math.pow(a, b);
      }
    }
  }
}

/** Kommt in dem Term überhaupt ein x vor? (Sonst ist der Graph eine Waagerechte.) */
export function hasX(n: Node): boolean {
  switch (n.k) {
    case "x": return true;
    case "num": return false;
    case "neg": case "fn": return hasX(n.a);
    case "bin": return hasX(n.a) || hasX(n.b);
  }
}

// ── Schreiben ─────────────────────────────────────────────────────────────────

export function fmt(v: number): string {
  if (!Number.isFinite(v)) return "–";
  const r = Math.round(v * 1e6) / 1e6;
  if (Number.isInteger(r)) return String(r);
  return r.toFixed(Math.abs(r) < 1 ? 3 : 2).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");
}

const PREC: Record<string, number> = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3 };

/** Ein Stück des Terms — die Oberfläche färbt danach ein. */
export type Seg = { t: string; kind: "plain" | "x" | "mark" };

/**
 * Term als farbige Stücke. `mark` ist der Knoten, der gerade hervorgehoben
 * werden soll (der eingesetzte Wert oder das Zwischenergebnis).
 */
export function segments(n: Node, mark?: Node | null, fmtSubst?: (v: number) => string): Seg[] {
  const out: Seg[] = [];
  const put = (t: string, kind: Seg["kind"] = "plain") => out.push({ t, kind });

  const walk = (node: Node, parentPrec: number) => {
    const marked = mark != null && node === mark;
    if (node.k === "x") { put("x", "x"); return; }
    if (node.k === "num") {
      // Eingesetzte Werte dürfen anders geschrieben werden als gerechnete —
      // im π-Modus steht in der Tabelle »−π«, nicht »−3,14«.
      const txt = node.subst && fmtSubst ? fmtSubst(node.v) : fmt(node.v);
      put(txt, marked || node.subst ? "mark" : "plain");
      return;
    }
    if (node.k === "neg") {
      const need = parentPrec > 1;
      if (need) put("(");
      put("−");
      walk(node.a, 2);
      if (need) put(")");
      return;
    }
    if (node.k === "fn") {
      put(node.name + "(");
      walk(node.a, 0);
      put(")");
      return;
    }
    const p = PREC[node.op];
    const need = p < parentPrec;
    if (need) put("(");
    walk(node.a, p);
    put(node.op === "*" ? " · " : node.op === "-" ? " − " : node.op === "^" ? "^" : ` ${node.op} `);
    // Rechts eine Stufe strenger: a − (b − c) braucht die Klammer.
    walk(node.b, node.op === "^" ? p : p + (node.op === "-" || node.op === "/" ? 1 : 0));
    if (need) put(")");
  };

  walk(n, 0);
  return out;
}

export const formatNode = (n: Node): string => segments(n).map(s => s.t).join("");

// ── Einsetzen, Schritt für Schritt ────────────────────────────────────────────

/** x überall durch den Wert ersetzen; die eingesetzten Zahlen bleiben markiert. */
export function substituteX(n: Node, x: number): Node {
  switch (n.k) {
    case "x": return { k: "num", v: x, subst: true };
    case "num": return n;
    case "neg": return { k: "neg", a: substituteX(n.a, x) };
    case "fn": return { k: "fn", name: n.name, a: substituteX(n.a, x) };
    case "bin": return { k: "bin", op: n.op, a: substituteX(n.a, x), b: substituteX(n.b, x) };
  }
}

const isNum = (n: Node): n is { k: "num"; v: number; subst?: true } => n.k === "num";

/**
 * Einen Rechenschritt ausführen: den am weitesten innen liegenden Knoten, der
 * schon nur aus Zahlen besteht, durch sein Ergebnis ersetzen. So entsteht
 * »2 · 3 + 1« → »6 + 1« → »7« statt eines Sprungs zum Endergebnis.
 */
function reduceOnce(n: Node): { node: Node; done: Node } | null {
  if (n.k === "num" || n.k === "x") return null;

  if (n.k === "neg") {
    const inner = reduceOnce(n.a);
    if (inner) return { node: { k: "neg", a: inner.node }, done: inner.done };
    if (isNum(n.a)) {
      const res: Node = { k: "num", v: -n.a.v };
      return { node: res, done: res };
    }
    return null;
  }
  if (n.k === "fn") {
    const inner = reduceOnce(n.a);
    if (inner) return { node: { k: "fn", name: n.name, a: inner.node }, done: inner.done };
    if (isNum(n.a)) {
      const res: Node = { k: "num", v: FNS[n.name](n.a.v) };
      return { node: res, done: res };
    }
    return null;
  }
  // bin: erst links, dann rechts, dann selbst.
  const l = reduceOnce(n.a);
  if (l) return { node: { k: "bin", op: n.op, a: l.node, b: n.b }, done: l.done };
  const r = reduceOnce(n.b);
  if (r) return { node: { k: "bin", op: n.op, a: n.a, b: r.node }, done: r.done };
  if (isNum(n.a) && isNum(n.b)) {
    const res: Node = { k: "num", v: raw(n, 0) };
    return { node: res, done: res };
  }
  return null;
}

export type Step = { segs: Seg[]; label: string };

/**
 * Der Rechenweg für eine Zeile der Wertetabelle: Formel → x eingesetzt →
 * Schritt für Schritt ausgerechnet.
 */
export function substitutionSteps(n: Node, x: number, maxSteps = 12): Step[] {
  const steps: Step[] = [{ segs: segments(n), label: "Die Funktion" }];
  let cur = substituteX(n, x);
  steps.push({ segs: segments(cur), label: `x = ${fmt(x)} einsetzen` });

  for (let guard = 0; guard < maxSteps; guard++) {
    const next = reduceOnce(cur);
    if (!next) break;
    cur = next.node;
    steps.push({ segs: segments(cur, next.done), label: "ausrechnen" });
  }
  if (steps.length > 2) steps[steps.length - 1].label = "Ergebnis";
  return steps;
}

// ── Wertetabelle ──────────────────────────────────────────────────────────────

export type Row = { x: number; y: number | null };

export function tableRows(n: Node, from: number, to: number, step: number): Row[] {
  const rows: Row[] = [];
  if (!(step > 0) || !Number.isFinite(from) || !Number.isFinite(to) || to < from) return rows;
  const count = Math.floor((to - from) / step + 1e-9);
  // Deckel gegen versehentlich winzige Schrittweiten (0,001 über 20 Einheiten).
  for (let i = 0; i <= Math.min(count, 200); i++) {
    const x = Math.round((from + i * step) * 1e6) / 1e6;
    rows.push({ x, y: evalAt(n, x) });
  }
  return rows;
}

// ── Graph antasten ───────────────────────────────────────────────────────────

/**
 * Welche Stelle x liegt unter dem Zeiger?
 *
 * `px` ist die Position im viewBox-Maß, nicht in Bildschirmpixeln. null, wenn
 * der Zeiger neben der Zeichenfläche liegt — oder wenn die Breite 0 ist: das
 * passiert bei noch nicht gelayouteten (versteckten) Seiten, und ohne diese
 * Bremse käme NaN heraus und der Graph zeigte einen Punkt ins Nichts.
 */
export function xAtPixel(
  px: number, x0: number, x1: number, width: number, margin: number,
): number | null {
  const inner = width - 2 * margin;
  if (!(inner > 0) || !Number.isFinite(px) || x1 <= x0) return null;
  if (px < margin || px > width - margin) return null;
  const x = x0 + ((px - margin) / inner) * (x1 - x0);
  return Math.round(x * 1000) / 1000;
}


// ── Vielfache von π ───────────────────────────────────────────────────────────

/**
 * Zahl als Vielfaches von π schreiben: 1,5708 → »π/2«, −4,712 → »−3π/2«.
 *
 * Bei Winkelfunktionen sind die interessanten Stellen Bruchteile von π; als
 * Dezimalzahl sagen sie nichts. Passt kein kleiner Bruch, bleibt es bei der
 * Dezimalzahl — dann ist π nicht gemeint.
 */
export function fmtPi(v: number): string {
  if (!Number.isFinite(v)) return "–";
  const q = v / Math.PI;
  if (Math.abs(q) < 1e-9) return "0";
  for (const den of [1, 2, 3, 4, 6, 8]) {
    const num = q * den;
    const r = Math.round(num);
    if (r !== 0 && Math.abs(num - r) < 1e-6) {
      const g = (a: number, b: number): number => (b ? g(b, Math.abs(a % b)) : Math.abs(a));
      const d = g(r, den);
      const n = r / d, dd = den / d;
      const sign = n < 0 ? "−" : "";
      const mag = Math.abs(n) === 1 ? "π" : `${Math.abs(n)}π`;
      return dd === 1 ? `${sign}${mag}` : `${sign}${mag}/${dd}`;
    }
  }
  return fmt(v);
}

// ── Vorlagen ──────────────────────────────────────────────────────────────────

/**
 * Was eine Vorlage beim Anklicken liefert: den Term und den Bereich, in dem er
 * etwas zeigt. `pi` heißt, dass von/bis/Schritt in Vielfachen von π zu lesen
 * sind — bei Winkelfunktionen ist alles andere unbrauchbar.
 */
export type Instance = { src: string; from: number; to: number; step: number; pi: boolean };

export type Template = {
  key: string;
  label: string;
  hint: string;
  /** Jeder Aufruf würfelt neue Parameter — nochmal klicken heißt neue Aufgabe. */
  build: () => Instance;
};

const ri = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
/** Zahl für den Term: −0.5 wird zu »-0.5«, damit der Leser sie wiederfindet. */
const n2s = (v: number) => String(Math.round(v * 1000) / 1000);
/** »+ 3« bzw. »- 3«, und bei 0 gar nichts. */
const plus = (v: number) => (v === 0 ? "" : v > 0 ? ` + ${n2s(v)}` : ` - ${n2s(-v)}`);
/** Faktor vor x: 1 und −1 schreibt man nicht aus. */
const fac = (m: number) => (m === 1 ? "" : m === -1 ? "-" : `${n2s(m)}`);

/** Ein Fenster um eine Mitte herum — für Scheitelpunkte und Nullstellen. */
const around = (center: number, radius = 3, step = 1): Omit<Instance, "src" | "pi"> => ({
  from: Math.round(center) - radius,
  to: Math.round(center) + radius,
  step,
});

/**
 * Ein volles Periodenfenster für sin/cos mit dem Streckfaktor b.
 * Periode 2π/b ⇒ von −1/b bis 1/b (in π gerechnet), in acht Schritten.
 */
function fullPeriod(b: number): Omit<Instance, "src" | "pi"> {
  const half = 1 / Math.abs(b);
  const raw = (2 * half) / 8;
  const step = [0.125, 0.25, 0.5, 1].find(s => s >= raw - 1e-9) ?? 1;
  return { from: -half, to: half, step };
}

export const TEMPLATES: Template[] = [
  {
    key: "proportional",
    label: "Proportional",
    hint: "Ursprungsgerade y = m · x — doppelt so viel x, doppelt so viel y. Ohne n geht sie durch (0 | 0).",
    build: () => {
      const m = pick([2, 3, -2, -1, 0.5, -0.5, 1.5]);
      return { src: `${fac(m)}x`, ...around(0), pi: false };
    },
  },
  {
    key: "linear",
    label: "Linear",
    hint: "y = m · x + n. m ist die Steigung, n der y-Achsenabschnitt — dort schneidet die Gerade die y-Achse.",
    build: () => {
      const m = pick([2, 3, -2, -3, 0.5, -0.5, 1, -1]);
      const n = ri(-4, 4);
      // Um die Nullstelle herum zeigen: dort passiert das Interessante.
      return { src: `${fac(m)}x${plus(n)}`, ...around(-n / m), pi: false };
    },
  },
  {
    key: "parabel",
    label: "Parabel",
    hint: "y = a · (x − d)² + e. Der Scheitelpunkt liegt bei (d | e) — der Bereich ist darum herum gelegt.",
    build: () => {
      const a = pick([1, 1, -1, 0.5, -0.5, 2]);
      const d = ri(-3, 3);
      const e = ri(-4, 4);
      const inner = d === 0 ? "x" : d > 0 ? `(x - ${d})` : `(x + ${-d})`;
      return { src: `${fac(a)}${inner}^2${plus(e)}`, ...around(d), pi: false };
    },
  },
  {
    key: "kubisch",
    label: "Kubisch",
    hint: "y = x³ − c · x — steigt, fällt und steigt wieder. Ein Wendepunkt im Ursprung.",
    build: () => {
      const c = ri(1, 4);
      return { src: `x^3 - ${c}x`, ...around(0), pi: false };
    },
  },
  {
    key: "hyperbel",
    label: "Hyperbel",
    hint: "y = a / x. Bei x = 0 nicht definiert — dort hat der Graph eine Lücke, keine Linie.",
    build: () => {
      const a = pick([1, 2, -1, -2, 3]);
      return { src: `${n2s(a)}/x`, ...around(0), pi: false };
    },
  },
  {
    key: "wurzel",
    label: "Wurzel",
    hint: "y = √(x − d) + e. Erst ab x = d definiert — links davon steht in der Tabelle »—«.",
    build: () => {
      const d = ri(-2, 2);
      const e = ri(-2, 3);
      const inner = d === 0 ? "x" : d > 0 ? `x - ${d}` : `x + ${-d}`;
      return { src: `sqrt(${inner})${plus(e)}`, from: d - 1, to: d + 9, step: 1, pi: false };
    },
  },
  {
    key: "betrag",
    label: "Betrag",
    hint: "y = |x − d| + e — ein Knick statt einer runden Spitze, bei (d | e).",
    build: () => {
      const d = ri(-3, 3);
      const e = ri(-3, 3);
      const inner = d === 0 ? "x" : d > 0 ? `x - ${d}` : `x + ${-d}`;
      return { src: `abs(${inner})${plus(e)}`, ...around(d), pi: false };
    },
  },
  {
    key: "sinus",
    label: "Sinus",
    hint: "y = a · sin(b · x). Der Bereich zeigt genau eine volle Periode — sie ist 2π/b lang.",
    build: () => {
      const a = pick([1, 1, 2, -1, 0.5]);
      const b = pick([1, 1, 2, 0.5]);
      return { src: `${fac(a)}sin(${fac(b)}x)`, ...fullPeriod(b), pi: true };
    },
  },
  {
    key: "kosinus",
    label: "Kosinus",
    hint: "y = a · cos(b · x) — wie Sinus, aber um π/2 verschoben: bei x = 0 ganz oben.",
    build: () => {
      const a = pick([1, 1, 2, -1, 0.5]);
      const b = pick([1, 1, 2, 0.5]);
      return { src: `${fac(a)}cos(${fac(b)}x)`, ...fullPeriod(b), pi: true };
    },
  },
  {
    key: "tangens",
    label: "Tangens",
    hint: "y = tan(x). Periode π, und an ±π/2 Polstellen — dort bricht der Graph ab.",
    build: () => ({ src: "tan(x)", from: -0.5, to: 0.5, step: 0.125, pi: true }),
  },
  {
    key: "welle",
    label: "Gedämpfte Welle",
    hint: "y = sin(x)/x — eine Welle, die nach außen kleiner wird. Bei x = 0 nicht definiert.",
    build: () => ({ src: "sin(x)/x", from: -2, to: 2, step: 0.25, pi: true }),
  },
];

/** Erste Vorlage beim Öffnen — fest, damit der Einstieg immer gleich aussieht. */
export const START: Instance = { src: "2x + 1", from: -3, to: 3, step: 1, pi: false };

// ── Ausschnitt und Achsenteilung ──────────────────────────────────────────────

export type Viewport = { x0: number; x1: number; y0: number; y1: number };

/** Runde Schrittweite (1, 2, 5, 10 …) für eine Spannweite. */
export function niceStep(span: number): number {
  if (!(span > 0)) return 1;
  const rough = span / 10;
  const p = Math.pow(10, Math.floor(Math.log10(rough)));
  for (const m of [1, 2, 5, 10]) if (rough <= m * p) return m * p;
  return 10 * p;
}

/** Wie viele Linien ein 1er-Raster höchstens haben darf, bevor es zumatscht. */
export const UNIT_GRID_MAX = 26;

/**
 * Achsenteilung. `unit` heißt: möglichst in Einer-Schritten, damit sich Kästchen
 * zählen lassen — das ist bei den meisten Funktionen das Anschaulichste. Erst
 * wenn dabei zu viele Linien herauskämen, wird auf 2, 5, 10 … ausgewichen.
 * Winkelfunktionen rechnen dagegen in π und geben `unit = false` mit.
 */
export function axisStep(span: number, unit: boolean): number {
  if (unit && span > 0 && span <= UNIT_GRID_MAX) return 1;
  return niceStep(span);
}

/** Teilung der x-Achse im π-Modus: Vielfache von π, nicht von 1. */
export function piAxisStep(span: number): number {
  const m = [0.25, 0.5, 1, 2, 4].find(k => span / (k * Math.PI) <= 10) ?? 4;
  return m * Math.PI;
}

/**
 * Ausschnitt um seine Mitte herum skalieren — x und y unabhängig.
 * Faktor < 1 heißt hineinzoomen (der gezeigte Bereich wird kleiner).
 */
export function zoomViewport(v: Viewport, fx: number, fy: number): Viewport {
  const cx = (v.x0 + v.x1) / 2;
  const cy = (v.y0 + v.y1) / 2;
  // Grenzen, damit der Ausschnitt weder entartet noch ins Unendliche läuft.
  const clamp = (h: number) => Math.min(Math.max(Math.abs(h), 1e-3), 1e6);
  const hx = clamp(((v.x1 - v.x0) / 2) * fx);
  const hy = clamp(((v.y1 - v.y0) / 2) * fy);
  return { x0: cx - hx, x1: cx + hx, y0: cy - hy, y1: cy + hy };
}

/**
 * Ausschnitt auf gleiche Maßstäbe bringen: ein Schritt in x ist dann genauso
 * breit wie ein Schritt in y hoch — das Raster besteht aus Quadraten.
 *
 * Es wird nur gedehnt, nie beschnitten: was vorher im Bild war, bleibt drin.
 * Sobald jemand eine Achse einzeln staucht oder dehnt, gilt das absichtlich
 * nicht mehr — dafür sind die getrennten Achsenknöpfe da.
 */
export function squareViewport(v: Viewport, width: number, height: number): Viewport {
  if (!(width > 0) || !(height > 0)) return v;
  const proX = (v.x1 - v.x0) / width;    // Einheiten je Pixel
  const proY = (v.y1 - v.y0) / height;
  if (!(proX > 0) || !(proY > 0)) return v;
  const s = Math.max(proX, proY);        // die engere Achse wird aufgezogen
  const cx = (v.x0 + v.x1) / 2, cy = (v.y0 + v.y1) / 2;
  const hx = (s * width) / 2, hy = (s * height) / 2;
  return { x0: cx - hx, x1: cx + hx, y0: cy - hy, y1: cy + hy };
}

/**
 * Der Term mit eingesetztem x, als farbige Stücke — für die Rechnung-Spalte
 * der Wertetabelle. Die eingesetzten Zahlen tragen `kind: "mark"`, damit in
 * der Tabelle sichtbar wird, dass dort überall dasselbe x steht.
 */
export function substitutedTerm(n: Node, x: number, fmtValue?: (v: number) => string): Seg[] {
  return segments(substituteX(n, x), null, fmtValue);
}

/**
 * Ausschnitt verschieben — reine Translation, die Maßstäbe bleiben.
 *
 * `dx`/`dy` sind die Verschiebung des **Fensters** in Einheiten, nicht die des
 * Inhalts: wer den Graphen nach rechts zieht, schiebt das Fenster nach links.
 * Quadratische Kästchen bleiben quadratisch, weil sich keine Spannweite ändert.
 */
export function panViewport(v: Viewport, dx: number, dy: number): Viewport {
  return { x0: v.x0 + dx, x1: v.x1 + dx, y0: v.y0 + dy, y1: v.y1 + dy };
}

/**
 * Wie viele Einheiten eine Verschiebung um `clientPx` Bildschirmpunkte ist.
 *
 * Dazwischen liegen zwei Umrechnungen: vom gerenderten Bild auf das viewBox-Maß
 * und von dort auf Einheiten. Ohne die zweite würde bei gezoomtem Ausschnitt
 * zu weit oder zu kurz geschoben.
 */
export function pxToUnits(
  clientPx: number, renderedSize: number, viewBoxSize: number, plotSize: number, span: number,
): number {
  if (!(renderedSize > 0) || !(plotSize > 0)) return 0;
  return clientPx * (viewBoxSize / renderedSize) * (span / plotSize);
}
