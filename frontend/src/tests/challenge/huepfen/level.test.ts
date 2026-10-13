import { describe, it, expect } from "vitest";
import { themeVon } from "@/lib/challenge/themes";
import { baueLevel, edelsteineGesamt, figurBilder, kettePasst, schritt, startSpieler, type Level, type Spieler } from "@/lib/challenge/huepfen";

// Probe: vom rechten Rand der Plattform i springen (rechts gehalten, nach 0,45 s loslassen) und auf i+1 landen
function probe(voll: Level, i: number): number {
  const l: Level = { ...voll, leisten: [], beweger: [] }; // sicherer Weg ohne Extras
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
  it("Etappen 1-3 mehrere Seeds: Schlüssel und Türen auf der erreichbaren Kette", () => {
    for (let e = 1; e <= 3; e++) for (const n of [2, 5, 9]) {
      const l = baueLevel(e, n, 2);
      for (let i = 0; i < l.plattformen.length - 1; i++) expect(probe(l, i)).toBe(i + 1);
      for (const k of l.schluessel) expect(l.plattformen.some((p) => k.x >= p.x && k.x <= p.x + p.w && k.y === p.y)).toBe(true);
      for (const t of l.tueren) expect(l.plattformen[l.plattformen.length - 1].y).toBe(t.y);
    }
  });
  it("Edelsteine: vorhanden und mehr in späteren Etappen, Gegner nur auf Plattformen ohne Schlüssel", () => {
    const zahl = [1, 2, 3].map((e) => edelsteineGesamt(baueLevel(e, 6, 2)));
    expect(zahl[0]).toBeGreaterThan(0);
    expect(zahl[2]).toBeGreaterThan(zahl[0]);
    const l = baueLevel(3, 6, 2);
    expect(l.gegner.length).toBeGreaterThan(0);
    expect(l.beweger.length).toBeGreaterThan(0);
    for (const g of l.gegner) expect(l.schluessel.some((k) => k.x >= l.plattformen[g.plat].x && k.x <= l.plattformen[g.plat].x + l.plattformen[g.plat].w)).toBe(false);
  });
  it("Blickrichtung: links -> links-Frames, rechts -> rechts-Frames, Stand behält die Richtung", () => {
    const { laufen } = themeVon("klassisch").spieler;
    expect(figurBilder(laufen, -1, true).frames).toBe(laufen.links);
    expect(figurBilder(laufen, 1, true).frames).toBe(laufen.rechts);
    expect(figurBilder(laufen, -1, false)).toEqual({ frame: laufen.links[0] });
    expect(figurBilder(laufen, 1, false).frame).toBe(laufen.rechts[0]);
  });
});
