/**
 * Dreiecke: Rechnung (Einordnung, besondere Punkte, Einrasten), gewürfelte
 * Aufgaben (jede eigene Lösung gilt als richtig, Auswahlfragen haben genau
 * eine richtige Option), Spiel-Dreiecke passen zu ihrer Einordnung, und alle
 * Blätter öffnen.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Dreiecke from "@/components/dreiecke/Dreiecke";
import { ergebnis, stimmt } from "@/lib/geometrie/aufgabe";
import { z } from "@/lib/prozent";
import {
  abstand, ausSeiten, ausWinkeln, einrasten, flaeche, hoehenschnitt, inkreis, innenwinkel, nachSeiten, nachWinkeln, seitenLaengen, umkreis, type Dreieck,
} from "@/lib/dreiecke";
import { ANWENDUNG_ARTEN, UEBUNG_ARTEN, blitzDreieck, erzeugeAnwendung, erzeugeUebung, ordneEin } from "@/lib/dreiecke-aufgaben";

function zufall(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe("Rechnung", () => {
  it("Winkel und Seiten aus ausWinkeln/ausSeiten", () => {
    const d = ausWinkeln(6, 50, 70);
    const w = innenwinkel(d);
    expect(w.alpha).toBeCloseTo(50);
    expect(w.beta).toBeCloseTo(70);
    expect(w.gamma).toBeCloseTo(60);
    const s = seitenLaengen(ausSeiten(5, 4, 3));
    expect(s.a).toBeCloseTo(5); expect(s.b).toBeCloseTo(4); expect(s.c).toBeCloseTo(3);
    expect(flaeche(ausSeiten(5, 4, 3))).toBeCloseTo(6);
  });
  it("ordnet ein", () => {
    expect([nachSeiten(ausWinkeln(5, 60, 60)), nachWinkeln(ausWinkeln(5, 60, 60))]).toEqual(["gleichseitig", "spitzwinklig"]);
    expect([nachSeiten(ausWinkeln(5, 45, 45)), nachWinkeln(ausWinkeln(5, 45, 45))]).toEqual(["gleichschenklig", "rechtwinklig"]);
    expect([nachSeiten(ausWinkeln(5, 20, 30)), nachWinkeln(ausWinkeln(5, 20, 30))]).toEqual(["unregelmaessig", "stumpfwinklig"]);
  });
  it("Umkreis, Inkreis, Höhenschnittpunkt", () => {
    const d = ausSeiten(5, 4, 3); // rechter Winkel bei A (a ist die Hypotenuse)
    const u = umkreis(d)!;
    expect(u.r).toBeCloseTo(2.5);
    expect(abstand(hoehenschnitt(d)!, d[0])).toBeCloseTo(0);
    expect(inkreis(d).r).toBeCloseTo(1);
  });
  it("Einrasten macht gleichseitig bzw. rechtwinklig", () => {
    const d = ausWinkeln(6, 60, 60);
    const fast = { x: d[2].x + 0.1, y: d[2].y - 0.1 };
    const e = einrasten(d, 2, fast);
    expect(nachSeiten([d[0], d[1], e])).toBe("gleichseitig");
    const r = einrasten(d, 2, { x: 0.1, y: -3 }); // nahe der Senkrechten in A
    expect(nachWinkeln([d[0], d[1], r])).toBe("rechtwinklig");
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
      for (let i = 0; i < 80; i++) {
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
        for (const p of (a.skizze?.flaechen ?? []).flatMap(f => f.pts)) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      }
    }
  });

  it("Winkelsumme: die drei Winkel ergeben 180°", () => {
    const r = zufall(3);
    for (let i = 0; i < 60; i++) {
      const a = erzeugeUebung("winkelsumme", r);
      const zahlen = [...a.text.matchAll(/(\d+)°/g)].map(m => Number(m[1]));
      expect(zahlen[0] + zahlen[1] + a.gesucht[0].wert).toBe(180);
    }
  });

  it("Rechenwege enthalten das Ergebnis", () => {
    const r = zufall(5);
    for (const art of ["flaeche", "basiswinkel", "aussenwinkel", "thales"] as const) {
      for (let i = 0; i < 30; i++) {
        const a = erzeugeUebung(art, r);
        expect(a.loesung.join(" ")).toContain(z(a.gesucht[0].wert));
      }
    }
  });

  it("Thales-Skizze: Winkel bei C ist 90°", () => {
    const r = zufall(13);
    for (let i = 0; i < 20; i++) {
      const pts = erzeugeUebung("thales", r).skizze!.flaechen![0].pts as Dreieck;
      expect(innenwinkel(pts).gamma).toBeCloseTo(90);
    }
  });
});

describe("Dreiecks-Blitz", () => {
  it("jedes Spiel-Dreieck hat die angesagte Einordnung, auf allen Stufen", () => {
    const r = zufall(17);
    for (const stufe of [0, 1, 2, 3]) {
      for (let i = 0; i < 300; i++) {
        const b = blitzDreieck(stufe, r);
        expect(b.ws.reduce((s, x) => s + x, 0)).toBe(180);
        expect(Math.min(...b.ws)).toBeGreaterThan(0);
        expect(ordneEin(b.d)).toEqual([b.seiten, b.winkel]);
      }
    }
  });
});

describe("Blätter", () => {
  it("alle sieben öffnen", () => {
    render(<Dreiecke />);
    expect(screen.getByTestId("einordnung").textContent).toMatch(/spitzwinklig|stumpfwinklig|rechtwinklig/);
    fireEvent.click(screen.getByRole("button", { name: "gleichseitig" }));
    expect(screen.getByTestId("einordnung").textContent).toContain("spitzwinklig und gleichseitig");
    fireEvent.click(screen.getByRole("button", { name: /Winkelsätze/ }));
    expect(screen.getByRole("button", { name: /Abreißen und anlegen/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Satz des Thales" }));
    expect(screen.getByRole("img", { name: "Satz des Thales" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Besondere Linien/ }));
    fireEvent.click(screen.getByRole("button", { name: /Mittelsenkrechte/ }));
    expect(screen.getByText(/Mittelpunkt des Umkreises/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Umfang und Fläche/ }));
    expect(screen.getByText(/A = g · h : 2 = /)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Kongruenzsätze" }));
    expect(screen.getByText(/SsW — zwei Seiten/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Übungen/ }));
    expect(screen.getByRole("button", { name: /Prüfen/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Arbeitsblatt/ }));
    expect(screen.getByRole("button", { name: /docx herunterladen/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Anwendungen/ }));
    expect(screen.getByRole("button", { name: /Giebel streichen/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Dreiecks-Blitz/ }));
    fireEvent.click(screen.getByRole("button", { name: /Los geht/ }));
    expect(screen.getByRole("button", { name: "gleichschenklig und stumpfwinklig" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "gleichseitig und rechtwinklig" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("Vorgabe öffnet Reiter und Startdreieck", () => {
    render(<Dreiecke vorgabe={{ reiter: "arten", winkel: { alpha: 45, beta: 45 } }} />);
    expect(screen.getByTestId("einordnung").textContent).toContain("rechtwinklig und gleichschenklig");
  });
});
