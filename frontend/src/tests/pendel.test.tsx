/** Ideales Pendel: Periodenformel, numerische Lösung, Bauteil öffnet im Trigonometrie-Blatt. */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Trigonometrie from "@/components/trigonometrie/Trigonometrie";
import { gemessenePeriode, halbwertszeit, huelle, periode, periodeGedaempft, periodeGross, rad, simuliere, vMax } from "@/lib/pendel";

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
  it("Dämpfung: Amplitude folgt der Hüllkurve, Periode wird länger, Kriechfall ohne Schwingung", () => {
    const d = 0.3, sim = simuliere(rad(10), 1, 9.81, 10, 0.002, d, true);
    // nach einer gedämpften Periode ist die Auslenkung genau um e^(−δ·T_d) kleiner
    const Td = periodeGedaempft(1, 9.81, d)!;
    expect(Td).toBeGreaterThan(periode(1, 9.81));
    const i = Math.round(Td / 0.002);
    expect(sim[i].phi).toBeCloseTo(huelle(rad(10), d, Td), 3);
    expect(gemessenePeriode(sim)!).toBeCloseTo(Td, 2);
    expect(halbwertszeit(d)).toBeCloseTo(Math.LN2 / d, 9);
    expect(periodeGedaempft(1, 9.81, 4)).toBeNull();
    const kriech = simuliere(rad(10), 1, 9.81, 5, 0.002, 4, true);
    expect(kriech.every(x => x.phi >= -1e-9)).toBe(true);
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
    fireEvent.change(screen.getByLabelText("Dämpfung δ (0 = ideal)"), { target: { value: "0.2" } });
    expect(screen.getByText(/Gedämpft \(lila\)/)).toBeTruthy();
  });
});
