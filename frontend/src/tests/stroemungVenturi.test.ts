import { describe, expect, it } from "vitest";
import { VERLUST, steighoehe, venturi } from "@/lib/stroemung/venturi";
import { Stroemung } from "@/lib/stroemung/loeser";

describe("Venturi", () => {
  it("halber Durchmesser: vierfache Geschwindigkeit (Kontinuität)", () => {
    const r = venturi(1e-3, 0.04, 0.02, 1000, 0);
    expect(r.v2 / r.v1).toBeCloseTo(4, 9);
  });

  it("in der Engstelle sinkt der Druck um ½ρ(v₂² − v₁²); dahinter kommt fast alles zurück", () => {
    const r = venturi(1e-3, 0.04, 0.02, 1000, 2e4);
    expect(r.p1 - r.p2).toBeCloseTo(0.5 * 1000 * (r.v2 ** 2 - r.v1 ** 2), 6);
    expect(r.p2).toBeLessThan(r.p3);
    expect(r.p1 - r.p3).toBeCloseTo(VERLUST * r.dp, 6);
  });

  it("Zerstäuber: Unterdruck hebt die Flüssigkeit, Überdruck nicht", () => {
    expect(steighoehe(-981, 1000)).toBeCloseTo(0.1, 6);
    expect(steighoehe(500, 1000)).toBe(0);
  });
});

describe("Öl strömt laminar: r⁴ — Wasser in Rohren turbulent: deutlich weniger", () => {
  const verhaeltnis = (medium: "oel" | "wasser") => {
    const fluss = (d: number) => {
      const s = new Stroemung({
        medium, knoten: [{ id: "q", z: 0 }, { id: "o", z: 0 }],
        teile: [
          { id: "quelle", art: "druckquelle", a: "q", druck: 5e4 },
          { id: "r", art: "rohr", a: "q", b: "o", laenge: 3, durchmesser: d, turbulent: medium === "wasser" },
          { id: "aus", art: "auslass", a: "o", widerstand: 1 },
        ],
      });
      s.schritt(0.01);
      return s.fluss("r");
    };
    return fluss(0.02) / fluss(0.01);
  };
  it("Öl: doppelter Durchmesser, 16-facher Durchfluss", () => expect(verhaeltnis("oel")).toBeCloseTo(16, 2));
  it("Wasser: etwa d^2,5 ≈ 5,7-fach", () => {
    const v = verhaeltnis("wasser");
    expect(v).toBeGreaterThan(5.3);
    expect(v).toBeLessThan(6.2);
  });
});
