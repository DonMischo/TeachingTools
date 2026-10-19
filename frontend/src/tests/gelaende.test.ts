import { describe, expect, it } from "vitest";
import { erzeuge, LANDSCHAFTEN, wuerfle, hoeheBei, neigungBei, wasserAbstand, inAue } from "@/lib/gelaende/gelaende";
import { erosionStart, erosionSchritt, aenderung, aufGelaende } from "@/lib/gelaende/erosion";

describe("Gelände", () => {
  it("jede Landschaft hat endliche Höhen", () => {
    for (const l of LANDSCHAFTEN) {
      const g = erzeuge({ art: l.id, seed: 7, fluss: true, relief: 1 }, 96, 32);
      expect(g.hoehe.every(Number.isFinite)).toBe(true);
    }
  });

  it("gleicher Seed, gleiches Gelände", () => {
    const a = erzeuge({ art: "flusstal", seed: 42, fluss: true, relief: 1 }, 64, 48);
    const b = erzeuge({ art: "flusstal", seed: 42, fluss: true, relief: 1 }, 64, 48);
    expect(Array.from(a.hoehe)).toEqual(Array.from(b.hoehe));
  });

  it("Flusstal: Fluss, Furt, Aue und Burgberg", () => {
    const g = erzeuge({ art: "flusstal", seed: 3, fluss: true, relief: 1 }, 128, 24);
    expect(g.wasser.some(w => w === 1)).toBe(true);
    expect(g.aue.some(a => a === 1)).toBe(true);
    expect(g.furt).not.toBeNull();
    // die Furt liegt am Wasser
    expect(wasserAbstand(g, g.furt!.x, g.furt!.y)).toBeLessThan(60);
    if (g.berg) {
      // der Berg ist höher als die Furt und nicht in der Aue
      expect(hoeheBei(g, g.berg.x, g.berg.y)).toBeGreaterThan(hoeheBei(g, g.furt!.x, g.furt!.y) + 10);
      expect(inAue(g, g.berg.x, g.berg.y)).toBe(false);
    }
  });

  it("Küste hat Meer, ohne Fluss gibt es kein Flusswasser", () => {
    const k = erzeuge({ art: "kueste", seed: 5, fluss: true, relief: 1 }, 96, 32);
    expect(k.wasser.some(w => w === 2)).toBe(true);
    const o = erzeuge({ art: "ebene", seed: 5, fluss: false, relief: 1 }, 64, 48);
    expect(o.wasser.every(w => w === 0)).toBe(true);
    expect(neigungBei(o, 1500, 1500)).toBeLessThan(5);
  });

  it("Würfel ist reproduzierbar", () => {
    expect(wuerfle(9)).toEqual(wuerfle(9));
  });
});

describe("Erosion", () => {
  it("trägt ab und lagert ab, bleibt endlich", () => {
    const g = erzeuge({ art: "huegel", seed: 11, fluss: false, relief: 1.4 }, 64, 48);
    const e = erosionStart(g);
    for (let i = 0; i < 60; i++) erosionSchritt(e);
    const d = aenderung(e);
    expect(d.every(Number.isFinite)).toBe(true);
    expect(Math.min(...d)).toBeLessThan(-0.05);
    expect(Math.max(...d)).toBeGreaterThan(0.05);
    const g2 = aufGelaende(e, g);
    expect(g2.hoehe).not.toBe(g.hoehe);
    expect(e.schritte).toBe(60);
  });
});
