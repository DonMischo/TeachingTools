import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Quellen from "@/components/leviathan/Quellen";

describe("Quellen", () => {
  it("listet die Studien mit DOI-Link und zeigt, wo sie wirken", () => {
    render(<Quellen />);
    expect(screen.getByRole("link", { name: "DOI 10.1126/science.aap9559" })).toHaveAttribute("href", "https://doi.org/10.1126/science.aap9559");
    expect(screen.getByText(/Vosoughi, S., Roy, D. & Aral, S. \(2018\)/)).toBeInTheDocument();
    expect(screen.getByText(/Bewusst nicht verwendet/)).toBeInTheDocument();
    expect(screen.getAllByText(/Im Spiel verwendet/).length).toBeGreaterThan(10);
  });
});
