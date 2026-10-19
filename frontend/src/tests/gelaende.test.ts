import { describe, expect, it } from "vitest";
import { erzeuge, LANDSCHAFTEN, wuerfle, hoeheBei, neigungBei, wasserAbstand, inAue } from "@/lib/gelaende/gelaende";
import { erosionStart, erosionSchritt, aenderung, aufGelaende, gewaesser, jahreszeit, JAHR, spiegel, STANDARD_EROSION } from "@/lib/gelaende/erosion";
import { kuesteErzeugen, kuestenSchritt, rueckgang, ueberflutet, STANDARD_KUESTE } from "@/lib/gelaende/kuestenErosion";

describe("Gelände", () => {
  it("jede Landschaft hat endliche Höhen", () => {
    for (const l of LANDSCHAFTEN) {
      const g = erzeuge({ art: l.id, seed: 7, fluss: true, relief: 1 }, 96, 32);
      expect(g.hoehe.every(Number.isFinite)).toBe(true);
    }
  });

  it("gleicher Seed, gleiches Gelände", () => {
    const a = erzeuge({ art: "flusstal", seed: 42, fluss: true, relief: 1 }, 64, 48);
    const b = erzeuge({ art: "flusstal", seed: 42, fluss: true, relief: 1 }, 64, 48);
    expect(Array.from(a.hoehe)).toEqual(Array.from(b.hoehe));
  });

  it("Flusstal: Fluss, Furt, Aue und Burgberg", () => {
    const g = erzeuge({ art: "flusstal", seed: 3, fluss: true, relief: 1 }, 128, 24);
    expect(g.wasser.some(w => w === 1)).toBe(true);
    expect(g.aue.some(a => a === 1)).toBe(true);
    expect(g.furt).not.toBeNull();
    // die Furt liegt am Wasser
    expect(wasserAbstand(g, g.furt!.x, g.furt!.y)).toBeLessThan(60);
    if (g.berg) {
      // der Berg ist höher als die Furt und nicht in der Aue
      expect(hoeheBei(g, g.berg.x, g.berg.y)).toBeGreaterThan(hoeheBei(g, g.furt!.x, g.furt!.y) + 10);
      expect(inAue(g, g.berg.x, g.berg.y)).toBe(false);
    }
  });

  it("Küste hat Meer, ohne Fluss gibt es kein Flusswasser", () => {
    const k = erzeuge({ art: "kueste", seed: 5, fluss: true, relief: 1 }, 96, 32);
    expect(k.wasser.some(w => w === 2)).toBe(true);
    const o = erzeuge({ art: "ebene", seed: 5, fluss: false, relief: 1 }, 64, 48);
    expect(o.wasser.every(w => w === 0)).toBe(true);
    expect(neigungBei(o, 1500, 1500)).toBeLessThan(5);
  });

  it("Würfel ist reproduzierbar", () => {
    expect(wuerfle(9)).toEqual(wuerfle(9));
  });
});

describe("Erosion", () => {
  it("trägt ab und lagert ab, bleibt endlich", () => {
    const g = erzeuge({ art: "huegel", seed: 11, fluss: false, relief: 1.4 }, 64, 48);
    const e = erosionStart(g);
    for (let i = 0; i < 60; i++) erosionSchritt(e);
    const d = aenderung(e);
    expect(d.every(Number.isFinite)).toBe(true);
    expect(Math.min(...d)).toBeLessThan(-0.05);
    expect(Math.max(...d)).toBeGreaterThan(0.05);
    const g2 = aufGelaende(e, g);
    expect(g2.hoehe).not.toBe(g.hoehe);
    expect(e.schritte).toBe(60);
  });
});


describe("Flüsse, Seen, Jahreszeiten", () => {
  it("Senken werden bis zum Überlauf gefüllt", () => {
    // 5×5-Schüssel: Mitte 0, Rand 2, ein Ausfluss bei 1
    const n = 5, h = new Array(25).fill(2);
    for (let j = 1; j < 4; j++) for (let i = 1; i < 4; i++) h[j * n + i] = 0;
    h[2 * n + 4] = 1;
    const F = spiegel(h, n, null);
    expect(F[12]).toBe(1);
    expect(F[0]).toBe(2);
  });
  it("Regen- und Trockenzeit wechseln", () => {
    const a = jahreszeit({ schritte: Math.round(JAHR * 0.25) }, STANDARD_EROSION);
    const b = jahreszeit({ schritte: Math.round(JAHR * 0.75) }, STANDARD_EROSION);
    expect(a.regenzeit).toBe(true);
    expect(b.regenzeit).toBe(false);
    expect(a.faktor).toBeGreaterThan(b.faktor);
  });
  it("mit Zufluss entsteht ein Gewässer", () => {
    const g = erzeuge({ art: "huegel", seed: 3, fluss: true, relief: 1 }, 64, 48);
    const e = erosionStart(g);
    for (let i = 0; i < 120; i++) erosionSchritt(e);
    const w = gewaesser(e);
    expect(w.some(x => x > 0)).toBe(true);
  });
});

describe("Küste", () => {
  it("das Kliff weicht zurück, abgetragenes Material landet woanders", () => {
    const k = kuesteErzeugen({ typ: "steil", seed: 4 }, 96, 12);
    for (let i = 0; i < 120; i++) kuestenSchritt(k, { ...STANDARD_KUESTE, sturm: i % 10 === 9 });
    expect(rueckgang(k)).toBeGreaterThan(0);
    expect(k.angelandet).toBeGreaterThan(0);
  });
  it("der Deich hält bei normaler Sturmflut, bricht bei höherem Meer", () => {
    const k = kuesteErzeugen({ typ: "deich", seed: 4, deich: 8 }, 96, 12);
    for (let i = 0; i < 3; i++) kuestenSchritt(k, { ...STANDARD_KUESTE, sturm: true });
    expect(ueberflutet(k)).toBeLessThan(1);
    for (let i = 0; i < 6; i++) kuestenSchritt(k, { ...STANDARD_KUESTE, sturm: true, anstieg: 3 });
    expect(ueberflutet(k)).toBeGreaterThan(5);
  });
});
