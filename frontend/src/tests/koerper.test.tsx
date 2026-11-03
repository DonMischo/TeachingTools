/**
 * Körper: Formeln, Euler, Netz-Faltung, gewürfelte Aufgaben und die Blätter.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Koerper from "@/components/koerper/Koerper";
import { KOERPER, KOERPER_REIHE, startMasse } from "@/lib/koerper";
import { faltePolyeder } from "@/lib/koerper-netz";
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
