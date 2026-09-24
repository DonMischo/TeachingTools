import { describe, expect, it } from "vitest";
import { bestanden, LEER, MAX_SCHWERE, MISSIONEN, pflichtErfuellt, verbuche, type Fortschritt } from "@/lib/verkehr/missionen";
import { Gruppenblick } from "@/lib/verkehr/gruppe";
import { baueSchilder, SCHILDER, type SchildArt } from "@/lib/verkehr/schilder";
import { stadt } from "@/lib/verkehr/stadt";

const alle = (f: Fortschritt, ...e: Parameters<typeof verbuche>[1][]) => e.reduce((x, y) => verbuche(x, y).f, f);

describe("Aufträge", () => {
  it("hakt Orte, Ampel, Zebra und Einsteigen ab", () => {
    const f = alle(LEER,
      { typ: "ort", name: "Lidl" }, { typ: "ort", name: "Netto Marken-Discount" },
      { typ: "meldung", id: "gruenGequert", t: 10 }, { typ: "meldung", id: "zebraGequert", t: 20 },
      { typ: "eingestiegen", art: "bus", gut: true }, { typ: "eingestiegen", art: "tram", gut: false });
    expect(f.erledigt.sort()).toEqual(["ampel", "bus", "lidl", "netto", "zebra"]);
  });

  it("zählt den Taster nur, wenn danach bei Grün gequert wird", () => {
    expect(alle(LEER, { typ: "taster", t: 0 }, { typ: "meldung", id: "gruenGequert", t: 30 }).erledigt).toContain("taster");
    expect(alle(LEER, { typ: "taster", t: 0 }, { typ: "meldung", id: "gruenGequert", t: 90 }).erledigt).not.toContain("taster");
    expect(alle(LEER, { typ: "meldung", id: "gruenGequert", t: 5 }).erledigt).not.toContain("taster");
  });

  it("zählt das Handzeichen nur mit sicherer Querung kurz danach", () => {
    expect(alle(LEER, { typ: "hand", t: 0 }, { typ: "meldung", id: "sicherGequert", t: 8 }).erledigt).toContain("hand");
    expect(alle(LEER, { typ: "meldung", id: "sicherGequert", t: 8 }).erledigt).not.toContain("hand");
  });

  it("braucht jede Schildart einmal richtig", () => {
    const arten = Object.keys(SCHILDER) as SchildArt[];
    let f = alle(LEER, ...arten.slice(1).map((art) => ({ typ: "schild" as const, art, richtig: true })));
    expect(f.erledigt).not.toContain("schilder");
    f = alle(f, { typ: "schild", art: arten[0], richtig: false });
    expect(f.erledigt).not.toContain("schilder");
    f = alle(f, { typ: "schild", art: arten[0], richtig: true });
    expect(f.erledigt).toContain("schilder");
  });

  it("besteht mit allen Pflichtaufträgen und wenigen schweren Verstößen", () => {
    const pflicht = MISSIONEN.filter((m) => m.pflicht).map((m) => m.id);
    const f: Fortschritt = { ...LEER, erledigt: pflicht };
    expect(pflichtErfuellt(f)).toBe(true);
    expect(bestanden(f)).toBe(true);
    const schlimm = alle(f, ...Array.from({ length: MAX_SCHWERE + 1 }, () => ({ typ: "meldung" as const, id: "rot" as const, t: 0 })));
    expect(bestanden(schlimm)).toBe(false);
  });

  it("spiegelt die Pflichtliste im Backend", () => {
    // api/routers/verkehr.py: PFLICHT["fuss"]
    expect(MISSIONEN.filter((m) => m.pflicht).map((m) => m.id).sort())
      .toEqual(["ampel", "bus", "hand", "lidl", "netto", "schilder", "taster", "zebra"]);
  });
});

describe("Als Gruppe über die Straße", () => {
  const quere = (g: Gruppenblick, key: string, rein: number, dauer: number, x: number) => {
    g.melde(key, false, rein - 1, [x, 0]);
    g.melde(key, true, rein, [x, 0]);
    g.melde(key, false, rein + dauer, [x, 8]);
  };

  it("erkennt die Wand: alle zugleich nebeneinander", () => {
    const g = new Gruppenblick();
    quere(g, "a", 10.3, 5, 1); quere(g, "b", 10.1, 5, 2); quere(g, "ich", 10, 5, 0);
    const u = g.urteil("ich", 15)!;
    expect(u.wand).toBe(true);
    expect(u.n).toBe(3);
    expect(u.dauer).toBeCloseTo(5.3);
  });

  it("erkennt die Schlange: einer nach dem anderen, länger auf der Fahrbahn", () => {
    const g = new Gruppenblick();
    quere(g, "a", 12, 5, 0.5); quere(g, "b", 14, 5, 0.5); quere(g, "ich", 10, 5, 0);
    const u = g.urteil("ich", 19)!;
    expect(u.wand).toBe(false);
    expect(u.dauer).toBeGreaterThan(u.einzeln + 3);
  });

  it("ist keine Gruppe mit nur zwei Leuten oder weit auseinander", () => {
    const g = new Gruppenblick();
    quere(g, "a", 10, 5, 1); quere(g, "fern", 10, 5, 80); quere(g, "ich", 10, 5, 0);
    expect(g.urteil("ich", 15)).toBeNull();
  });
});

describe("Schilder", () => {
  it("stehen in der Stadt, jede Art mindestens einmal", () => {
    const arten = new Set(baueSchilder(stadt()).map((s) => s.art));
    for (const art of Object.keys(SCHILDER)) expect(arten, art).toContain(art);
  });

  it("haben genau eine richtige Antwort unter drei", () => {
    for (const f of Object.values(SCHILDER)) {
      expect(f.antworten).toHaveLength(3);
      expect(f.richtig).toBeGreaterThanOrEqual(0);
      expect(f.richtig).toBeLessThan(3);
    }
  });
});
