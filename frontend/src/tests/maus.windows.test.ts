import { describe, it, expect } from "vitest";
import { suche } from "@/lib/maus/windows";

describe("Windows-Suche: suche()", () => {
  it("»pai« findet Paint zuerst", () => {
    const treffer = suche("pai");
    expect(treffer[0]).toMatchObject({ art: "app", id: "paint" });
  });

  it("»referat« findet die Datei", () => {
    const treffer = suche("referat");
    expect(treffer.some(t => t.art === "datei" && t.id === "referat")).toBe(true);
  });

  it("»dunkel« findet die Einstellung »Farben«", () => {
    const treffer = suche("dunkel");
    expect(treffer.some(t => t.art === "einstellung" && t.id === "farben")).toBe(true);
  });

  it("leerer Text liefert keine Treffer", () => {
    expect(suche("")).toEqual([]);
    expect(suche("   ")).toEqual([]);
  });
});
