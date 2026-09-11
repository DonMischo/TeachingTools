import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import StufeScreenshot from "@/components/maus/StufeScreenshot";

function bilddatei(name = "foto.png") {
  return new File(["x"], name, { type: "image/png" });
}

function pasteBild(el: Element, datei: File) {
  fireEvent.paste(el, {
    clipboardData: { items: [{ kind: "file", type: "image/png", getAsFile: () => datei }] },
  });
}

beforeAll(() => {
  // jsdom kennt weder createObjectURL noch Image-Ladeereignisse von echten Bildern.
  URL.createObjectURL = vi.fn(() => "blob:fake");
  URL.revokeObjectURL = vi.fn();
  Object.defineProperty(window.Image.prototype, "src", {
    set() { setTimeout(() => this.onload?.()); },
  });
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe("Maus-Führerschein: Bildschirmfoto", () => {
  it("zeigt die erste Aufgabe als aktiv", () => {
    render(<StufeScreenshot avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);
    expect(screen.getByText(/Ausschnitt:/)).toBeInTheDocument();
  });

  it("zählt einen eingefügten Bild-Ausschnitt und geht zur nächsten Aufgabe", async () => {
    vi.useFakeTimers();
    render(<StufeScreenshot avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);
    const feld = screen.getByTestId("einfuegen-feld");
    act(() => { pasteBild(feld, bilddatei()); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getByText(/Ganzer Bildschirm:/).closest("li")).toHaveClass("font-bold");
    vi.useRealTimers();
  });

  it("zeigt bei Text statt Bild einen Hinweis", () => {
    render(<StufeScreenshot avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);
    const feld = screen.getByTestId("einfuegen-feld");
    fireEvent.paste(feld, { clipboardData: { items: [{ kind: "string", type: "text/plain" }] } });
    expect(screen.getByText(/Das war Text, kein Bild/)).toBeInTheDocument();
  });
});
