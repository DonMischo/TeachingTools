/**
 * Tastatur-Stufe: der Rettungsknopf »↺ Text zurücksetzen«.
 *
 * Aus der Praxis: verwirrte Kinder räumen das Feld leer. Ohne »Katzee« lässt
 * sich das doppelte e nicht mehr löschen — die Aufgabe war unlösbar
 * festgefahren, und das Kind kam ohne fremde Hilfe nicht weiter.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import StufeTastatur from "@/components/maus/StufeTastatur";

function feld(): HTMLInputElement {
  return screen.getByRole("textbox") as HTMLInputElement;
}

/** Den Feldinhalt setzen, wie es ein tippendes Kind täte. */
function tippe(wert: string) {
  fireEvent.input(feld(), { target: { value: wert } });
}

/** Aufgabe 1 (»Hund« mit Umschalt) lösen, um bei »Katzee« zu landen. */
function zuKatzee() {
  fireEvent.keyDown(feld(), { code: "ShiftLeft", key: "Shift" });
  tippe("Hund");
  act(() => { vi.advanceTimersByTime(1000); });
}

describe("Maus-Führerschein: Tastatur", () => {
  afterEach(() => vi.useRealTimers());

  it("holt den Starttext zurück, wenn das Feld leer geräumt wurde", () => {
    vi.useFakeTimers();
    render(<StufeTastatur avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);
    zuKatzee();
    expect(feld().value).toBe("Katzee");

    tippe("");  // das Kind löscht alles und sitzt fest
    fireEvent.click(screen.getByText("↺ Text zurücksetzen"));

    expect(feld().value).toBe("Katzee");
  });

  it("stellt auch den Weg zur Lösung zurück, nicht nur den Text", () => {
    // Sonst zählte eine vor dem Zurücksetzen gedrückte Rücktaste weiter mit und
    // die Aufgabe liesse sich danach durch blosses Tippen »lösen«.
    vi.useFakeTimers();
    render(<StufeTastatur avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);
    zuKatzee();

    fireEvent.keyDown(feld(), { code: "Backspace", key: "Backspace" });
    fireEvent.click(screen.getByText("↺ Text zurücksetzen"));
    tippe("Katze");                       // richtiger Text, aber ohne Rücktaste
    expect(screen.queryByText("Richtig! ⭐")).not.toBeInTheDocument();

    fireEvent.keyDown(feld(), { code: "Backspace", key: "Backspace" });
    tippe("Katze");
    expect(screen.getByText("Richtig! ⭐")).toBeInTheDocument();
  });

  it("zählt das Zurücksetzen nicht als Fehler", () => {
    // Wer feststeckt, soll sich retten duerfen, ohne Punkte zu verlieren: nach
    // dem Zurücksetzen zaehlen auch die wilden Anschlaege davor nicht mehr mit.
    vi.useFakeTimers();
    // Die Wertung zählt auch die gebrauchte Zeit. Ohne feste Uhr entscheidet
    // unter Last die Rechenzeit der beiden Durchläufe das Ergebnis statt der
    // Fehlerzähler — der Test schlug dann sporadisch fehl.
    vi.spyOn(performance, "now").mockReturnValue(0);

    function punkteNachKatzee(zuruecksetzen: boolean): number {
      const { unmount } = render(<StufeTastatur avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);
      zuKatzee();
      for (let i = 0; i < 20; i++) fireEvent.keyDown(feld(), { code: "KeyX", key: "x" });
      if (zuruecksetzen) fireEvent.click(screen.getByText("↺ Text zurücksetzen"));
      fireEvent.keyDown(feld(), { code: "Backspace", key: "Backspace" });
      tippe("Katze");
      const punkte = Number(screen.getByTestId("punkte").textContent!.replace(/\D/g, ""));
      unmount();
      return punkte;
    }

    expect(punkteNachKatzee(true)).toBeGreaterThan(punkteNachKatzee(false));
  });
});
