import { describe, expect, it } from "vitest";
import { HEBEL, HUB, Wagenheber, kreis } from "@/lib/stroemung/wagenheber";

const e = { d1: 0.03, d2: 0.12, last: 12000, hand: 150, blase: false };
const pumpen = (w: Wagenheber, n: number) => { for (let i = 0; i < n; i++) { w.bewege(HUB); w.bewege(0); } };

describe("Wagenheber", () => {
  it("jeder Stoß hebt um HUB·A₁/A₂, das Öl kommt aus dem Vorrat und bleibt erhalten", () => {
    const w = new Wagenheber(e);
    const oel = w.oel;
    pumpen(w, 5);
    expect(w.hebung).toBeCloseTo(5 * HUB * kreis(0.03) / kreis(0.12), 9);
    expect(w.oel).toBeCloseTo(oel, 12);
    expect(w.stoesse).toBe(5);
  });

  it("Hebel: 150 N an der Hand werden 1200 N am Kolben; reicht das nicht, bleibt der Hebel stehen", () => {
    const w = new Wagenheber(e);
    expect(w.kolbenkraft).toBe(150 * HEBEL);
    expect(w.stark).toBe(true);
    const schwer = new Wagenheber({ ...e, last: 40000 });
    expect(schwer.stark).toBe(false);
    expect(schwer.bewege(HUB)).toBe(0);
    expect(schwer.blockiert).toBe(true);
    expect(schwer.hebung).toBe(0);
  });

  it("Ablassen senkt die Last und füllt den Vorrat wieder", () => {
    const w = new Wagenheber(e);
    pumpen(w, 10);
    const vorher = w.vorrat, oel = w.oel;
    for (let i = 0; i < 1000; i++) w.ablassen(0.05);
    expect(w.hebung).toBe(0);
    expect(w.vorrat).toBeGreaterThan(vorher);
    expect(w.oel).toBeCloseTo(oel, 12);
  });

  it("mit Luftblase hebt jeder Stoß weniger", () => {
    const ohne = new Wagenheber(e), mit = new Wagenheber({ ...e, blase: true });
    pumpen(ohne, 3); pumpen(mit, 3);
    expect(mit.hebung).toBeLessThan(ohne.hebung);
    expect(mit.hebung).toBeGreaterThan(0);
  });
});
