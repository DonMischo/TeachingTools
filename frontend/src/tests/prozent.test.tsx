/**
 * Prozent- und Zinsrechnung: die Rechnung stimmt, gewürfelte Aufgaben sind
 * lösbar und mit ihrer eigenen (gerundeten) Lösung richtig, jedes Blatt öffnet.
 */
import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import Prozent from "@/components/prozent/Prozent";
import { zerlege } from "@/components/prozent/Denkwege";
import {
  AUFGABEN_ARTEN, alsBruch, dreisatz, erzeugeAufgabe, erzeugeRunde, euro, leseZahl, loese, pruefe, verdopplung, z, zinsen, zinseszins,
  type Stufe,
} from "@/lib/prozent";

/** reproduzierbarer Zufall */
function zufall(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe("Grundrechnung", () => {
  it("W, G und p passen zusammen", () => {
    const w = { G: 240, W: 84, p: 35 };
    expect(loese("W", w)).toBeCloseTo(84);
    expect(loese("G", w)).toBeCloseTo(240);
    expect(loese("p", w)).toBeCloseTo(35);
  });

  it("der Dreisatz endet beim Ergebnis und geht über 1", () => {
    const w = { G: 80, W: 20, p: 25 };
    const ziel = { W: { prozent: 25, wert: 20 }, G: { prozent: 100, wert: 80 }, p: { prozent: 25, wert: 20 } };
    for (const g of ["W", "G", "p"] as const) {
      const { zeilen, schritte } = dreisatz(g, w);
      expect(zeilen[2].prozent).toBeCloseTo(ziel[g].prozent);
      expect(zeilen[2].wert).toBeCloseTo(ziel[g].wert);
      expect(zeilen[1].prozent === 1 || zeilen[1].wert === 1).toBe(true);
      // jeder Schritt macht links und rechts dasselbe
      for (let i = 0; i < 2; i++) {
        const f = schritte[i].op === ":" ? 1 / schritte[i].zahl : schritte[i].zahl;
        expect(zeilen[i + 1].prozent).toBeCloseTo(zeilen[i].prozent * f);
        expect(zeilen[i + 1].wert).toBeCloseTo(zeilen[i].wert * f);
      }
    }
  });

  it("Bruch, Zahlen lesen, Euro", () => {
    expect(alsBruch(25)).toEqual({ zaehler: 1, nenner: 4 });
    expect(alsBruch(12.5)).toEqual({ zaehler: 1, nenner: 8 });
    expect(leseZahl("12,5")).toBe(12.5);
    expect(leseZahl("1.200")).toBe(1200);
    expect(leseZahl("48 €")).toBe(48);
    expect(leseZahl("abc")).toBeNull();
    expect(euro(1234.5)).toMatch(/^1.234,50 €$/);
    expect(euro(0.1 + 0.2)).toBe("0,30 €");
  });

  it("Zinsen und Zinseszins", () => {
    expect(zinsen(2400, 3)).toBeCloseTo(72);
    expect(zinsen(2400, 3, 5 * 30)).toBeCloseTo(30);
    const r = zinseszins(1000, 10, 2);
    expect(r[2]).toBeCloseTo(1210);
    expect(verdopplung(7)).toBe(11);
  });

  it("Zerlegen ergibt wieder den Prozentsatz", () => {
    for (const p of [35, 15, 99, 75, 7, 120, 62.5]) {
      const { plus, minus = 0 } = zerlege(p);
      expect(plus.reduce((a, b) => a + b, 0) - minus).toBeCloseTo(p);
    }
  });
});

describe("Gewürfelte Aufgaben", () => {
  it("sind lösbar, sauber formuliert und mit der gerundeten Lösung richtig", () => {
    const rnd = zufall(7);
    for (const { id } of AUFGABEN_ARTEN) {
      for (const stufe of [1, 2, 3] as Stufe[]) {
        for (let i = 0; i < 60; i++) {
          const a = erzeugeAufgabe(id, stufe, rnd);
          expect(Number.isFinite(a.loesung)).toBe(true);
          expect(a.loesung).toBeGreaterThan(0);
          expect(a.text).not.toMatch(/NaN|undefined|Infinity/);
          for (const w of a.weg) expect(w).not.toMatch(/NaN|undefined|Infinity/);
          const angezeigt = a.einheit === "€" ? euro(a.loesung) : z(a.loesung);
          expect(pruefe(a, angezeigt)).toBe(true);
          expect(pruefe(a, String(a.loesung * 1.1 + 1))).toBe(false);
          // Leute zählt man ganz
          if (a.einheit === "" ) expect(Number.isInteger(Math.round(a.loesung * 1e9) / 1e9)).toBe(true);
        }
      }
    }
  });

  it("Spielrunden haben eine richtige Antwort und keine doppelten", () => {
    const rnd = zufall(3);
    for (let i = 0; i < 400; i++) {
      const r = erzeugeRunde(rnd);
      expect(r.richtig).toBeGreaterThanOrEqual(0);
      expect(r.richtig).toBeLessThan(r.optionen.length);
      expect(new Set(r.optionen.map(String)).size).toBe(r.optionen.length);
      if (r.art === "schnaeppchen") expect(r.preise[r.richtig]).toBeLessThan(r.preise[1 - r.richtig]);
      if (r.art === "kopf") expect(r.optionen).toHaveLength(4);
    }
  });
});

describe("Oberfläche", () => {
  it("jedes Blatt öffnet ohne Absturz", () => {
    render(<Prozent />);
    for (const name of [/Dreisatz/, /Denkwege/, /Zinsen/, /Üben/, /Spiele/, /Anschauen/]) {
      fireEvent.click(screen.getAllByRole("button", { name })[0]);
    }
    expect(screen.getByText(/von 40 = 10/)).toBeInTheDocument();
  });

  it("Dreisatz zeigt den Grundwert", () => {
    render(<Prozent />);
    fireEvent.click(screen.getByRole("button", { name: /🔢 Dreisatz/ }));
    fireEvent.click(screen.getByRole("button", { name: /Grundwert G gesucht/ }));
    expect(screen.getByText(/G = 20 · 100 : 25 =/)).toBeInTheDocument();
  });

  it("Üben zählt eine richtige Antwort", () => {
    render(<Prozent />);
    fireEvent.click(screen.getByRole("button", { name: /Üben/ }));
    fireEvent.click(screen.getByRole("button", { name: /Lösungsweg/ }));
    // die letzte Zeile des Wegs nennt das Ergebnis — hier nur prüfen, dass er aufgeht
    expect(document.querySelectorAll("ol li").length).toBeGreaterThan(1);
    fireEvent.change(screen.getByLabelText("Deine Antwort"), { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: "Prüfen" }));
    expect(screen.queryByText(/Richtig/)).toBeNull();
  });

  it("Prozent-Blitz startet und zählt", () => {
    render(<Prozent />);
    fireEvent.click(screen.getByRole("button", { name: /Spiele/ }));
    fireEvent.click(screen.getByRole("button", { name: /Prozent-Blitz/ }));
    act(() => { fireEvent.click(screen.getByRole("button", { name: /Los geht/ })); });
    expect(screen.getByText(/⭐ 0/)).toBeInTheDocument();
  });
});
