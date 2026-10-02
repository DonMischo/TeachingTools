import { describe, expect, it } from "vitest";
import { ankerpunkt, marke, vergibNummern } from "@/lib/karten/nummern";
import { aufgeraeumt } from "@/lib/karten/satz";

describe("marke", () => {
  it("zählt in allen Schemata", () => {
    expect([1, 2, 26, 27, 28].map((n) => marke("klein", n))).toEqual(["a", "b", "z", "aa", "ab"]);
    expect(marke("gross", 3)).toBe("C");
    expect([1, 4, 9, 14, 40, 1994].map((n) => marke("roemisch", n))).toEqual(["I", "IV", "IX", "XIV", "XL", "MCMXCIV"]);
    expect(marke("zahl", 12)).toBe("12");
    expect(marke("keine", 1)).toBe("");
  });
});

describe("vergibNummern", () => {
  it("gleiches Schema zählt über Ebenen weiter, eigenes beginnt neu, Reihenfolge = Katalog", () => {
    const n = vergibNummern({
      "de-seen": { zeigen: "alle", objekte: ["see1"], nummerierung: "zahl" },
      "de-staedte": { zeigen: "auswahl", objekte: ["erfurt", "jena"], nummerierung: "zahl" },
      "de-fluesse": { zeigen: "alle", objekte: ["saale", "ilm"], nummerierung: "klein" },
      "de-gipfel": { zeigen: "alle", objekte: ["brocken"], nummerierung: "keine" },
    }, ["de-staedte", "de-fluesse", "de-seen", "de-gipfel"]);
    expect(n).toEqual({
      "de-staedte": { erfurt: "1", jena: "2" },
      "de-fluesse": { saale: "a", ilm: "b" },
      "de-seen": { see1: "3" },
    });
  });
});

describe("ankerpunkt", () => {
  it("Punkt bleibt, Linie landet auf einem eigenen Stützpunkt", () => {
    expect(ankerpunkt({ type: "Point", coordinates: [11, 51] })).toEqual([11, 51]);
    const linie = { type: "MultiLineString" as const, coordinates: [[[0, 0], [1, 0]], [[1, 0], [2, 0], [3, 0]]] };
    const p = ankerpunkt(linie)!;
    expect(linie.coordinates.flat()).toContainEqual(p);
    expect(p).toEqual([1, 0]);
  });

  it("liegt bei einer U-Form innerhalb der Fläche, nicht im Schwerpunkt", () => {
    // U: Schwerpunkt liegt in der Lücke
    const u = [[[0, 0], [3, 0], [3, 3], [2, 3], [2, 1], [1, 1], [1, 3], [0, 3], [0, 0]]];
    const [x, y] = ankerpunkt({ type: "Polygon", coordinates: u })!;
    const inLuecke = x > 1 && x < 2 && y > 1;
    expect(inLuecke).toBe(false);
    expect(x >= 0 && x <= 3 && y >= 0 && y <= 3).toBe(true);
  });

  it("nimmt bei Inseln den größten Teil", () => {
    const g = { type: "MultiPolygon" as const, coordinates: [
      [[[0, 0], [0.1, 0], [0.1, 0.1], [0, 0.1], [0, 0]]],
      [[[10, 10], [14, 10], [14, 14], [10, 14], [10, 10]]],
    ] };
    const [x, y] = ankerpunkt(g)!;
    expect(x).toBeGreaterThan(10);
    expect(y).toBeGreaterThan(10);
  });
});

describe("aufgeraeumt", () => {
  it("lässt leere Auswahlen und Erfolge ohne Ebene weg", () => {
    const aus = aufgeraeumt({
      art: "stumm", region: "deutschland", ebenen: [], beschriftung: false, ausschnitt: null,
      auswahl: { "de-fluesse": { zeigen: "alle", objekte: ["saale"], nummerierung: "zahl" }, "de-seen": { zeigen: "alle", objekte: [], nummerierung: "keine" } },
      erfolge: [
        { id: "a", name: "A", icon: "🌊", ebenen: ["de-fluesse", "de-seen"], schwelle: 1 },
        { id: "b", name: "B", icon: "💧", ebenen: ["de-seen"], schwelle: 1 },
      ],
    });
    expect(Object.keys(aus.auswahl)).toEqual(["de-fluesse"]);
    expect(aus.erfolge).toEqual([{ id: "a", name: "A", icon: "🌊", ebenen: ["de-fluesse"], schwelle: 1 }]);
  });
});
