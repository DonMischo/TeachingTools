/** QR-Code lesen: Erfolg nur, wenn der gelesene Text stimmt — nicht fürs Aufdecken. */
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QrLesen, gleicherText } from "@/components/medien/demos/Live";

describe("QR-Code lesen und prüfen", () => {
  it("Groß-/Kleinschreibung und Leerzeichen sind egal", () => {
    expect(gleicherText("  hallo   Klasse ", "Hallo Klasse")).toBe(true);
    expect(gleicherText("Hallo", "Hallo Klasse")).toBe(false);
  });

  it("richtig eingetragen → Erfolg, falsch → Hinweis", () => {
    const richtig = vi.fn();
    render(<QrLesen inhalt="Rohrpost" onRichtig={richtig} />);
    const feld = screen.getByLabelText("Gelesener Text");
    fireEvent.change(feld, { target: { value: "Rohrbost" } });
    fireEvent.click(screen.getByRole("button", { name: "Prüfen" }));
    expect(screen.getByText(/Stimmt nicht/)).toBeInTheDocument();
    expect(richtig).not.toHaveBeenCalled();
    fireEvent.change(feld, { target: { value: "rohrpost" } });
    fireEvent.click(screen.getByRole("button", { name: "Prüfen" }));
    expect(richtig).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Richtig gelesen/)).toBeInTheDocument();
  });

  it("Aufdecken zeigt die Lösung, gibt aber keinen Erfolg", () => {
    const richtig = vi.fn();
    render(<QrLesen inhalt="Pager" onRichtig={richtig} />);
    fireEvent.click(screen.getByRole("button", { name: /Aufdecken/ }));
    expect(screen.getByText(/»Pager«/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Gelesener Text")).not.toBeInTheDocument();
    expect(richtig).not.toHaveBeenCalled();
  });
});
