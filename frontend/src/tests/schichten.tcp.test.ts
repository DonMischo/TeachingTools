import { describe, expect, it } from "vitest";
import { tcpLauf } from "@/lib/schichten/tcp";
import { bitsVon, signal } from "@/lib/schichten/signal";

describe("TCP bei Paketverlust", () => {
  it("ohne Verlust: jedes Stück genau einmal, keine Wiederholung", () => {
    const l = tcpLauf(20, 0, 5);
    expect(l.pfeile.filter(p => p.art === "daten")).toHaveLength(20);
    expect(l.wiederholungen).toBe(0);
    expect(l.geliefert.map(g => g.nr)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it("mit Verlust: alles kommt an, in Reihenfolge, Verlorenes wird wiederholt", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const l = tcpLauf(30, 0.2, 6, seed);
      expect(l.geliefert.map(g => g.nr)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
      expect(l.wiederholungen).toBeGreaterThanOrEqual(l.verloren);
      expect(l.verloren).toBeGreaterThan(0);
      // geliefert wird nie früher als ein Vorgänger
      for (let i = 1; i < l.geliefert.length; i++) expect(l.geliefert[i].t).toBeGreaterThanOrEqual(l.geliefert[i - 1].t);
    }
  });

  it("nutzt beide Wege der Wiederholung", () => {
    const gruende = new Set<string>();
    for (let seed = 1; seed < 30; seed++) for (const p of tcpLauf(30, 0.25, 8, seed).pfeile) if (p.wiederholt) gruende.add(p.wiederholt);
    expect(gruende).toEqual(new Set(["dreifach", "zeit"]));
  });
});

describe("Signal", () => {
  it("Manchester: in jeder Bitmitte ein Sprung", () => {
    const s = signal([1, 0], "kupfer", 4);
    expect(s).toEqual([-1, -1, 1, 1, 1, 1, -1, -1]);
  });

  it("Ethernet sendet das niedrigste Bit zuerst", () => {
    expect(bitsVon(Uint8Array.of(0xd5), 1)).toEqual([1, 1, 0, 1, 0, 1, 0, 1]);
    expect(bitsVon(Uint8Array.of(0xd5), 1, true)).toEqual([1, 0, 1, 0, 1, 0, 1, 1]);
  });
});
