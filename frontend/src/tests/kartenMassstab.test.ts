// Maßstabsleiste: runde Feldlängen (1-2-5), km ab 1000 m, passt in die vorgegebene Breite.
import { describe, expect, it } from "vitest";
import { massstab, meterJePixel } from "@/lib/karten/massstab";

describe("Maßstabsleiste", () => {
  it("wählt runde Felder und bleibt unter der Höchstbreite", () => {
    const m = massstab(meterJePixel(6, 51), 180); // Deutschland, Zoom 6
    expect([1, 2, 5, 10, 20, 50, 100]).toContain(m.feldWert);
    expect(m.einheit).toBe("km");
    expect(m.feldPx * m.felder).toBeLessThanOrEqual(180);
    expect(m.feldPx * m.felder).toBeGreaterThan(70);
  });

  it("nimmt Meter, wenn es eng wird", () => {
    const m = massstab(2, 180); // 2 m je Pixel
    expect(m.einheit).toBe("m");
    expect(m.feldWert).toBe(50);
  });
});
