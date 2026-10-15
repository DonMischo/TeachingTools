import { describe, it, expect } from "vitest";
import { STILE, TOR_HALB, baueLevel, edelsteineGesamt, schritt, startSpieler, type Level, type Spieler } from "@/lib/challenge/huepfen";
import { kettePasst, probe, pruefeAufbau } from "./kette";

const gleich = (a: Level, b: Level) => JSON.stringify(a) === JSON.stringify(b);
const nichts = { links: false, rechts: false, sprung: false };

describe("Hüpfen-Karten: dynamisch und variabel", () => {
  it("jeder Stil, viele Seeds, Etappen 1-3: Kette machbar, Schlüssel vor dem ersten Tor, Tore ohne Umgehung", () => {
    for (const stil of STILE) for (let seed = 1; seed <= 25; seed++) for (let e = 1; e <= 3; e++) {
      const nF = 1 + ((seed * 5) % 12), nT = 1 + (seed % 4);
      const l = baueLevel(e, nF, nT, seed * 7919, stil);
      expect(l.stil).toBe(stil);
      const wo = `${stil} s${seed} e${e}`;
      expect(kettePasst(l), wo).toBe(true);
      expect(pruefeAufbau(l, nF, nT), wo).toEqual([]);
      for (let i = 0; i < l.plattformen.length - 1; i++) expect(probe(l, i), `${wo} #${i}`).toBe(i + 1);
      expect(edelsteineGesamt(l)).toBeGreaterThan(0);
      expect(l.plattformen.some((p, i) => i > 0 && p.cp)).toBe(true); // Kontrollpunkte unterwegs
    }
  });
  it("Welt wächst nach oben und unten: Höhe und Breite deutlich größer als die Ansicht", () => {
    for (const stil of STILE) for (let seed = 1; seed <= 10; seed++) {
      const l = baueLevel(1, 6, 2, seed * 31, stil);
      const ys = l.plattformen.map((p) => p.y);
      expect(l.hoehe, stil).toBeGreaterThanOrEqual(20);
      expect(Math.max(...ys) - Math.min(...ys), stil).toBeGreaterThanOrEqual(9);
      let auf = 0, ab = 0;
      l.plattformen.forEach((p, i) => { if (i) { const d = l.plattformen[i - 1].y - p.y; if (d > 0) auf += d; else ab -= d; } });
      if (stil === "tuerme" || stil === "inseln") expect(auf, stil).toBeGreaterThanOrEqual(8);
      if (stil === "hoehle" || stil === "tal") expect(ab, stil).toBeGreaterThanOrEqual(6);
      if (stil === "zickzack" || stil === "treppe" || stil === "tal") { expect(auf, stil).toBeGreaterThan(0); expect(ab, stil).toBeGreaterThan(0); }
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

describe("Hüpfen-Tore", () => {
  it("ein geschlossenes Tor hält die Figur auf, auch mit Sprüngen und Pogo; offen geht es hindurch", () => {
    for (const stil of STILE) {
      const l = baueLevel(2, 4, 3, 77, stil);
      const zu = l.tueren.map(() => true);
      const t = l.tueren[0], p = l.plattformen[t.plat];
      for (const pogo of [false, true]) {
        let s: Spieler = { ...startSpieler(l), x: p.x + 0.5, y: p.y, auf: t.plat, pogo };
        let versuche = 0;
        for (let k = 0; k < 600; k++) {
          s = schritt(s, { links: false, rechts: true, sprung: k % 40 < 20 }, 1 / 60, l, zu);
          versuche++;
          expect(s.x, stil).toBeLessThanOrEqual(t.x - TOR_HALB + 1e-6);
        }
        expect(versuche).toBe(600);
        expect(s.x).toBeGreaterThan(t.x - TOR_HALB - 0.2);
      }
      let s: Spieler = { ...startSpieler(l), x: p.x + 0.5, y: p.y, auf: t.plat };
      let max = s.x;
      for (let k = 0; k < 240; k++) { s = schritt(s, { ...nichts, rechts: true }, 1 / 60, l, l.tueren.map((_, i) => i !== 0)); max = Math.max(max, s.x); }
      expect(max, stil).toBeGreaterThan(t.x + TOR_HALB);
    }
  });
  it("ein Tor sperrt nur seine Spalte: andere geschlossene Tore stören davor nicht", () => {
    const l = baueLevel(1, 3, 2, 5, "treppe");
    const s0: Spieler = { ...startSpieler(l), x: l.plattformen[0].x + 1 };
    const s = schritt(s0, { ...nichts, rechts: true }, 1 / 60, l, l.tueren.map(() => true));
    expect(s.x).toBeGreaterThan(s0.x);
  });
});
