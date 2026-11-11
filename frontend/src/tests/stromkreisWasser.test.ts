import { describe, expect, it } from "vitest";
import { rechne, type WasserEinstellung } from "@/lib/stromkreis/wasser";

const basis: WasserEinstellung = { aufbau: "einzeln", hoehe: 12, ventil1: 10, ventil2: 10, rohr: 1, geschlossen: true };

describe("Wassermodell", () => {
  it("Ohmsches Gesetz über den ganzen Kreis, Spannungsfälle ergeben die Quellspannung", () => {
    const z = rechne(basis);
    expect(z.rGesamt).toBeCloseTo(12); // 10 Ω Ventil + 0,5 + 0,5 + 1 Ω Rohre
    expect(z.strom).toBeCloseTo(1);
    expect(z.uZu + z.u1 + z.uAb + z.uRueck).toBeCloseTo(12);
    expect(z.phi.fass - z.uRueck).toBeCloseTo(0);
  });

  it("dickere Rohre: weniger Verlust in der Leitung, mehr Strom", () => {
    const duenn = rechne(basis), dick = rechne({ ...basis, rohr: 4 });
    expect(dick.strom).toBeGreaterThan(duenn.strom);
    expect(dick.uZu).toBeLessThan(duenn.uZu);
  });

  it("Knotenregel: in der Parallelschaltung teilt sich der Strom", () => {
    const z = rechne({ ...basis, aufbau: "parallel", ventil1: 10, ventil2: 40 });
    expect(z.i1 + z.i2).toBeCloseTo(z.strom);
    expect(z.i1 / z.i2).toBeCloseTo(4);
    expect(z.u1).toBeCloseTo(z.u2);
  });

  it("Reihe: gleicher Strom, die Spannung teilt sich im Verhältnis der Widerstände", () => {
    const z = rechne({ ...basis, aufbau: "reihe", ventil1: 10, ventil2: 30 });
    expect(z.i1).toBeCloseTo(z.i2);
    expect(z.u2 / z.u1).toBeCloseTo(3);
  });

  it("offener Kreis: kein Durchfluss, überall bis zur Sperre der volle Druck", () => {
    const z = rechne({ ...basis, geschlossen: false });
    expect(z.strom).toBe(0);
    expect(z.phi.nach).toBe(12);
    expect(z.phi.fass).toBe(12);
    expect(z.pQuelle).toBe(0);
  });

  it("Energie bleibt erhalten: Quelle liefert, was Ventile und Rohre verbrauchen", () => {
    const z = rechne({ ...basis, aufbau: "parallel", ventil2: 25 });
    const rohre = z.strom * (z.uZu + z.uAb + z.uRueck);
    expect(z.p1 + z.p2 + rohre).toBeCloseTo(z.pQuelle);
  });
});
