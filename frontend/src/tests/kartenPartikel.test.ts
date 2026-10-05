// Partikelfluss: Feld aus Linien — Richtung, Reichweite, Monat, warm/kalt.
import { describe, expect, it } from "vitest";
import type { Feature } from "geojson";
import { baueFeld, startpunkt, wind } from "@/lib/karten/partikel";

const linie = (coordinates: number[][], properties: Record<string, unknown>): Feature =>
  ({ type: "Feature", geometry: { type: "LineString", coordinates }, properties });

describe("Partikelfeld", () => {
  it("zeigt in Linienrichtung, wirkt nur in der Nähe und kennt warm/kalt", () => {
    const feld = baueFeld([linie([[-40, 20], [-20, 20]], { art: "warm", monate: "alle" })], "7", 4);
    const [u, v, warm] = wind(feld, -30, 20);
    expect(u).toBeGreaterThan(0.8);
    expect(Math.abs(v)).toBeLessThan(0.05);
    expect(warm).toBeCloseTo(1);
    expect(wind(feld, -30, 30)[0]).toBe(0); // 10° weg: kein Fluss
    const s = startpunkt(feld, () => 0.5)!;
    expect(Math.abs(s[1] - 20)).toBeLessThan(4);
  });

  it("nimmt nur den gewählten Monat und keine Gürtel (ITC, Hoch, Tief)", () => {
    const fs = [
      linie([[0, 10], [10, 10]], { art: "passat", monate: ",1," }),
      linie([[0, 10], [10, 10]], { art: "itc", monate: ",7," }),
    ];
    expect(baueFeld(fs, "7", 4).aktiv.length).toBe(0);
    expect(baueFeld(fs, "1", 4).aktiv.length).toBeGreaterThan(0);
  });
});
