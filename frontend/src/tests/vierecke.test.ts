/**
 * Die Formeln der sechs Vierecke. Rechnung ohne Oberfläche — hier fällt auf,
 * wenn eine Formel schief steht, nicht erst an der Tafel.
 */
import { describe, it, expect } from "vitest";
import { SHAPES, SHAPE_ORDER, bounds, defaults, fmt } from "@/lib/vierecke";

describe("fmt", () => {
  it("lässt ganze Zahlen ganz und kürzt Nullen weg", () => {
    expect(fmt(20)).toBe("20");
    expect(fmt(4.5)).toBe("4.5");
    expect(fmt(7.0710678)).toBe("7.07");
    expect(fmt(3.10)).toBe("3.1");
  });
});

describe("Quadrat", () => {
  const s = SHAPES.quadrat;
  it("u = 4a, A = a²", () => {
    expect(s.perimeter({ a: 5 })).toBe(20);
    expect(s.area({ a: 5 })).toBe(25);
  });
  it("hat vier Eckpunkte und ist so hoch wie breit", () => {
    const b = bounds(s.poly({ a: 6 }));
    expect(s.poly({ a: 6 })).toHaveLength(4);
    expect(b.width).toBe(6);
    expect(b.height).toBe(6);
  });
});

describe("Rechteck", () => {
  const s = SHAPES.rechteck;
  it("u = 2(a+b), A = a·b", () => {
    expect(s.perimeter({ a: 6, b: 4 })).toBe(20);
    expect(s.area({ a: 6, b: 4 })).toBe(24);
  });
  it("zeigt den Rechenweg mit eingesetzten Zahlen", () => {
    expect(s.stepsA({ a: 6, b: 4 })).toBe("A = 6 · 4 = 24");
    expect(s.stepsU({ a: 6, b: 4 })).toContain("2 · (6 + 4)");
  });
});

describe("Parallelogramm", () => {
  const s = SHAPES.parallelogramm;
  it("A = a·h, nicht a·b", () => {
    expect(s.area({ a: 7, b: 4, h: 3 })).toBe(21);
    expect(s.perimeter({ a: 7, b: 4, h: 3 })).toBe(22);
  });
  it("begrenzt die Höhe auf die Seite b — höher gibt es die Form nicht", () => {
    // h > b wäre unmöglich; gerechnet und gezeichnet wird mit h = b.
    expect(s.area({ a: 5, b: 3, h: 8 })).toBe(15);
    const b = bounds(s.poly({ a: 5, b: 3, h: 8 }));
    expect(b.height).toBe(3);
  });
  it("wird bei h = b zum Rechteck (kein Versatz)", () => {
    const p = s.poly({ a: 5, b: 3, h: 3 });
    expect(p[0].x).toBeCloseTo(0);
    expect(bounds(p).width).toBeCloseTo(5);
  });
});

describe("Trapez", () => {
  const s = SHAPES.trapez;
  it("A = ((a+c)/2)·h", () => {
    expect(s.area({ a: 8, c: 4, h: 3 })).toBe(18);
  });
  it("u zählt beide Schenkel mit", () => {
    // Versatz je Seite (12-4)/2 = 4, h = 3 → Schenkel 5 (3-4-5-Dreieck)
    expect(s.perimeter({ a: 12, c: 4, h: 3 })).toBe(12 + 4 + 2 * 5);
  });
  it("ist bei a = c ein Rechteck", () => {
    expect(s.perimeter({ a: 5, c: 5, h: 2 })).toBe(2 * (5 + 2));
    expect(s.area({ a: 5, c: 5, h: 2 })).toBe(10);
  });
});

describe("Raute", () => {
  const s = SHAPES.raute;
  it("A = (e·f)/2", () => {
    expect(s.area({ e: 8, f: 6 })).toBe(24);
  });
  it("u = 4a mit a aus den halben Diagonalen", () => {
    // Halbe Diagonalen 4 und 3 → Seite 5
    expect(s.perimeter({ e: 8, f: 6 })).toBe(20);
  });
  it("ist bei e = f ein Quadrat — gleiche Fläche wie über die Seite", () => {
    const u = s.perimeter({ e: 6, f: 6 });
    const a = u / 4;
    expect(s.area({ e: 6, f: 6 })).toBeCloseTo(a * a, 6);
  });
});

describe("Drachen", () => {
  const s = SHAPES.drachen;
  it("A = (e·f)/2", () => {
    expect(s.area({ e: 6, f: 9, m: 3 })).toBe(27);
  });
  it("u = 2(s+t) aus beiden Seitenpaaren", () => {
    // e/2 = 3, m = 4 → s = 5; f-m = 6, e/2 = 3 → t = √45
    const u = s.perimeter({ e: 6, f: 10, m: 4 });
    expect(u).toBeCloseTo(2 * (5 + Math.sqrt(45)), 6);
  });
  it("wird zur Raute, wenn die Querdiagonale in der Mitte liegt", () => {
    const raute = SHAPES.raute;
    expect(s.perimeter({ e: 8, f: 6, m: 3 })).toBeCloseTo(raute.perimeter({ e: 8, f: 6 }), 6);
    expect(s.area({ e: 8, f: 6, m: 3 })).toBeCloseTo(raute.area({ e: 8, f: 6 }), 6);
  });
});

describe("Katalog", () => {
  it("führt alle sechs Formen und liefert für jede sinnvolle Startwerte", () => {
    expect(SHAPE_ORDER).toHaveLength(6);
    for (const key of SHAPE_ORDER) {
      const s = SHAPES[key];
      const v = defaults(s);
      expect(Object.keys(v)).toEqual(s.fields.map(f => f.key));
      expect(s.perimeter(v)).toBeGreaterThan(0);
      expect(s.area(v)).toBeGreaterThan(0);
      expect(s.poly(v)).toHaveLength(4);
      expect(s.properties.length).toBeGreaterThan(2);
    }
  });

  it("erlaubt das Auslegen nur, wo ein Einheitsraster aufgeht", () => {
    // Ein Trapez oder Drachen zerfällt nicht lückenlos in Einheitsquadrate.
    const gridable = SHAPE_ORDER.filter(k => SHAPES[k].gridable);
    expect(gridable).toEqual(["quadrat", "rechteck"]);
  });
});
