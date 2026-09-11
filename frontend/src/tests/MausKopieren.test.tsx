import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import StufeKopieren from "@/components/maus/StufeKopieren";

function einfuegen(text: string) {
  const zettel = screen.getByPlaceholderText("Hier einfügen …");
  fireEvent.paste(zettel, { clipboardData: { getData: () => text } });
}

describe("Maus-Führerschein: Kopieren", () => {
  it("zeigt einen leeren Zwischenspeicher, bis etwas kopiert wurde", () => {
    render(<StufeKopieren avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);
    expect(screen.getByTestId("zwischenspeicher")).toHaveTextContent("leer");
  });

  it("zeigt im Zwischenspeicher, was eingefügt wurde, und zählt die Aufgabe", () => {
    vi.useFakeTimers();
    render(<StufeKopieren avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);
    einfuegen("Universum");
    expect(screen.getByTestId("zwischenspeicher")).toHaveTextContent("Universum");
    expect(screen.getByText("Eingefügt! ⭐")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText(/Aufgabe 2 von/)).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("zeigt auch Fremdes, das eingefügt wird, zählt es aber nicht", () => {
    render(<StufeKopieren avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);
    einfuegen("Pizza");
    expect(screen.getByTestId("zwischenspeicher")).toHaveTextContent("Pizza");
    expect(screen.getByText(/Aufgabe 1 von/)).toBeInTheDocument();
  });
});
