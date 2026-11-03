/**
 * Kreis: Formeln, Lage einer Geraden, gewürfelte Übungen und Sachaufgaben
 * (jede Aufgabe ist mit ihrer eigenen Lösung lösbar, Auswahlfragen haben genau
 * eine richtige Option), Rad-Rollen-Runden und das Öffnen der Blätter.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Kreis from "@/components/kreis/Kreis";
import { stimmt, ergebnis } from "@/lib/geometrie/aufgabe";
import { allePunkte, bogenPunkt } from "@/lib/geometrie/skizze";
import { z } from "@/lib/prozent";
import { bogen, flaeche, lage, ring, schnitt, segment, sektor, sehne, umfang } from "@/lib/kreis";
import { ANWENDUNG_ARTEN, UEBUNG_ARTEN, erzeugeAnwendung, erzeugeUebung, radPunkte, radRunde } from "@/lib/kreis-aufgaben";

function zufall(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe("Formeln", () => {
  it("Umfang, Fläche, Kreisteile", () => {
    expect(umfang(1)).toBeCloseTo(2 * Math.PI);
    expect(flaeche(2)).toBeCloseTo(4 * Math.PI);
    expect(bogen(3, 360)).toBeCloseTo(umfang(3));
    expect(sektor(3, 90)).toBeCloseTo(flaeche(3) / 4);
    expect(segment(2, 180)).toBeCloseTo(flaeche(2) / 2);
    expect(segment(2, 90)).toBeCloseTo(Math.PI - 2);
    expect(sehne(5, 60)).toBeCloseTo(5);
    expect(ring(3, 2)).toBeCloseTo(5 * Math.PI);
    // Segment über 180°: Sektor plus Dreieck, zusammen mit dem Gegenstück der ganze Kreis
    expect(segment(4, 300) + segment(4, 60)).toBeCloseTo(flaeche(4));
  });

  it("Lage einer Geraden: d gegen r", () => {
    expect(lage(2, 5)).toBe("sekante");
    expect(lage(5, 5)).toBe("tangente");
    expect(lage(5.1, 5)).toBe("passante");
    expect(lage(5.1, 5, 0.2)).toBe("tangente");
    const s = schnitt({ x: 0, y: 0 }, 5, { x: 3, y: 0 });
    expect(s.punkte).toHaveLength(2);
    for (const p of s.punkte) expect(Math.hypot(p.x, p.y)).toBeCloseTo(5);
    expect(schnitt({ x: 0, y: 0 }, 5, { x: 0, y: 5 }).punkte).toHaveLength(1);
    expect(schnitt({ x: 0, y: 0 }, 5, { x: 6, y: 0 }).punkte).toHaveLength(0);
  });

  it("Bögen in der Skizze: gegen den Uhrzeigersinn, Rahmen umfasst den Bogen", () => {
    const p = bogenPunkt({ x: 0, y: 0 }, 2, 90);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(-2); // y zeigt nach unten
    const pts = allePunkte({ boegen: [{ m: { x: 0, y: 0 }, r: 1, von: 0, bis: 180, flaeche: "sektor" }] });
    expect(Math.min(...pts.map(q => q.y))).toBeCloseTo(-1);
    expect(Math.max(...pts.map(q => q.y))).toBeCloseTo(0);
  });
});

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
    for (const art of ["umfang", "flaeche", "ring"] as const) {
      for (let i = 0; i < 30; i++) {
        const a = erzeugeUebung(art, r);
        expect(a.loesung.join(" ")).toContain(z(a.gesucht[0].wert));
      }
    }
  });

  it("Lage der Geraden: jede der drei Antworten kommt vor", () => {
    const r = zufall(13), gesehen = new Set<number>();
    for (let i = 0; i < 60; i++) gesehen.add(erzeugeUebung("lage", r).gesucht[0].wert);
    expect(gesehen.size).toBe(3);
  });
});

describe("Rad-Rollen", () => {
  it("die eigene Lösung rollt genau bis zur Fahne", () => {
    const r = zufall(5);
    for (let stufe = 0; stufe < 3; stufe++) {
      for (let i = 0; i < 100; i++) {
        const x = radRunde(stufe, r);
        expect(x.n * umfang(x.r)).toBeCloseTo(x.s, 6);
        expect(x.r).toBeGreaterThan(0);
        if (stufe === 0) expect(x.art).toBe("umdrehungen");
      }
    }
  });
  it("Punkte: 100 bei Treffer, 0 ab einem Viertel daneben", () => {
    expect(radPunkte(200, 200)).toBe(100);
    expect(radPunkte(200, 250)).toBe(0);
    expect(radPunkte(200, 190)).toBe(80);
  });
});

describe("Blätter", () => {
  it("alle Blätter öffnen", () => {
    render(<Kreis />);
    expect(screen.getByRole("img", { name: /Kreis mit Radius/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Geraden am Kreis/ }));
    fireEvent.click(screen.getByRole("button", { name: /Sekante/ }));
    expect(screen.getByText(/Sehne s = 2/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Kreisteile/ }));
    fireEvent.click(screen.getByRole("button", { name: /Kreisring/ }));
    expect(screen.getByText(/π · \(R² − r²\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Übungen/ }));
    expect(screen.getByRole("button", { name: /Neue Aufgabe/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Arbeitsblatt/ }));
    expect(screen.getByRole("button", { name: /docx herunterladen/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Anwendungen/ }));
    expect(screen.getByRole("button", { name: /Pizza-Angebot/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Rad-Rollen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Los geht/ }));
    expect(screen.getByRole("button", { name: /Rollen!/ })).toBeTruthy();
  });
});
