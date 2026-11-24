import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { gesteinVon, zeitalterVon } from "../../scripts/karten-daten/geologie.mjs";
import { GRUPPEN, KARTENARTEN } from "@/lib/karten/stil";

const DATEN = join(__dirname, "../../../data/karten");

describe("Geologische Karte: Einteilung", () => {
  it("ordnet nach mittlerem Alter in die Systeme", () => {
    expect(zeitalterVon({ best_age_top: 0, best_age_bottom: 0.1, lith_class1: "sedimentary" })).toBe("quartaer");
    expect(zeitalterVon({ best_age_top: 145, best_age_bottom: 201, lith_class1: "sedimentary" })).toBe("jura");
    expect(zeitalterVon({ best_age_top: 359, best_age_bottom: 419, lith_class1: "sedimentary" })).toBe("devon");
    expect(zeitalterVon({ best_age_top: 600, best_age_bottom: 1000, lith_class1: "metamorphic" })).toBe("praekambrium");
  });
  it("Magmatite gehen vor das Alter", () => {
    expect(zeitalterVon({ best_age_top: 299, best_age_bottom: 359, lith_class1: "igneous", lith_type1: "plutonic" })).toBe("plutonit");
    expect(zeitalterVon({ best_age_top: 2, best_age_bottom: 20, lith_class1: "igneous", lith_type1: "volcanic" })).toBe("vulkanit");
  });
  it("Gesteinsart: junge Sedimente sind Lockergestein", () => {
    expect(gesteinVon({ best_age_top: 0, best_age_bottom: 0.01, lith_class1: "sedimentary" })).toBe("locker");
    expect(gesteinVon({ best_age_top: 145, best_age_bottom: 201, lith_class1: "sedimentary" })).toBe("sediment");
    expect(gesteinVon({ lith_class1: "metamorphic" })).toBe("metamorphit");
    expect(gesteinVon({})).toBe("");
  });
});

describe("Geologische Karte: Ebenen im Katalog", () => {
  const katalog = JSON.parse(readFileSync(join(DATEN, "ebenen.json"), "utf8")).ebenen as
    { id: string; gruppe: string; darstellung?: { feld: string; werte: { wert: string }[] } }[];
  it.each(["de-geologie", "de-gesteine", "de-stoerungen"])("%s ist da, Gruppe Geologie, jede Fläche hat eine Legendenfarbe", (id) => {
    const e = katalog.find((k) => k.id === id)!;
    expect(e.gruppe).toBe("geologie");
    const werte = new Set(e.darstellung!.werte.map((w) => w.wert));
    const fs = JSON.parse(readFileSync(join(DATEN, "ebenen", `${id}.geojson`), "utf8")).features as { properties: Record<string, string> }[];
    expect(fs.length).toBeGreaterThan(50);
    for (const f of fs) expect(werte.has(f.properties[e.darstellung!.feld])).toBe(true);
  });
  it("Gruppe und Kartenart sind wählbar", () => {
    expect(GRUPPEN.some((g) => g.id === "geologie")).toBe(true);
    const art = KARTENARTEN.find((k) => k.id === "geologisch")!;
    expect(art.ebenen.de).toContain("de-geologie");
    for (const id of art.ebenen.de) expect(katalog.some((k) => k.id === id) || id === "de-hoehen" || id === "welt-hoehen").toBe(true);
  });
});
