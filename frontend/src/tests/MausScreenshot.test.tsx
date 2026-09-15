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

// jsdom kennt keine echte Bildgröße — die nächste eingefügte Datei bekommt diese Maße.
let naechsteGroesse = { breite: 1920, hoehe: 1080 };

beforeAll(() => {
  // jsdom kennt weder createObjectURL noch Image-Ladeereignisse von echten Bildern.
  URL.createObjectURL = vi.fn(() => "blob:fake");
  URL.revokeObjectURL = vi.fn();
  Object.defineProperty(window.Image.prototype, "naturalWidth", { get() { return naechsteGroesse.breite; } });
  Object.defineProperty(window.Image.prototype, "naturalHeight", { get() { return naechsteGroesse.hoehe; } });
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

  it("Aufgabe 2: ein Bild in Bildschirmgröße (1920×1080) löst die Aufgabe", async () => {
    vi.useFakeTimers();
    naechsteGroesse = { breite: 1920, hoehe: 1080 };
    render(<StufeScreenshot avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);
    const feld = screen.getByTestId("einfuegen-feld");
    act(() => { pasteBild(feld, bilddatei()); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    act(() => { pasteBild(feld, bilddatei("bildschirm.png")); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.getAllByText(/Zieh die gespeicherte Datei hierher/)[0].closest("li")).toHaveClass("font-bold");
    vi.useRealTimers();
  });

  it("Aufgabe 2: ein zu kleines Bild löst die Aufgabe nicht und zeigt einen Hinweis", async () => {
    vi.useFakeTimers();
    render(<StufeScreenshot avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);
    const feld = screen.getByTestId("einfuegen-feld");
    naechsteGroesse = { breite: 1920, hoehe: 1080 };
    act(() => { pasteBild(feld, bilddatei()); });
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    naechsteGroesse = { breite: 400, hoehe: 300 };
    act(() => { pasteBild(feld, bilddatei("ausschnitt.png")); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText(/400 × 300 Pixel groß/)).toBeInTheDocument();
    expect(screen.getByText(/Ganzer Bildschirm:/).closest("li")).toHaveClass("font-bold");
    vi.useRealTimers();
  });
});
