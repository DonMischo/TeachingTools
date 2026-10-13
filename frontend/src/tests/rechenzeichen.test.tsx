/**
 * Rechenzeichen: die Analysis-Bilder rechnen richtig, und jedes Zeichen
 * öffnet sein Bild ohne Absturz.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Rechenzeichen from "@/components/rechenzeichen/Rechenzeichen";
import { FUNKTIONEN, streifenSumme } from "@/components/rechenzeichen/Analysis";

describe("Integral als Streifensumme", () => {
  it("läuft mit mehr Streifen auf die Stammfunktion zu", () => {
    for (const fn of FUNKTIONEN) {
      const genau = fn.F(5) - fn.F(1);
      const grob = Math.abs(streifenSumme(fn, 1, 5, 2) - genau);
      const fein = Math.abs(streifenSumme(fn, 1, 5, 80) - genau);
      expect(fein).toBeLessThanOrEqual(grob + 1e-12);
      expect(fein).toBeLessThan(0.01);
    }
  });

  it("die Ableitung passt zum Differenzenquotienten", () => {
    for (const fn of FUNKTIONEN) {
      const h = 1e-5, x = 2.3;
      expect(fn.d(x)).toBeCloseTo((fn.f(x + h) - fn.f(x - h)) / (2 * h), 4);
    }
  });

  it("alle Funktionen bleiben auf [0, 6] über der x-Achse", () => {
    for (const fn of FUNKTIONEN) for (let x = 0; x <= 6; x += 0.05) expect(fn.f(x)).toBeGreaterThanOrEqual(0);
  });
});

describe("Rechenzeichen", () => {
  it("zeigt zu jedem Zeichen sein Bild", () => {
    render(<Rechenzeichen />);
    const knoepfe = ["+", "−", "·", ":", "x²", "x³", "√", "< >", "≤ ≥", "∫", "f′"];
    for (const z of knoepfe) {
      fireEvent.click(screen.getByRole("button", { name: z }));
      expect(document.querySelector(".card svg")).not.toBeNull();
    }
  });

  it("Geteilt nennt den Rest", () => {
    render(<Rechenzeichen />);
    fireEvent.click(screen.getByRole("button", { name: ":" }));
    expect(screen.getByText("12 : 3 = 4")).toBeInTheDocument();
  });
});
