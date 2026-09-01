/**
 * Die neuen Aufgabensorten der Zahlen-Waage: mehr Minus und Brüche.
 *
 * Der Generator würfelt, deshalb wird jede Stufe vielfach gezogen und über die
 * Menge geprüft — nicht an einem einzelnen Zufallstreffer.
 */
import { describe, it, expect } from "vitest";
import {
  LEVELS, asFraction, coeffs, fmtFrac, formatEquation, generateTask, isSolved, solve,
  type Equation,
} from "@/lib/gleichung";

const many = (level: number, n = 60): Equation[] =>
  Array.from({ length: n }, () => generateTask(level));

describe("asFraction / fmtFrac", () => {
  it("erkennt einfache Brüche und kürzt sie", () => {
    expect(asFraction(0.5)).toEqual({ num: 1, den: 2 });
    expect(asFraction(0.75)).toEqual({ num: 3, den: 4 });
    expect(asFraction(2 / 3)).toEqual({ num: 2, den: 3 });
    // 2/4 ist gekürzt ein Halb.
    expect(asFraction(0.25 * 2)).toEqual({ num: 1, den: 2 });
  });
  it("lässt ganze Zahlen und krumme Dezimalzahlen in Ruhe", () => {
    expect(asFraction(3)).toBeNull();
    expect(asFraction(0)).toBeNull();
    expect(asFraction(0.123)).toBeNull();
    expect(fmtFrac(3)).toBe("3");
    expect(fmtFrac(0.5)).toBe("1/2");
    expect(fmtFrac(-0.5)).toBe("−1/2");
  });
});

describe("Aufgabengenerator", () => {
  it("liefert für jede angebotene Stufe eine lösbare Gleichung", () => {
    for (const { level } of LEVELS) {
      for (const eq of many(level, 20)) {
        const sol = solve(eq);
        expect(sol.kind).toBe("one");
        // Noch nicht fertig — sonst gäbe es nichts zu tun.
        expect(isSolved(eq)).toBeNull();
      }
    }
  });

  it("bietet mehr als die vier alten Stufen an", () => {
    expect(LEVELS.length).toBeGreaterThanOrEqual(7);
  });

  it("übt in Stufe 1 überwiegend das Wegnehmen", () => {
    // »x + 4 = 9« verlangt −4, »x − 4 = 1« verlangt +4. Gewollt ist, dass das
    // Minus nicht die Ausnahme bleibt: es soll in der Mehrzahl auftauchen.
    const mitMinus = many(1).filter(eq => formatEquation(eq).includes("−")).length;
    expect(mitMinus).toBeGreaterThan(60 * 0.4);
  });

  it("stellt in Stufe 5 ein Minus vor das x", () => {
    for (const eq of many(5, 30)) {
      const x = coeffs(eq.left).x + coeffs(eq.right).x;
      // Auf einer Seite steht −ax; über beide Seiten bleibt ein x-Anteil übrig.
      expect(x).not.toBe(0);
      expect(formatEquation(eq)).toContain("−");
    }
  });

  it("setzt in Stufe 6 einen Bruch vor das x und lässt die Lösung ganz", () => {
    for (const eq of many(6, 30)) {
      const xk = Math.abs(coeffs(eq.left).x - coeffs(eq.right).x);
      expect(asFraction(xk)).not.toBeNull();       // ½, ⅓, ¾ …
      const sol = solve(eq);
      expect(sol.kind === "one" && Number.isInteger(sol.x)).toBe(true);
      expect(formatEquation(eq)).toMatch(/\d\/\dx/); // »1/2x«, nicht »0,5x«
    }
  });

  it("liefert in Stufe 7 ein gebrochenes Ergebnis", () => {
    for (const eq of many(7, 30)) {
      const sol = solve(eq);
      expect(sol.kind).toBe("one");
      if (sol.kind !== "one") continue;
      expect(Number.isInteger(sol.x)).toBe(false);
      // Nur Halbe und Viertel — Drittel wären als Dezimalzahl unlesbar.
      expect(Number.isInteger(sol.x * 4)).toBe(true);
    }
  });

  it("hält die Zahlen klein genug für Klötzchen", () => {
    for (const { level } of LEVELS) {
      for (const eq of many(level, 15)) {
        for (const side of [eq.left, eq.right]) {
          for (const t of side) {
            const v = t.t === "g" ? Math.abs(t.k * t.c) : Math.abs(t.n);
            expect(v).toBeLessThanOrEqual(20);
          }
        }
      }
    }
  });
});
