import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { useState } from "react";
import { Einstellungen } from "@/components/maus/windows/Einstellungen";
import StufeAussehen from "@/components/maus/StufeAussehen";
import { WindowsKontext } from "@/components/maus/windows/WindowsKontext";
import { STANDARD_AUSSEHEN, type Aussehen } from "@/lib/maus/windows";

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe("Maus-Führerschein: Einstellungen-Fenster", () => {
  it("Klick auf einen Hintergrund ruft onAussehen mit dessen Id auf", () => {
    const onAussehen = vi.fn();
    render(
      <Einstellungen
        aussehen={STANDARD_AUSSEHEN}
        onAussehen={onAussehen}
        seite="hintergrund"
        onSeite={() => {}}
        benutzer="Mia"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Wald" }));
    expect(onAussehen).toHaveBeenCalledWith({ ...STANDARD_AUSSEHEN, hintergrund: "wald" });
  });
});

function AussehenTestRahmen() {
  const [aussehen, setAussehen] = useState<Aussehen>(STANDARD_AUSSEHEN);
  return (
    <WindowsKontext.Provider value={{ aussehen, setAussehen, benutzer: "Mia" }}>
      <StufeAussehen avatar="cat" onFertig={() => {}} onWeiter={() => {}} />
    </WindowsKontext.Provider>
  );
}

describe("Maus-Führerschein: Stufe Hintergrund & Farben", () => {
  it("Aufgabe 1 (öffnen) und Aufgabe 2 (Hintergrund) lassen sich per Klick lösen", () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.useFakeTimers();
    render(<AussehenTestRahmen />);

    // Aufgabe 1: Einstellungen über die Taskleiste öffnen.
    const taskleisteKnopf = document.querySelector('[data-taskleiste="einstellungen"]') as HTMLElement;
    expect(taskleisteKnopf).toBeTruthy();
    fireEvent.click(taskleisteKnopf);
    expect(document.querySelector('[data-einstellung-seite="hintergrund"]')).toBeTruthy();

    // Aufgabe 2: den gesuchten Hintergrund anklicken — bei Math.random() = 0
    // ist das der erste andere Eintrag der Liste, »Himmel«.
    const himmel = document.querySelector('[data-hintergrund="himmel"]') as HTMLElement;
    expect(himmel).toBeTruthy();
    fireEvent.click(himmel);

    expect(screen.getByText("Toll — genau der richtige Hintergrund!")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(800); });
    // Aufgabe 3 ist dran: der Auftragstext nennt jetzt den gesuchten Modus.
    expect(screen.getAllByText((_, el) => el?.tagName === "DIV" && el?.textContent === "Schalte auf den dunklen Modus.").length).toBeGreaterThan(0);
  });
});
