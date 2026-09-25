import { describe, expect, it } from "vitest";
import { gedraenge, Raster, type Mensch } from "@/lib/verkehr/wegsuche";
import type { P } from "@/lib/verkehr/geometrie";

/** 10 × 10 m, eine Wand bei x = 5 von y = 0 bis 8 (unten offen). */
const wand = new Raster(0, 0, 50, 50, 0.2, (x, y) => !(x > 4.8 && x < 5.2 && y < 8));

const laenge = (von: P, weg: P[]) => weg.reduce((s, p, i) => s + Math.hypot(p[0] - (i ? weg[i - 1] : von)[0], p[1] - (i ? weg[i - 1] : von)[1]), 0);

describe("Wegsuche", () => {
  it("geht um die Wand herum statt hindurch", () => {
    const weg = wand.suche([2, 2], [8, 2])!;
    expect(weg).not.toBeNull();
    expect(weg[weg.length - 1]).toEqual([8, 2]);
    // um das offene Ende bei y = 8 herum
    expect(Math.max(...weg.map((p) => p[1]))).toBeGreaterThan(7.9);
    // und geglättet: nur wenige Wegpunkte
    expect(weg.length).toBeLessThanOrEqual(4);
  });

  it("geht bei freier Sicht geradeaus", () => {
    const weg = wand.suche([1, 1], [3, 4])!;
    expect(weg).toEqual([[3, 4]]);
  });

  it("nimmt bei einem Klick in die Wand den nächsten freien Punkt", () => {
    const weg = wand.suche([2, 2], [5, 3])!;
    const ende = weg[weg.length - 1];
    expect(wand.begehbar(ende[0], ende[1])).toBe(true);
    expect(Math.hypot(ende[0] - 5, ende[1] - 3)).toBeLessThan(0.5);
  });

  it("meidet teure Zellen (Fahrbahn), wenn es einen Umweg gibt", () => {
    // Streifen x 4–6 teuer, außer bei y 9–10 (Überweg)
    const r = new Raster(0, 0, 50, 50, 0.2, () => true, (x, y) => (x > 4 && x < 6 && y < 9 ? 20 : 1));
    const weg = r.suche([2, 1], [8, 1])!;
    expect(Math.max(...weg.map((p) => p[1]))).toBeGreaterThan(8.5);
    expect(laenge([2, 1], weg)).toBeGreaterThan(14);
  });
});

describe("Gedränge", () => {
  const offen = new Raster(0, 0, 50, 50, 0.2, () => true);

  it("schiebt einen, der im Weg steht, beiseite", () => {
    const laeufer: Mensch = { id: "a", x: 1, y: 5, r: 0.25, tempo: 1.4, weg: [[9, 5]] };
    const steher: Mensch = { id: "b", x: 3, y: 5, r: 0.25, tempo: 1.4, weg: [] };
    let geschoben = false;
    for (let i = 0; i < 200; i++) if (gedraenge([laeufer, steher], 0.05, offen, i * 0.05).length) geschoben = true;
    expect(geschoben).toBe(true);
    expect(laeufer.x).toBeCloseTo(9, 1);
    expect(Math.abs(steher.y - 5)).toBeGreaterThan(0.2);
  });

  it("schiebt Sitzende nie", () => {
    const laeufer: Mensch = { id: "a", x: 1, y: 5, r: 0.25, tempo: 1.4, weg: [[9, 5]], ziel: [9, 5] };
    const sitzt: Mensch = { id: "b", x: 3, y: 5, r: 0.25, tempo: 1.4, weg: [], fest: true };
    for (let i = 0; i < 300; i++) gedraenge([laeufer, sitzt], 0.05, offen, i * 0.05);
    expect([sitzt.x, sitzt.y]).toEqual([3, 5]);
    expect(laeufer.x).toBeGreaterThan(8.5);
  });

  it("weicht Entgegenkommenden aus, beide kommen an", () => {
    const a: Mensch = { id: "a", x: 1, y: 5, r: 0.25, tempo: 1.4, weg: [[9, 5]], ziel: [9, 5] };
    const b: Mensch = { id: "b", x: 9, y: 5, r: 0.25, tempo: 1.4, weg: [[1, 5]], ziel: [1, 5] };
    for (let i = 0; i < 300; i++) gedraenge([a, b], 0.05, offen, i * 0.05);
    expect(a.x).toBeGreaterThan(8.5);
    expect(b.x).toBeLessThan(1.5);
  });
});
