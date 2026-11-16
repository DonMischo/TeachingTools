import { describe, expect, it } from "vitest";
import { DUESE_Y, E_MAX, FLEVELS, austritt, brandMitte, durchfluss, hitze, naechsterStandort, strahl, strahlTrifft } from "@/lib/feuerwehr";
import { scheitel, spfWert } from "@/lib/quadratisch";

describe("Feuerwehr", () => {
  it("Bernoulli: v = √(2p/ρ), Q = A·v", () => {
    expect(austritt(1)).toBeCloseTo(Math.sqrt(200), 9);
    expect(austritt(4)).toBeCloseTo(2 * austritt(1), 9);
    expect(durchfluss(1)).toBeCloseTo(Math.PI * 0.006 ** 2 * Math.sqrt(200) * 1000, 9);
  });
  it("der Strahl startet an der Düse mit Steigung tan α und hat den Scheitel der Wurfparabel", () => {
    const s = strahl(5, 1.2, 40), v = austritt(1.2), al = (40 * Math.PI) / 180;
    expect(s.a * (5 + s.d) ** 2 + s.e).toBeCloseTo(DUESE_Y, 2);
    expect(2 * s.a * (5 + s.d)).toBeCloseTo(Math.tan(al), 2);
    expect(scheitel(s).y).toBeCloseTo(DUESE_Y + (v * Math.sin(al)) ** 2 / (2 * 9.81), 2);
    expect(spfWert(s, 5)).toBeCloseTo(DUESE_Y, 2);
  });
  it("Hitze fällt mit 1/r², gelöschte Brände strahlen nicht", () => {
    const lv = FLEVELS[0], m = brandMitte(lv, lv.braende[0]);
    const e1 = hitze(lv, [1], m.x - 4), e2 = hitze(lv, [1], m.x - 8);
    const r1 = 16 + (m.y - 1.7) ** 2, r2 = 64 + (m.y - 1.7) ** 2;
    expect(e1 / e2).toBeCloseTo(r2 / r1, 9);
    expect(hitze(lv, [0], m.x - 1)).toBe(0);
  });
  it("Mindestabstand: am erlaubten Standort ≤ E_MAX, 10 cm näher zu heiß; ohne Glut näher", () => {
    for (const lv of FLEVELS) {
      const glut = lv.braende.map(() => 1), x = naechsterStandort(lv, glut);
      expect(hitze(lv, glut, x)).toBeLessThanOrEqual(E_MAX);
      expect(hitze(lv, glut, x + 0.1)).toBeGreaterThan(E_MAX);
      expect(naechsterStandort(lv, glut.map(() => 0))).toBeGreaterThan(x);
    }
  });
  it("jeder Einsatz ist lösbar: jeder Brand vom erlaubten Standort mit erlaubtem Druck erreichbar", () => {
    FLEVELS.forEach((lv, i) => {
      lv.braende.forEach((b, j) => {
        const x = naechsterStandort(lv, lv.braende.map(() => 1));
        let geht = false;
        for (let p = 0.2; p <= lv.pMax + 1e-9 && !geht; p += 0.1)
          for (let w = 5; w <= 80 && !geht; w++) if (strahlTrifft(lv, b, Math.min(x, 3.5 + j), p, w) || strahlTrifft(lv, b, x, p, w)) geht = true;
        expect(geht, `Einsatz ${i + 1}, Brand ${j + 1}`).toBe(true);
      });
    });
  });
});
