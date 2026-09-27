import { describe, expect, it } from "vitest";
import { bestanden, zeugnisErzeugen } from "@/lib/leben/zeugnis";

const basis = { Deutsch: 4, Mathematik: 4, Englisch: 4, Biologie: 4, Chemie: 4, Physik: 4, Geschichte: 4, Sport: 4 };

describe("Abschlusszeugnis nach § 51 ThürSchulO", () => {
  it("eine Fünf ist ohne Ausgleich erlaubt", () => {
    expect(bestanden({ ...basis, Chemie: 5 }).ok).toBe(true);
  });
  it("zwei Fünfen brauchen Ausgleich", () => {
    expect(bestanden({ ...basis, Chemie: 5, Physik: 5 }).ok).toBe(false);
    expect(bestanden({ ...basis, Chemie: 5, Physik: 5, Biologie: 2, Geschichte: 3, Sport: 3 }).ok).toBe(true);
  });
  it("eine Sechs braucht eine Eins oder zwei Zweien", () => {
    expect(bestanden({ ...basis, Chemie: 6, Biologie: 2 }).ok).toBe(false);
    expect(bestanden({ ...basis, Chemie: 6, Biologie: 2, Sport: 2 }).ok).toBe(true);
    expect(bestanden({ ...basis, Chemie: 6, Sport: 1 }).ok).toBe(true);
  });
  it("Kernfächer gleichen nur untereinander aus", () => {
    expect(bestanden({ ...basis, Mathematik: 5, Englisch: 5, Sport: 1, Biologie: 1 }).ok).toBe(false);
    expect(bestanden({ ...basis, Mathematik: 5, Englisch: 5, Deutsch: 2, Sport: 1 }).ok).toBe(false);
    expect(bestanden({ ...basis, Mathematik: 6, Deutsch: 1 }).ok).toBe(true);
  });
  it("Sechs und Fünf zusammen oder drei Fünfen fallen durch", () => {
    expect(bestanden({ ...basis, Chemie: 6, Physik: 5, Sport: 1, Biologie: 1 }).ok).toBe(false);
    expect(bestanden({ ...basis, Chemie: 5, Physik: 5, Geschichte: 5, Sport: 1, Biologie: 1 }).ok).toBe(false);
  });
  it("erzeugte Zeugnisse sind bestanden und passen zur Stufe", () => {
    const schnitt = (n: Record<string, number | undefined>) => { const v = Object.values(n) as number[]; return v.reduce((a, b) => a + b, 0) / v.length; };
    for (let i = 0; i < 50; i++) {
      const g = zeugnisErzeugen("gut"), m = zeugnisErzeugen("mittel"), s = zeugnisErzeugen("schlecht");
      for (const z of [g, m, s]) expect(bestanden(z).ok).toBe(true);
      expect(schnitt(g)).toBeLessThan(schnitt(s));
      expect(Object.values(s).some((n) => (n ?? 0) >= 5)).toBe(true);
      expect(g.Deutsch).toBeDefined();
    }
  });
});
