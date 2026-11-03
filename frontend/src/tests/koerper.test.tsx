/**
 * Körper: Formeln, Euler, Netz-Faltung, gewürfelte Aufgaben und die Blätter.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Koerper from "@/components/koerper/Koerper";
import { KOERPER, KOERPER_REIHE, startMasse } from "@/lib/koerper";
import { faltePolyeder } from "@/lib/koerper-netz";
import { bastelbogen, innen } from "@/lib/koerper-bastelbogen";
import { ANWENDUNG_ARTEN, UEBUNG_ARTEN, erzeugeAnwendung, erzeugeUebung, fassPaar } from "@/lib/koerper-aufgaben";
import { stimmt } from "@/lib/geometrie/aufgabe";
import { z } from "@/lib/prozent";

function zufall(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}

describe("Formeln", () => {
  it("Quader, Zylinder, Kegel, Kugel", () => {
    expect(KOERPER.quader.rechne({ a: 4, b: 3, c: 2 }).V.wert).toBe(24);
    expect(KOERPER.quader.rechne({ a: 4, b: 3, c: 2 }).O.wert).toBe(52);
    expect(KOERPER.zylinder.rechne({ r: 1, h: 2 }).V.wert).toBeCloseTo(2 * Math.PI);
    expect(KOERPER.kegel.rechne({ r: 3, h: 4 }).M.wert).toBeCloseTo(15 * Math.PI);
    expect(KOERPER.kugel.rechne({ r: 3 }).V.wert).toBeCloseTo(36 * Math.PI);
    expect(KOERPER.pstumpf.rechne({ a: 4, a2: 2, h: 3 }).V.wert).toBeCloseTo(28);
  });
  it("Euler gilt für alle Polyeder, Teilflächen ergeben die Oberfläche", () => {
    for (const k of KOERPER_REIHE) {
      const d = KOERPER[k].rechne(startMasse(KOERPER[k]));
      if (d.zaehlung.polyeder) expect(d.zaehlung.e + d.zaehlung.f - d.zaehlung.k).toBe(2);
      expect(d.teile.reduce((s, t) => s + t.wert, 0)).toBeCloseTo(d.O.wert);
    }
  });
  it("flaches Netz liegt in der Ebene y = 0", () => {
    for (const k of KOERPER_REIHE.filter(x => KOERPER[x].poly)) {
      for (const f of faltePolyeder(KOERPER[k].poly!(startMasse(KOERPER[k])), 0)) for (const p of f.pts) expect(Math.abs(p[1])).toBeLessThan(1e-9);
    }
  });
});

describe("gewürfelte Aufgaben", () => {
  it("sind lösbar", () => {
    const r = zufall(5);
    const alle = [...UEBUNG_ARTEN.map(a => () => erzeugeUebung(a.id, r)), ...ANWENDUNG_ARTEN.map(a => () => erzeugeAnwendung(a.id, r))];
    for (const e of alle) for (let i = 0; i < 40; i++) {
      const a = e();
      for (const g of a.gesucht) expect(stimmt(g, g.optionen ? String(g.wert) : z(g.wert, g.nk ?? 2))).toBe(true);
      expect(a.text + a.loesung.join()).not.toMatch(/NaN|undefined|Infinity/);
    }
  });
  it("Spielpaare sind verschieden groß", () => {
    const r = zufall(9);
    for (let i = 0; i < 50; i++) { const [a, b] = fassPaar(2, r); expect(a.V).not.toBe(b.V); }
  });
});

describe("Blätter", () => {
  it("öffnen", () => {
    render(<Koerper />);
    fireEvent.click(screen.getByRole("button", { name: /Übungen/ }));
    expect(screen.getByRole("button", { name: /Prüfen/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Anwendungen/ }));
    expect(screen.getByRole("button", { name: /Aquarium/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Zusammengesetzt/ }));
    fireEvent.click(screen.getByRole("button", { name: /Wer fasst mehr/ }));
    fireEvent.click(screen.getByRole("button", { name: /Los geht/ }));
    expect(screen.getAllByRole("button", { name: /Gefäß/ }).length).toBe(2);
  });
});

describe("Bastelbogen", () => {
  it("jede aufgeschnittene Kante bekommt genau eine Lasche", () => {
    for (const k of KOERPER_REIHE.filter(x => KOERPER[x].poly)) {
      const m = startMasse(KOERPER[k]), d = KOERPER[k].rechne(m), b = bastelbogen(k, m)!;
      // Ein Netz aus f Flächen hat f − 1 Scharniere; die übrigen Kanten sind aufgeschnitten.
      expect(b.laschen.length).toBe(d.zaehlung.k - (d.zaehlung.f - 1));
      expect(b.falze.length).toBe(d.zaehlung.k);
    }
  });
  it("Zylinder und Kegel haben eine Naht-Lasche und Zähne, die Kugel keinen Bogen", () => {
    for (const k of ["zylinder", "kegel", "kstumpf"] as const) expect(bastelbogen(k, startMasse(KOERPER[k]))!.laschen.length).toBeGreaterThan(5);
    expect(bastelbogen("kugel", { r: 3 })).toBeNull();
  });
  it("Laschen liegen außerhalb ihrer Fläche", () => {
    const b = bastelbogen("quader", { a: 6, b: 4, c: 3 })!;
    for (const l of b.laschen) {
      const c = { x: (l[1].x + l[2].x) / 2, y: (l[1].y + l[2].y) / 2 };
      expect(b.teile.some(t => innen(c, t.pts))).toBe(false);
    }
  });
});
