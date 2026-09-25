import { describe, expect, it } from "vitest";
import { antworte, beginne, BEAMTE, MAX_STUFE } from "@/lib/verkehr/polizei";

const fest = (n: number) => () => n;

describe("Polizei-Gespräch", () => {
  it("hat nette und grummelige Beamte, Frauen und Männer", () => {
    expect(new Set(BEAMTE.map((b) => b.laune))).toEqual(new Set(["nett", "grummelig"]));
    expect(new Set(BEAMTE.map((b) => b.frau))).toEqual(new Set([true, false]));
  });

  it("endet mit Pluspunkten, wer einsichtig antwortet", () => {
    let g = beginne("rot", fest(0));
    while (!g.ende) g = antworte(g, g.antworten.find((a) => a.wirkung < 0)!, fest(0.9));
    expect(g.ende!.stufe).toBe(0);
    expect(g.ende!.punkte).toBeGreaterThan(0);
  });

  it("bleibt bei frechen Antworten bei Stufe 3 stehen: Wache, Eltern, Bußgeld — nicht höher", () => {
    for (const anlass of ["beleidigung", "rot", "gleis"] as const) {
      let g = beginne(anlass, fest(0.8));
      let schritte = 0;
      while (!g.ende && schritte++ < 10) g = antworte(g, g.antworten.find((a) => a.wirkung > 0)!, fest(0.9));
      expect(g.ende!.stufe).toBe(MAX_STUFE);
      expect(g.ende!.text).toMatch(/Eltern/);
      expect(g.ende!.text).toMatch(/Bußgeld/);
      // Danach ändert nichts mehr etwas
      expect(antworte(g, { text: "x", wirkung: 1 })).toBe(g);
    }
  });
});
