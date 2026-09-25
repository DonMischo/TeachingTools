import { describe, expect, it } from "vitest";
import { stadt, schulStart } from "@/lib/verkehr/stadt";
import { gehMinuten, suche, suchIndex, Wegenetz } from "@/lib/verkehr/handy";

const s = stadt();
const index = suchIndex(s);

describe("Handy: Suche", () => {
  it("findet die Schule, Adressen mit Hausnummer, Läden und Haltestellen", () => {
    expect(suche(index, "eugen richter 22")[0].art).toBe("schule");
    const adr = suche(index, "Eugen-Richter-Str. 12");
    expect(adr[0].name).toBe("Eugen-Richter-Straße 12");
    expect(suche(index, "aldi")[0].name).toMatch(/Aldi/);
    expect(suche(index, "fritz büchner").some((z) => z.art === "halt")).toBe(true);
    expect(suche(index, "")).toEqual([]);
  });
});

describe("Handy: Route", () => {
  const netz = new Wegenetz(s);
  it("findet von der Schule zum Aldi einen Fußweg, der nicht viel länger ist als die Luftlinie", () => {
    const aldi = suche(index, "aldi")[0];
    const start = schulStart(s);
    const r = netz.route(start, aldi.p)!;
    expect(r).not.toBeNull();
    const luft = Math.hypot(aldi.p[0] - start[0], aldi.p[1] - start[1]);
    expect(r.laenge).toBeGreaterThan(luft * 0.95);
    expect(r.laenge).toBeLessThan(luft * 2);
    expect(r.punkte[0]).toEqual(start);
    expect(r.punkte[r.punkte.length - 1]).toEqual(aldi.p);
    expect(gehMinuten(r.laenge)).toBeGreaterThan(1);
  });
});

describe("Handy: Fußweg", () => {
  it("führt über Gehwege: kaum ein Stück auf der Fahrbahn", async () => {
    const { fussweg } = await import("@/lib/verkehr/handy");
    const netz = new Wegenetz(s);
    const start = schulStart(s);
    const ziel = suche(index, "netto")[0];
    const t0 = performance.now();
    const r = fussweg(s, netz, start, ziel.p)!;
    const dauer = performance.now() - t0;
    expect(r).not.toBeNull();
    let fahrbahn = 0, gesamt = 0;
    for (let i = 1; i < r.punkte.length; i++) {
      const [a, b] = [r.punkte[i - 1], r.punkte[i]];
      const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      for (let k = 0; k < l; k += 1) {
        const x = a[0] + ((b[0] - a[0]) * k) / l, y = a[1] + ((b[1] - a[1]) * k) / l;
        gesamt++;
        if (s.untergrund(x, y).art === "fahrbahn") fahrbahn++;
      }
    }
    // Nur zum Queren auf der Fahrbahn
    expect(fahrbahn / gesamt).toBeLessThan(0.15);
    expect(dauer).toBeLessThan(3000);
  });
});
