// Startansicht der Karte: ganz Deutschland im Bild, der Brocken genau in der Mitte —
// in jedem Kartennetz (die Netze rechnen in Schein-Koordinaten).
import { describe, expect, it } from "vitest";
import { startKamera } from "@/components/karten/KartenAnsicht";
import { ausschnittVor, vor, type Projektion } from "@/lib/karten/projektion";

const merc = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const DEUTSCHLAND = { west: 5.6, sued: 47.2, ost: 15.3, nord: 55.1 };

describe.each(["equalearth", "robinson", "winkeltripel", "kinder", "mercator"] satisfies Projektion[])("Start im Netz %s", (p) => {
  const { mitte, rahmen } = startKamera(p);
  const [[w, s], [o, n]] = rahmen;

  it("der Brocken liegt in der Mitte des Rahmens (in Bildhöhe)", () => {
    expect(mitte).toEqual(vor([10.6155, 51.7991], p));
    expect((w + o) / 2).toBeCloseTo(mitte[0], 6);
    expect((merc(s) + merc(n)) / 2).toBeCloseTo(merc(mitte[1]), 6);
  });

  it("ganz Deutschland passt hinein", () => {
    const d = ausschnittVor(DEUTSCHLAND, p);
    expect(w).toBeLessThanOrEqual(d.west + 1e-9);
    expect(o).toBeGreaterThanOrEqual(d.ost - 1e-9);
    expect(s).toBeLessThanOrEqual(d.sued + 1e-9);
    expect(n).toBeGreaterThanOrEqual(d.nord - 1e-9);
  });
});
