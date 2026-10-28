/**
 * Prozent-Blitz: blindes Klicken lohnt sich nicht. Falsch kostet doppelt so
 * viel, wie richtig bringt; wer unter einer halben Sekunde klickt, bekommt nur
 * die Hälfte bzw. dreifachen Abzug und muss danach immer länger warten.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import Spiel from "@/components/prozent/Spiel";
import { BLITZ, blitzWertung } from "@/lib/prozent";

afterEach(() => { vi.useRealTimers(); });

describe("blitzWertung", () => {
  it("überlegt: richtig 10 (+ Serie), falsch −20", () => {
    expect(blitzWertung(true, 2000, 0, 0)).toMatchObject({ plus: 10, neueSerie: 1, schnell: false, hastig: 0, sperre: 0 });
    expect(blitzWertung(true, 2000, 3, 0).plus).toBe(16);
    expect(blitzWertung(false, 2000, 3, 0)).toMatchObject({ plus: -20, neueSerie: 0 });
  });

  it("vorschnell: halbe Punkte, dreifacher Abzug, wachsende Sperre", () => {
    expect(blitzWertung(true, 200, 0, 0)).toMatchObject({ plus: 5, schnell: true, hastig: 1, sperre: BLITZ.sperreJe });
    expect(blitzWertung(false, 200, 0, 0).plus).toBe(-30);
    expect(blitzWertung(false, 200, 0, 2).sperre).toBe(3 * BLITZ.sperreJe);
    expect(blitzWertung(false, 200, 0, 20).sperre).toBe(BLITZ.sperreMax);
    // eine überlegte Antwort setzt die Hast zurück
    expect(blitzWertung(true, 900, 0, 4)).toMatchObject({ hastig: 0, sperre: 0 });
  });

  it("Raten lohnt sich nicht mehr, auch nicht beim Schnäppchen (zwei Antworten)", () => {
    const erwartung = (n: number, ms: number) =>
      (1 / n) * blitzWertung(true, ms, 0, 0).plus + (1 - 1 / n) * blitzWertung(false, ms, 0, 0).plus;
    expect(erwartung(2, 2000)).toBeLessThan(0);
    expect(erwartung(4, 2000)).toBeLessThan(0);
    expect(erwartung(2, 100)).toBeLessThan(0);
  });
});

describe("Spiel", () => {
  it("vorschnell geklickt: Hinweis, und die nächste Aufgabe ist kurz gesperrt", () => {
    vi.useFakeTimers();
    render(<Spiel />);
    act(() => { fireEvent.click(screen.getByRole("button", { name: /Los geht/ })); });
    const antwort = () => screen.getAllByRole("button").find(b => !/Los|Sorte|Nochmal/.test(b.textContent ?? ""))!;
    act(() => { fireEvent.click(antwort()); });
    expect(screen.getByText(/zu schnell geklickt/)).toBeTruthy();
    expect(screen.getByText(/Erst lesen/)).toBeTruthy();
    expect((antwort() as HTMLButtonElement).disabled).toBe(true);
    act(() => { vi.advanceTimersByTime(BLITZ.sperreJe + 200); });
    expect(screen.queryByText(/Erst lesen/)).toBeNull();
    expect((antwort() as HTMLButtonElement).disabled).toBe(false);
  });
});
