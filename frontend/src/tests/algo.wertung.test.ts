import { describe, expect, it } from "vitest";
import { aufgabenWertung, levelWertung, zeitPunkte } from "@/lib/algo/wertung";
import { hilfebedarf, hilfestufe } from "@/lib/algo/hilfe";

describe("Wertung", () => {
  const basis = { bloecke: 7, optimal: 7, fehlversuche: 0, sekunden: 30, richtzeit: 100 };
  it("perfekt = 3 Sterne, 1000 Punkte", () => {
    expect(levelWertung(basis)).toEqual({ sterne: 3, punkte: 1000 });
  });
  it("Fehlversuche kosten Punkte und Sterne", () => {
    expect(levelWertung({ ...basis, fehlversuche: 2 })).toEqual({ sterne: 2, punkte: 800 });
    expect(levelWertung({ ...basis, fehlversuche: 5 }).sterne).toBe(1);
  });
  it("mehr Bausteine kosten anteilig", () => {
    expect(levelWertung({ ...basis, bloecke: 14 })).toEqual({ sterne: 1, punkte: 750 });
  });
  it("Zeit ist nur ein kleiner Anteil", () => {
    expect(zeitPunkte(100, 100)).toBe(100);
    expect(zeitPunkte(200, 100)).toBe(50);
    expect(zeitPunkte(400, 100)).toBe(0);
    expect(zeitPunkte(200, 100, true)).toBe(100);
  });
  it("Vorführen halbiert und deckelt die Sterne", () => {
    expect(levelWertung({ ...basis, vorgefuehrt: true })).toEqual({ sterne: 1, punkte: 500 });
    expect(aufgabenWertung({ fehlversuche: 0, sekunden: 10, richtzeit: 60 })).toEqual({ sterne: 3, punkte: 1000 });
  });
});

describe("Unscharfe Hilfe", () => {
  it("wer flott und fehlerfrei ist, bekommt keine Hilfe", () => {
    expect(hilfestufe({ fehlversuche: 0, zeitAnteil: 0.2, untaetig: 5 })).toBe(0);
  });
  it("Hilfe wächst mit Fehlversuchen, Zeit und Untätigkeit", () => {
    const a = hilfebedarf({ fehlversuche: 1, zeitAnteil: 0.8, untaetig: 10 });
    const b = hilfebedarf({ fehlversuche: 2, zeitAnteil: 1.5, untaetig: 10 });
    const c = hilfebedarf({ fehlversuche: 4, zeitAnteil: 2.5, untaetig: 90 });
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
    expect(hilfestufe({ fehlversuche: 4, zeitAnteil: 2.5, untaetig: 90 })).toBe(3);
  });
  it("Hilfsmodus hilft früher", () => {
    const e = { fehlversuche: 1, zeitAnteil: 0.9, untaetig: 15 };
    expect(hilfestufe({ ...e, hilfsmodus: true })).toBeGreaterThan(hilfestufe(e));
  });
});

describe("Stand vereinigen (Browser + Server)", () => {
  it("nimmt je Level und Aufgabe das Beste", async () => {
    const { vereinige, LEER_STAND } = await import("@/lib/algo/fortschritt");
    const browser = { ...LEER_STAND, level: { "1-1": { sterne: 1, bloecke: 5, punkte: 300 } }, fluss: ["formen"] };
    const server = { level: { "1-1": { sterne: 3, bloecke: 7, punkte: 900 }, "1-2": { sterne: 2, bloecke: 4, punkte: 600 } }, fluss: [], automat: ["kaugummi"], wertung: { "automat:kaugummi": { sterne: 2, punkte: 500 } } };
    const s = vereinige(browser, server);
    expect(s.level["1-1"]).toEqual({ sterne: 3, bloecke: 5, punkte: 900 });
    expect(s.level["1-2"].sterne).toBe(2);
    expect(s.fluss).toEqual(["formen"]);
    expect(s.automat).toEqual(["kaugummi"]);
    expect(s.wertung["automat:kaugummi"]).toEqual({ sterne: 2, punkte: 500 });
  });
});
