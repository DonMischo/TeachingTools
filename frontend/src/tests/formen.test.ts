import { describe, expect, it } from "vitest";
import { KLIMATE, schritt } from "@/lib/gelaende/verwitterung";
import { querschnitt } from "@/lib/gelaende/querschnitte";
import { formenErkennen } from "@/lib/gelaende/formen";
import { kuesteErzeugen, kuestenSchritt, kuestenFormen, STANDARD_KUESTE } from "@/lib/gelaende/kuestenErosion";
import { erzeuge } from "@/lib/gelaende/gelaende";
import { erosionStart, erosionSchritt, flussFormen } from "@/lib/gelaende/erosion";

describe("Formen erkennen", () => {
  it("unberührter Karst hat noch keine Formen, nach Verkarstung Höhle und Doline", () => {
    const q = querschnitt("kalk", 3);
    expect(formenErkennen(q).filter(f => f.art.includes("höhle") || f.art.includes("doline"))).toHaveLength(0);
    const k = KLIMATE.find(x => x.id === "mittel")!.k;
    for (let i = 0; i < 1200; i++) schritt(q, k);
    const arten = new Set(formenErkennen(q).map(f => f.art));
    expect([...arten].some(a => /Höhle|Höhlenbach|Tropfsteinhöhle|Karströhre/.test(a)), [...arten].join()).toBe(true);
    expect([...arten].some(a => /doline/.test(a)), [...arten].join()).toBe(true);
  }, 300000);

  it("Granit im Harz: Wollsäcke werden erkannt", () => {
    const q = querschnitt("granit", 3);
    const k = KLIMATE.find(x => x.id === "harz")!.k;
    for (let i = 0; i < 900; i++) schritt(q, k);
    expect(formenErkennen(q).some(f => f.art === "Wollsack" || f.art === "Felsburg")).toBe(true);
  }, 300000);

  it("Küste: Kliff und Deichbruch", () => {
    const s = kuesteErzeugen({ typ: "steil", seed: 4 }, 128, 12);
    for (let i = 0; i < 60; i++) kuestenSchritt(s, { ...STANDARD_KUESTE, sturm: i % 10 === 9 });
    expect(kuestenFormen(s, STANDARD_KUESTE).some(m => m.text.includes("Kliff"))).toBe(true);
    const d = kuesteErzeugen({ typ: "deich", seed: 4, deich: 6 }, 128, 12);
    const p = { ...STANDARD_KUESTE, sturm: true, anstieg: 3 };
    for (let i = 0; i < 6; i++) kuestenSchritt(d, p);
    expect(kuestenFormen(d, p).some(m => m.text.includes("Deichbruch") || m.text.includes("überflutet"))).toBe(true);
  });

  it("Flüsse: nach Erosion gibt es Beschriftungen", () => {
    const g = erzeuge({ art: "huegel", seed: 12, fluss: true, relief: 1.3 }, 128, 24);
    const e = erosionStart(g);
    for (let i = 0; i < 150; i++) erosionSchritt(e);
    expect(flussFormen(e, g).length).toBeGreaterThan(0);
  });
});
