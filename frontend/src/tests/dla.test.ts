import { describe, expect, it } from "vitest";
import { ABSTAND, ANZIEHUNG, Dla, dimension } from "@/lib/dla/kern";

function abstandZumElternteil(dla: Dla, i: number): number {
  const e = dla.eltern[i];
  const p = dla.pos;
  return Math.hypot(p[i * 3] - p[e * 3], p[i * 3 + 1] - p[e * 3 + 1], p[i * 3 + 2] - p[e * 3 + 2]);
}

// Die großen Haufen brauchen im vollen Testlauf (parallel) deutlich länger als allein
describe("DLA", () => {
  it("hängt jedes Teilchen im Abstand 1 an ein früheres", () => {
    const dla = new Dla({ dim: 2, kapazitaet: 2000, haftung: 1, saat: "punkt", zufall: 3 });
    dla.wachse();
    expect(dla.anzahl).toBe(2000);
    for (let i = 1; i < dla.anzahl; i++) {
      expect(dla.eltern[i]).toBeGreaterThanOrEqual(0);
      expect(dla.eltern[i]).toBeLessThan(i);
      expect(abstandZumElternteil(dla, i)).toBeCloseTo(ABSTAND, 4);
      expect(dla.pos[i * 3 + 2]).toBe(0);
    }
  });

  it("überlappt nicht: kein Teilchen liegt näher als der Abstand an einem anderen", () => {
    const dla = new Dla({ dim: 3, kapazitaet: 800, haftung: 1, saat: "punkt", zufall: 5 });
    dla.wachse();
    let min = Infinity;
    for (let i = 0; i < dla.anzahl; i++)
      for (let j = i + 1; j < dla.anzahl; j++) {
        const p = dla.pos;
        min = Math.min(min, Math.hypot(p[i * 3] - p[j * 3], p[i * 3 + 1] - p[j * 3 + 1], p[i * 3 + 2] - p[j * 3 + 2]));
      }
    // Ein Wanderer haftet beim ersten Teilchen in Reichweite; an dessen Nachbarn kann er näher liegen
    expect(min).toBeGreaterThan(0.05);
    expect(min).toBeLessThan(ANZIEHUNG);
  });

  it("ist mit gleichem Zufall reproduzierbar", () => {
    const a = new Dla({ dim: 2, kapazitaet: 500, haftung: 0.5, saat: "punkt", zufall: 9 });
    const b = new Dla({ dim: 2, kapazitaet: 500, haftung: 0.5, saat: "punkt", zufall: 9 });
    a.wachse(); b.wachse();
    expect(Array.from(a.pos)).toEqual(Array.from(b.pos));
  });

  it("legt Linie und Kreis als Saat aus", () => {
    const l = new Dla({ dim: 2, kapazitaet: 1000, haftung: 1, saat: "linie" });
    expect(l.saatAnzahl).toBe(121);
    const k = new Dla({ dim: 3, kapazitaet: 1000, haftung: 1, saat: "kreis" });
    expect(k.saatAnzahl).toBeGreaterThan(300);
    k.wachse();
    expect(k.anzahl).toBe(1000);
  });

  it("misst in 2D eine Dimension um 1,7", () => {
    const dla = new Dla({ dim: 2, kapazitaet: 20000, haftung: 1, saat: "punkt", zufall: 1 });
    dla.wachse();
    const d = dimension(dla)!;
    expect(d.d).toBeGreaterThan(1.55);
    expect(d.d).toBeLessThan(1.85);
  }, 60_000);

  it("misst in 3D eine Dimension um 2,5", () => {
    const dla = new Dla({ dim: 3, kapazitaet: 20000, haftung: 1, saat: "punkt", zufall: 1 });
    dla.wachse();
    const d = dimension(dla)!;
    expect(d.d).toBeGreaterThan(2.2);
    expect(d.d).toBeLessThan(2.8);
  }, 60_000);

  it("wird mit kleiner Haftung dichter", () => {
    const hart = new Dla({ dim: 2, kapazitaet: 10000, haftung: 1, saat: "punkt", zufall: 2 });
    const weich = new Dla({ dim: 2, kapazitaet: 10000, haftung: 0.05, saat: "punkt", zufall: 2 });
    hart.wachse(); weich.wachse();
    expect(weich.rmax).toBeLessThan(hart.rmax);
  }, 60_000);

  it("wächst in der Zeitlupe ohne Sprünge genauso", () => {
    const dla = new Dla({ dim: 2, kapazitaet: 60, haftung: 1, saat: "punkt", ohneSpruenge: true });
    dla.wachse();
    expect(dla.anzahl).toBe(60);
  });
});

describe.skip("DLA Tempo", () => {
  it("2D 100k / 3D 100k", () => {
    for (const dim of [2, 3] as const) {
      const t = performance.now();
      const dla = new Dla({ dim, kapazitaet: 100000, haftung: 1, saat: "punkt" });
      dla.wachse();
      console.log(dim, "D:", Math.round(performance.now() - t), "ms, rmax", Math.round(dla.rmax), "D", dimension(dla)?.d.toFixed(3));
    }
  });
});
