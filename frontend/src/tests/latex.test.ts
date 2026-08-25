import { describe, it, expect } from "vitest";
import { fromLatex, looksLikeLatex } from "@/lib/latex";
import { equationToLatex, formatEquation, parseEquation, sideToLatex } from "@/lib/gleichung";
import { exprToLatex, feqToLatex, formatFeq, parseFormel } from "@/lib/formel";

describe("fromLatex", () => {
  it("erkennt, ob überhaupt LaTeX im Spiel ist", () => {
    expect(looksLikeLatex("3x + 4 = 19")).toBe(false);
    expect(looksLikeLatex("\\frac{x}{2} = 3")).toBe(true);
    expect(looksLikeLatex("$x = 1$")).toBe(true);
  });

  it("streift Mathe-Umgebungen ab", () => {
    expect(fromLatex("$3x + 4 = 19$")).toBe("3x + 4 = 19");
    expect(fromLatex("$$x = 1$$")).toBe("x = 1");
    expect(fromLatex("\\(x = 1\\)")).toBe("x = 1");
  });

  it("übersetzt Mal- und Geteiltzeichen", () => {
    expect(fromLatex("2 \\cdot x = 8")).toBe("2 · x = 8");
    expect(fromLatex("2 \\times x = 8")).toBe("2 · x = 8");
    expect(fromLatex("x \\div 2 = 3")).toBe("x : 2 = 3");
  });

  it("macht aus \\frac einen Bruch mit Schrägstrich", () => {
    expect(fromLatex("\\frac{x}{2} = 3")).toBe("x/2 = 3");
    expect(fromLatex("p = \\frac{F}{A}")).toBe("p = F/A");
    // Klammern nur, wo wirklich eine Summe steht
    expect(fromLatex("\\frac{a+b}{2} = 4")).toBe("(a+b)/2 = 4");
  });

  it("wirft geschweifte Klammern und Abstandsmakros weg", () => {
    expect(fromLatex("E = m \\cdot c^{2}")).toBe("E = m · c^2");
    expect(fromLatex("\\left( x + 1 \\right) = 5")).toBe("( x + 1 ) = 5");
    expect(fromLatex("\\mathrm{U} = R \\cdot I")).toBe("U = R · I");
  });
});

describe("LaTeX als Eingabe", () => {
  it("liest Gleichungen im Zahlenmodus", () => {
    const r = parseEquation("$2 \\cdot (x + 3) = 14$");
    expect(r.ok && formatEquation(r.eq)).toBe("2·(x + 3) = 14");
    const f = parseEquation("\\frac{x}{2} = 3");
    expect(f.ok && formatEquation(f.eq)).toBe("0,5x = 3");
  });

  it("liest Formeln im Variablenmodus", () => {
    const r = parseFormel("p = \\frac{F}{A}");
    expect(r.ok && formatFeq(r.eq)).toBe("p = F/A");
    const e = parseFormel("E = m \\cdot c^{2}");
    expect(e.ok && formatFeq(e.eq)).toBe("E = m·c²");
  });

  it("meldet weiterhin Fehler, statt Unbekanntes zu schlucken", () => {
    expect(parseFormel("y = \\sqrt{x}")).toMatchObject({ ok: false });
  });
});

describe("LaTeX als Ausgabe", () => {
  it("setzt Gleichungen mit Klammern", () => {
    const r = parseEquation("2(x + 3) = 14");
    expect(r.ok && equationToLatex(r.eq)).toBe("2 \\cdot \\left( x + 3 \\right) = 14");
  });

  it("schreibt das deutsche Komma so, dass KaTeX es eng setzt", () => {
    const r = parseEquation("x = 2,5");
    expect(r.ok && sideToLatex(r.eq.right)).toBe("2{,}5");
  });

  it("macht aus einem Quotienten einen echten Bruch", () => {
    const r = parseFormel("p = F/A");
    expect(r.ok && feqToLatex(r.eq)).toBe("p = \\frac{F}{A}");
  });

  it("stellt Indizes tief und Hochzahlen hoch", () => {
    const r = parseFormel("s = v·t + s0");
    expect(r.ok && exprToLatex(r.eq.right)).toBe("v \\cdot t + s_{0}");
    const e = parseFormel("E = m·c^2");
    expect(e.ok && exprToLatex(e.eq.right)).toBe("m \\cdot c^{2}");
  });

  it("überlebt die Hin- und Rückrichtung", () => {
    for (const src of ["3x + 4 = x + 10", "2(x + 3) = 14", "x = 2,5"]) {
      const first = parseEquation(src);
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      const again = parseEquation(equationToLatex(first.eq));
      expect(again.ok && formatEquation(again.eq)).toBe(formatEquation(first.eq));
    }
    for (const src of ["p = F/A", "E = m·g·h", "s = v·t + s0"]) {
      const first = parseFormel(src);
      expect(first.ok).toBe(true);
      if (!first.ok) return;
      const again = parseFormel(feqToLatex(first.eq));
      expect(again.ok && formatFeq(again.eq)).toBe(formatFeq(first.eq));
    }
  });
});
