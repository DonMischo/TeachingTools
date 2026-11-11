import { describe, expect, it } from "vitest";
import { FLUESSIGKEITEN, blasenVolumen, blasenWeg, luftdruckInHoehe, maxSaughoehe, presse, schweredruck } from "@/lib/stroemung/druck";
import { P_LUFT } from "@/lib/stroemung/modell";

const f = (id: string) => FLUESSIGKEITEN.find(x => x.id === id)!;

describe("Druck-Formeln", () => {
  it("10 m Wasser ≈ 1 bar, Meerwasser etwas mehr", () => {
    expect(schweredruck(1000, 10) / 1e5).toBeCloseTo(0.981, 3);
    expect(schweredruck(1025, 10)).toBeGreaterThan(schweredruck(1000, 10));
  });

  it("Luftblase in 10 m Tiefe hat etwa das halbe Volumen", () => {
    const v = blasenVolumen(1, P_LUFT, P_LUFT + schweredruck(1000, 10));
    expect(v).toBeGreaterThan(0.49);
    expect(v).toBeLessThan(0.52);
  });

  it("Presse: 100-fache Fläche, hundertstel Kraft", () => {
    const r = presse(1e-4, 1e-2, 10000);
    expect(r.kraft).toBeCloseTo(100, 9);
    expect(r.druck).toBeCloseTo(1e6, 6);
    expect(r.uebersetzung).toBeCloseTo(100, 9);
  });

  it("Bremse: eine Luftblase verlängert den Pedalweg, ohne Blase kein Mehrweg", () => {
    expect(blasenWeg(0, 5e-4, 5e6)).toBe(0);
    // 2 cm³ Blase, 5 cm² Kolben, 50 bar: fast die ganze Blase muss weg ⇒ knapp 4 mm
    const w = blasenWeg(2e-6, 5e-4, 5e6);
    expect(w).toBeGreaterThan(0.0039);
    expect(w).toBeLessThan(0.004);
  });

  it("Saughöhe: Wasser knapp über 10 m, Quecksilber 760 mm (Torricelli)", () => {
    expect(maxSaughoehe(f("suess"))).toBeGreaterThan(10.0);
    expect(maxSaughoehe(f("suess"))).toBeLessThan(10.4);
    expect(maxSaughoehe(f("hg"))).toBeCloseTo(0.763, 2);
  });

  it("auf der Zugspitze (2962 m) ist der Luftdruck rund 30 % geringer", () => {
    const r = luftdruckInHoehe(2962) / P_LUFT;
    expect(r).toBeGreaterThan(0.68);
    expect(r).toBeLessThan(0.72);
  });
});
