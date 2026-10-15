import { describe, it, expect } from "vitest";
import { themeVon } from "@/lib/challenge/themes";
import { baueLevel, edelsteineGesamt, figurBilder, schritt, startSpieler } from "@/lib/challenge/huepfen";
import { kettePasst, probe, pruefeAufbau } from "./kette";

describe("Hüpfen-Level", () => {
  for (const [etappe, n, t] of [[1, 1, 1], [1, 5, 2], [2, 8, 3], [3, 12, 4], [4, 0, 1], [5, 12, 5], [1, 4, 0]]) {
    it(`Etappe ${etappe}, ${n} Schlüssel, ${t} Tore: alles erreichbar`, () => {
      const l = baueLevel(etappe, n, t);
      expect(kettePasst(l)).toBe(true);
      expect(pruefeAufbau(l, n, t)).toEqual([]);
      for (let i = 0; i < l.plattformen.length - 1; i++) expect(probe(l, i)).toBe(i + 1);
    });
  }
  it("ist deterministisch", () => {
    expect(baueLevel(2, 6, 2)).toEqual(baueLevel(2, 6, 2));
  });
  it("Absturz setzt zum Kontrollpunkt zurück", () => {
    const l = baueLevel(1, 4, 1);
    const s = schritt({ ...startSpieler(l), x: 30, y: l.hoehe + 5, auf: -1, vy: 5 }, { links: false, rechts: false, sprung: false }, 1 / 60, l);
    expect(s.auf).toBe(0);
  });
  it("Fallen ist gedeckelt (Fallen mit Kontrolle)", () => {
    const l = baueLevel(1, 4, 1);
    let s = { ...startSpieler(l), x: 30, y: -50, auf: -1 };
    for (let i = 0; i < 60; i++) s = schritt(s, { links: false, rechts: false, sprung: false }, 1 / 60, l);
    expect(s.vy).toBeLessThanOrEqual(22);
  });
  it("Schlüssel liegen alle vor dem ersten Tor, Tore stehen der Reihe nach, hinter jedem Tor ist eine Fahne", () => {
    for (let e = 1; e <= 3; e++) for (const n of [2, 5, 9, 12]) {
      const l = baueLevel(e, n, 3, e * 13 + n);
      expect(pruefeAufbau(l, n, 3)).toEqual([]);
      for (const t of l.tueren) expect(l.plattformen[t.plat].y).toBe(t.y);
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
    for (const g of l.gegner) expect(l.tueren.some((t) => t.plat === g.plat)).toBe(false);
  });
  it("Blickrichtung: links -> links-Frames, rechts -> rechts-Frames, Stand behält die Richtung", () => {
    const { laufen } = themeVon("klassisch").spieler;
    expect(figurBilder(laufen, -1, true).frames).toBe(laufen.links);
    expect(figurBilder(laufen, 1, true).frames).toBe(laufen.rechts);
    expect(figurBilder(laufen, -1, false)).toEqual({ frame: laufen.links[0] });
    expect(figurBilder(laufen, 1, false).frame).toBe(laufen.rechts[0]);
  });
});
