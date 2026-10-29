import { describe, it, expect, vi } from "vitest";
import { act, render, screen, fireEvent, within } from "@testing-library/react";
import StufeExplorer from "@/components/maus/StufeExplorer";

/** Neuen Ordner anlegen und doppelklickend öffnen. */
function inSchule() {
  render(<StufeExplorer avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);
  fireEvent.click(screen.getByTitle("Neuer Ordner"));
  fireEvent.doubleClick(screen.getByText(/Neuer Ordner/, { selector: "button *, button" }).closest("button")!);
  expect(within(screen.getByTestId("adressleiste")).getByText("Neuer Ordner")).toBeInTheDocument();
  expect(screen.getByTestId("explorer-titel")).toHaveTextContent("Neuer Ordner");
}

describe("Maus-Führerschein: Explorer-Navigation", () => {
  it("»Dokumente« in der Seitenleiste führt aus dem Unterordner zurück", () => {
    inSchule();
    fireEvent.click(document.querySelector('[data-nav="dokumente"]')!);
    expect(within(screen.getByTestId("adressleiste")).queryByText("Neuer Ordner")).not.toBeInTheDocument();
  });

  it("»Dokumente« in der Adressleiste führt zurück", () => {
    inSchule();
    fireEvent.click(document.querySelector('[data-pfad="dokumente"]')!);
    expect(within(screen.getByTestId("adressleiste")).queryByText("Neuer Ordner")).not.toBeInTheDocument();
    expect(screen.getByTestId("explorer-titel")).toHaveTextContent("Dokumente");
  });
});

describe("Maus-Führerschein: Explorer — Umbenennen, Ablegen, Zurücksetzen", () => {
  function start() {
    render(<StufeExplorer avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);
    fireEvent.click(screen.getByTitle("Neuer Ordner"));
    return screen.getByText("Neuer Ordner", { selector: "[data-name]" });
  }

  it("ein zweiter, langsamer Klick auf den Namen benennt um — der Name steht markiert da", () => {
    vi.useFakeTimers();
    const name = start(); // der neue Ordner ist schon markiert
    fireEvent.click(name, { detail: 1 });
    act(() => { vi.advanceTimersByTime(700); });
    const feld = screen.getByLabelText("Neuer Name") as HTMLInputElement;
    expect(document.activeElement).toBe(feld);
    expect([feld.selectionStart, feld.selectionEnd]).toEqual([0, "Neuer Ordner".length]);
    vi.useRealTimers();
  });

  it("bei Dateien bleibt die Endung unmarkiert", () => {
    vi.useFakeTimers();
    render(<StufeExplorer avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);
    const name = screen.getByText("Mathe.docx", { selector: "[data-name]" });
    fireEvent.click(name, { detail: 1 });
    fireEvent.click(name, { detail: 1 });
    act(() => { vi.advanceTimersByTime(700); });
    const feld = screen.getByLabelText("Neuer Name") as HTMLInputElement;
    expect([feld.selectionStart, feld.selectionEnd]).toEqual([0, "Mathe".length]);
    vi.useRealTimers();
  });

  it("ein Doppelklick öffnet und benennt nicht um", () => {
    vi.useFakeTimers();
    const name = start();
    fireEvent.click(name, { detail: 1 });
    fireEvent.doubleClick(name);
    act(() => { vi.advanceTimersByTime(700); });
    expect(screen.queryByLabelText("Neuer Name")).toBeNull();
    expect(screen.getByTestId("explorer-titel")).toHaveTextContent("Neuer Ordner");
    vi.useRealTimers();
  });

  it("Dateien lassen sich auf »Dokumente« in der Seitenleiste ziehen", () => {
    start();
    const ordner = screen.getByText("Neuer Ordner", { selector: "[data-name]" }).closest("button")!;
    const mathe = screen.getByText("Mathe.docx", { selector: "[data-name]" }).closest("button")!;
    const ziehe = (quelle: HTMLElement, ziel: Element) => {
      const vorher = document.elementFromPoint;
      document.elementFromPoint = () => ziel;
      quelle.setPointerCapture = () => {};
      fireEvent.pointerDown(quelle, { button: 0, clientX: 0, clientY: 0, pointerId: 1 });
      fireEvent.pointerMove(quelle, { clientX: 50, clientY: 50, pointerId: 1 });
      fireEvent.pointerUp(quelle, { clientX: 50, clientY: 50, pointerId: 1 });
      document.elementFromPoint = vorher;
    };
    ziehe(mathe, ordner);
    expect(screen.queryByText("Mathe.docx")).toBeNull();
    fireEvent.doubleClick(ordner);
    const drin = screen.getByText("Mathe.docx", { selector: "[data-name]" }).closest("button")!;
    ziehe(drin, document.querySelector('[data-nav="dokumente"]')!);
    expect(screen.queryByText("Mathe.docx")).toBeNull();
    fireEvent.click(document.querySelector('[data-nav="dokumente"]')!);
    expect(screen.getByText("Mathe.docx")).toBeInTheDocument();
  });

  it("»Übung zurücksetzen« stellt den Anfang wieder her", () => {
    start();
    expect(screen.getByText("Neuer Ordner", { selector: "[data-name]" })).toBeInTheDocument();
    fireEvent.click(screen.getByText(/Übung zurücksetzen/));
    expect(screen.queryByText("Neuer Ordner", { selector: "[data-name]" })).toBeNull();
    expect(screen.getByText(/Lege einen neuen Ordner an/, { selector: "li span" })).toBeInTheDocument();
  });
});
