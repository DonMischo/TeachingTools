/**
 * Der Schiffsbaukasten (Nachbau von SpaceshipGenerator): gleicher Seed ⇒
 * gleiches Schiff — darauf verlässt sich der Mehrspieler-Flug, damit alle
 * dasselbe Schiff eines Mitspielers sehen.
 */
import { describe, it, expect } from "vitest";
import { erzeugeRumpf, GLUT, HUELLE } from "@/components/sonnensystem/raumschiff";

describe("erzeugeRumpf", () => {
  it("baut aus demselben Seed dasselbe Schiff", () => {
    const a = erzeugeRumpf("Mira"), b = erzeugeRumpf("Mira");
    expect(a.positionen).toEqual(b.positionen);
    expect(a.rumpfFarbe).toEqual(b.rumpfFarbe);
  });

  it("baut aus anderen Seeds andere Schiffe", () => {
    const zahlen = new Set(["a", "b", "c", "d", "e"].map(s => erzeugeRumpf(s).positionen.length));
    expect(zahlen.size).toBeGreaterThan(1);
  });

  it("liefert saubere, auf Länge 1 genormte Dreiecke mit Triebwerksglut", () => {
    for (const seed of ["1", "2", "3", "4", "5", "6", "7", "8"]) {
      const r = erzeugeRumpf(seed);
      expect(r.positionen.length % 9).toBe(0);
      expect(r.positionen.every(Number.isFinite)).toBe(true);
      const max = r.positionen.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
      expect(max).toBeGreaterThan(0.45);
      expect(max).toBeLessThanOrEqual(0.5 + 1e-6);
      expect(r.gruppen[0].mat).toBe(HUELLE);
      expect(r.gruppen.some(g => g.mat === GLUT)).toBe(true);
      expect(r.gruppen.reduce((s, g) => s + g.anzahl, 0)).toBe(r.positionen.length / 3);
    }
  });
});
