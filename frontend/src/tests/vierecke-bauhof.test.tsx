/**
 * Bauhof (Vierecke-Spiel): Jedes Gehege-Level ist lösbar, die beste Fläche
 * stimmt, Wand-Level lassen sich mit den gierigen Strichen genau streichen,
 * und das Blatt öffnet mit beiden Aufträgen.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Vierecke from "@/components/simulationen/Vierecke";
import {
  aufziehen, besteFlaeche, bewerteGehege, flaeche, gehegeLevel, gierigeStriche, passt, umfang, wandLevel, wandSterne, zellen,
} from "@/lib/vierecke-bauhof";

function zufall(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe("Gehege bauen", () => {
  it("Rechteck aufziehen geht in jede Richtung", () => {
    expect(aufziehen(5, 4, 2, 1)).toEqual({ x: 2, y: 1, b: 4, h: 4 });
    expect(umfang({ x: 0, y: 0, b: 4, h: 3 })).toBe(14);
    expect(flaeche({ x: 0, y: 0, b: 4, h: 3 })).toBe(12);
  });

  it("beste Fläche: bei 16 Zaun auf freiem Feld das Quadrat 4 × 4", () => {
    expect(besteFlaeche(Array(9).fill("............"), 16)).toBe(16);
    expect(besteFlaeche(Array(9).fill("............"), 14)).toBe(12);
  });

  it("jedes Level ist lösbar und die beste Fläche erfüllt den Bedarf", () => {
    const r = zufall(4);
    for (let nr = 1; nr <= 40; nr++) {
      const l = gehegeLevel(nr, r);
      expect(l.beste).toBeGreaterThanOrEqual(l.bedarf);
      // Ein Rechteck mit der besten Fläche finden und bewerten lassen
      let gefunden = false;
      for (let y = 0; y < l.h && !gefunden; y++) for (let x = 0; x < l.w && !gefunden; x++)
        for (let h = 1; y + h <= l.h && !gefunden; h++) for (let b = 1; x + b <= l.w && !gefunden; b++) {
          const q = { x, y, b, h };
          if (flaeche(q) === l.beste && umfang(q) <= l.zaun && passt(l.gitter, q)) {
            expect(bewerteGehege(l, q)).toEqual({ ok: true, sterne: 3 });
            gefunden = true;
          }
        }
      expect(gefunden).toBe(true);
    }
  });

  it("zu wenig Zaun, zu eng oder Felsen im Gehege: nicht ok", () => {
    const l = { nr: 1, w: 6, h: 4, gitter: ["......", "..F...", "......", "......"], tier: { emoji: "🐐", name: "Ziegen" }, zaun: 10, bedarf: 4, beste: 6 };
    expect(bewerteGehege(l, { x: 0, y: 0, b: 6, h: 1 }).ok).toBe(false); // u = 14 > 10
    expect(bewerteGehege(l, { x: 0, y: 0, b: 1, h: 3 }).ok).toBe(false); // A = 3 < 4
    expect(bewerteGehege(l, { x: 1, y: 0, b: 2, h: 2 }).ok).toBe(false); // Felsen
    expect(bewerteGehege(l, { x: 3, y: 0, b: 2, h: 2 })).toEqual({ ok: true, sterne: 1 });
  });
});

describe("Wand streichen", () => {
  it("die gierigen Striche decken die Wand genau einmal ab", () => {
    const r = zufall(8);
    for (let nr = 1; nr <= 30; nr++) {
      const l = wandLevel(nr, r);
      const striche = gierigeStriche(l.gitter);
      const zaehler = new Map<string, number>();
      for (const s of striche) for (const [x, y] of zellen(s)) {
        expect(l.gitter[y][x]).toBe(".");
        zaehler.set(`${x},${y}`, (zaehler.get(`${x},${y}`) ?? 0) + 1);
      }
      expect([...zaehler.values()].every(n => n === 1)).toBe(true);
      expect(zaehler.size).toBe(l.flaeche);
      expect(striche.length).toBe(l.profi);
      expect(l.gitter.join("")).toMatch(/T/);
    }
  });

  it("Sterne nach Strichzahl", () => {
    const l = { nr: 1, w: 1, h: 1, gitter: ["."], flaeche: 1, profi: 4 };
    expect(wandSterne(l, 3)).toBe(3);
    expect(wandSterne(l, 4)).toBe(3);
    expect(wandSterne(l, 5)).toBe(2);
    expect(wandSterne(l, 9)).toBe(1);
  });
});

describe("Blatt Bauhof", () => {
  it("öffnet mit beiden Aufträgen", () => {
    render(<Vierecke />);
    fireEvent.click(screen.getByRole("button", { name: /Bauhof/ }));
    expect(screen.getByRole("application", { name: /Gehege aufziehen/ })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Gehege bauen/ })).toHaveLength(2); // Auftrag + Bauen-Knopf
    fireEvent.click(screen.getByRole("button", { name: /Wand streichen/ }));
    expect(screen.getByRole("application", { name: /Rollerstrich/ })).toBeTruthy();
  });
});
