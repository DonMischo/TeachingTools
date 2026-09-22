/**
 * Das Glossar und die Fachwörter im Text.
 *
 * Zwei Sorten Fehler tun hier weh und fallen von allein nicht auf: ein Begriff
 * wird *in* einem anderen Wort markiert (»Token« mitten in »Tokenbahnhof«),
 * oder ein Eintrag verspricht eine Erklärung, die es gar nicht gibt. Beides
 * sieht auf dem Bildschirm harmlos aus und macht den Text trotzdem falsch.
 */
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GLOSSAR, zerlegeMitFachworten } from "@/lib/ki/glossar";
import { MitFachworten } from "@/components/ki/Fachwort";
import { WISSEN, type Lesestufe } from "@/lib/ki/wissen";

const STUFEN: Lesestufe[] = ["5-7", "8+", "10+"];

/** Nur die markierten Begriffe eines Textes. */
function begriffe(text: string): string[] {
  return zerlegeMitFachworten(text)
    .filter((s): s is { begriff: string; wort: string } => typeof s !== "string")
    .map(s => s.begriff);
}

describe("Die Einträge", () => {
  it("haben Titel und einen Satz, der für sich steht", () => {
    for (const [begriff, e] of Object.entries(GLOSSAR)) {
      expect(e.titel, begriff).toBeTruthy();
      expect(e.kurz.length, `${begriff}: zu knapp`).toBeGreaterThan(25);
      expect(/[.!?]$/.test(e.kurz.trim()), `${begriff}: kein ganzer Satz`).toBe(true);
    }
  });

  it("erklären die Wörter, die in den Lesetexten vorkommen", () => {
    // Stichprobe der Begriffe, ohne die die Texte nicht zu verstehen sind.
    for (const wort of [
      "XOR", "Backpropagation", "Perzeptron", "Sigmoid", "Token", "Perplexität",
      "Attention", "Transformer", "Korpus", "Backoff", "Seed", "Halluzination",
    ]) {
      expect(GLOSSAR[wort] ?? Object.values(GLOSSAR).find(e => e.auch?.includes(wort)),
        `${wort} fehlt im Glossar`).toBeTruthy();
    }
  });
});

describe("Begriffe im Text finden", () => {
  it("markiert ganze Wörter, keine Wortteile", () => {
    expect(begriffe("Ein Token ist ein Stück.")).toEqual(["Token"]);
    // »Token« steckt auch in »Tokenbahnhof« — dort darf nichts markiert werden.
    expect(begriffe("Der Tokenbahnhof ist erfunden.")).toEqual([]);
  });

  it("nimmt den längeren Begriff, wenn zwei passen", () => {
    // »Byte-Pair Encoding« gewinnt, nicht irgendein Teil davon.
    expect(begriffe("Das Verfahren heißt Byte-Pair Encoding.")).toEqual(["Byte-Pair Encoding"]);
  });

  it("markiert jeden Begriff nur einmal je Absatz", () => {
    const gefunden = begriffe("Ein Token ist ein Token, und noch ein Token.");
    expect(gefunden).toEqual(["Token"]);
  });

  it("erkennt auch die anderen Schreibweisen", () => {
    expect(begriffe("Die Tokenisierung zerlegt den Satz.")).toEqual(["Token"]);
    expect(begriffe("Mit mehreren Startwerten probiert.")).toEqual(["Seed"]);
  });

  it("gibt den Text unverändert zurück", () => {
    for (const eintrag of Object.values(WISSEN)) {
      for (const stufe of STUFEN) {
        for (const absatz of eintrag.stufen[stufe]) {
          const wieder = zerlegeMitFachworten(absatz)
            .map(s => (typeof s === "string" ? s : s.wort))
            .join("");
          expect(wieder, "der Text hat sich beim Markieren verändert").toBe(absatz);
        }
      }
    }
  });

  it("markiert nur Begriffe, die es auch erklärt", () => {
    for (const eintrag of Object.values(WISSEN)) {
      for (const stufe of STUFEN) {
        for (const absatz of eintrag.stufen[stufe]) {
          for (const b of begriffe(absatz)) {
            expect(GLOSSAR[b], `${b} wird markiert, steht aber nicht im Glossar`).toBeTruthy();
          }
        }
      }
    }
  });

  it("erklärt in den Lesetexten überhaupt etwas", () => {
    // Wären es null, liefe die Verknüpfung ins Leere, ohne dass es auffällt.
    const alle = Object.values(WISSEN)
      .flatMap(e => STUFEN.flatMap(s => e.stufen[s]))
      .flatMap(begriffe);
    expect(new Set(alle).size).toBeGreaterThan(20);
  });
});

describe("Im Text angetippt", () => {
  it("zeigt die Erklärung erst auf Wunsch", () => {
    render(<MitFachworten text="Das nennt man XOR." />);
    expect(screen.queryByRole("tooltip")).toBeNull();

    fireEvent.click(screen.getByText("XOR"));
    const kasten = screen.getByRole("tooltip");
    expect(kasten.textContent).toContain("entweder oder");
    // Zum XOR gehört ein Bild — ohne es bleibt »über Kreuz« eine Behauptung.
    expect(kasten.querySelector("svg")).toBeTruthy();
  });

  it("hängt den Kasten an den Seitenkörper, nicht in den Absatz", () => {
    // Sonst schneidet ihn jeder Rahmen mit »overflow: hidden« ab — der
    // Lesekasten hat einen, die Spielbühne scrollt — und die Erklärung ist
    // halb oder gar nicht zu sehen.
    const { container } = render(
      <div style={{ overflow: "hidden", height: 40 }}>
        <MitFachworten text="Das nennt man XOR." />
      </div>,
    );
    fireEvent.click(screen.getByText("XOR"));
    const kasten = screen.getByRole("tooltip");
    expect(container.contains(kasten), "der Kasten steckt im abschneidenden Rahmen").toBe(false);
    expect(document.body.contains(kasten)).toBe(true);
    expect(getComputedStyle(kasten).position).toBe("fixed");
  });

  it("räumt den Kasten wieder weg", () => {
    render(<MitFachworten text="Das nennt man XOR." />);
    fireEvent.click(screen.getByText("XOR"));
    expect(document.querySelectorAll('[role="tooltip"]')).toHaveLength(1);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.querySelectorAll('[role="tooltip"]')).toHaveLength(0);
  });

  it("bleibt beim Scrollen stehen und wandert mit", () => {
    // Zumachen wäre einfacher — aber schon ein Layoutsprung löst ein
    // Scroll-Ereignis aus, und die Erklärung wäre weg, kaum geöffnet.
    render(<MitFachworten text="Das nennt man XOR." />);
    fireEvent.click(screen.getByText("XOR"));
    fireEvent.scroll(window);
    expect(screen.queryByRole("tooltip")).toBeTruthy();
  });

  it("schließt wieder", () => {
    render(<MitFachworten text="Das nennt man XOR." />);
    fireEvent.click(screen.getByText("XOR"));
    fireEvent.click(screen.getByText("XOR"));
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("lässt unbekannte Wörter in Ruhe", () => {
    const { container } = render(<MitFachworten text="Ein ganz gewöhnlicher Satz." />);
    expect(container.querySelector("button")).toBeNull();
    expect(container.textContent).toBe("Ein ganz gewöhnlicher Satz.");
  });
});
