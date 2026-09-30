import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Rechenweg from "@/components/leviathan/Rechenweg";
import { leereVerteilung, neuesSpiel, runde } from "@/lib/leviathan/motor";
import { STANDARD_EINSTELLUNGEN } from "@/lib/leviathan/typen";

describe("Rechenweg", () => {
  const z = runde(neuesSpiel("industrie", STANDARD_EINSTELLUNGEN, 3), { ...leereVerteilung(), bildung: 3, soziales: 2 });

  it("führt Schritt für Schritt durch die Runde, mit Beiträgen und Quellen", () => {
    render(<Rechenweg z={z} />);
    fireEvent.click(screen.getByRole("button", { name: /3\. .* Wirkungsgefüge/ }));
    expect(screen.getByRole("heading", { name: /Wirkungsgefüge/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Vertrauen/, expanded: false }));
    expect(screen.getAllByText(/Rothstein & Uslaner 2005/).length).toBeGreaterThan(0);
  });

  it("verfolgt eine Größe vom Start bis zum Ende der Runde", () => {
    render(<Rechenweg z={z} />);
    expect(screen.getByText("Start der Runde")).toBeInTheDocument();
    expect(screen.getByText("Ende der Runde")).toBeInTheDocument();
  });

  it("erklärt vor der ersten Runde, dass noch nichts gerechnet wurde", () => {
    render(<Rechenweg z={neuesSpiel("nordisch", STANDARD_EINSTELLUNGEN, 1)} />);
    expect(screen.getByText(/Nach der ersten Runde/)).toBeInTheDocument();
  });
});
