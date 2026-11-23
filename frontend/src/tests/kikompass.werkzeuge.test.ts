import { describe, expect, it } from "vitest";
import { WERKZEUGE, sichtbar, sortiert, KATEGORIEN } from "@/lib/kikompass/werkzeuge";

describe("KI-Werkzeuge", () => {
  it("Gäste sehen nur kindersichere Schülerangebote ohne eigenes Konto", () => {
    const gast = WERKZEUGE.filter(w => sichtbar(w, "gast"));
    expect(gast.length).toBeGreaterThan(3);
    for (const w of gast) {
      expect(w.fuer).not.toBe("lehrkraft");
      expect(w.kindersicher).toBe(true);
      expect(w.konto).not.toBe("eigenes");
    }
  });
  it("Schüler·innen sehen keine Angebote ab 18", () => {
    for (const w of WERKZEUGE.filter(w => sichtbar(w, "schueler"))) expect(w.alter ?? 0).toBeLessThan(18);
  });
  it("Lehrkräfte sehen alles, Sprachmodelle eingeschlossen", () => {
    expect(WERKZEUGE.filter(w => sichtbar(w, "lehrkraft"))).toHaveLength(WERKZEUGE.length);
    expect(WERKZEUGE.some(w => w.kategorie === "chat")).toBe(true);
  });
  it("sortiert nach Kategorie, eindeutige Ids, nur https", () => {
    const kat = Object.keys(KATEGORIEN);
    const s = sortiert(WERKZEUGE).map(w => kat.indexOf(w.kategorie));
    expect(s).toEqual([...s].sort((a, b) => a - b));
    expect(new Set(WERKZEUGE.map(w => w.id)).size).toBe(WERKZEUGE.length);
    for (const w of WERKZEUGE) expect(w.url).toMatch(/^https:\/\//);
  });
});
