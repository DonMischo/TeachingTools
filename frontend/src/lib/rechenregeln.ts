/**
 * Rechenregeln der Klassen 5/6 — Klammern vor Punkt vor Strich, Vertauschen,
 * Stufenzahlen.
 *
 * Für die Simulation »Rechenregeln«. Drei Dinge stecken hier drin:
 *
 *   1. Ein Term wird gelesen und *nicht* auf einen Schlag ausgerechnet,
 *      sondern Schritt für Schritt: `naechster()` sagt, welche Rechnung
 *      als Nächstes dran ist, `anwenden()` macht genau diese eine. So kann
 *      das Bild jeden Zwischenstand zeigen, statt nur das Ergebnis.
 *   2. Der Zug: derselbe Term als Reihe von Waggons, die sich vertauschen
 *      lassen. Getauscht wird naiv — die Zahlen wandern, die Rechenzeichen
 *      bleiben stehen. Genau so merkt man, dass es bei + und · gutgeht und
 *      bei − und : nicht.
 *   3. Stufenzahlen: 3 · 40 wird in 3 · 4 und »eine Stelle nach links«
 *      zerlegt, damit »eine Null anhängen« kein Zauberspruch bleibt. Geteilt
 *      wird dieselbe Rutsche rückwärts (45 : 10 = 4,5), Kommazahlen dabei.
 *
 * Reine Rechnung ohne React, damit sie prüfbar ist.
 */

export class RechenError extends Error {}

export type Op = "+" | "-" | "*" | ":";

export type Node =
  | { k: "num"; v: number }
  | { k: "bin"; op: Op; a: Node; b: Node };

const PREC: Record<Op, number> = { "+": 1, "-": 1, "*": 2, ":": 2 };
const SYM: Record<Op, string> = { "+": "+", "-": "−", "*": "·", ":": ":" };

/** Zahl fürs Auge: ganze Zahlen ganz, sonst Komma statt Punkt. */
export function fmt(v: number): string {
  const gerundet = Math.round(v * 1000) / 1000;
  // Auch das Minus in Schulschreibweise, damit »−5« aussieht wie an der Tafel.
  return String(gerundet).replace("-", "−").replace(".", ",");
}

export function opZeichen(op: Op): string {
  return SYM[op];
}

// ── Lesen ────────────────────────────────────────────────────────────────────

type Tok = { k: "num"; v: number } | { k: "op"; v: Op } | { k: "(" } | { k: ")" };

function tokenize(src: string): Tok[] {
  const s = src.replace(/\s+/g, "");
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (/[0-9]/.test(ch)) {
      let j = i;
      while (j < s.length && /[0-9]/.test(s[j])) j++;
      toks.push({ k: "num", v: Number(s.slice(i, j)) });
      i = j;
      continue;
    }
    i++;
    if (ch === "+") toks.push({ k: "op", v: "+" });
    else if (ch === "-" || ch === "−" || ch === "–") toks.push({ k: "op", v: "-" });
    else if (ch === "*" || ch === "·" || ch === "×") toks.push({ k: "op", v: "*" });
    else if (ch === ":" || ch === "/" || ch === "÷") toks.push({ k: "op", v: ":" });
    else if (ch === "(" || ch === "[") toks.push({ k: "(" });
    else if (ch === ")" || ch === "]") toks.push({ k: ")" });
    else throw new RechenError(`Das Zeichen »${ch}« kenne ich nicht. Erlaubt sind Zahlen, + − · : und Klammern.`);
  }
  return toks;
}

/**
 * Term → Baum.
 *
 * `flach` schaltet Punkt vor Strich ab: dann gelten alle vier Rechenzeichen
 * gleich viel und es wird von links nach rechts gebaut. Damit lässt sich
 * zeigen, was herauskäme, wenn man die Regel nicht kennt.
 */
export function parse(src: string, opts: { flach?: boolean } = {}): Node {
  const toks = tokenize(src);
  if (!toks.length) throw new RechenError("Da steht noch kein Term.");
  let pos = 0;
  const prec = (op: Op) => (opts.flach ? 1 : PREC[op]);

  function primary(): Node {
    const t = toks[pos];
    if (!t) throw new RechenError("Der Term hört mitten in der Rechnung auf.");
    if (t.k === "num") {
      pos++;
      return { k: "num", v: t.v };
    }
    if (t.k === "(") {
      pos++;
      const inner = expr(1);
      if (toks[pos]?.k !== ")") throw new RechenError("Eine Klammer wurde nicht geschlossen.");
      pos++;
      return inner;
    }
    if (t.k === "op") throw new RechenError(`Vor »${SYM[t.v]}« fehlt eine Zahl.`);
    throw new RechenError("Da steht eine Klammer zu viel.");
  }

  function expr(min: number): Node {
    let left = primary();
    for (;;) {
      const t = toks[pos];
      if (!t || t.k !== "op") break;
      const p = prec(t.v);
      if (p < min) break;
      pos++;
      const right = expr(p + 1);
      left = { k: "bin", op: t.v, a: left, b: right };
    }
    return left;
  }

  const baum = expr(1);
  if (pos < toks.length) throw new RechenError("Da steht eine Klammer zu viel.");
  return baum;
}

// ── Schreiben ────────────────────────────────────────────────────────────────

/**
 * Braucht das Kind eine Klammer, damit der geschriebene Term denselben Baum
 * ergibt? Das ist gleichzeitig die Antwort auf »was steht in Klammern« —
 * eine zweite Buchführung über gesetzte Klammern gibt es deshalb nicht.
 */
export function brauchtKlammer(elternOp: Op, seite: "a" | "b", kind: Node): boolean {
  if (kind.k !== "bin") return false;
  const pk = PREC[kind.op];
  const pe = PREC[elternOp];
  if (pk > pe) return false;
  if (pk < pe) return true;
  return seite === "b";
}

export function render(n: Node): string {
  if (n.k === "num") return fmt(n.v);
  const a = brauchtKlammer(n.op, "a", n.a) ? `(${render(n.a)})` : render(n.a);
  const b = brauchtKlammer(n.op, "b", n.b) ? `(${render(n.b)})` : render(n.b);
  return `${a} ${SYM[n.op]} ${b}`;
}

// ── Ausrechnen ───────────────────────────────────────────────────────────────

export function rechne(op: Op, a: number, b: number): number {
  switch (op) {
    case "+": return a + b;
    case "-": return a - b;
    case "*": return a * b;
    case ":":
      if (b === 0) throw new RechenError("Durch 0 kann man nicht teilen.");
      return a / b;
  }
}

export function wert(n: Node): number {
  if (n.k === "num") return n.v;
  return rechne(n.op, wert(n.a), wert(n.b));
}

/** Was herauskäme, wenn man stur von links nach rechts rechnet. */
export function wertVonLinks(src: string): number {
  return wert(parse(src, { flach: true }));
}

// ── Wege durch den Baum ──────────────────────────────────────────────────────

/** Ein Pfad ist die Folge der Abzweigungen, z. B. "ab" = links, dann rechts. */
export type Pfad = string;

export function knotenAn(n: Node, pfad: Pfad): Node {
  let cur = n;
  for (const s of pfad) {
    if (cur.k !== "bin") throw new RechenError("Diesen Teilterm gibt es nicht.");
    cur = s === "a" ? cur.a : cur.b;
  }
  return cur;
}

function ersetzeAn(n: Node, pfad: Pfad, neu: Node): Node {
  if (!pfad.length) return neu;
  if (n.k !== "bin") throw new RechenError("Diesen Teilterm gibt es nicht.");
  const [kopf, ...rest] = pfad;
  const restPfad = rest.join("");
  return kopf === "a"
    ? { ...n, a: ersetzeAn(n.a, restPfad, neu) }
    : { ...n, b: ersetzeAn(n.b, restPfad, neu) };
}

// ── Schritt für Schritt ──────────────────────────────────────────────────────

export type Kandidat = {
  pfad: Pfad;
  op: Op;
  a: number;
  b: number;
  ergebnis: number;
  /** In wie vielen Klammern steht diese Rechnung? */
  tiefe: number;
  /** Stelle im Term, von links gezählt — entscheidet bei Gleichstand. */
  stelle: number;
};

/**
 * Alle Rechnungen, die jetzt drankommen könnten (beide Zahlen stehen schon
 * da) — in der Reihenfolge, in der man sie machen soll: erst die innerste
 * Klammer, dann Punkt vor Strich, bei Gleichstand von links nach rechts.
 */
export function kandidaten(root: Node): Kandidat[] {
  const out: Kandidat[] = [];
  let stelle = 0;
  const geh = (n: Node, pfad: Pfad, tiefe: number) => {
    if (n.k !== "bin") return;
    geh(n.a, pfad + "a", tiefe + (brauchtKlammer(n.op, "a", n.a) ? 1 : 0));
    const eigene = stelle++;
    if (n.a.k === "num" && n.b.k === "num") {
      out.push({
        pfad, op: n.op, a: n.a.v, b: n.b.v,
        ergebnis: rechne(n.op, n.a.v, n.b.v),
        tiefe, stelle: eigene,
      });
    }
    geh(n.b, pfad + "b", tiefe + (brauchtKlammer(n.op, "b", n.b) ? 1 : 0));
  };
  geh(root, "", 0);
  return out.sort((x, y) =>
    y.tiefe - x.tiefe || PREC[y.op] - PREC[x.op] || x.stelle - y.stelle);
}

export function naechster(root: Node): Kandidat | null {
  return kandidaten(root)[0] ?? null;
}

/** Genau eine Rechnung ausführen — die an diesem Pfad. */
export function anwenden(root: Node, pfad: Pfad): Node {
  const n = knotenAn(root, pfad);
  if (n.k !== "bin" || n.a.k !== "num" || n.b.k !== "num") {
    throw new RechenError("Hier stehen noch nicht beide Zahlen fest.");
  }
  return ersetzeAn(root, pfad, { k: "num", v: rechne(n.op, n.a.v, n.b.v) });
}

export type Schritt = { vorher: string; kandidat: Kandidat; nachher: string };

/** Der ganze Rechenweg — vor allem fürs Prüfen und für die Hilfe. */
export function alleSchritte(root: Node): Schritt[] {
  const out: Schritt[] = [];
  let cur = root;
  for (let i = 0; i < 40; i++) {
    const k = naechster(cur);
    if (!k) break;
    const vorher = render(cur);
    cur = anwenden(cur, k.pfad);
    out.push({ vorher, kandidat: k, nachher: render(cur) });
  }
  return out;
}

/** Alle Rechenzeichen des Terms samt Klammertiefe — auch die, die warten. */
function alleOperationen(root: Node): { pfad: Pfad; op: Op; tiefe: number }[] {
  const out: { pfad: Pfad; op: Op; tiefe: number }[] = [];
  const geh = (n: Node, pfad: Pfad, tiefe: number) => {
    if (n.k !== "bin") return;
    out.push({ pfad, op: n.op, tiefe });
    geh(n.a, pfad + "a", tiefe + (brauchtKlammer(n.op, "a", n.a) ? 1 : 0));
    geh(n.b, pfad + "b", tiefe + (brauchtKlammer(n.op, "b", n.b) ? 1 : 0));
  };
  geh(root, "", 0);
  return out;
}

/**
 * Begründung für den nächsten Schritt — das »warum jetzt der«.
 *
 * Verglichen wird mit dem, was sonst noch im Term steht: gegen eine Rechnung
 * ausserhalb der Klammer gewinnt die Klammer, gegen ein + gewinnt der Punkt,
 * und unter Gleichen gewinnt der linke.
 */
export function begruendung(root: Node, k: Kandidat): string {
  const andere = alleOperationen(root).filter(c => c.pfad !== k.pfad);
  if (andere.some(c => c.tiefe < k.tiefe)) return "Klammer zuerst";
  const bereit = kandidaten(root).filter(c => c.pfad !== k.pfad);
  if (bereit.some(c => c.tiefe === k.tiefe && PREC[c.op] === PREC[k.op])) return "von links nach rechts";
  if (andere.some(c => c.tiefe === k.tiefe && PREC[c.op] < PREC[k.op])) return "Punkt vor Strich";
  return "letzter Schritt";
}

// ── Aufgaben würfeln ─────────────────────────────────────────────────────────

const zufall = (min: number, max: number) => min + Math.floor(Math.random() * (max - min + 1));
const eines = <T,>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)];

/**
 * Taugt der Term fürs Bild? Nur ganze Zahlen, nichts Negatives und nichts,
 * was sich nicht mehr als Obst hinlegen lässt.
 */
export function istKindgerecht(n: Node, max = 60): boolean {
  try {
    let cur = n;
    for (;;) {
      const k = naechster(cur);
      if (!k) break;
      if (!Number.isInteger(k.ergebnis) || k.ergebnis < 0 || k.ergebnis > max) return false;
      cur = anwenden(cur, k.pfad);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Vier Stufen für den Obstkorb: erst Punkt vor Strich, dann Klammern.
 *
 * `nicht` ist die Aufgabe, die gerade dasteht — sie kommt nicht noch einmal.
 * Sonst wirkt der Würfelknopf manchmal kaputt, obwohl er gewürfelt hat.
 */
export function wuerfelnTerm(stufe: number, nicht?: string): string {
  for (let versuch = 0; versuch < 200; versuch++) {
    const a = zufall(2, 9), b = zufall(2, 5), c = zufall(2, 6), d = zufall(2, 5);
    const src = (() => {
      switch (stufe) {
        case 1:
          return eines([`${a} + ${b} · ${c}`, `${b} · ${c} + ${a}`]);
        case 2:
          return eines([`${a} · ${b} + ${c} · ${d}`, `${b} · ${c} − ${a}`, `${b * c} : ${c} + ${a}`]);
        case 3:
          return eines([`(${a} + ${b}) · ${c}`, `${c} · (${a} + ${b})`, `(${a} − ${b}) · ${c}`]);
        default:
          return eines([
            `${a} + (${b} + ${c}) · ${d}`,
            `(${a} + ${b}) · ${c} − ${d}`,
            `${a} · ${b} − (${c} + ${d})`,
            `(${a} + ${b}) · (${c} + ${d})`,
          ]);
      }
    })();
    const baum = parse(src);
    // Ohne Vorzeichenwechsel und ohne Riesenmengen — und der Term muss die
    // Regel auch wirklich brauchen: wo links-nach-rechts dasselbe ergibt,
    // lernt niemand etwas.
    if (!istKindgerecht(baum, stufe >= 3 ? 60 : 40)) continue;
    if (stufe <= 2 && wertVonLinks(src) === wert(baum)) continue;
    if (src === nicht) continue;
    return src;
  }
  return "2 + 3 · 4";
}

// ── Der Zug ──────────────────────────────────────────────────────────────────

/**
 * Ein Term ohne Klammern als Reihe: Zahlen sind Waggons, Rechenzeichen die
 * Kupplungen dazwischen. · und : kuppeln fest (die Waggons gehören zusammen),
 * + und − lose.
 */
export type Zug = { zahlen: number[]; ops: Op[] };

export function zugAusTerm(src: string): Zug {
  if (/[()[\]]/.test(src)) throw new RechenError("Der Zug fährt ohne Klammern — nimm einen Term ohne sie.");
  const toks = tokenize(src);
  const zahlen: number[] = [];
  const ops: Op[] = [];
  toks.forEach((t, i) => {
    if (i % 2 === 0) {
      if (t.k !== "num") throw new RechenError("Zwischen zwei Rechenzeichen fehlt eine Zahl.");
      zahlen.push(t.v);
    } else {
      if (t.k !== "op") throw new RechenError("Zwischen zwei Zahlen fehlt ein Rechenzeichen.");
      ops.push(t.v);
    }
  });
  if (zahlen.length !== ops.length + 1) throw new RechenError("Der Term hört mitten in der Rechnung auf.");
  if (zahlen.length < 2) throw new RechenError("Ein Zug braucht mindestens zwei Waggons.");
  return { zahlen, ops };
}

export function zugTerm(z: Zug): string {
  return z.zahlen.map((v, i) => (i ? ` ${SYM[z.ops[i - 1]]} ${fmt(v)}` : fmt(v))).join("");
}

export function zugWert(z: Zug): number {
  return wert(parse(zugTerm(z)));
}

/** Die fest gekuppelten Blöcke — jeder Block ist eine Folge von Indizes. */
export function gruppen(z: Zug): number[][] {
  const out: number[][] = [[0]];
  z.ops.forEach((op, i) => {
    if (op === "*" || op === ":") out[out.length - 1].push(i + 1);
    else out.push([i + 1]);
  });
  return out;
}

/** Zwei Waggons tauschen die Plätze. Die Rechenzeichen bleiben stehen. */
export function tauscheZahlen(z: Zug, i: number, j: number): Zug {
  const zahlen = [...z.zahlen];
  [zahlen[i], zahlen[j]] = [zahlen[j], zahlen[i]];
  return { zahlen, ops: [...z.ops] };
}

/**
 * Zwei benachbarte Blöcke tauschen die Plätze. Die feste Kupplung *im* Block
 * fährt mit, die lose Kupplung zwischen den Blöcken bleibt liegen.
 */
export function tauscheGruppen(z: Zug, gi: number, gj: number): Zug {
  const gs = gruppen(z);
  if (Math.abs(gi - gj) !== 1) throw new RechenError("Nur Nachbarn können die Plätze tauschen.");
  const [links, rechts] = gi < gj ? [gs[gi], gs[gj]] : [gs[gj], gs[gi]];
  const a0 = links[0], a1 = links[links.length - 1];
  const b0 = rechts[0], b1 = rechts[rechts.length - 1];

  const zahlen = [
    ...z.zahlen.slice(0, a0),
    ...z.zahlen.slice(b0, b1 + 1),
    ...z.zahlen.slice(a0, a1 + 1),
    ...z.zahlen.slice(b1 + 1),
  ];
  const ops = [
    ...z.ops.slice(0, a0),
    ...z.ops.slice(b0, b1),   // feste Kupplungen des rechten Blocks
    z.ops[a1],                // die lose Kupplung dazwischen bleibt
    ...z.ops.slice(a0, a1),   // feste Kupplungen des linken Blocks
    ...z.ops.slice(b1),
  ];
  return { zahlen, ops };
}

/** Vier Stufen für den Zug: erst nur + und ·, dann − und :. */
export function wuerfelnZug(stufe: number, nicht?: string): string {
  for (let versuch = 0; versuch < 200; versuch++) {
    const a = zufall(2, 9), b = zufall(2, 6), c = zufall(2, 9), d = zufall(2, 5);
    const src = (() => {
      switch (stufe) {
        case 1: return eines([`${a} + ${b} + ${c}`, `${a} · ${b} + ${c}`, `${a} + ${b} · ${c}`]);
        case 2: return eines([`${a} − ${b} + ${c}`, `${a} + ${b} − ${c}`, `${a} · ${b} − ${c}`]);
        case 3: return eines([`${a * b} : ${b} + ${c}`, `${a} + ${b * d} : ${d}`, `${a * b} : ${a} · ${d}`]);
        default: return eines([`${a} · ${b} + ${c} · ${d}`, `${a} + ${b} · ${c} − ${d}`, `${a * b} : ${b} + ${c} · ${d}`]);
      }
    })();
    if (src !== nicht && istKindgerecht(parse(src), 99)) return src;
  }
  return "3 · 4 + 5";
}

// ── Stufenzahlen ─────────────────────────────────────────────────────────────

/** Mal oder geteilt — die Rutsche geht in beide Richtungen. */
export type Rechenart = "*" | ":";

export type Zerlegung = {
  art: Rechenart;
  a: number; b: number;
  /** Die Zahlen ohne ihre Nullen und ohne Komma — der Teil fürs kleine Einmaleins. */
  kernA: number; kernB: number;
  /** Wie weit jede Zahl selbst schon verschoben ist: 40 = 4 · 10¹, 0,3 = 3 · 10⁻¹. */
  stellenA: number; stellenB: number;
  /** So weit rutscht das Ergebnis: positiv nach links, negativ nach rechts. */
  stellen: number;
  kern: number;
  ergebnis: number;
};

/**
 * Eine Zahl als »Kern mal Zehnerpotenz«: 40 → 4 · 10¹, 0,05 → 5 · 10⁻².
 *
 * Über den Dezimalstring und nicht über Logarithmen oder `* 10 ** n`: sonst
 * wird aus 1,1 · 100 die 110,00000000000001, und die Tafel zeigt Staub.
 */
export function zerlegeZahl(v: number): { kern: number; stellen: number } {
  if (!Number.isFinite(v)) throw new RechenError("Das ist keine Zahl.");
  if (v === 0) return { kern: 0, stellen: 0 };
  const vorzeichen = v < 0 ? -1 : 1;
  let ziffern = String(Math.abs(v));
  if (ziffern.includes("e")) throw new RechenError("Diese Zahl ist zu groß oder zu klein.");
  let stellen = 0;
  const punkt = ziffern.indexOf(".");
  if (punkt >= 0) {
    stellen = -(ziffern.length - punkt - 1);
    ziffern = ziffern.slice(0, punkt) + ziffern.slice(punkt + 1);
  }
  let kern = Number(ziffern);
  while (kern !== 0 && kern % 10 === 0) { kern /= 10; stellen++; }
  return { kern: vorzeichen * kern, stellen };
}

/** Eine Zahl um `stellen` Zehnerpotenzen verschieben — ohne Rundungsstaub. */
export function rutsche(v: number, stellen: number): number {
  if (v === 0) return 0;
  const z = zerlegeZahl(v);
  return Number(`${z.kern}e${z.stellen + stellen}`);
}

/** Genau multiplizieren — über die Kerne, aus demselben Grund wie `rutsche`. */
function mal(x: number, y: number): number {
  const zx = zerlegeZahl(x), zy = zerlegeZahl(y);
  return rutsche(zx.kern * zy.kern, zx.stellen + zy.stellen);
}

function ggt(a: number, b: number): number {
  return b === 0 ? a : ggt(b, a % b);
}

/** Geht a : b als Dezimalzahl auf? Nur, wenn im gekürzten Nenner nur 2 und 5 stecken. */
function gehtGlattAuf(a: number, b: number): boolean {
  if (a === 0) return true;
  let n = Math.abs(b) / ggt(Math.abs(a), Math.abs(b));
  while (n % 2 === 0) n /= 2;
  while (n % 5 === 0) n /= 5;
  return n === 1;
}

/**
 * Eine Stufenaufgabe zerlegen — mal oder geteilt.
 *
 * Beides ist dieselbe Rutsche, nur in verschiedene Richtungen: bei · zählen
 * sich die Verschiebungen zusammen (3 · 40 = 12, eine Stelle nach links), bei :
 * ziehen sie sich ab (45 : 10 = 45, eine Stelle nach rechts → 4,5). Deshalb
 * ist `stellen` vorzeichenbehaftet und nicht mehr eine Anzahl Nullen.
 */
export function zerlegeStufen(a: number, b: number, art: Rechenart = "*"): Zerlegung {
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 0) {
    throw new RechenError("Nimm zwei Zahlen ab 0.");
  }
  if (art === ":" && b === 0) throw new RechenError("Durch 0 kann man nicht teilen.");
  const za = zerlegeZahl(a), zb = zerlegeZahl(b);
  if (art === ":" && !gehtGlattAuf(za.kern, zb.kern)) {
    throw new RechenError("Das geht nicht glatt auf — nimm eine Aufgabe ohne Rest.");
  }
  const kern = art === "*" ? za.kern * zb.kern : za.kern / zb.kern;
  const stellen = art === "*" ? za.stellen + zb.stellen : za.stellen - zb.stellen;
  return {
    art, a, b,
    kernA: za.kern, kernB: zb.kern,
    stellenA: za.stellen, stellenB: zb.stellen,
    stellen, kern,
    ergebnis: rutsche(kern, stellen),
  };
}

/** Die Stellen der Tafel, von der Million bis zum Tausendstel. */
export const STELLEN_NAMEN: Record<number, string> = {
  6: "M", 5: "HT", 4: "ZT", 3: "T", 2: "H", 1: "Z", 0: "E",
  "-1": "z", "-2": "h", "-3": "t",
};
export const STELLE_MAX = 6;
export const STELLE_MIN = -3;

/**
 * Die Ziffern einer Zahl auf die Stellenwerttafel — eine Spalte je
 * Zehnerpotenz, von `von` (links) bis `bis` (rechts).
 *
 * Geschrieben wird genau so viel, wie man auch ins Heft schreibt: von der
 * höchsten Ziffer bis zum Einer und, bei Kommazahlen, weiter bis zur letzten
 * Nachkommastelle. Die 0 in der 120 gehört also dazu, die in der 0,45 auch —
 * die Spalten davor und danach bleiben leer.
 */
export function ziffernNachStellen(v: number, von: number, bis: number): string[] {
  const { kern, stellen } = zerlegeZahl(v);
  const ziffern = String(Math.abs(kern));
  const hoechste = stellen + ziffern.length - 1;
  const oben = Math.max(hoechste, 0);
  const unten = Math.min(stellen, 0);
  const out: string[] = [];
  for (let e = von; e >= bis; e--) {
    if (e > oben || e < unten) { out.push(""); continue; }
    const i = hoechste - e;
    out.push(i >= 0 && i < ziffern.length ? ziffern[i] : "0");
  }
  return out;
}

/** Der Spaltenbereich, in den alle genannten Zahlen passen — der Einer immer dabei. */
export function tafelBereich(...zahlen: number[]): { von: number; bis: number } {
  let von = 0, bis = 0;
  for (const v of zahlen) {
    if (v === 0) continue;
    const { kern, stellen } = zerlegeZahl(v);
    von = Math.max(von, stellen + String(Math.abs(kern)).length - 1);
    bis = Math.min(bis, stellen);
  }
  return { von: Math.min(von, STELLE_MAX), bis: Math.max(bis, STELLE_MIN) };
}

/**
 * Die Stellen, die durch das Rutschen neu dazukommen: beim Rutschen nach links
 * die angehängten Nullen (Einer aufwärts), nach rechts die frisch geöffneten
 * Nachkommastellen. Genau die dürfen auf der Tafel leuchten.
 */
export function neueStellen(stellen: number): number[] {
  if (stellen > 0) return Array.from({ length: stellen }, (_, i) => i);
  if (stellen < 0) return Array.from({ length: -stellen }, (_, i) => -1 - i);
  return [];
}

export type StufenModus = "frei" | "komma" | "10" | "100" | "1000" | "10000";

/**
 * Aufgaben für die Rutsche. Die Nullen hängen immer an der *zweiten* Zahl —
 * an ihr liest man ab, wie weit gerutscht wird.
 *
 * »Frei« würfelt Zehner-, Hunderter- und Tausenderzahlen (40, 500, 2000):
 * dort gibt es beides, ein kleines Einmaleins und eine Rutsche. »Komma« nimmt
 * Zehntel und Hundertstel dazu (0,3 · 400 = 120). Die festen Stufen legen die
 * zweite Zahl auf genau 10, 100, 1000 oder 10000 fest — dann wird gar nichts
 * gerechnet, dann rutscht nur, und die erste Zahl darf mehrstellig sein.
 *
 * Beim Teilen muss die Aufgabe aufgehen. Durch eine reine Stufenzahl geht sie
 * das immer (45 : 100 = 0,45), sonst wird sie vom Ergebnis her gebaut:
 * a = Ergebnis · b.
 */
export function wuerfelnStufen(
  modus: StufenModus, art: Rechenart = "*", nicht?: [number, number],
): [number, number] {
  const fest = modus !== "frei" && modus !== "komma";
  for (let versuch = 0; versuch < 200; versuch++) {
    const b = fest ? Number(modus) : zufall(2, 9) * 10 ** zufall(1, 3);
    const klein = modus === "komma"
      ? rutsche(zufall(2, 9), -zufall(1, 2))
      : fest ? zufall(2, 99) : zufall(2, 9);
    const paar: [number, number] = art === "*" || fest ? [klein, b] : [mal(klein, b), b];
    if (paar[0] > 10 ** STELLE_MAX) continue;
    if (nicht && paar[0] === nicht[0] && paar[1] === nicht[1]) continue;
    return paar;
  }
  return art === "*" ? [3, 40] : [120, 40];
}

/** Eine getippte Zahl lesen — Komma wie an der Tafel, ein Punkt geht auch. */
export function zahlAusText(s: string): number | null {
  const t = s.trim().replace(/[−–]/g, "-").replace(",", ".");
  if (t === "" || !/^-?(\d+\.?\d*|\.\d+)$/.test(t)) return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}
