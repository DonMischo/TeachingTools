import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import SchichtInfo from "@/components/erde/SchichtInfo";
import Tiefenprofil from "@/components/erde/Tiefenprofil";
import { SCHICHTEN } from "@/lib/erde/schichten";

describe("Aufbau der Erde — Ansichten", () => {
  it("die Infotafel zeigt für jede Schicht Werte, im äußeren Kern keine S-Wellen", () => {
    for (const s of SCHICHTEN) {
      const { unmount, container } = render(<SchichtInfo schicht={s} />);
      expect(container.textContent).toContain(s.name);
      expect(container.textContent).not.toMatch(/NaN|undefined/);
      if (s.id === "aussenkern") expect(container.textContent).toContain("keine (flüssig)");
      unmount();
    }
  });

  it("das Tiefenprofil zeichnet alle sechs Tafeln", () => {
    render(<Tiefenprofil />);
    for (const t of ["Temperatur", "Druck", "Dichte", "Erdbebenwellen", "Zähigkeit", "Schwere"]) {
      expect(screen.getAllByText(t).length).toBeGreaterThan(0);
    }
    expect(document.querySelectorAll("polyline").length).toBe(8);
  });
});
