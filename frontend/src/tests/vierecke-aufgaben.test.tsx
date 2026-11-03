/**
 * Vierecke-Übungen, Sachaufgaben und Flächen-Duell: Jede gewürfelte Aufgabe
 * ist lösbar (die eigene Lösung wird als richtig erkannt), Auswahlfragen haben
 * genau eine richtige Option, und die neuen Blätter öffnen.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Vierecke from "@/components/simulationen/Vierecke";
import { stimmt, ergebnis } from "@/lib/geometrie/aufgabe";
import { z } from "@/lib/prozent";
import {
  ANWENDUNG_ARTEN, STECKBRIEFE, UEBUNG_ARTEN, duellPaar, erzeugeAnwendung, erzeugeUebung, flaecheVieleck, gitterViereck,
} from "@/lib/vierecke-aufgaben";

function zufall(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const alle = [
  ...UEBUNG_ARTEN.map(a => (r: () => number) => erzeugeUebung(a.id, r)),
  ...ANWENDUNG_ARTEN.map(a => (r: () => number) => erzeugeAnwendung(a.id, r)),
];

describe("gewürfelte Aufgaben", () => {
  it("haben endliche, positive Lösungen, die als richtig gelten", () => {
    const r = zufall(7);
    for (const erzeuge of alle) {
      for (let i = 0; i < 60; i++) {
        const a = erzeuge(r);
        expect(a.text.length).toBeGreaterThan(10);
        expect(a.loesung.length).toBeGreaterThan(0);
        for (const g of a.gesucht) {
          expect(Number.isFinite(g.wert)).toBe(true);
          if (g.optionen) {
            expect(stimmt(g, String(g.wert))).toBe(true);
            expect(stimmt(g, String((g.wert + 1) % g.optionen.length))).toBe(false);
          } else {
            expect(g.wert).toBeGreaterThan(0);
            // Die gerundete Anzeige der Lösung muss als richtig durchgehen.
            expect(stimmt(g, z(g.wert, g.nk ?? 2))).toBe(true);
            expect(ergebnis(g)).toContain(g.label);
          }
        }
        expect(a.text + a.loesung.join()).not.toMatch(/NaN|undefined|Infinity/);
      }
    }
  });

  it("Rechenwege enthalten das Ergebnis", () => {
    const r = zufall(3);
    for (let i = 0; i < 40; i++) {
      const a = erzeugeUebung("flaeche", r);
      expect(a.loesung.join(" ")).toContain(z(a.gesucht[0].wert));
    }
  });

  it("Einheiten: Faktor 100 je Stufe (10 000 bei zwei Stufen)", () => {
    const r = zufall(11);
    for (let i = 0; i < 50; i++) {
      const a = erzeugeUebung("einheiten", r);
      expect(a.loesung[1]).toMatch(/[·:] (100|10 000) =/);
    }
  });

  it("jeder Steckbrief nennt eine der sechs Formen", () => {
    expect(new Set(STECKBRIEFE.map(s => s[1])).size).toBe(6);
  });
});

describe("Flächen-Duell", () => {
  it("Gaußsche Trapezformel", () => {
    expect(flaecheVieleck([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }])).toBe(12);
    expect(flaecheVieleck([{ x: 0, y: 2 }, { x: 2, y: 4 }, { x: 4, y: 2 }, { x: 2, y: 0 }])).toBe(8);
  });
  it("Gitter-Vierecke liegen auf Gitterpunkten im 8 × 7-Blatt", () => {
    const r = zufall(5);
    for (let i = 0; i < 300; i++) {
      const v = gitterViereck(r);
      for (const p of v.pts) {
        expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
        expect(p.x).toBeLessThanOrEqual(8);
        expect(p.y).toBeLessThanOrEqual(7);
      }
      expect(v.A).toBeGreaterThan(0);
    }
  });
  it("Paare sind verschieden groß, ab Stufe 3 knapp", () => {
    const r = zufall(9);
    for (let i = 0; i < 100; i++) {
      const [a, b] = duellPaar(3, r);
      expect(a.A).not.toBe(b.A);
      expect(Math.max(a.A, b.A) / Math.min(a.A, b.A)).toBeLessThanOrEqual(1.25);
    }
  });
});

describe("Blätter", () => {
  it("Übungen, Anwendungen und Spiel öffnen", () => {
    render(<Vierecke />);
    fireEvent.click(screen.getByRole("button", { name: /Übungen/ }));
    expect(screen.getByRole("button", { name: /Neue Aufgabe/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Prüfen/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Arbeitsblatt/ }));
    expect(screen.getByRole("button", { name: /docx herunterladen/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Anwendungen/ }));
    expect(screen.getByRole("button", { name: /Garten einzäunen/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Flächen-Duell/ }));
    fireEvent.click(screen.getByRole("button", { name: /Los geht/ }));
    expect(screen.getByRole("button", { name: "Viereck 1" })).toBeTruthy();
  });
});
