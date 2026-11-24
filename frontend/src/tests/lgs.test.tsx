/**
 * Lineare Gleichungssysteme: Lesen und Schreiben von Termen, Umformen auf
 * beiden Seiten, Freistellen, Lösen (eine/keine/unendlich), Additionsfaktoren,
 * Einsetzen, gewürfelte Systeme und Sachaufgaben.
 */
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import Lgs from "@/components/lgs/Lgs";
import {
  additionsFaktoren, addiere, einsetzen, einsetzText, erfuellt, forme, gleichstand, gleichungText, kosten, leseGleichung, leseTerm, leseUmformung,
  loeseSystem, opText, q, sachaufgabe, stelleFrei, TARIFE, termText, wuerfleSystem, type Gleichung,
} from "@/lib/lgs";

function zufall(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}
const G = (t: string) => leseGleichung(t) as Gleichung;

describe("Terme und Umformungen", () => {
  it("liest und schreibt", () => {
    expect(termText(leseTerm("2x + 3y - 4")!)).toBe("2x + 3y − 4");
    expect(termText(leseTerm("-x+1/2y")!)).toBe("−x + 1/2y");
    expect(termText(leseTerm("0,5x")!)).toBe("1/2x");
    expect(leseTerm("2xx")).toBeNull();
    expect(gleichungText(G("2x + y = 7"))).toBe("2x + y = 7");
  });
  it("formt beide Seiten um", () => {
    const g = forme(G("2x + 3 = 11"), leseUmformung("-3")!);
    expect(gleichungText(g)).toBe("2x = 8");
    expect(gleichungText(forme(g, leseUmformung(":2")!))).toBe("x = 4");
    expect(opText(leseUmformung("-3")!)).toBe("− 3");
    expect(opText(leseUmformung("+2x")!)).toBe("+ 2x");
    expect(opText(leseUmformung(":(-2)")!)).toBe(": (−2)");
  });
  it("stellt frei", () => {
    const f = stelleFrei(G("3x - 2y = 4"), "y")!;
    expect(gleichungText(f.ergebnis)).toBe("y = 3/2x − 2");
    expect(stelleFrei(G("7 = x + 2"), "x")!.ergebnis).toEqual(G("x = 5"));
  });
});

describe("Systeme", () => {
  it("eine, keine, unendlich viele Lösungen", () => {
    expect(loeseSystem(G("2x + y = 7"), G("x - y = 2"))).toEqual({ art: "eine", x: q(3), y: q(1) });
    expect(loeseSystem(G("y = 2x + 1"), G("y = 2x + 3")).art).toBe("keine");
    expect(loeseSystem(G("y = 2x + 1"), G("2y = 4x + 2")).art).toBe("unendlich");
  });
  it("Additionsverfahren und Einsetzen", () => {
    const g1 = G("2x + 3y = 12"), g2 = G("4x - 5y = 2");
    const [f1, f2] = additionsFaktoren(g1, g2, "x")!;
    expect([f1, f2]).toEqual([2, -1]);
    const z = addiere(g1, f1, g2, f2);
    expect(z.a).toEqual(q(0));
    expect(z.b).toEqual(q(11));
    expect(gleichungText(einsetzen(g2, "y", leseTerm("2x - 1")!))).toBe("−6x + 5 = 2");
    expect(einsetzText(G("2x + 3y = 7"), "y", leseTerm("3x - 1")!)).toBe("2x + 3·(3x − 1) = 7");
  });
  it("gewürfelte Systeme haben die versprochene Lösung", () => {
    const r = zufall(9);
    for (const s of [1, 2, 3] as const) for (let i = 0; i < 100; i++) {
      const { g1, g2, x, y } = wuerfleSystem(r, s);
      expect(loeseSystem(g1, g2)).toEqual({ art: "eine", x: q(x), y: q(y) });
      expect(erfuellt(g1, q(x), q(y)) && erfuellt(g2, q(x), q(y))).toBe(true);
    }
  });
  it("Sachaufgaben lösen zu den echten Preisen", () => {
    const r = zufall(4);
    for (let i = 0; i < 50; i++) {
      const a = sachaufgabe(r);
      const l = loeseSystem(a.g1, a.g2);
      expect(l.art).toBe("eine");
      if (l.art === "eine") { expect(l.x.z / l.x.n).toBeCloseTo(a.x, 9); expect(l.y.z / l.y.n).toBeCloseTo(a.y, 9); }
    }
  });
  it("Tarife haben einen Gleichstand im gezeigten Bereich", () => {
    for (const t of TARIFE) {
      const g = gleichstand(t)!;
      expect(g).toBeGreaterThan(t.bereich[0]);
      expect(g).toBeLessThan(t.bereich[1]);
      expect(kosten(t.a, g)).toBeCloseTo(kosten(t.b, g), 9);
    }
  });
});


/** Den letzten offenen Umformer mit Tipps bis zum Ende treiben */
function loeseAlleUmformer() {
  for (let i = 0; i < 40; i++) {
    const tipps = screen.queryAllByRole("button", { name: "💡 Tipp" });
    if (!tipps.length) return;
    fireEvent.click(tipps[tipps.length - 1]);
    const anwenden = screen.getAllByRole("button", { name: "Anwenden" });
    fireEvent.click(anwenden[anwenden.length - 1]);
  }
}

describe("Oberfläche", () => {
  it("öffnet jedes Blatt", () => {
    render(<Lgs />);
    expect(screen.getByText(/schneiden sich in S\(3 \| 1\)/)).toBeTruthy();
    for (const b of ["Additionsverfahren", "Gleichsetzungsverfahren", "Einsetzungsverfahren", "Üben", "Tarif-Check"]) {
      fireEvent.click(screen.getByRole("button", { name: new RegExp(b) }));
    }
    expect(screen.getByText(/Runde 1/)).toBeTruthy();
  });

  it("Additionsverfahren bis zur Lösung", () => {
    vi.useFakeTimers();
    try {
      render(<Lgs />);
      fireEvent.click(screen.getByRole("button", { name: /Additionsverfahren/ }));
      fireEvent.click(screen.getAllByRole("button", { name: "💡 Tipp" })[0]);
      fireEvent.click(screen.getByRole("button", { name: "Multiplizieren" }));
      fireEvent.click(screen.getByRole("button", { name: "⬆ Addieren" }));
      act(() => { vi.advanceTimersByTime(1000); });
      expect(screen.getByText(/y ist weg/)).toBeTruthy();
      loeseAlleUmformer();
      loeseAlleUmformer();
      expect(screen.getByText(/L = \{\(3 \| 2\)\}/)).toBeTruthy();
    } finally { vi.useRealTimers(); }
  });

  it("Einsetzungsverfahren: Term antippen und auf y legen", () => {
    render(<Lgs />);
    fireEvent.click(screen.getByRole("button", { name: /Einsetzungsverfahren/ }));
    loeseAlleUmformer();
    fireEvent.click(screen.getByRole("button", { name: "Term zum Einsetzen" }));
    fireEvent.click(screen.getByRole("button", { name: "Ablagefeld y" }));
    fireEvent.click(screen.getByRole("button", { name: /Klammer auflösen/ }));
    loeseAlleUmformer();
    fireEvent.click(screen.getByRole("button", { name: "Lösung zeigen" }));
    expect(screen.getByText(/L = \{\(3 \| 2\)\}/)).toBeTruthy();
  });

  it("Gleichsetzungsverfahren bis zur Lösung", () => {
    render(<Lgs />);
    fireEvent.click(screen.getByRole("button", { name: /Gleichsetzungsverfahren/ }));
    loeseAlleUmformer();
    fireEvent.click(screen.getByRole("button", { name: "= Gleichsetzen" }));
    loeseAlleUmformer();
    expect(screen.getByText(/L = \{\(3 \| 2\)\}/)).toBeTruthy();
  });
});
