import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Funktionen from "@/components/simulationen/Funktionen";
import Vierecke from "@/components/simulationen/Vierecke";
import Rechenregeln from "@/components/simulationen/Rechenregeln";

describe("Simulationen mit fester Vorgabe (TaskCrawler-Stationen)", () => {
  it("Funktionen: Term fest, keine Vorlagen", () => {
    render(<Funktionen vorgabe={{ term: "x^2 - 4", von: -3, bis: 3 }} />);
    const feld = screen.getByLabelText("Funktionsterm") as HTMLInputElement;
    expect(feld.value).toBe("x^2 - 4");
    expect(feld.readOnly).toBe(true);
    expect(screen.queryByText(/Eine Vorlage wählen/)).not.toBeInTheDocument();
  });

  it("Funktionen frei: Term änderbar", () => {
    render(<Funktionen />);
    expect((screen.getByLabelText("Funktionsterm") as HTMLInputElement).readOnly).toBe(false);
  });

  it("Vierecke: Form, Maße und Blatt fest, Rechnung verdeckt", () => {
    const { container } = render(<Vierecke vorgabe={{ form: "trapez", masse: { a: 8, c: 4, h: 3 } }} />);
    expect(screen.queryByRole("button", { name: /Rechteck/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Umfang/ })).not.toBeInTheDocument();
    expect(container.textContent).toMatch(/Seite a \(unten\) = 8/);
    expect(container.textContent).not.toMatch(/Fläche A = 18/);
    for (const r of container.querySelectorAll("input[type=range]")) expect((r as HTMLInputElement).disabled).toBe(true);
  });

  it("Vierecke: Rechnung auf Wunsch sichtbar", () => {
    const { container } = render(<Vierecke vorgabe={{ form: "trapez", masse: { a: 8, c: 4, h: 3 }, rechnung: true }} />);
    expect(container.textContent).toMatch(/Fläche A = 18/);
  });

  it("Rechenregeln: Obstkorb mit festem Term, ohne Reiter und eigene Aufgaben", () => {
    render(<Rechenregeln vorgabe={{ term: "2 + 3 · (4 − 1)" }} />);
    expect(screen.getByLabelText("Term")).toHaveTextContent("2 + 3 · (4 − 1)");
    expect(screen.queryByRole("button", { name: /Rechenzug/ })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/z\. B\./)).not.toBeInTheDocument();
  });

  it("Rechenregeln: Stufenzahlen mit festen Zahlen, ohne »Lösung zeigen«", () => {
    render(<Rechenregeln vorgabe={{ a: 3.5, b: 100, art: "*" }} />);
    expect((screen.getByLabelText("erste Zahl") as HTMLInputElement).value).toBe("3,5");
    expect((screen.getByLabelText("erste Zahl") as HTMLInputElement).readOnly).toBe(true);
    expect(screen.queryByText("Lösung zeigen")).not.toBeInTheDocument();
    expect(screen.queryByText(/geteilt/)).not.toBeInTheDocument();
  });
});
