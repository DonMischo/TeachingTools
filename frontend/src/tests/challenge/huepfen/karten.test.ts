import { describe, it, expect } from "vitest";
import { STILE, baueLevel, edelsteineGesamt, kettePasst, schritt, startSpieler, type Level, type Spieler } from "@/lib/challenge/huepfen";

// Probe wie in level.test.ts: vom rechten Rand der Plattform i springen und auf i+1 landen
function probe(voll: Level, i: number): number {
  const l: Level = { ...voll, leisten: [], beweger: [] };
  const p = l.plattformen[i];
  let s: Spieler = { ...startSpieler(l), x: p.x + p.w, y: p.y, auf: i, cp: 0 };
  s = schritt(s, { links: false, rechts: true, sprung: true }, 1 / 60, l);
  for (let t = 0; t < 3; t += 1 / 60) {
    s = schritt(s, { links: false, rechts: t < 0.45, sprung: false }, 1 / 60, l);
    if (s.auf >= 0 && s.auf !== i) return s.auf;
  }
  return -1;
}

const gleich = (a: Level, b: Level) => JSON.stringify(a) === JSON.stringify(b);

describe("Hüpfen-Karten: dynamisch und variabel", () => {
  it("jeder Stil, viele Seeds, Etappen 1-3: Schlüssel und Türen erreichbar, Edelsteine vorhanden", () => {
    for (const stil of STILE) for (let seed = 1; seed <= 12; seed++) for (let e = 1; e <= 3; e++) {
      const l = baueLevel(e, 3 + (seed % 5), 2, seed * 7919, stil);
      expect(l.stil).toBe(stil);
      expect(kettePasst(l), `${stil} ${seed} ${e}`).toBe(true);
      for (let i = 0; i < l.plattformen.length - 1; i++) expect(probe(l, i), `${stil} s${seed} e${e} #${i}`).toBe(i + 1);
      for (const k of l.schluessel) expect(l.plattformen.some((p) => k.x >= p.x && k.x <= p.x + p.w && k.y === p.y)).toBe(true);
      for (const t of l.tueren) expect(l.plattformen[l.plattformen.length - 1].y).toBe(t.y);
      expect(edelsteineGesamt(l)).toBeGreaterThan(0);
      expect(l.plattformen.some((p, i) => i > 0 && p.cp)).toBe(true); // Kontrollpunkte unterwegs
    }
  });
  it("derselbe Seed ist deterministisch, verschiedene Seeds geben andere Karten", () => {
    expect(gleich(baueLevel(2, 6, 2, 42), baueLevel(2, 6, 2, 42))).toBe(true);
    const karten = new Set(Array.from({ length: 20 }, (_, i) => JSON.stringify(baueLevel(2, 6, 2, 1000 + i))));
    expect(karten.size).toBeGreaterThanOrEqual(18);
    expect(gleich(baueLevel(2, 6, 2, 1), baueLevel(2, 6, 2, 2))).toBe(false);
  });
  it("alle Stile kommen über die Seeds vor", () => {
    const gesehen = new Set(Array.from({ length: 200 }, (_, i) => baueLevel(1, 4, 2, i * 31 + 5).stil));
    expect([...gesehen].sort()).toEqual([...STILE].sort());
  });
  it("die Stile sehen verschieden aus (Höhenverlauf)", () => {
    const hoehen = (stil: (typeof STILE)[number]) => baueLevel(2, 6, 2, 3, stil).plattformen.map((p) => p.y).join();
    expect(new Set(STILE.map(hoehen)).size).toBe(STILE.length);
  });
});
