import { describe, it, expect } from "vitest";
import { markovKarte, laengsterPfad, bauplaetze, knotenKarte, type KartenArt } from "@/lib/challenge/markovKarte";

const ARTEN: KartenArt[] = ["verlies", "haus", "labyrinth"];

describe("markovKarte", () => {
  it("ist je Seed deterministisch", () => {
    for (const a of ARTEN) {
      const x = markovKarte(5, 6, a), y = markovKarte(5, 6, a);
      expect(x.boden).toEqual(y.boden);
      expect(x.orte).toEqual(y.orte);
    }
  });
  it("alle Orte sind vom Start erreichbar, mindestens anzahlOrte, nach Entfernung sortiert", () => {
    for (const a of ARTEN) {
      for (let seed = 1; seed <= 25; seed++) {
        const k = markovKarte(seed, 3 + (seed % 6), a);
        expect(k.orte.length).toBeGreaterThanOrEqual(3 + (seed % 6));
        let davor = 0;
        for (const o of k.orte) {
          expect(k.abstand([o.x, o.y])).toBeGreaterThanOrEqual(0);
          expect(k.weg(k.start, [o.x, o.y]).length).toBeGreaterThan(0);
          expect(k.abstand([o.x, o.y])).toBeGreaterThanOrEqual(davor);
          davor = k.abstand([o.x, o.y]);
        }
      }
    }
  });
});

describe("laengsterPfad / bauplaetze", () => {
  it("Pfad ist zusammenhängend und endet weit weg; Bauplätze liegen daneben", () => {
    for (let seed = 1; seed <= 15; seed++) {
      const k = markovKarte(seed, 5, "labyrinth");
      const pfad = laengsterPfad(k);
      expect(pfad[0]).toEqual(k.start);
      for (let i = 1; i < pfad.length; i++) {
        expect(Math.abs(pfad[i][0] - pfad[i - 1][0]) + Math.abs(pfad[i][1] - pfad[i - 1][1])).toBe(1);
        expect(k.begehbar(pfad[i])).toBe(true);
      }
      const max = Math.max(...k.boden.map((_, i) => k.abstand([i % k.R, Math.floor(i / k.R)])));
      expect(k.abstand(pfad[pfad.length - 1])).toBe(max);
      expect(pfad.length).toBeGreaterThan(5);
      const plaetze = bauplaetze(k, pfad, 6);
      expect(plaetze.length).toBeGreaterThan(0);
      expect(plaetze.length).toBeLessThanOrEqual(6);
      for (const p of plaetze) {
        expect(pfad.some(q => Math.abs(q[0] - p[0]) + Math.abs(q[1] - p[1]) === 1)).toBe(true);
        expect(pfad.some(q => q[0] === p[0] && q[1] === p[1])).toBe(false);
      }
    }
  });
});

describe("knotenKarte", () => {
  it("ist zusammenhängend, Kanten führen eine Schicht weiter", () => {
    for (let seed = 1; seed <= 15; seed++) {
      const g = knotenKarte(seed, 5);
      expect(g.knoten[0].schicht).toBe(0);
      expect(g.schichten).toBeLessThanOrEqual(5);
      const erreicht = new Set([0]);
      for (let ok = true; ok;) {
        ok = false;
        for (const [a, b] of g.kanten) if (erreicht.has(a) && !erreicht.has(b)) { erreicht.add(b); ok = true; }
      }
      expect(erreicht.size).toBe(g.knoten.length);
      for (const [a, b] of g.kanten) expect(g.knoten[b].schicht).toBe(g.knoten[a].schicht + 1);
    }
  });
});
