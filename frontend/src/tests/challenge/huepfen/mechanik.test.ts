import { describe, it, expect } from "vitest";
import { VX, VJ, baueLevel, naheEdelstein, nahePogo, schritt, sterne, startSpieler, STILE, type Eingabe, type Level, type Spieler } from "@/lib/challenge/huepfen";

const DT = 1 / 60;
const nichts: Eingabe = { links: false, rechts: false, sprung: false };
const flach = (): Level => ({ ...baueLevel(1, 3, 1), leisten: [], beweger: [], gegner: [],
  plattformen: [{ x: 0, y: 8, w: 6, cp: true }, { x: 20, y: 8, w: 6, cp: true }] });
const lauf = (s: Spieler, e: Eingabe, sek: number, l: Level) => { for (let t = 0; t < sek; t += DT) s = schritt(s, e, DT, l); return s; };
const scheitel = (s: Spieler, e: (t: number) => Eingabe, l: Level) => {
  let min = s.y;
  for (let t = 0; t < 2; t += DT) { s = schritt(s, e(t), DT, l); min = Math.min(min, s.y); }
  return 8 - min;
};

describe("Hüpfen: Spielgefühl", () => {
  it("beschleunigt statt sofort Vollgas und bremst mit Reibung", () => {
    const l = flach();
    let s = schritt(startSpieler(l), { ...nichts, rechts: true }, DT, l);
    expect(s.vx).toBeGreaterThan(0);
    expect(s.vx).toBeLessThan(VX);
    s = lauf(s, { ...nichts, rechts: true }, 0.5, l);
    expect(s.vx).toBeCloseTo(VX, 5);
    s = lauf(s, nichts, 0.05, l);
    expect(s.vx).toBeGreaterThan(0);
    s = lauf(s, nichts, 0.5, l);
    expect(s.vx).toBe(0);
  });
  it("Coyote Time: Sprung kurz nach der Kante geht, zu spät nicht", () => {
    const l = flach();
    const kante = { ...startSpieler(l), x: 6.15, y: 8, auf: 0 };
    const weg = lauf(kante, { ...nichts, rechts: true }, 0.2, l); // von der Kante gelaufen
    expect(weg.auf).toBe(-1);
    const frueh = { ...startSpieler(l), x: 6.5, y: 8.1, vy: 1, auf: -1, coyote: 0.05, luftSprung: true };
    expect(schritt(frueh, { ...nichts, sprung: true }, DT, l).vy).toBeLessThan(-VJ + 1);
    const spaet = { ...frueh, coyote: 0 };
    expect(schritt(spaet, { ...nichts, sprung: true }, DT, l).vy).toBeGreaterThan(0);
  });
  it("Sprungpuffer: kurz vor der Landung gedrückt, springt sofort beim Aufsetzen", () => {
    const l = flach();
    let s: Spieler = { ...startSpieler(l), x: 3, y: 7.7, vy: 6, auf: -1, luftSprung: true };
    s = schritt(s, { ...nichts, sprung: true }, DT, l); // zu früh gedrückt
    expect(s.puffer).toBeGreaterThan(0);
    let sprang = false;
    for (let i = 0; i < 20 && !sprang; i++) { s = schritt(s, { ...nichts, sprung: true }, DT, l); sprang = s.vy < -10; }
    expect(sprang).toBe(true);
  });
  it("variable Sprunghöhe: kurz tippen ist niedriger als halten", () => {
    const l = flach();
    const start = { ...startSpieler(l), x: 3 };
    const hoch = scheitel(start, () => ({ ...nichts, sprung: true }), l);
    const tipp = scheitel(start, (t) => ({ ...nichts, sprung: t < DT * 2 }), l);
    expect(hoch).toBeGreaterThan(2.8);
    expect(tipp).toBeLessThan(hoch - 1);
    expect(tipp).toBeGreaterThan(0.5);
  });
  it("Landestaub: harte Landung zählt hoch, sanftes Aufsetzen nicht", () => {
    const l = flach();
    const hart = lauf({ ...startSpieler(l), x: 3, y: 5, auf: -1 }, nichts, 1, l);
    expect(hart.landung).toBe(1);
    const sanft = schritt({ ...startSpieler(l), x: 3, y: 7.98, vy: 1, auf: -1 }, nichts, DT, l);
    expect(sanft.auf).toBe(0);
    expect(sanft.landung).toBe(0);
  });
});

describe("Hüpfen: Pogo-Stab", () => {
  it("höherer Sprung, hält man Sprung, hüpft er immer weiter", () => {
    const l = flach();
    const normal = { ...startSpieler(l), x: 3 };
    const pogo = { ...normal, pogo: true };
    const e = () => ({ ...nichts, sprung: true });
    expect(scheitel(pogo, e, l)).toBeGreaterThan(scheitel(normal, e, l) + 1.4);
    const nach = lauf(pogo, e(), 1.5, l);
    expect(nach.landung).toBeGreaterThanOrEqual(1); // nach der Landung wieder abgesprungen
  });
  it("Pogo-Edelsteine: nur mit Stab erreichbar, Stab liegt auf dem sicheren Weg", () => {
    let gesehen = 0;
    for (const stil of STILE) for (let seed = 1; seed <= 10; seed++) for (let e = 1; e <= 3; e++) {
      const l = baueLevel(e, 5, 2, seed * 4243, stil);
      const gems = l.edelsteine.filter((g) => g.pogo);
      if (!gems.length) { expect(l.pogo).toBeNull(); continue; }
      gesehen++;
      expect(l.pogo).not.toBeNull();
      const p1 = l.plattformen[1];
      expect(l.pogo!.y).toBe(p1.y - 0.7);
      expect(l.pogo!.x).toBeGreaterThanOrEqual(p1.x);
      expect(l.pogo!.x).toBeLessThanOrEqual(p1.x + p1.w);
      expect(nahePogo({ ...startSpieler(l), x: l.pogo!.x, y: p1.y }, l.pogo!)).toBe(true);
      const L: Level = { ...l, leisten: [], beweger: [] };
      for (const g of gems) {
        const plat = l.plattformen.find((p) => g.x >= p.x && g.x <= p.x + p.w && p.y - g.y > 5)!;
        expect(plat).toBeDefined();
        const reich = (pogo: boolean) => {
          let s: Spieler = { ...startSpieler(L), x: g.x, y: plat.y, auf: l.plattformen.indexOf(plat), pogo };
          for (let t = 0; t < 1.5; t += DT) { s = schritt(s, { ...nichts, sprung: true }, DT, L); if (naheEdelstein(s, g)) return true; }
          return false;
        };
        expect(reich(true)).toBe(true);
        expect(reich(false)).toBe(false);
      }
    }
    expect(gesehen).toBeGreaterThan(5);
  });
});

describe("Hüpfen: Etappenbilanz", () => {
  it("Sterne nach Anteil", () => {
    expect(sterne(0, 0)).toBe(0);
    expect(sterne(1, 10)).toBe(0);
    expect(sterne(3, 10)).toBe(1);
    expect(sterne(6, 10)).toBe(2);
    expect(sterne(9, 10)).toBe(3);
  });
});
