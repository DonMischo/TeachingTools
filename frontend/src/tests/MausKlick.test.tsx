import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import Klickspiel from "@/components/maus/Klickspiel";
import { Stufenkopf, vorlesbarerText } from "@/components/maus/Stufenkopf";

const zellen = () => Array.from(document.querySelectorAll<HTMLElement>("[data-zelle]"));
const reihenfolge = () => zellen().map(z => z.dataset.zelle);
const ziel = () => document.querySelector<HTMLElement>("[data-ziel]")!;

function starten() {
  render(<Klickspiel art="klick" onFertig={() => {}} onWeiter={() => {}} />);
  fireEvent.click(screen.getByText(/Los geht/));
}

afterEach(() => { vi.useRealTimers(); });

describe("Maus-Führerschein: Klicken", () => {
  it("behält die Reihenfolge des Rasters und hebt das Ziel hervor", () => {
    starten();
    const vorher = reihenfolge();
    expect(vorher).toHaveLength(9);
    expect(document.querySelectorAll(".maus-blinken")).toHaveLength(1);

    const erstesZiel = ziel().dataset.zelle;
    fireEvent.click(ziel());

    expect(reihenfolge()).toEqual(vorher);
    expect(ziel().dataset.zelle).not.toBe(erstesZiel);
    expect(ziel().className).toContain("maus-blinken");
  });

  it("lässt ein verfehltes Tier nur kurz wackeln — nicht in späteren Runden", () => {
    vi.useFakeTimers();
    starten();
    const daneben = zellen().find(z => !z.dataset.ziel)!;
    fireEvent.click(daneben);
    expect(daneben.className).toContain("maus-wackeln");

    act(() => { vi.advanceTimersByTime(700); });
    fireEvent.click(ziel());
    expect(document.querySelector(".maus-wackeln")).toBeNull();
  });
});

describe("Maus-Führerschein: Vorlesen", () => {
  it("liest nur den Auftrag, ohne Tipps, Zähler und Emojis", () => {
    const el = document.createElement("div");
    el.innerHTML = 'Klicke auf die <b>Kuh</b> 🐮<div data-zusatz>💡 Tipp: Treffer 3 / 20</div>';
    expect(vorlesbarerText(el)).toBe("Klicke auf die Kuh");
  });

  it("gibt der Stimme genau diesen Text", () => {
    const speak = vi.fn();
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: { speak, cancel: vi.fn(), getVoices: () => [] },
    });
    class Satz { text: string; lang = ""; rate = 1; voice = null; onend = null; onerror = null; constructor(t: string) { this.text = t; } }
    vi.stubGlobal("SpeechSynthesisUtterance", Satz);

    render(
      <Stufenkopf
        titel="Test"
        auftrag={<>Markiere das Wort <b>»Sonne«</b>.<div data-zusatz>💡 Doppelklick auf das Wort</div></>}
        onWeiter={() => {}}
      />,
    );
    fireEvent.click(screen.getByTitle("Auftrag vorlesen"));
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak.mock.calls[0][0].text).toBe("Markiere das Wort »Sonne«.");
    vi.unstubAllGlobals();
  });
});
