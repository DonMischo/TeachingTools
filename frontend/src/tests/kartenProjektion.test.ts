// Equal Earth ↔ Mercator: Umrechnung hin und zurück, Ausschnitte, Stil (Server-Umrechnung, -ee-Kacheln, Erd-Oval).
import { describe, expect, it } from "vitest";
import { ausschnittVor, ausschnittZurueck, vor, zurueck } from "@/lib/karten/projektion";
import { baueStil, type Ebene } from "@/lib/karten/stil";

describe("Kartennetz", () => {
  it("rechnet hin und zurück und erkennt Punkte außerhalb der Erde", () => {
    for (const p of [[0, 0], [10.5, 51.2], [-74, 40.7], [151, -33.9], [179, 80], [-179, -85]] as [number, number][]) {
      const q = zurueck(vor(p))!;
      expect(q[0]).toBeCloseTo(p[0], 6);
      expect(q[1]).toBeCloseTo(p[1], 6);
    }
    expect(vor([180, 0])[0]).toBeCloseTo(180, 6);
    // gleiche Zahl wie api/karten_projektion.py (Test dort: 60° N → < 59)
    expect(vor([10, 60])[1]).toBeCloseTo(58.4235449, 5);
    expect(zurueck([179, 60])).toBeNull(); // rechts oben neben dem Oval
    expect(vor([13.4, 52.5], "mercator")).toEqual([13.4, 52.5]);
  });

  it("Ausschnitt: hin und zurück umschließt das Original", () => {
    const a = { west: 5.6, sued: 47.2, ost: 15.3, nord: 55.1 };
    const b = ausschnittZurueck(ausschnittVor(a, "equalearth"), "equalearth");
    expect(b.west).toBeLessThanOrEqual(a.west + 1e-6);
    expect(b.ost).toBeGreaterThanOrEqual(a.ost - 1e-6);
    expect(b.nord).toBeGreaterThanOrEqual(a.nord - 1e-6);
  });

  it("Stil: Equal Earth holt umgerechnete Daten und -ee-Kacheln, zeichnet das Erd-Oval", () => {
    const ebenen: Ebene[] = [
      { id: "welt-staaten", name: "Staaten", gruppe: "politisch", bereich: "welt", geometrie: "flaeche", quiz: true, bytes: 0, quelle: { name: "NE", lizenz: "", url: "" } },
      { id: "welt-hoehen", name: "Relief", gruppe: "topographisch", bereich: "welt", geometrie: "raster", quiz: false, bytes: 0,
        kachelUrl: "/karten/welt-hoehen/{z}/{x}/{y}.webp", quelle: { name: "NE", lizenz: "", url: "" } },
    ];
    const ee = baueStil({ stand: "", ebenen }, { ebenen: ["welt-staaten", "welt-hoehen"], beschriftung: false }, "topographisch");
    expect((ee.sources["welt-staaten"] as { data: string }).data).toBe("/api/karten/ebenen/welt-staaten?projektion=equalearth");
    expect((ee.sources["welt-hoehen"] as { tiles: string[] }).tiles[0]).toBe("/karten/welt-hoehen-ee/{z}/{x}/{y}.webp");
    expect(ee.layers.some((l) => l.id === "erde")).toBe(true);
    const me = baueStil({ stand: "", ebenen }, { ebenen: ["welt-staaten", "welt-hoehen"], beschriftung: false, projektion: "mercator" }, "topographisch");
    expect((me.sources["welt-staaten"] as { data: string }).data).toBe("/api/karten/ebenen/welt-staaten");
    expect(me.layers.some((l) => l.id === "erde")).toBe(false);
  });

  it("Globus: echte Koordinaten, Mercator-Kacheln, MapLibre-Kugel", () => {
    expect(vor([13.4, 52.5], "globus")).toEqual([13.4, 52.5]);
    expect(zurueck([13.4, 52.5], "globus")).toEqual([13.4, 52.5]);
    const ebenen: Ebene[] = [
      { id: "welt-hoehen", name: "Relief", gruppe: "topographisch", bereich: "welt", geometrie: "raster", quiz: false, bytes: 0,
        kachelUrl: "/karten/welt-hoehen/{z}/{x}/{y}.webp", quelle: { name: "NE", lizenz: "", url: "" } },
    ];
    const gl = baueStil({ stand: "", ebenen }, { ebenen: ["welt-hoehen"], beschriftung: false, projektion: "globus" }, "topographisch");
    expect(gl.projection).toEqual({ type: "globe" });
    expect((gl.sources["welt-hoehen"] as { tiles: string[] }).tiles[0]).toBe("/karten/welt-hoehen/{z}/{x}/{y}.webp");
    expect(gl.layers.some((l) => l.id === "erde")).toBe(false);
    expect(baueStil({ stand: "", ebenen }, { ebenen: [], beschriftung: false }, "topographisch").projection).toBeUndefined();
  });
});
