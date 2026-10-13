import { describe, it, expect } from "vitest";
import { baueLevel, kettePasst, schritt, startSpieler, type Level, type Spieler } from "@/lib/challenge/huepfen";

// Probe: vom rechten Rand der Plattform i springen (rechts gehalten, nach 0,45 s loslassen) und auf i+1 landen
function probe(l: Level, i: number): number {
  const p = l.plattformen[i];
  let s: Spieler = { ...startSpieler(l), x: p.x + p.w, y: p.y, auf: i, cp: 0 };
  let t = 0;
  s = schritt(s, { links: false, rechts: true, sprung: true }, 1 / 60, l);
  for (; t < 3; t += 1 / 60) {
    s = schritt(s, { links: false, rechts: t < 0.45, sprung: false }, 1 / 60, l);
    if (s.auf >= 0 && s.auf !== i) return s.auf;
  }
  return -1;
}

describe("Hüpfen-Level", () => {
  for (const [etappe, n, t] of [[1, 1, 1], [1, 5, 2], [2, 8, 3], [3, 20, 4], [4, 0, 1], [5, 30, 5]]) {
    it(`Etappe ${etappe}, ${n} Schlüssel: alle erreichbar`, () => {
      const l = baueLevel(etappe, n, t);
      expect(kettePasst(l)).toBe(true);
      expect(l.schluessel).toHaveLength(n);
      expect(l.tueren).toHaveLength(t);
      for (let i = 0; i < l.plattformen.length - 1; i++) expect(probe(l, i)).toBe(i + 1);
    });
  }
  it("ist deterministisch", () => {
    expect(baueLevel(2, 6, 2)).toEqual(baueLevel(2, 6, 2));
  });
  it("Absturz setzt zum Kontrollpunkt zurück", () => {
    const l = baueLevel(1, 4, 1);
    const s = schritt({ ...startSpieler(l), x: 30, y: 30, auf: -1, vy: 5 }, { links: false, rechts: false, sprung: false }, 1 / 60, l);
    expect(s.auf).toBe(0);
  });
});
