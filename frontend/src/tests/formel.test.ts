import { describe, it, expect } from "vitest";
import {
  applyFOp, evalExpr, formatExpr, formatFeq, formatFOp, initialValues, isolated,
  monoKey, num, parseFormel, PRESETS, simplifyExpr, solveFor, suggestFOps, varMono, varsOf,
  type Feq,
} from "@/lib/formel";

const parse = (s: string): Feq => {
  const r = parseFormel(s);
  if (!r.ok) throw new Error(`${s}: ${r.error}`);
  return r.eq;
};

describe("parseFormel", () => {
  it("liest ein Produkt", () => {
    expect(formatFeq(parse("F = m·a"))).toBe("F = m·a");
    expect(formatFeq(parse("F = ma"))).toBe("F = m·a"); // ohne Malpunkt
    expect(formatFeq(parse("F = m * a"))).toBe("F = m·a");
  });

  it("liest einen Bruch", () => {
    const eq = parse("p = F/A");
    expect(eq.right[0].v).toEqual({ F: 1, A: -1 });
    expect(formatFeq(eq)).toBe("p = F/A");
  });

  it("liest Hochzahlen", () => {
    expect(formatFeq(parse("E = 0,5·m·v^2"))).toBe("E = 0,5·m·v²");
    expect(formatFeq(parse("A = r²"))).toBe("A = r²");
  });

  it("multipliziert Klammern gleich aus", () => {
    expect(formatFeq(parse("U = R·(I1 + I2)"))).toBe("U = R·I1 + R·I2");
  });

  it("kennt Variablen mit Index", () => {
    expect(varsOf(parse("s = v·t + s0"))).toEqual(["s", "v", "t", "s0"]);
  });

  it("meldet Fehler statt zu raten", () => {
    expect(parseFormel("F = m·a·")).toMatchObject({ ok: false });
    expect(parseFormel("F m a")).toMatchObject({ ok: false });
    expect(parseFormel("3 = 4")).toMatchObject({ ok: false });
    expect(parseFormel("y = 1/(a+b)")).toMatchObject({ ok: false });
  });
});

describe("simplifyExpr", () => {
  it("fasst gleichartige Monome zusammen", () => {
    expect(formatExpr(simplifyExpr([varMono("a"), varMono("a"), num(3)]))).toBe("2·a + 3");
  });
  it("unterscheidet a·b von a", () => {
    expect(monoKey({ c: 1, v: { a: 1, b: 1 } })).not.toBe(monoKey(varMono("a")));
  });
});

describe("Äquivalenzumformungen mit Variablen", () => {
  it("teilt durch eine Variable", () => {
    const eq = applyFOp(parse("F = m·a"), { op: "div", m: varMono("a") });
    expect(formatFeq(eq)).toBe("F/a = m");
    expect(isolated(eq, "m")).toBe(true);
  });

  it("multipliziert einen Nenner weg", () => {
    const eq = applyFOp(parse("p = F/A"), { op: "mul", m: varMono("A") });
    expect(formatFeq(eq)).toBe("p·A = F");
  });

  it("stellt Schritt für Schritt um", () => {
    let eq = parse("s = v·t + s0");
    eq = applyFOp(eq, { op: "add", m: varMono("s0", 1, -1) });
    expect(formatFeq(eq)).toBe("s − s0 = v·t");
    eq = applyFOp(eq, { op: "div", m: varMono("t") });
    expect(formatFeq(eq)).toBe("s/t − s0/t = v");
    expect(isolated(eq, "v")).toBe(true);
  });

  it("ändert den Wert der gesuchten Größe nicht", () => {
    const values = { F: 12, a: 3, m: null };
    let eq = parse("F = m·a");
    const before = solveFor(eq, "m", values);
    eq = applyFOp(eq, { op: "div", m: varMono("a") });
    expect(solveFor(eq, "m", values)).toBe(before);
    expect(before).toBe(4);
  });
});

describe("solveFor", () => {
  it("löst nach einem Faktor auf", () => {
    expect(solveFor(parse("F = m·a"), "m", { F: 12, a: 3, m: null })).toBe(4);
  });
  it("löst nach einem Nenner auf", () => {
    expect(solveFor(parse("p = F/A"), "A", { p: 3, F: 12, A: null })).toBe(4);
  });
  it("zieht die Wurzel", () => {
    expect(solveFor(parse("A = r^2"), "r", { A: 9, r: null })).toBe(3);
  });
  it("löst mit Summand", () => {
    expect(solveFor(parse("s = v·t + s0"), "v", { s: 14, t: 3, s0: 2, v: null })).toBe(4);
  });
  it("gibt null zurück, statt zu raten", () => {
    expect(solveFor(parse("y = x^2 + x"), "x", { y: 6, x: null })).toBeNull(); // gemischte Potenzen
    expect(solveFor(parse("F = m·a"), "m", { F: 12, a: null, m: null })).toBeNull(); // Wert fehlt
    expect(solveFor(parse("A = r^2"), "r", { A: -9, r: null })).toBeNull(); // keine reelle Lösung
  });
});

describe("suggestFOps", () => {
  it("schlägt das Teilen durch den Mitfaktor vor", () => {
    expect(suggestFOps(parse("F = m·a"), "m").map(formatFOp)).toContain(": a");
  });
  it("räumt erst den Summanden weg", () => {
    const labels = suggestFOps(parse("s = v·t + s0"), "v").map(formatFOp);
    expect(labels).toContain("− s0");
    expect(labels).toContain(": t");
  });
  it("holt die Größe aus dem Nenner", () => {
    expect(suggestFOps(parse("p = F/A"), "A").map(formatFOp)).toContain("· A");
  });
  it("führt jede Vorlage ans Ziel", () => {
    for (const p of PRESETS) {
      const eq0 = parse(p.formel);
      const values = initialValues(eq0, p.target, p.values);
      const want = solveFor(eq0, p.target, values);
      expect(want).not.toBeNull();
      let eq = eq0;
      for (let step = 0; step < 6 && !isolated(eq, p.target); step++) {
        const ops = suggestFOps(eq, p.target);
        expect(ops.length).toBeGreaterThan(0);
        eq = applyFOp(eq, ops[ops.length - 1]);
      }
      expect(isolated(eq, p.target)).toBe(true);
      // Die freigestellte Seite liefert denselben Wert.
      const free = isolated(eq, p.target) && eq.left.length === 1 && eq.left[0].v[p.target] ? eq.right : eq.left;
      expect(evalExpr(free, values)).toBeCloseTo(want as number, 6);
    }
  });
});

describe("initialValues", () => {
  it("lässt die gesuchte Größe leer und füllt den Rest", () => {
    const eq = parse("F = m·a");
    const v = initialValues(eq, "m", { F: 12, a: 3 });
    expect(v).toEqual({ F: 12, m: null, a: 3 });
  });
});
