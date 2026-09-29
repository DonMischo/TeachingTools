import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Gleichungswaage from "@/components/waage/Gleichungswaage";
import { parseFormel, varsOf } from "@/lib/formel";

describe("Gleichungswaage an einer Exitgame-Station", () => {
  it("frei: Modi, Stufen, neue und eigene Aufgaben", () => {
    render(<Gleichungswaage />);
    expect(screen.getByText(/Neue Aufgabe/)).toBeInTheDocument();
    expect(screen.getByText(/Eigene Gleichung/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Chemie/ })).toBeInTheDocument();
  });

  it("feste Gleichung: kein Moduswechsel, keine anderen Aufgaben, die Gleichung liegt auf der Waage", () => {
    const { container } = render(<Gleichungswaage vorgabe={{ gleichung: "3x + 4 = 19" }} />);
    expect(screen.queryByText(/Neue Aufgabe/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Eigene Gleichung/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Chemie/ })).not.toBeInTheDocument();
    expect(container.textContent).toMatch(/3x \+ 4/);
    expect(container.textContent).toMatch(/19/);
    expect(screen.getByText(/Zurück/)).toBeInTheDocument();
  });

  it("feste Formel: nur diese Formel, der gesuchte Wert bleibt verdeckt", () => {
    const { container } = render(<Gleichungswaage vorgabe={{ formel: "E = m·g·h", nach: "h", werte: { E: 60, m: 2, g: 10 } }} />);
    expect(screen.queryByText(/Eigene Formel/)).not.toBeInTheDocument();
    expect(container.textContent).toMatch(/E/);
    // h = 3 darf nicht dastehen, bevor h allein steht
    expect(container.textContent).not.toMatch(/h\s*=\s*3\b/);
  });

  it("feste Reaktion: Chemie ohne Vorlagen", () => {
    const { container } = render(<Gleichungswaage vorgabe={{ reaktion: "H2 + O2 -> H2O" }} />);
    expect(screen.queryByText(/Eigene Reaktion/)).not.toBeInTheDocument();
    expect(container.textContent).toMatch(/H2O|H₂O/);
  });

  it("liest die Hebelformel der Exitgame-Vorlage (Größen mit Ziffern)", () => {
    const r = parseFormel("m1·a1 = m2·a2");
    expect(r.ok).toBe(true);
    if (r.ok) expect(varsOf(r.eq)).toEqual(expect.arrayContaining(["m1", "a1", "m2", "a2"]));
  });
});
