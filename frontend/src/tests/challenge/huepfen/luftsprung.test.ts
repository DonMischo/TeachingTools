import { describe, it, expect } from "vitest";
import { TOR_HOCH, VJ_POGO, baueLevel, schritt, startSpieler, STILE, type Eingabe, type Level, type Spieler } from "@/lib/challenge/huepfen";

const DT = 1 / 60;
const nichts: Eingabe = { links: false, rechts: false, sprung: false, runter: false };
const lauf = (s: Spieler, e: Eingabe | ((t: number) => Eingabe), sek: number, l: Level) => {
  for (let t = 0; t < sek; t += DT) s = schritt(s, typeof e === "function" ? e(t) : e, DT, l);
  return s;
};
const welt = (fest: boolean): Level => ({ ...baueLevel(1, 3, 1), leisten: [], beweger: [], gegner: [],
  plattformen: [{ x: 0, y: 8, w: 8, cp: true, fest }, { x: 0, y: 14, w: 8, cp: true, fest: true }] });

describe("Hüpfen: durch Plattformen fallen", () => {
  it("fällt durch eine durchlässige Plattform auf die darunter", () => {
    const l = welt(false);
    const s = lauf({ ...startSpieler(l), x: 3 }, (t) => ({ ...nichts, runter: t < DT * 2 }), 1.5, l);
    expect(s.auf).toBe(1);
  });
  it("fällt nicht durch feste Plattformen", () => {
    const l = welt(true);
    const s = lauf({ ...startSpieler(l), x: 3 }, { ...nichts, runter: true }, 1.5, l);
    expect(s.auf).toBe(0);
    expect(s.y).toBe(8);
  });
  it("nur bei neuem Druck: gehaltenes ↓ beim Landen lässt nicht erneut fallen", () => {
    const l: Level = { ...welt(false), plattformen: [{ x: 0, y: 8, w: 8, cp: true }, { x: 0, y: 11, w: 8, cp: true }, { x: 0, y: 20, w: 8, cp: true, fest: true }] };
    const s = lauf({ ...startSpieler(l), x: 3 }, { ...nichts, runter: true }, 2, l);
    expect(s.auf).toBe(1); // eine Ebene tiefer gelandet und dort stehengeblieben
    const wieder = lauf({ ...s, runterVorher: false }, { ...nichts, runter: true }, 1.5, l);
    expect(wieder.auf).toBe(2);
  });
  it("Start, Tore und Ziel sind fest, Kettenplattformen dazwischen nicht", () => {
    const l = baueLevel(2, 4, 2, 5);
    expect(l.plattformen[0].fest).toBe(true);
    expect(l.plattformen[l.plattformen.length - 1].fest).toBe(true);
    for (const t of l.tueren) expect(l.plattformen[t.plat].fest).toBe(true);
    expect(l.plattformen.some((p) => !p.fest)).toBe(true);
  });
});

describe("Hüpfen: Sprung in der Luft", () => {
  const l = welt(true);
  const hoehe = (s: Spieler, e: (t: number) => Eingabe) => { let min = s.y; for (let t = 0; t < 3; t += DT) { s = schritt(s, e(t), DT, l); min = Math.min(min, s.y); } return 8 - min; };
  const start = { ...startSpieler(l), x: 3 };
  it("einmal pro Flugphase: zweiter Druck hebt, dritter nicht", () => {
    const e2 = (t: number) => ({ ...nichts, sprung: t < 0.1 || (t > 0.3 && t < 0.4) });
    const e3 = (t: number) => ({ ...nichts, sprung: t < 0.1 || (t > 0.3 && t < 0.4) || (t > 0.5 && t < 0.6) });
    const einfach = hoehe(start, (t) => ({ ...nichts, sprung: t < 0.1 }));
    expect(hoehe(start, e2)).toBeGreaterThan(einfach + 1);
    expect(hoehe(start, e3)).toBeCloseTo(hoehe(start, e2), 5);
  });
  it("wird beim Landen zurückgesetzt", () => {
    let s = lauf(start, (t) => ({ ...nichts, sprung: t < 0.1 || (t > 0.3 && t < 0.4) }), 3, l);
    expect(s.auf).toBe(0);
    expect(s.luftSprung).toBe(false);
    s = lauf(s, (t) => ({ ...nichts, sprung: t < 0.1 || (t > 0.3 && t < 0.4) }), 0.5, l);
    expect(s.luftSprunge).toBe(2);
  });
  it("gehaltenes Springen löst keinen Sprung in der Luft aus", () => {
    const s = lauf(start, { ...nichts, sprung: true }, 0.5, l);
    expect(s.luftSprung).toBe(false);
  });
  it("Tore bleiben auch mit Pogo-Stab und Doppelsprung unüberwindbar", () => {
    expect(TOR_HOCH).toBeGreaterThan(2 * (VJ_POGO * VJ_POGO) / (2 * 42) + 0.5);
    for (const stil of STILE) {
      const lv = { ...baueLevel(2, 3, 1, 3, stil), leisten: [], beweger: [], gegner: [] };
      const t = lv.tueren[0];
      let s: Spieler = { ...startSpieler(lv), x: t.x - 2.5, y: t.y, auf: t.plat, pogo: true };
      let x = s.x;
      for (let k = 0; k < 600; k++) {
        const tt = k * DT;
        s = schritt(s, { ...nichts, rechts: true, sprung: tt % 0.3 < 0.1 }, DT, lv, [true]);
        x = Math.max(x, s.x);
        if (s.auf >= 0 && s.y > t.y + 1) break;
      }
      expect(x).toBeLessThan(t.x);
    }
  });
});
