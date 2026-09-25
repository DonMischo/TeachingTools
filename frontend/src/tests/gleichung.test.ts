import { describe, it, expect } from "vitest";
import {
  applyOp, coeffs, evalSide, expandSide, formatEquation, formatOp, formatSide,
  generateTask, hasPairs, isSolved, outerCoeffs, parseEquation, putOn, simplify, solve, suggestions, takeOff,
  type Equation, type Side,
} from "@/lib/gleichung";

const parse = (s: string): Equation => {
  const r = parseEquation(s);
  if (!r.ok) throw new Error(`${s}: ${r.error}`);
  return r.eq;
};

describe("parseEquation", () => {
  it("liest eine einfache Gleichung", () => {
    const eq = parse("3x + 4 = x + 10");
    expect(coeffs(eq.left)).toEqual({ x: 3, c: 4 });
    expect(coeffs(eq.right)).toEqual({ x: 1, c: 10 });
  });

  it("behält die Klammer als eigenen Term", () => {
    const eq = parse("2(x + 3) = 14");
    expect(eq.left).toEqual([{ t: "g", k: 2, x: 1, c: 3 }]);
    expect(outerCoeffs(eq.left)).toEqual({ x: 0, c: 0 });
    expect(coeffs(eq.left)).toEqual({ x: 2, c: 6 });
  });

  it("versteht ·, ×, : und typografisches Minus", () => {
    expect(formatEquation(parse("2·(x − 1) = 6"))).toBe("2·(x − 1) = 6");
    expect(coeffs(parse("x = 6:2").right)).toEqual({ x: 0, c: 3 });
  });

  it("nimmt Minus vor der Klammer", () => {
    expect(coeffs(parse("10 - 2(x + 1) = 0").left)).toEqual({ x: -2, c: 8 });
  });

  it("meldet Fehler statt zu raten", () => {
    expect(parseEquation("3x + 4")).toMatchObject({ ok: false });
    expect(parseEquation("3y = 4")).toMatchObject({ ok: false });
    expect(parseEquation("2(x + 3 = 4")).toMatchObject({ ok: false });
    expect(parseEquation("4 = 4")).toMatchObject({ ok: false });
    expect(parseEquation("x = 1 = 2")).toMatchObject({ ok: false });
  });
});

describe("simplify", () => {
  it("fasst gleichartige Terme zusammen, Klammern zuerst", () => {
    const side = simplify([
      { t: "n", n: 4 },
      { t: "x", n: 3 },
      { t: "g", k: 2, x: 1, c: 1 },
      { t: "x", n: -1 },
    ]);
    expect(side).toEqual([{ t: "g", k: 2, x: 1, c: 1 }, { t: "x", n: 2 }, { t: "n", n: 4 }]);
  });

  it("lässt die 0 stehen, wenn nichts übrig bleibt", () => {
    expect(simplify([{ t: "n", n: 4 }, { t: "n", n: -4 }])).toEqual([{ t: "n", n: 0 }]);
  });
});

describe("Äquivalenzumformungen", () => {
  it("subtrahiert auf beiden Seiten", () => {
    const eq = applyOp(parse("3x + 4 = x + 10"), { op: "add", kind: "n", n: -4 });
    expect(formatEquation(eq)).toBe("3x = x + 6");
  });

  it("nimmt x von beiden Seiten", () => {
    const eq = applyOp(parse("3x + 4 = x + 10"), { op: "add", kind: "x", n: -1 });
    expect(formatEquation(eq)).toBe("2x + 4 = 10");
  });

  it("teilt beide Seiten", () => {
    const eq = applyOp(parse("2x = 6"), { op: "div", n: 2 });
    expect(formatEquation(eq)).toBe("x = 3");
    expect(isSolved(eq)).toBe(3);
  });

  it("teilt auch krumm", () => {
    expect(formatEquation(applyOp(parse("2x = 5"), { op: "div", n: 2 }))).toBe("x = 2,5");
  });

  it("löst die Klammer auf", () => {
    const eq = applyOp(parse("2(x + 3) = 14"), { op: "expand" });
    expect(formatEquation(eq)).toBe("2x + 6 = 14");
  });

  it("teilt eine Klammer, ohne sie aufzulösen", () => {
    const eq = applyOp(parse("2(x + 3) = 14"), { op: "div", n: 2 });
    expect(formatEquation(eq)).toBe("(x + 3) = 7");
  });

  it("ändert die Lösung nie", () => {
    let eq = parse("3(x + 2) = x + 12");
    const before = solve(eq);
    for (const op of [
      { op: "expand" } as const,
      { op: "add", kind: "x", n: -1 } as const,
      { op: "add", kind: "n", n: -6 } as const,
      { op: "div", n: 2 } as const,
    ]) {
      eq = applyOp(eq, op);
      expect(solve(eq)).toEqual(before);
    }
    expect(isSolved(eq)).toBe(3);
  });
});

describe("solve", () => {
  it("findet die eindeutige Lösung", () => {
    expect(solve(parse("3x + 4 = x + 10"))).toEqual({ kind: "one", x: 3 });
  });
  it("erkennt eine unlösbare Gleichung", () => {
    expect(solve(parse("x + 1 = x + 2"))).toEqual({ kind: "none" });
  });
  it("erkennt unendlich viele Lösungen", () => {
    expect(solve(parse("2(x + 1) = 2x + 2"))).toEqual({ kind: "all" });
  });
});

describe("evalSide — die Last in der Schale", () => {
  it("ist bei der Lösung auf beiden Seiten gleich", () => {
    const eq = parse("2(x + 3) = 4x - 2");
    const sol = solve(eq);
    if (sol.kind !== "one") throw new Error("erwartet: eine Lösung");
    expect(evalSide(eq.left, sol.x)).toBe(evalSide(eq.right, sol.x));
  });
});

describe("formatSide", () => {
  it("schreibt wie im Heft", () => {
    expect(formatSide([{ t: "x", n: 1 }])).toBe("x");
    expect(formatSide([{ t: "x", n: -1 }, { t: "n", n: -4 }])).toBe("−x − 4");
    expect(formatSide([{ t: "g", k: 1, x: 1, c: -3 }])).toBe("(x − 3)");
    expect(formatSide([{ t: "g", k: -2, x: 2, c: 0 }])).toBe("−2·(2x)");
  });

  it("beschriftet die Umformung", () => {
    expect(formatOp({ op: "add", kind: "n", n: -4 })).toBe("− 4");
    expect(formatOp({ op: "add", kind: "x", n: -1 })).toBe("− x");
    expect(formatOp({ op: "div", n: 2 })).toBe(": 2");
    expect(formatOp({ op: "expand" })).toBe("Klammern auflösen");
  });
});

describe("suggestions", () => {
  it("bietet beide Wege bei einer Klammer an", () => {
    const labels = suggestions(parse("2(x + 3) = 14")).map(formatOp);
    expect(labels).toContain("Klammern auflösen");
    expect(labels).toContain(": 2");
  });

  it("bietet an, was wirklich dasteht", () => {
    const labels = suggestions(parse("3x + 4 = x + 10")).map(formatOp);
    expect(labels).toEqual(expect.arrayContaining(["− 4", "− 3x", "− 10", "− x"]));
  });

  it("bietet das Teilen erst am Ende an", () => {
    expect(suggestions(parse("2x + 1 = 7")).map(formatOp)).not.toContain(": 2");
    expect(suggestions(parse("2x = 6")).map(formatOp)).toContain(": 2");
  });

  it("bietet in jeder Situation mindestens einen legalen Schritt an", () => {
    for (const level of [1, 2, 3, 4]) {
      for (let i = 0; i < 40; i++) {
        let eq = generateTask(level);
        for (let step = 0; step < 8 && isSolved(eq) === null; step++) {
          const next = suggestions(eq);
          expect(next.length).toBeGreaterThan(0);
          // Der Weg „von außen nach innen": der letzte Vorschlag ist stets legal.
          eq = applyOp(eq, next[next.length - 1]);
        }
      }
    }
  });
});

describe("generateTask", () => {
  it("erzeugt lösbare Aufgaben mit ganzzahliger Lösung", () => {
    for (const level of [1, 2, 3, 4]) {
      for (let i = 0; i < 50; i++) {
        const eq = generateTask(level);
        const sol = solve(eq);
        expect(sol.kind).toBe("one");
        if (sol.kind === "one") {
          expect(Number.isInteger(sol.x)).toBe(true);
          expect(sol.x).toBeGreaterThanOrEqual(1);
        }
        expect(isSolved(eq)).toBeNull();
      }
    }
  });

  it("baut in Stufe 4 immer eine Klammer ein", () => {
    for (let i = 0; i < 30; i++) {
      const eq = generateTask(4);
      expect(eq.left.some(t => t.t === "g")).toBe(true);
      expect(expandSide(eq.left).some(t => t.t === "g")).toBe(false);
    }
  });
});

describe("von Hand legen", () => {
  it("putOn legt Gewicht und Feder nebeneinander", () => {
    const s = putOn([{ t: "x", n: 3 }, { t: "n", n: 4 }], "n", -1);
    expect(s).toEqual([{ t: "x", n: 3 }, { t: "n", n: 4 }, { t: "n", n: -1 }]);
    expect(hasPairs(s)).toBe(true);
    expect(putOn(s, "n", 1)).toEqual([{ t: "x", n: 3 }, { t: "n", n: 5 }, { t: "n", n: -1 }]);
    expect(formatSide(s)).toBe("3x + 4 − 1");
  });

  it("putOn ersetzt die leere Seite", () => {
    expect(putOn([{ t: "n", n: 0 }], "x", 1)).toEqual([{ t: "x", n: 1 }]);
  });

  it("takeOff nimmt nur Teile mit passendem Vorzeichen", () => {
    const s: Side = [{ t: "n", n: 4 }, { t: "n", n: -1 }];
    expect(takeOff(s, "n", false)).toEqual([{ t: "n", n: 3 }, { t: "n", n: -1 }]);
    expect(takeOff(s, "n", true)).toEqual([{ t: "n", n: 4 }]);
    expect(takeOff([{ t: "n", n: 1 }], "n", false)).toEqual([{ t: "n", n: 0 }]);
    expect(takeOff([{ t: "x", n: 1.5 }], "x", false)).toEqual([{ t: "x", n: 0.5 }]);
    expect(takeOff(s, "x", false)).toBe(s);
  });
});
