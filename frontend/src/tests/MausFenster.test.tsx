import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import StufeFenster from "@/components/maus/StufeFenster";

// jsdom kennt weder PointerEvent noch setPointerCapture. Ohne PointerEvent
// käme `button` nicht im Ereignis an, und der Test prüfte gar nichts.
class Zeigerereignis extends MouseEvent {
  pointerId: number;
  constructor(typ: string, init: MouseEventInit & { pointerId?: number } = {}) {
    super(typ, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

afterEach(() => { vi.unstubAllGlobals(); });

describe("Maus-Führerschein: Fenster", () => {
  it("maximiert beim Klick auf ▢ — die Titelleiste schnappt sich den Zeiger nicht", () => {
    vi.stubGlobal("PointerEvent", Zeigerereignis);
    const fangen = vi.fn();
    HTMLElement.prototype.setPointerCapture = fangen;

    render(<StufeFenster avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);
    const knopf = screen.getByLabelText("Maximieren");
    fireEvent.pointerDown(knopf, { button: 0, pointerId: 1 });
    fireEvent.click(knopf);

    // Im Browser leitet ein gesetzter Pointer-Capture den Klick auf die Titelleiste um.
    expect(fangen).not.toHaveBeenCalled();
    expect(screen.getByText("Maximiert!")).toBeInTheDocument();
  });

  it("zieht an der Titelleiste selbst weiterhin", () => {
    vi.stubGlobal("PointerEvent", Zeigerereignis);
    const fangen = vi.fn();
    HTMLElement.prototype.setPointerCapture = fangen;

    render(<StufeFenster avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);
    fireEvent.pointerDown(screen.getByText("Notizen – Editor"), { button: 0, pointerId: 1 });
    expect(fangen).toHaveBeenCalledTimes(1);
  });

  it("führt durch alle Aufgaben — der Knopf wird zu »Wiederherstellen«, Schließen fragt nicht", async () => {
    vi.stubGlobal("PointerEvent", Zeigerereignis);
    HTMLElement.prototype.setPointerCapture = vi.fn();
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      width: 900, height: 506, left: 0, top: 0, right: 900, bottom: 506, x: 0, y: 0, toJSON() {},
    } as DOMRect);

    const warten = (ms: number) => new Promise(r => setTimeout(r, ms));
    // Unter Last (ganze Suite parallel) braucht die Rückmeldung länger als die üblichen 1 s
    const LANGSAM = { timeout: 5000 };

    const fertig = vi.fn();
    render(<StufeFenster avatar="cat" onFertig={fertig} onWeiter={() => {}} />);

    // maximieren → wiederherstellen → minimieren → zurückholen
    fireEvent.click(screen.getByLabelText("Maximieren"));
    await screen.findByText("Maximiert!", undefined, LANGSAM);
    await warten(950);
    fireEvent.click(screen.getByLabelText("Wiederherstellen"));
    await screen.findByText("Wiederhergestellt!", undefined, LANGSAM);
    await warten(950);
    fireEvent.click(screen.getByLabelText("Minimieren"));
    await screen.findByText("Minimiert!", undefined, LANGSAM);
    await warten(950);
    fireEvent.click(document.querySelector('[data-taskleiste="editor"]')!);
    await screen.findByText("Zurückgeholt!", undefined, LANGSAM);
    await warten(950);

    // verschieben
    const desktop = screen.getByTestId("windows-desktop");
    const titelleiste = screen.getByText("Notizen – Editor").parentElement!;
    fireEvent.pointerDown(titelleiste, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(desktop, { pointerId: 1, clientX: 220, clientY: 110 });
    fireEvent.pointerUp(desktop, { pointerId: 1 });
    await screen.findByText("Genau richtig hingeschoben!", undefined, LANGSAM);
    await warten(950);

    // Größe ändern
    const ecke = screen.getByLabelText("Größe ändern");
    fireEvent.pointerDown(ecke, { button: 0, pointerId: 1, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(desktop, { pointerId: 1, clientX: 220, clientY: 120 });
    fireEvent.pointerUp(desktop, { pointerId: 1 });
    await screen.findByText("Groß genug!", undefined, LANGSAM);
    await warten(950);

    // Alt + Tab
    fireEvent(window, new Event("blur"));
    await warten(550);
    fireEvent(window, new Event("focus"));
    await screen.findByText("Zurück — Alt + Tab hat geklappt!", undefined, LANGSAM);
    await warten(950);

    // Fenster schließen: nichts verändert, also keine Rückfrage
    fireEvent.click(screen.getByLabelText("Schließen"));
    expect(screen.queryByText(/Änderungen speichern/)).not.toBeInTheDocument();
    await screen.findByText(/Geschlossen!/, undefined, LANGSAM);
    await warten(950);
    expect(fertig).toHaveBeenCalledTimes(1);
    expect(fertig.mock.calls[0][0].details[0]).toBe("8 von 8 Aufgaben");
  }, 20000);
});
