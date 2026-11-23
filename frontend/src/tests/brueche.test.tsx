/**
 * Brüche: Kürzen, Rechnen (jede gewürfelte Aufgabe stimmt mit der Gleitkomma-
 * Rechnung), Dezimalzahlen (endlich und periodisch), Bruchteile von Größen,
 * und jedes Blatt öffnet.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Brueche from "@/components/brueche/Brueche";
import { ziffernJeStelle } from "@/components/brueche/Dezimal";
import { legeKarten } from "@/components/brueche/Wichtige";
import { raster } from "@/components/brueche/bild";
import {
  ausDezimal, bruchteilAufgabe, dezimal, dezimalText, gemischtText, kuerze, leseBruch, OPS, rechenAufgabe, rechne, wert, wort, zehnerbruch, type Op,
} from "@/lib/brueche";

function zufall(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}
const F: Record<Op, (a: number, b: number) => number> = { "+": (a, b) => a + b, "−": (a, b) => a - b, "·": (a, b) => a * b, ":": (a, b) => a / b };

describe("Rechnung", () => {
  it("kürzt, schreibt gemischt und benennt", () => {
    expect(kuerze({ z: 12, n: 18 })).toEqual({ z: 2, n: 3 });
    expect(gemischtText({ z: 11, n: 4 })).toBe("2 3/4");
    expect(wort({ z: 3, n: 4 })).toBe("drei Viertel");
    expect(wort({ z: 1, n: 2 })).toBe("ein Halb");
  });
  it("Rechenwege: Hauptnenner, Kehrwert, gekürztes Ergebnis", () => {
    const w = rechne({ z: 1, n: 4 }, "+", { z: 1, n: 6 });
    expect(w.ergebnis).toEqual({ z: 5, n: 12 });
    expect(w.schritte[0]).toContain("Hauptnenner = kgV(4; 6) = 12");
    expect(rechne({ z: 3, n: 4 }, ":", { z: 1, n: 2 }).ergebnis).toEqual({ z: 3, n: 2 });
    expect(rechne({ z: 2, n: 3 }, "·", { z: 3, n: 4 }).ergebnis).toEqual({ z: 1, n: 2 });
  });
  it("jede gewürfelte Aufgabe stimmt", () => {
    const r = zufall(11);
    for (const op of OPS) for (const s of [1, 2, 3] as const) for (let i = 0; i < 60; i++) {
      const { a, b } = rechenAufgabe(r, op, s);
      const e = rechne(a, op, b).ergebnis;
      expect(wert(e)).toBeCloseTo(F[op](wert(a), wert(b)), 9);
      expect(kuerze(e)).toEqual(e);
      if (op === "−") expect(wert(e)).toBeGreaterThan(0);
    }
  });
  it("liest Eingaben", () => {
    expect(leseBruch("1 1/2")).toEqual({ z: 3, n: 2 });
    expect(leseBruch("-5/2")).toEqual({ z: -5, n: 2 });
    expect(leseBruch("3/0")).toBeNull();
  });
});

describe("Dezimalzahlen", () => {
  it("erweitert auf 10, 100, 1000", () => {
    expect(zehnerbruch({ z: 3, n: 8 })).toEqual({ faktor: 125, nenner: 1000, bruch: { z: 375, n: 1000 } });
    expect(zehnerbruch({ z: 7, n: 20 })).toMatchObject({ nenner: 100, bruch: { z: 35, n: 100 } });
    expect(zehnerbruch({ z: 1, n: 3 })).toBeNull();
  });
  it("teilt schriftlich, erkennt Perioden", () => {
    expect(dezimal({ z: 1, n: 3 })).toMatchObject({ ganz: 0, vor: "", periode: "3" });
    expect(dezimal({ z: 5, n: 6 })).toMatchObject({ vor: "8", periode: "3" });
    expect(dezimal({ z: 1, n: 7 }).periode).toBe("142857");
    expect(dezimalText({ z: 3, n: 8 })).toBe("0,375");
  });
  it("Dezimalzahl → Bruch", () => {
    expect(ausDezimal("0,45")!.ergebnis).toEqual({ z: 9, n: 20 });
    expect(ausDezimal("2,75")!.ergebnis).toEqual({ z: 11, n: 4 });
    expect(ziffernJeStelle(12, "045")).toEqual({ 0: 2, 1: 1, [-1]: 0, [-2]: 4, [-3]: 5 });
  });
});

describe("Bruchteile und Spielteile", () => {
  it("Bruchteil-Aufgaben gehen auf", () => {
    const r = zufall(5);
    for (let i = 0; i < 200; i++) {
      const a = bruchteilAufgabe(r, i % 2 === 1);
      expect(a.teil).toBeCloseTo((a.ganzes.wert * a.bruch.z) / a.bruch.n, 9);
      expect(a.loesung).toBeCloseTo(a.gesucht === "teil" ? a.teil : a.ganzes.wert, 9);
      if (a.ganzes.einheit === "Kinder") expect(Number.isInteger(a.teil)).toBe(true);
    }
  });
  it("Memory hat 8 Paare, Tafel-Raster passt", () => {
    const k = legeKarten(zufall(2));
    expect(k).toHaveLength(16);
    expect(new Set(k.map(x => x.paar)).size).toBe(8);
    expect(raster(12)).toEqual([3, 4]);
    expect(raster(7)).toEqual([1, 7]);
  });
});

describe("Oberfläche", () => {
  it("öffnet jedes Blatt", () => {
    render(<Brueche />);
    expect(screen.getAllByRole("group", { name: "Ganzes 1" }).length).toBeGreaterThan(0);
    for (const [reiter, text] of [["Erweitern & Kürzen", /Gleichnamig machen/], ["Rechnen", /Rechner mit Rechenweg/], ["Bruchteile", /erst teilen, dann malnehmen/],
      ["Dezimalzahlen", /Dezimalzahl → Bruch/], ["Wichtige Brüche", /Bruch-Memory/]] as const) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(reiter) }));
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
  });
  it("Teile antippen ändert den Bruch", () => {
    render(<Brueche />);
    fireEvent.click(screen.getAllByRole("button", { name: "Teil 4" })[0]);
    expect(screen.getByText("vier Viertel")).toBeTruthy();
  });
  it("Rechner zeigt Schritt für Schritt", () => {
    render(<Brueche />);
    fireEvent.click(screen.getByRole("button", { name: /Rechnen/ }));
    fireEvent.click(screen.getByRole("button", { name: "Alle" }));
    expect(screen.getByText(/Ergebnis:/)).toBeTruthy();
  });
});
