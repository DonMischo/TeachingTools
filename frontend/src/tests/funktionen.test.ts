/**
 * Der Funktionsterm-Leser und der Rechenweg beim Einsetzen.
 *
 * Der Rechenweg ist der eigentliche Zweck der Simulation: sichtbar machen,
 * wo die Zahlen der Wertetabelle herkommen. Deshalb wird er hier genauso
 * geprüft wie das Ergebnis.
 */
import { describe, it, expect } from "vitest";
import katex from "katex";
import {
  TEMPLATES, evalAt, fmt, fmtPi, formatNode, hasX, parseFunction, segments,
  UNIT_GRID_MAX, axisStep, niceStep, piAxisStep, substitutionSteps, tableRows,
  fmtPiLatex, normalForm, numLatex, panViewport, pxToUnits, quadraticCoeffs, squareViewport,
  substitutedLatex, substitutedTerm, toLatex,
  vertex, vertexForm, xAtPixel, zoomViewport,
  type Node,
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

describe("Achsenteilung", () => {
  it("nimmt Einer-Schritte, solange das Raster lesbar bleibt", () => {
    expect(axisStep(6, true)).toBe(1);
    expect(axisStep(20, true)).toBe(1);
    expect(axisStep(UNIT_GRID_MAX, true)).toBe(1);
  });

  it("weicht bei sehr weiten Bereichen auf runde Schritte aus", () => {
    expect(axisStep(100, true)).toBeGreaterThan(1);
    expect(axisStep(1000, true)).toBe(100);
  });

  it("lässt Winkelfunktionen bei der runden Teilung", () => {
    expect(axisStep(6, false)).toBe(niceStep(6));
  });

  it("teilt die x-Achse im π-Modus in Vielfachen von π", () => {
    expect(piAxisStep(2 * Math.PI) / Math.PI).toBeCloseTo(0.25, 6);
    expect(piAxisStep(20 * Math.PI) / Math.PI).toBeCloseTo(2, 6);
  });
});

describe("Zoomen", () => {
  const v = { x0: -3, x1: 3, y0: -2, y1: 4 };

  it("behält die Mitte bei", () => {
    const z = zoomViewport(v, 0.5, 0.5);
    expect((z.x0 + z.x1) / 2).toBeCloseTo(0, 9);
    expect((z.y0 + z.y1) / 2).toBeCloseTo(1, 9);
  });

  it("zoomt hinein und wieder heraus", () => {
    const rein = zoomViewport(v, 0.5, 0.5);
    expect(rein.x1 - rein.x0).toBeCloseTo(3, 9);
    const raus = zoomViewport(rein, 2, 2);
    expect(raus.x1 - raus.x0).toBeCloseTo(6, 9);
    expect(raus.y1 - raus.y0).toBeCloseTo(6, 9);
  });

  it("skaliert die Achsen unabhängig voneinander", () => {
    const z = zoomViewport(v, 2, 1);
    expect(z.x1 - z.x0).toBeCloseTo(12, 9);
    expect(z.y1 - z.y0).toBeCloseTo(6, 9);   // y unangetastet
  });

  it("entartet nicht, egal wie oft man zoomt", () => {
    let z = v;
    for (let i = 0; i < 60; i++) z = zoomViewport(z, 0.5, 0.5);
    expect(z.x1).toBeGreaterThan(z.x0);
    expect(Number.isFinite(z.x0) && Number.isFinite(z.y1)).toBe(true);
    let w = v;
    for (let i = 0; i < 60; i++) w = zoomViewport(w, 2, 2);
    expect(Number.isFinite(w.x0) && Number.isFinite(w.y1)).toBe(true);
    expect(w.x1 - w.x0).toBeLessThanOrEqual(2e6 + 1);
  });
});

describe("Quadratisches Raster", () => {
  const W = 572, H = 392;   // Zeichenfläche ohne Ränder

  it("macht die Maßstäbe beider Achsen gleich", () => {
    const q = squareViewport({ x0: -3, x1: 3, y0: -8, y1: 10 }, W, H);
    expect((q.x1 - q.x0) / W).toBeCloseTo((q.y1 - q.y0) / H, 9);
  });

  it("dehnt nur — was drin war, bleibt drin", () => {
    const v = { x0: -3, x1: 3, y0: -8, y1: 10 };
    const q = squareViewport(v, W, H);
    expect(q.x0).toBeLessThanOrEqual(v.x0 + 1e-9);
    expect(q.x1).toBeGreaterThanOrEqual(v.x1 - 1e-9);
    expect(q.y0).toBeLessThanOrEqual(v.y0 + 1e-9);
    expect(q.y1).toBeGreaterThanOrEqual(v.y1 - 1e-9);
  });

  it("behält die Mitte", () => {
    const v = { x0: 1, x1: 7, y0: -2, y1: 4 };
    const q = squareViewport(v, W, H);
    expect((q.x0 + q.x1) / 2).toBeCloseTo(4, 9);
    expect((q.y0 + q.y1) / 2).toBeCloseTo(1, 9);
  });

  it("bleibt quadratisch, wenn man beide Achsen zusammen zoomt", () => {
    const q = squareViewport({ x0: -3, x1: 3, y0: -8, y1: 10 }, W, H);
    const z = zoomViewport(q, 1.4, 1.4);
    expect((z.x1 - z.x0) / W).toBeCloseTo((z.y1 - z.y0) / H, 9);
  });

  it("gibt die Quadrate auf, sobald eine Achse einzeln gedehnt wird", () => {
    const q = squareViewport({ x0: -3, x1: 3, y0: -8, y1: 10 }, W, H);
    const z = zoomViewport(q, 1.4, 1);
    expect((z.x1 - z.x0) / W).not.toBeCloseTo((z.y1 - z.y0) / H, 6);
  });

  it("verträgt entartete Maße, statt NaN zu liefern", () => {
    const v = { x0: -1, x1: 1, y0: -1, y1: 1 };
    expect(squareViewport(v, 0, H)).toEqual(v);
    expect(squareViewport(v, W, 0)).toEqual(v);
  });
});

describe("Rechnung in der Wertetabelle", () => {
  it("zeigt den Term mit eingesetztem x", () => {
    const segs = substitutedTerm(p("2x + 3"), 5);
    expect(segs.map(s => s.t).join("")).toBe("2 · 5 + 3");
  });

  it("markiert jedes eingesetzte x — es ist überall dieselbe Zahl", () => {
    const segs = substitutedTerm(p("x^2 + x"), 4);
    expect(segs.filter(s => s.kind === "mark").map(s => s.t)).toEqual(["4", "4"]);
    // Nach dem Einsetzen steht kein x mehr da.
    expect(segs.some(s => s.kind === "x")).toBe(false);
  });

  it("rechnet nichts aus — der Rechenweg gehört ins »?«", () => {
    expect(substitutedTerm(p("(x - 2)^2 - 3"), 5).map(s => s.t).join("")).toBe("(5 − 2)^2 − 3");
  });

  it("zeigt auch die undefinierte Stelle, statt sie zu verschweigen", () => {
    expect(substitutedTerm(p("1/x"), 0).map(s => s.t).join("")).toBe("1 / 0");
  });
});

describe("Rechnung im π-Modus", () => {
  it("schreibt den eingesetzten Wert so wie die x-Spalte", () => {
    // Sonst stünde in der einen Spalte »−π« und daneben »-3,14«.
    const segs = substitutedTerm(p("sin(x)"), -Math.PI, fmtPi);
    expect(segs.map(s => s.t).join("")).toBe("sin(−π)");
    expect(segs.filter(s => s.kind === "mark").map(s => s.t)).toEqual(["−π"]);
  });

  it("lässt gerechnete Zahlen davon unberührt", () => {
    // Nur der eingesetzte Wert wird umgeschrieben, die 2 bleibt eine 2.
    expect(substitutedTerm(p("2x"), Math.PI, fmtPi).map(s => s.t).join("")).toBe("2 · π");
  });

  it("bleibt ohne Formatierer bei der Dezimalzahl", () => {
    expect(substitutedTerm(p("2x"), 1.5).map(s => s.t).join("")).toBe("2 · 1,5");
  });
});

describe("Verschieben", () => {
  const v = { x0: -3, x1: 3, y0: -2, y1: 4 };

  it("verschiebt das Fenster, ohne den Maßstab zu ändern", () => {
    const p2 = panViewport(v, 2, -1);
    expect(p2).toEqual({ x0: -1, x1: 5, y0: -3, y1: 3 });
    expect(p2.x1 - p2.x0).toBeCloseTo(v.x1 - v.x0, 9);
    expect(p2.y1 - p2.y0).toBeCloseTo(v.y1 - v.y0, 9);
  });

  it("lässt quadratische Kästchen quadratisch", () => {
    const q = squareViewport(v, 572, 392);
    const p2 = panViewport(q, 5, 5);
    expect((p2.x1 - p2.x0) / 572).toBeCloseTo((p2.y1 - p2.y0) / 392, 9);
  });

  it("hebt sich beim Zurückschieben wieder auf", () => {
    expect(panViewport(panViewport(v, 3, 2), -3, -2)).toEqual(v);
  });

  it("rechnet Bildschirmpunkte in Einheiten um", () => {
    // Bild 1144 breit für viewBox 640, Zeichenfläche 572, Spanne 6 Einheiten:
    // ein halber viewBox-Punkt je Bildpunkt, also 6/572 Einheiten je halbem Punkt.
    expect(pxToUnits(1144, 1144, 640, 572, 6)).toBeCloseTo((640 / 572) * 6, 9);
    expect(pxToUnits(0, 1144, 640, 572, 6)).toBe(0);
  });

  it("gibt 0 statt NaN, wenn das Bild noch keine Größe hat", () => {
    expect(pxToUnits(50, 0, 640, 572, 6)).toBe(0);
    expect(pxToUnits(50, 1144, 640, 0, 6)).toBe(0);
  });
});

describe("Quadratische Terme erkennen", () => {
  it("liest a, b, c aus jeder Schreibweise", () => {
    expect(quadraticCoeffs(p("x^2 - 4x + 3"))).toEqual({ a: 1, b: -4, c: 3 });
    // Ausmultipliziert ist es dieselbe Parabel.
    expect(quadraticCoeffs(p("(x - 2)^2 - 1"))).toEqual({ a: 1, b: -4, c: 3 });
    expect(quadraticCoeffs(p("x(x + 1)"))).toEqual({ a: 1, b: 1, c: 0 });
    expect(quadraticCoeffs(p("-0.5x^2 + 2"))).toEqual({ a: -0.5, b: 0, c: 2 });
  });

  it("lässt sich nicht von anderen Funktionen täuschen", () => {
    for (const src of ["2x + 1", "x^3 - 3x", "sin(x)", "1/x", "sqrt(x)", "abs(x)", "3"]) {
      expect(quadraticCoeffs(p(src)), src).toBeNull();
    }
  });

  it("findet den Scheitelpunkt", () => {
    expect(vertex({ a: 1, b: -4, c: 3 })).toEqual({ d: 2, e: -1 });
    expect(vertex({ a: 1, b: 0, c: 0 })).toEqual({ d: 0, e: 0 });
    expect(vertex({ a: -2, b: 4, c: 1 })).toEqual({ d: 1, e: 3 });
  });

  it("schreibt beide Formen lesbar", () => {
    expect(normalForm({ a: 1, b: -4, c: 3 })).toBe("x^2 - 4x + 3");
    expect(normalForm({ a: 1, b: 1, c: 0 })).toBe("x^2 + x");
    expect(normalForm({ a: -1, b: 0, c: -2 })).toBe("-x^2 - 2");
    expect(vertexForm({ a: 1, b: -4, c: 3 })).toBe("(x - 2)^2 - 1");
    expect(vertexForm({ a: 1, b: 0, c: 0 })).toBe("x^2");
    expect(vertexForm({ a: -2, b: 4, c: 1 })).toBe("-2(x - 1)^2 + 3");
  });

  it("beschreibt in beiden Formen dieselbe Funktion", () => {
    for (const q of [
      { a: 1, b: -4, c: 3 }, { a: -1, b: 2, c: 0 }, { a: 0.5, b: 3, c: -2 },
      { a: 2, b: 0, c: 5 }, { a: -0.5, b: -1, c: 1 }, { a: 3, b: 7, c: -4 },
    ]) {
      const nf = parseFunction(normalForm(q));
      const spf = parseFunction(vertexForm(q));
      expect(nf.ok, `Normalform »${normalForm(q)}«`).toBe(true);
      expect(spf.ok, `Scheitelpunktform »${vertexForm(q)}«`).toBe(true);
      if (!nf.ok || !spf.ok) continue;
      for (const x of [-3, -1, 0, 0.5, 2, 4]) {
        const soll = q.a * x * x + q.b * x + q.c;
        expect(evalAt(nf.node, x)).toBeCloseTo(soll, 6);
        // Die Scheitelpunktform wird mit gerundetem d und e geschrieben — bei
        // einem Scheitel wie −7/6 bleibt deshalb ein Rest in der 6. Stelle.
        // Sichtbar ist das nicht; hier wird trotzdem ehrlich gerundet geprüft.
        expect(evalAt(spf.node, x)).toBeCloseTo(soll, 4);
      }
    }
  });

  it("überlebt das Hin- und Herwandeln", () => {
    const q = { a: 1, b: -4, c: 3 };
    const zurueck = quadraticCoeffs(p(vertexForm(q)));
    expect(zurueck).toEqual(q);
  });
});

describe("LaTeX", () => {
  const tex = (src: string) => toLatex(p(src));
  const gesetzt = (t: string) => katex.renderToString(t, { throwOnError: false, output: "html" });

  it("setzt Potenzen hoch und Brüche als Bruch", () => {
    expect(tex("x^2")).toContain("^{2}");
    expect(tex("1/x")).toContain("\\frac{");
    expect(tex("2*x")).toContain("\\cdot");
  });

  it("klammert die Basis einer Potenz, wenn sie zusammengesetzt ist", () => {
    expect(tex("(x-2)^2")).toContain("\\left(");
    expect(tex("x^2")).not.toContain("\\left(");
  });

  it("kennt die Funktionsnamen als Operatoren", () => {
    expect(tex("sin(x)")).toContain("\\sin");
    expect(tex("sqrt(x)")).toContain("\\sqrt{");
    expect(tex("abs(x)")).toContain("\\left|");
    expect(tex("ln(x)")).toContain("\\ln");
  });

  it("färbt jedes x ein", () => {
    const t = tex("x^2 + x");
    expect([...t.matchAll(/\\textcolor\{#8b5cf6\}\{x\}/g)]).toHaveLength(2);
  });

  it("färbt die eingesetzten Zahlen", () => {
    const t = substitutedLatex(p("x^2 + x"), 4);
    expect([...t.matchAll(/\\textcolor\{#8b5cf6\}\{4\}/g)]).toHaveLength(2);
    expect(t).not.toContain("{x}");
  });

  it("schreibt das deutsche Komma klammerfest", () => {
    // Ohne die Klammern setzt KaTeX hinter dem Komma eine Lücke.
    expect(numLatex(2.5)).toBe("2{,}5");
    expect(numLatex(-0.5)).toBe("-0{,}5");
    expect(numLatex(3)).toBe("3");
  });

  it("macht aus Vielfachen von π echte Brüche", () => {
    expect(fmtPiLatex(Math.PI)).toBe("\\pi");
    expect(fmtPiLatex(-Math.PI)).toBe("-\\pi");
    expect(fmtPiLatex(Math.PI / 2)).toBe("\\frac{\\pi}{2}");
    expect(fmtPiLatex((-3 * Math.PI) / 4)).toBe("-\\frac{3\\pi}{4}");
    expect(fmtPiLatex(2 * Math.PI)).toBe("2\\pi");
    expect(fmtPiLatex(0)).toBe("0");
    // Was kein Vielfaches ist, bleibt Dezimalzahl.
    expect(fmtPiLatex(1)).toBe("1");
  });

  it("enthält keine Steuerzeichen — die Falle mit dem einfachen Backslash", () => {
    // `\f` und `\t` in einem TS-Template sind Seitenvorschub und Tabulator.
    // Genau daran ist die erste Fassung gescheitert, zweimal.
    for (const src of ["1/x", "2x", "sin(x)", "x^2"]) {
      expect(tex(src)).not.toMatch(/[\f\v\b\t]/);
    }
  });

  it("wird von KaTeX ohne Fehler gesetzt", () => {
    for (const src of [
      "2x + 1", "x^2 - 4x + 3", "(x - 2)^2 - 3", "1/x", "sin(x)/x", "sqrt(x) + 1",
      "abs(x - 2)", "x^3 - 3x", "-0.5x^2 + 2", "2^3^2", "ln(x)", "exp(x)", "0.5x",
    ]) {
      expect(gesetzt(tex(src)), src).not.toContain("katex-error");
    }
  });

  it("setzt auch die eingesetzten Terme fehlerfrei", () => {
    for (const src of ["2x + 3", "(x - 2)^2 - 3", "1/x", "sin(x)"]) {
      for (const x of [-2, 0, 0.5, 3]) {
        expect(gesetzt(substitutedLatex(p(src), x, fmtPiLatex)), `${src} @ ${x}`)
          .not.toContain("katex-error");
      }
    }
  });

  it("setzt Vielfache von π fehlerfrei", () => {
    for (const v of [0, Math.PI, -Math.PI / 2, (3 * Math.PI) / 4, 2 * Math.PI, 1.234]) {
      expect(gesetzt(fmtPiLatex(v)), String(v)).not.toContain("katex-error");
    }
  });
});

describe("Rechenweg als Formelsatz", () => {
  const gesetzt = (t: string) => katex.renderToString(t, { throwOnError: false, output: "html" });

  it("liefert zu jedem Schritt gesetzten LaTeX-Code", () => {
    const steps = substitutionSteps(p("2x + 1"), 3);
    for (const st of steps) {
      expect(st.tex.length).toBeGreaterThan(0);
      expect(gesetzt(st.tex), st.label).not.toContain("katex-error");
    }
  });

  it("faerbt im ersten Schritt das x, danach die eingesetzte Zahl", () => {
    const steps = substitutionSteps(p("2x + 1"), 3);
    expect(steps[0].tex).toContain("{x}");
    expect(steps[1].tex).not.toContain("{x}");
    expect(steps[1].tex).toContain("8b5cf6");
  });

  it("schreibt den eingesetzten Wert im Pi-Modus als Bruch", () => {
    const steps = substitutionSteps(p("sin(x)"), Math.PI / 2, fmtPiLatex);
    expect(steps[1].tex).toContain("pi");
    expect(gesetzt(steps[1].tex)).not.toContain("katex-error");
  });

  it("bleibt bei allen Vorlagen fehlerfrei", () => {
    for (const t of TEMPLATES) {
      const inst = t.build();
      const r = parseFunction(inst.src);
      expect(r.ok, inst.src).toBe(true);
      if (!r.ok) continue;
      for (const st of substitutionSteps(r.node, 2, fmtPiLatex)) {
        expect(gesetzt(st.tex), `${t.label}: ${inst.src}`).not.toContain("katex-error");
      }
    }
  });
});
