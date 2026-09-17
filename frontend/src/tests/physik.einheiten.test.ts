/**
 * Alles rechnet in SI-Basiseinheiten; umgerechnet wird ausschließlich beim
 * Anzeigen. Diese Datei hält das fest — sie ist die einzige Stelle, an der
 * Vorsätze (m, k, µ) und Anzeige-Einheiten (°C, km/h, °) vorkommen dürfen.
 */
import { describe, it, expect } from "vitest";
import { formatiere, nachSI, grad, bogen } from "@/lib/physik/einheiten";

describe("formatiere", () => {
  it("schreibt mit deutschem Komma und drei geltenden Ziffern", () => {
    expect(formatiere(1.5, "m")).toBe("1,5 m");
    expect(formatiere(1.23456, "m")).toBe("1,23 m");
  });

  it("wählt den passenden Vorsatz", () => {
    expect(formatiere(0.0025, "A")).toBe("2,5 mA");
    expect(formatiere(4700, "Ohm")).toBe("4,7 kΩ");
    expect(formatiere(0.0000022, "F")).toBe("2,2 µF");
  });

  it("setzt den Vorsatz beim Kilogramm ans Gramm", () => {
    expect(formatiere(0.5, "kg")).toBe("500 g");
    expect(formatiere(0.002, "kg")).toBe("2 g");
    expect(formatiere(2, "kg")).toBe("2 kg");
    // Oberhalb von Tonnen bleibt es bei kg — »Megagramm« sagt keine Schule.
    expect(formatiere(1200, "kg")).toBe("1200 kg");
  });

  it("lässt Null und negative Werte heil", () => {
    expect(formatiere(0, "V")).toBe("0 V");
    expect(formatiere(-0.05, "V")).toBe("-50 mV");
  });

  it("gibt dimensionslosen Zahlen keine Einheit", () => {
    expect(formatiere(0.42, "")).toBe("0,42");
  });

  it("bekommt bei rad keinen Vorsatz", () => {
    expect(formatiere(Math.PI, "rad")).toBe("3,14 rad");
  });

  it("rechnet erst beim Anzeigen in die Schuleinheit um", () => {
    expect(formatiere(Math.PI, "rad", "grad")).toBe("180 °");
    expect(formatiere(293.15, "K", "°C")).toBe("20 °C");
    expect(formatiere(10, "m/s", "km/h")).toBe("36 km/h");
  });
});

describe("nachSI", () => {
  it("ist die Umkehrung von formatiere's Anzeigeeinheit", () => {
    expect(nachSI(20, "K", "°C")).toBeCloseTo(293.15, 6);
    expect(nachSI(180, "rad", "grad")).toBeCloseTo(Math.PI, 12);
    expect(nachSI(36, "m/s", "km/h")).toBeCloseTo(10, 12);
  });

  it("lässt einen Wert ohne Anzeigeeinheit unverändert", () => {
    expect(nachSI(5, "V")).toBe(5);
  });
});

describe("Winkel", () => {
  it("rechnet zwischen Bogenmaß und Grad", () => {
    expect(grad(Math.PI / 2)).toBeCloseTo(90, 12);
    expect(bogen(90)).toBeCloseTo(Math.PI / 2, 12);
  });
});
