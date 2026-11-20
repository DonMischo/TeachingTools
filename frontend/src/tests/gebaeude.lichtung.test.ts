import { describe, expect, it } from "vitest";
import { PLATZ, WAND, baueFreiPlan, freiAbstaende, istFrei } from "@/lib/gebaeude/frei";

describe("Lichtungskarten (Wälder)", () => {
  for (const art of ["lichtung", "bach", "hoehle", "hoehlebach"] as const) {
    it(`${art}: alle Stationen und das Ziel sind von der Ankunft aus erreichbar`, () => {
      for (const seed of [1, 3, 8, 21, 42]) {
        for (const e of baueFreiPlan([2, 5, 8], seed, [art, art, art]).ebenen) {
          const d = freiAbstaende(e, e.start);
          for (const [x, y] of [e.ziel, ...e.raeume.map(r => [r.x, r.y] as [number, number])]) expect(d[y * e.b + x]).toBeGreaterThan(0);
        }
      }
    });
  }

  it("jede Lichtung hat Platz für die Station (5 × 5 Felder frei)", () => {
    const e = baueFreiPlan([6], 5, ["bach"]).ebenen[0];
    for (const [x, y] of [e.start, e.ziel, ...e.raeume.map(r => [r.x, r.y] as [number, number])]) {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) expect(e.art[(y + dy) * e.b + x + dx]).toBe(PLATZ);
    }
  });

  it("gleicher Seed, gleiche Karte", () => {
    const a = baueFreiPlan([4], 7, ["bach"]).ebenen[0], b = baueFreiPlan([4], 7, ["bach"]).ebenen[0];
    expect(Array.from(a.art)).toEqual(Array.from(b.art));
    expect(a.bruecken).toEqual(b.bruecken);
  });

  it("Rundwege: mehr Wegstücke als ein Baum bräuchte (es gibt Schleifen)", () => {
    // Zyklomatische Zahl grob: freie Felder mit 3+ freien Nachbarn außerhalb der Lichtungen zeigen Abzweige
    let schleifen = 0;
    for (const seed of [2, 4, 6, 9]) {
      const e = baueFreiPlan([6], seed, ["lichtung"]).ebenen[0];
      const ohne = new Uint8Array(e.art);
      // ein Pfadfeld weg: bleibt alles erreichbar, lag es auf einer Schleife
      const d0 = freiAbstaende(e, e.start);
      const erreichbar0 = d0.filter(v => v >= 0).length;
      for (let i = 0; i < ohne.length && !schleifen; i++) {
        if (e.art[i] !== 1) continue;
        const kopie = { ...e, art: new Uint8Array(e.art) };
        kopie.art[i] = WAND;
        if (freiAbstaende(kopie, e.start).filter(v => v >= 0).length === erreichbar0 - 1) schleifen++;
      }
    }
    expect(schleifen).toBeGreaterThan(0);
  });

  it("Bach: Wasser ist nicht begehbar, außer wo eine Brücke den Pfad trägt", () => {
    let brueckenGesamt = 0;
    for (const seed of [1, 3, 8, 21]) {
      const e = baueFreiPlan([5], seed, ["bach"]).ebenen[0];
      expect(e.wasser).toBeDefined();
      brueckenGesamt += e.bruecken!.length;
      for (let y = 0; y < e.h; y++) for (let x = 0; x < e.b; x++) {
        if (!e.wasser![y * e.b + x] || !istFrei(e, x, y)) continue;
        // begehbares Wasser liegt unter einer Brücke
        expect(e.bruecken!.some(b => Math.hypot(b.x - x - 0.5, b.y - y - 0.5) < 4)).toBe(true);
      }
    }
    expect(brueckenGesamt).toBeGreaterThan(0);
  });
});
