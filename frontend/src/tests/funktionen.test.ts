/**
 * Der Funktionsterm-Leser und der Rechenweg beim Einsetzen.
 *
 * Der Rechenweg ist der eigentliche Zweck der Simulation: sichtbar machen,
 * wo die Zahlen der Wertetabelle herkommen. Deshalb wird er hier genauso
 * geprüft wie das Ergebnis.
 */
import { describe, it, expect } from "vitest";
import {
  TEMPLATES, evalAt, fmt, fmtPi, formatNode, hasX, parseFunction, segments,
  substitutionSteps, tableRows, xAtPixel, type Node,
} from "@/lib/funktionen";

const p = (src: string): Node => {
  const r = parseFunction(src);
  if (!r.ok) throw new Error(`${src}: ${r.error}`);
  return r.node;
};
const at = (src: string, x: number) => evalAt(p(src), x);

describe("Lesen", () => {
  it("liest Punkt vor Strich", () => {
    expect(at("2 + 3 * 4", 0)).toBe(14);
    expect(at("(2 + 3) * 4", 0)).toBe(20);
  });

  it("liest das stillschweigende Mal", () => {
    expect(at("2x", 3)).toBe(6);
    expect(at("2(x + 1)", 3)).toBe(8);
    expect(at("x(x + 1)", 3)).toBe(12);
    expect(at("3sin(0)", 0)).toBe(0);
  });

  it("nimmt Potenzen rechtsassoziativ", () => {
    expect(at("2^3^2", 0)).toBe(512);   // 2^(3^2), nicht (2^3)^2
    expect(at("x^2", -3)).toBe(9);
  });

  it("versteht Minus als Vorzeichen", () => {
    expect(at("-x", 3)).toBe(-3);
    expect(at("-x^2", 3)).toBe(-9);
    expect(at("3 - -2", 0)).toBe(5);
  });

  it("kennt die Funktionen und π", () => {
    expect(at("sin(x)", Math.PI / 2)).toBeCloseTo(1, 9);
    expect(at("cos(0)", 0)).toBe(1);
    expect(at("sqrt(x)", 9)).toBe(3);
    expect(at("abs(x)", -4)).toBe(4);
    expect(at("log(100)", 0)).toBeCloseTo(2, 9);
    expect(at("sin(pi)", 0)).toBeCloseTo(0, 9);
    expect(at("sin(π)", 0)).toBeCloseTo(0, 9);
  });

  it("erlaubt »f(x) =« davor und das Komma als Dezimaltrennzeichen", () => {
    expect(at("f(x) = 2x + 1", 2)).toBe(5);
    expect(at("y = 0,5x", 4)).toBe(2);
  });

  it("meldet Unlesbares mit einem verständlichen Satz", () => {
    for (const bad of ["2 +", "sin x", "2 § 3", "foo(x)", ""]) {
      const r = parseFunction(bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.length).toBeGreaterThan(5);
    }
  });
});

describe("Lücken", () => {
  it("gibt null, wo die Funktion nicht definiert ist", () => {
    expect(at("1/x", 0)).toBeNull();
    expect(at("sqrt(x)", -1)).toBeNull();
  });
  it("rechnet daneben normal weiter", () => {
    expect(at("1/x", 2)).toBe(0.5);
    expect(at("sqrt(x)", 0)).toBe(0);
  });
});

describe("Schreiben", () => {
  it("setzt nur die nötigen Klammern", () => {
    expect(formatNode(p("2*x+1"))).toBe("2 · x + 1");
    expect(formatNode(p("2*(x+1)"))).toBe("2 · (x + 1)");
    expect(formatNode(p("(x-2)^2-3"))).toBe("(x − 2)^2 − 3");
    // a − (b − c) darf die Klammer nicht verlieren.
    expect(formatNode(p("5-(x-2)"))).toBe("5 − (x − 2)");
  });

  it("färbt jedes x ein", () => {
    const segs = segments(p("x^2 + x"));
    expect(segs.filter(s => s.kind === "x")).toHaveLength(2);
    expect(segs.map(s => s.t).join("")).toBe("x^2 + x");
  });

  it("schreibt Zahlen deutsch und kurz", () => {
    expect(fmt(3)).toBe("3");
    expect(fmt(0.5)).toBe("0,5");
    expect(fmt(-2.25)).toBe("-2,25");
  });
});

describe("Rechenweg beim Einsetzen", () => {
  it("geht von der Formel über das Einsetzen zum Ergebnis", () => {
    const steps = substitutionSteps(p("2x + 1"), 3);
    const texte = steps.map(s => s.segs.map(g => g.t).join(""));
    expect(texte[0]).toBe("2 · x + 1");
    expect(texte[1]).toBe("2 · 3 + 1");
    // Innen zuerst: erst das Produkt, dann die Summe.
    expect(texte).toContain("6 + 1");
    expect(texte[texte.length - 1]).toBe("7");
    expect(steps[steps.length - 1].label).toBe("Ergebnis");
  });

  it("markiert den eingesetzten Wert", () => {
    const steps = substitutionSteps(p("2x + 1"), 3);
    const marked = steps[1].segs.filter(s => s.kind === "mark").map(s => s.t);
    expect(marked).toEqual(["3"]);
  });

  it("rechnet Klammern von innen nach außen", () => {
    const texte = substitutionSteps(p("(x - 2)^2 - 3"), 5).map(s => s.segs.map(g => g.t).join(""));
    expect(texte[1]).toBe("(5 − 2)^2 − 3");
    expect(texte).toContain("3^2 − 3");
    expect(texte).toContain("9 − 3");
    expect(texte[texte.length - 1]).toBe("6");
  });

  it("endet auch bei einer Funktion beim Zahlenwert", () => {
    const texte = substitutionSteps(p("sqrt(x) + 1"), 9).map(s => s.segs.map(g => g.t).join(""));
    expect(texte[1]).toBe("sqrt(9) + 1");
    expect(texte[texte.length - 1]).toBe("4");
  });

  it("bleibt beim Endergebnis stehen und dreht keine Schleife", () => {
    const steps = substitutionSteps(p("x"), 2);
    expect(steps[steps.length - 1].segs.map(g => g.t).join("")).toBe("2");
    expect(steps.length).toBeLessThan(6);
  });

  it("stimmt mit evalAt überein — der Weg führt zum selben Wert", () => {
    for (const src of ["2x + 1", "x^2 - 3", "(x-2)^2-3", "sqrt(x)", "abs(x) + 2", "x^3 - 3x"]) {
      for (const x of [0, 1, 2, 4, 9]) {
        const y = evalAt(p(src), x);
        if (y === null) continue;
        const steps = substitutionSteps(p(src), x);
        const last = steps[steps.length - 1].segs.map(g => g.t).join("");
        expect(last).toBe(fmt(y));
      }
    }
  });
});

describe("Wertetabelle", () => {
  it("läuft von … bis … in Schritten", () => {
    const rows = tableRows(p("2x"), -2, 2, 1);
    expect(rows.map(r => r.x)).toEqual([-2, -1, 0, 1, 2]);
    expect(rows.map(r => r.y)).toEqual([-4, -2, 0, 2, 4]);
  });

  it("lässt undefinierte Stellen als Lücke stehen", () => {
    const rows = tableRows(p("1/x"), -1, 1, 1);
    expect(rows.find(r => r.x === 0)!.y).toBeNull();
  });

  it("verträgt halbe Schritte", () => {
    expect(tableRows(p("x"), 0, 1, 0.5).map(r => r.x)).toEqual([0, 0.5, 1]);
  });

  it("wehrt Unsinn ab statt zu hängen", () => {
    expect(tableRows(p("x"), 0, 10, 0)).toEqual([]);
    expect(tableRows(p("x"), 5, 0, 1)).toEqual([]);
    // Winzige Schrittweite wird gedeckelt, nicht endlos gerechnet.
    expect(tableRows(p("x"), 0, 100, 0.001).length).toBeLessThanOrEqual(201);
  });
});

describe("Sonstiges", () => {
  it("erkennt Terme ohne x", () => {
    expect(hasX(p("2x + 1"))).toBe(true);
    expect(hasX(p("3 + 4"))).toBe(false);
  });

  it("liefert lauter lesbare Vorlagen — auch nach vielen Würfen", () => {
    expect(TEMPLATES.length).toBeGreaterThanOrEqual(10);
    for (const t of TEMPLATES) {
      expect(t.hint.length).toBeGreaterThan(10);
      for (let i = 0; i < 40; i++) {
        const inst = t.build();
        const r = parseFunction(inst.src);
        expect(r.ok, `${t.label} → »${inst.src}«: ${r.ok ? "" : r.error}`).toBe(true);
        expect(inst.to).toBeGreaterThan(inst.from);
        expect(inst.step).toBeGreaterThan(0);
      }
    }
  });
});

describe("Graph antasten", () => {
  it("rechnet die Zeigerposition in eine Stelle x um", () => {
    // Zeichenfläche 640 breit, Rand 34 ⇒ innen 572. Mitte ⇒ Mitte des Bereichs.
    expect(xAtPixel(320, -3, 3, 640, 34)).toBeCloseTo(0, 3);
    expect(xAtPixel(34, -3, 3, 640, 34)).toBeCloseTo(-3, 3);
    expect(xAtPixel(606, -3, 3, 640, 34)).toBeCloseTo(3, 3);
  });

  it("gibt null neben der Zeichenfläche", () => {
    expect(xAtPixel(10, -3, 3, 640, 34)).toBeNull();
    expect(xAtPixel(630, -3, 3, 640, 34)).toBeNull();
  });

  it("gibt null statt NaN, wenn noch kein Layout da ist", () => {
    // Versteckte Seiten liefern Breite 0 — daraus darf kein Punkt entstehen.
    expect(xAtPixel(100, -3, 3, 0, 34)).toBeNull();
    expect(xAtPixel(NaN, -3, 3, 640, 34)).toBeNull();
    expect(xAtPixel(100, 3, 3, 640, 34)).toBeNull();
  });
});

describe("Vielfache von π", () => {
  it("schreibt die üblichen Winkel als Bruchteil von π", () => {
    expect(fmtPi(0)).toBe("0");
    expect(fmtPi(Math.PI)).toBe("π");
    expect(fmtPi(Math.PI / 2)).toBe("π/2");
    expect(fmtPi(-Math.PI / 2)).toBe("−π/2");
    expect(fmtPi((3 * Math.PI) / 2)).toBe("3π/2");
    expect(fmtPi(2 * Math.PI)).toBe("2π");
    expect(fmtPi(Math.PI / 4)).toBe("π/4");
    expect(fmtPi((-3 * Math.PI) / 4)).toBe("−3π/4");
  });

  it("kürzt, statt 2π/4 zu schreiben", () => {
    expect(fmtPi((2 * Math.PI) / 4)).toBe("π/2");
    expect(fmtPi((4 * Math.PI) / 8)).toBe("π/2");
  });

  it("fällt auf die Dezimalzahl zurück, wo π nicht gemeint ist", () => {
    expect(fmtPi(1)).toBe("1");
    expect(fmtPi(2.5)).toBe("2,5");
  });
});

describe("Bereich der Vorlagen", () => {
  it("legt die Parabel um ihren Scheitelpunkt", () => {
    const t = TEMPLATES.find(x => x.key === "parabel")!;
    for (let i = 0; i < 40; i++) {
      const inst = t.build();
      // Scheitel bei d: aus »(x - 3)^2« bzw. »(x + 3)^2« bzw. »x^2« ablesen.
      const m = /\(x ([-+]) (\d+)\)/.exec(inst.src);
      const d = m ? (m[1] === "-" ? Number(m[2]) : -Number(m[2])) : 0;
      const mitte = (inst.from + inst.to) / 2;
      expect(mitte).toBeCloseTo(d, 6);
      expect(inst.pi).toBe(false);
    }
  });

  it("zeigt bei Sinus und Kosinus genau eine Periode, in π gerechnet", () => {
    for (const key of ["sinus", "kosinus"]) {
      const t = TEMPLATES.find(x => x.key === key)!;
      for (let i = 0; i < 40; i++) {
        const inst = t.build();
        expect(inst.pi).toBe(true);
        // b aus »sin(2x)« lesen; ohne Faktor ist b = 1.
        const m = /(?:sin|cos)\(([-\d.]*)x\)/.exec(inst.src);
        const b = !m || m[1] === "" ? 1 : m[1] === "-" ? -1 : Number(m[1]);
        // Fensterbreite = Periode 2π/b, hier in π-Einheiten: 2/|b|.
        expect(inst.to - inst.from).toBeCloseTo(2 / Math.abs(b), 6);
        expect(inst.from).toBeCloseTo(-inst.to, 6);
      }
    }
  });

  it("würfelt beim Wiederholen wirklich neue Terme", () => {
    for (const key of ["linear", "parabel", "sinus"]) {
      const t = TEMPLATES.find(x => x.key === key)!;
      const seen = new Set(Array.from({ length: 60 }, () => t.build().src));
      expect(seen.size).toBeGreaterThan(2);
    }
  });

  it("hält die Wurzel-Vorlage im definierten Bereich", () => {
    const t = TEMPLATES.find(x => x.key === "wurzel")!;
    for (let i = 0; i < 40; i++) {
      const inst = t.build();
      const node = parseFunction(inst.src);
      expect(node.ok).toBe(true);
      if (!node.ok) continue;
      // Am rechten Rand muss die Wurzel definiert sein, sonst zeigt sie nichts.
      expect(evalAt(node.node, inst.to)).not.toBeNull();
    }
  });
});
