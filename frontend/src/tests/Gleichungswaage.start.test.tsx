/**
 * Der Weg vom Periodensystem in die Waage: `start` wählt Modus und Aufgabe,
 * sperrt aber nichts — anders als die Vorgabe einer TaskCrawler-Station.
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import Gleichungswaage from "@/components/waage/Gleichungswaage";

describe("Gleichungswaage mit Start aus dem Link", () => {
  it("öffnet den Chemiemodus mit der übergebenen Reaktion", () => {
    render(<Gleichungswaage start={{ modus: "chemie", reaktion: "Fe + O2 -> Fe2O3" }} />);
    // Die Waage setzt die Indizes tief: aus O2 wird O₂.
    expect(screen.getByRole("button", { name: /⚗️ Chemie/ })).toHaveClass("bg-accent");
    expect(screen.getAllByText("Fe + O₂").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Fe₂O₃").length).toBeGreaterThan(0);
    // Der Moduswechsel bleibt da: wer über den Link kommt, darf weiterprobieren.
    expect(screen.getByRole("button", { name: /Zahlen/ })).toBeInTheDocument();
    // Und die Vorlagen auch.
    expect(screen.getByRole("button", { name: /Eigene Reaktion/ })).toBeInTheDocument();
  });

  it("startet ohne Link wie bisher im Zahlenmodus", () => {
    render(<Gleichungswaage />);
    expect(screen.getByRole("button", { name: /🔢 Zahlen/ })).toHaveClass("bg-accent");
  });

  it("sperrt bei einer Vorgabe weiterhin alles", () => {
    render(<Gleichungswaage vorgabe={{ reaktion: "H2 + O2 -> H2O" }} />);
    expect(screen.queryByRole("button", { name: /🔢 Zahlen/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Eigene Reaktion/ })).not.toBeInTheDocument();
  });
});
