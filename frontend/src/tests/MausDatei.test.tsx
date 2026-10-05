import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within, act } from "@testing-library/react";
import StufeDatei from "@/components/maus/StufeDatei";

const warten = (ms: number) => act(() => new Promise(r => setTimeout(r, ms)));
// Unter Last (ganze Suite parallel) braucht die Rückmeldung länger als die üblichen 1 s
const LANGSAM = { timeout: 5000 };

/** jsdom hat kein DataTransfer — für HTML-Ziehen reicht ein Ablagefach. */
function ablage() {
  const daten: Record<string, string> = {};
  return {
    setData: (t: string, v: string) => { daten[t] = v; },
    getData: (t: string) => daten[t] ?? "",
    get types() { return Object.keys(daten); },
    dropEffect: "none",
    effectAllowed: "all",
  };
}

describe("Maus-Führerschein: Speichern & USB-Stick", () => {
  it("schreiben → Speichern unter → beim Schließen speichern → wiederfinden → USB → herunterfahren", async () => {
    const fertig = vi.fn();
    render(<StufeDatei avatar="cat" onFertig={fertig} onWeiter={() => {}} />);
    const text = screen.getByLabelText("Text im Editor");

    // 1 schreiben
    fireEvent.change(text, { target: { value: "Mein Hund heißt Bello." } });
    await screen.findByText("Toll geschrieben!", undefined, LANGSAM);
    await warten(1150);

    // 2 Datei › Speichern unter
    fireEvent.click(document.querySelector("[data-editor] [aria-expanded]")!);
    fireEvent.click(document.querySelector('[data-datei-menue="speichernUnter"]')!);
    const dialog = await screen.findByTestId("speichern-unter");
    fireEvent.change(within(dialog).getByTestId("dateiname"), { target: { value: "Mein Tier" } });
    fireEvent.click(within(dialog).getByTestId("speichern-knopf"));
    await screen.findByText("Gespeichert als »Mein Tier.txt«!", undefined, LANGSAM);
    expect(screen.getByTestId("editor-titel")).toHaveTextContent("Mein Tier.txt – Editor");
    await warten(1150);

    // 3 weiterschreiben, ✕ → Frage → Speichern
    fireEvent.change(text, { target: { value: "Mein Hund heißt Bello.\nEr spielt gern." } });
    expect(screen.getByTestId("editor-titel")).toHaveTextContent("*Mein Tier.txt");
    fireEvent.click(screen.getAllByLabelText("Schließen")[0]);
    fireEvent.click(document.querySelector('[data-frage="speichern"]')!);
    await screen.findByText("Gespeichert und geschlossen!", undefined, LANGSAM);
    expect(screen.queryByLabelText("Text im Editor")).not.toBeInTheDocument();
    await warten(1150);

    // 4 wiederfinden: Explorer › Dokumente › Doppelklick
    fireEvent.doubleClick(document.querySelector('[data-desktop-symbol="dieserpc"]')!);
    fireEvent.click(document.querySelector('[data-explorer] [data-nav="dokumente"]')!);
    const datei = screen.getByText("Mein Tier.txt").closest("button")!;
    fireEvent.doubleClick(datei);
    await screen.findByText(/Wiedergefunden/, undefined, LANGSAM);
    expect((screen.getByLabelText("Text im Editor") as HTMLTextAreaElement).value).toBe("Mein Hund heißt Bello.\nEr spielt gern.");
    await warten(1150);

    // 5 USB-Stick wird eingesteckt und in der Seitenleiste gefunden
    await warten(800);
    expect(screen.getByRole("status")).toHaveTextContent("USB-Stick (D:)");
    fireEvent.click(document.querySelector('[data-explorer] [data-nav="usb"]')!);
    await screen.findByText(/Da ist der USB-Stick/, undefined, LANGSAM);
    await warten(1150);

    // 6 Datei aus Dokumente auf den Stick ziehen
    fireEvent.click(document.querySelector('[data-explorer] [data-nav="dokumente"]')!);
    const fach = ablage();
    fireEvent.dragStart(screen.getByText("Mein Tier.txt").closest("button")!, { dataTransfer: fach });
    const usb = document.querySelector('[data-explorer] [data-nav="usb"]')!;
    fireEvent.dragOver(usb, { dataTransfer: fach });
    fireEvent.drop(usb, { dataTransfer: fach });
    await screen.findByText(/Deine Datei ist jetzt auf dem Stick/, undefined, LANGSAM);
    expect(screen.getByText("Mein Tier.txt")).toBeInTheDocument();
    await warten(1150);

    // 7 Start › Ein/Aus › Herunterfahren (falsche Wahl zählt als Fehlversuch)
    fireEvent.click(document.querySelector("[data-start]")!);
    fireEvent.click(document.querySelector("[data-einaus]")!);
    fireEvent.click(document.querySelector('[data-einaus-wahl="energiesparen"]')!);
    expect(screen.getByText(/er ist nicht aus/)).toBeInTheDocument();
    fireEvent.click(document.querySelector("[data-start]")!);
    fireEvent.click(document.querySelector("[data-einaus]")!);
    fireEvent.click(document.querySelector('[data-einaus-wahl="herunterfahren"]')!);
    expect(screen.getByTestId("ausgeschaltet")).toHaveTextContent("Wird heruntergefahren");
    await warten(2300 + 1150);
    expect(fertig).toHaveBeenCalledTimes(1);
    expect(fertig.mock.calls[0][0].details[0]).toBe("7 von 7 Aufgaben");
  }, 30000);

  it("schließt ohne Änderung ohne Rückfrage", () => {
    render(<StufeDatei avatar="cat" onFertig={() => {}} onWeiter={() => {}} />);
    fireEvent.click(screen.getAllByLabelText("Schließen")[0]);
    expect(screen.queryByText(/Änderungen an/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Text im Editor")).not.toBeInTheDocument();
  });
});
