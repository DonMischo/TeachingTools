import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import KoordinatenLauf from "@/components/koordinaten/KoordinatenLauf";
import FunktionenWerkzeug from "@/components/simulationen/FunktionenWerkzeug";

const KEY = "test_koordinaten_stand";
afterEach(() => { localStorage.clear(); vi.useRealTimers(); });

const druecke = (el: Element, key: string, n = 1) => { for (let i = 0; i < n; i++) fireEvent.keyDown(el, { key }); };

/** Öffnet Level 1.1 — beim ersten Mal kommt der Infohappen davor. */
function oeffneErstesLevel() {
  fireEvent.click(screen.getByRole("button", { name: /Edelsteine sammeln/ }));
  expect(screen.getByTestId("infohappen")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /Zum Level/ }));
  return screen.getByLabelText(/Spielfläche/);
}

describe("Koordinaten-Lauf", () => {
  it("Tastatur: laufen, Sprunghöhe, springen — Treffer und Fehlsprung mit Hinweis", () => {
    render(<KoordinatenLauf speicherSchluessel={KEY} />);
    const flaeche = oeffneErstesLevel();
    druecke(flaeche, "ArrowRight", 3);
    druecke(flaeche, "ArrowUp", 2);
    expect(screen.getByTestId("anzeige")).toHaveTextContent("x = 3 · Sprung ↑ 2");
    druecke(flaeche, " ");
    expect(screen.getByRole("status")).toHaveTextContent("✓ A(3|2)");
    // B(6|4) vertauscht anspringen: (4|6)
    druecke(flaeche, "ArrowRight", 1);
    druecke(flaeche, "ArrowUp", 6);
    druecke(flaeche, "Enter");
    expect(screen.getByRole("status")).toHaveTextContent(/vertauscht/);
    expect(screen.getByText("Fehlsprünge: 1")).toBeInTheDocument();
  });

  it("Level fertig → Sterne werden gespeichert", () => {
    render(<KoordinatenLauf speicherSchluessel={KEY} />);
    const f = oeffneErstesLevel();
    // A(3|2), B(6|4), C(1|5)
    druecke(f, "ArrowRight", 3); druecke(f, "ArrowUp", 2); druecke(f, " ");
    druecke(f, "ArrowRight", 3); druecke(f, "ArrowUp", 4); druecke(f, " ");
    druecke(f, "ArrowLeft", 5); druecke(f, "ArrowUp", 5); druecke(f, " ");
    expect(screen.getByTestId("geschafft")).toHaveTextContent("Geschafft!");
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ "w1-edelsteine": 3 });
  });

  it("Vorführen im Level löst nicht und stellt den Stand wieder her", () => {
    vi.useFakeTimers();
    render(<KoordinatenLauf speicherSchluessel={KEY} />);
    const f = oeffneErstesLevel();
    fireEvent.click(screen.getByRole("button", { name: "▶ Vorführen" }));
    expect(screen.getByTestId("vorfuehrung")).toHaveTextContent("Gesucht: A(3|2).");
    // Tasten sind während der Vorführung gesperrt
    druecke(f, "ArrowRight");
    act(() => { vi.advanceTimersByTime(30_000); });
    expect(screen.queryByTestId("vorfuehrung")).not.toBeInTheDocument();
    expect(screen.getByTestId("anzeige")).toHaveTextContent("x = 0 · Sprung ↑ 0");
    expect(screen.getByText("A(3|2)")).toBeInTheDocument();  // noch nicht abgehakt
  });

  it("Infohappen führt sein Beispiel vor", () => {
    vi.useFakeTimers();
    render(<KoordinatenLauf speicherSchluessel={KEY} />);
    fireEvent.click(screen.getByRole("button", { name: /Negative Koordinaten/ }));
    fireEvent.click(screen.getByRole("button", { name: "▶ Vorführen" }));
    expect(screen.getByTestId("vorfuehrung")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(60_000); });
    expect(screen.getByTestId("koordinaten-feld").querySelector("desc")).toHaveTextContent("fertig");
  });
});

describe("Funktionen und Koordinatensystem", () => {
  it("zwei Reiter, Graphen zuerst", () => {
    render(<FunktionenWerkzeug />);
    expect(screen.getByRole("heading", { name: /Funktionen und Koordinatensystem/ })).toBeInTheDocument();
    expect(screen.getByLabelText("Funktionsterm")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Koordinaten-Lauf/ }));
    expect(screen.getByText(/Welt 1: Erst laufen, dann springen/)).toBeInTheDocument();
  });
});
