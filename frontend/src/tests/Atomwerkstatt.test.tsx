/**
 * Die eigene Simulation »Atommodelle«: alle vier Reiter lassen sich öffnen.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Atomwerkstatt from "@/components/atome/Atomwerkstatt";

describe("Atomwerkstatt", { timeout: 40_000 }, () => {
  it("zeigt die vier Reiter mit ihrem Inhalt", () => {
    render(<Atomwerkstatt />);
    // Start: Atommodelle mit Bor und kleinem Raster.
    expect(screen.getByText(/Bor — /)).toBeTruthy();
    fireEvent.click(screen.getByTitle("26 Eisen"));
    expect(screen.getByText(/Eisen — /)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Verbindungen/ }));
    expect(screen.getByText(/Valenzstrichformel/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Lewis-Labor/ }));
    expect(screen.getByLabelText(/Lewis-Labor/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "CH₄" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Teilchenmodell/ }));
    expect(screen.getByLabelText("Temperatur")).toBeTruthy();
    expect(screen.getByText(/Wasser ist bei 20 °C flüssig/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Reaktion/ }));
    expect(screen.getByText("2 H₂ + O₂ → 2 H₂O")).toBeTruthy();
  });
});
