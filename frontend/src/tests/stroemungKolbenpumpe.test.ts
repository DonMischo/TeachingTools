import { describe, expect, it } from "vitest";
import { Kolbenpumpe } from "@/lib/stroemung/kolbenpumpe";
import { P_LUFT } from "@/lib/stroemung/modell";

const wasser = () => new Kolbenpumpe({ rohrFlaeche: 1.26e-3, rohrLaenge: 12, zylFlaeche: 1.13e-2, hub: 0.3 }, P_LUFT, 1000, 2340);
const pumpen = (p: Kolbenpumpe, n: number) => { for (let i = 0; i < n; i++) { p.bewege(p.m.hub); p.bewege(0); } };

describe("Kolbenpumpe", () => {
  it("jeder Hub hebt die Säule, hinunter fällt sie nicht", () => {
    const p = wasser();
    p.bewege(0.3);
    const nachHoch = p.h;
    expect(nachHoch).toBeGreaterThan(0.5);
    p.bewege(0);
    expect(p.h).toBe(nachHoch);
    pumpen(p, 1);
    expect(p.h).toBeGreaterThan(nachHoch);
  });

  it("nach vielen Hüben: knapp über 10 m, nie mehr", () => {
    const p = wasser();
    pumpen(p, 200);
    expect(p.h).toBeGreaterThan(0.98 * p.grenze);
    expect(p.h).toBeLessThanOrEqual(p.grenze + 1e-6);
    expect(p.grenze).toBeGreaterThan(10);
    expect(p.grenze).toBeLessThan(10.4);
  });

  it("Gleichgewicht: innen + ρgh = außen", () => {
    const p = wasser();
    pumpen(p, 4);
    expect(p.druckRohr + 1000 * 9.81 * p.h).toBeCloseTo(P_LUFT, -1);
  });

  it("Quecksilber bleibt bei rund 76 cm stehen", () => {
    const p = new Kolbenpumpe({ rohrFlaeche: 1.26e-3, rohrLaenge: 1, zylFlaeche: 1.13e-2, hub: 0.3 }, P_LUFT, 13534, 0.16);
    pumpen(p, 300);
    expect(p.h).toBeCloseTo(0.763, 2);
  });

  it("Belüften lässt die Säule fallen", () => {
    const p = wasser();
    pumpen(p, 5);
    p.belueften();
    expect(p.h).toBe(0);
  });
});
