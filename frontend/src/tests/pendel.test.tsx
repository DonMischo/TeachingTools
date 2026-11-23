/** Ideales Pendel: Periodenformel, numerische Lösung, Bauteil öffnet im Trigonometrie-Blatt. */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Trigonometrie from "@/components/trigonometrie/Trigonometrie";
import { gemessenePeriode, periode, periodeGross, rad, simuliere, vMax } from "@/lib/pendel";

describe("Pendel-Rechnung", () => {
  it("T = 2π√(L/g)", () => {
    expect(periode(1, 9.81)).toBeCloseTo(2.006, 3);
    expect(periode(4, 9.81) / periode(1, 9.81)).toBeCloseTo(2, 9);
  });
  it("Simulation trifft bei kleinem Winkel die Formel, bei großem die Reihennäherung", () => {
    expect(gemessenePeriode(simuliere(rad(5), 1, 9.81, 5))!).toBeCloseTo(periode(1, 9.81), 2);
    const gross = gemessenePeriode(simuliere(rad(60), 1, 9.81, 5))!;
    expect(gross).toBeGreaterThan(periode(1, 9.81) * 1.06);
    expect(gross).toBeCloseTo(periodeGross(1, 9.81, rad(60)), 1);
  });
  it("Energieerhaltung: v unten", () => {
    expect(vMax(1, 9.81, rad(90))).toBeCloseTo(Math.sqrt(2 * 9.81), 9);
  });
});

describe("Blatt", () => {
  it("öffnet im Trigonometrie-Reiter und zeigt die Periode", () => {
    render(<Trigonometrie />);
    fireEvent.click(screen.getByRole("button", { name: /Ideales Pendel/ }));
    expect(screen.getByRole("img", { name: "Fadenpendel" })).toBeTruthy();
    expect(screen.getAllByText(/2,006 s/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Mond (1,62)" }));
    expect(screen.getAllByText(/4,937 s/).length).toBeGreaterThan(0);
  });
});
