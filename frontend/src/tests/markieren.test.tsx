/**
 * Markieren & Bearbeiten: jede gewürfelte Aufgabe ist lösbar und nicht schon
 * zu Beginn gelöst, die Prüfung verzeiht Browser-Eigenheiten, Techniken werden
 * erkannt, und das Textfeld meldet erst mit der verlangten Technik »gelöst«.
 */
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
  GENERATOREN, LEKTIONEN, MODI, auswahlPasst, challengeAufgaben, eindeutige, lektionsAufgaben, normalisiereText, pruefe, wuerfle, zufall,
  type Aufgabe, type AufgabenTyp,
} from "@/lib/markieren/aufgaben";
import { TEXTE } from "@/lib/markieren/texte";
import { technikAusTaste, zaehltAlsAktion } from "@/lib/markieren/technik";
import { Textfeld } from "@/components/markieren/Textfeld";
import Markieren from "@/components/markieren/Markieren";

const taste = (key: string, mod: Partial<{ ctrlKey: boolean; shiftKey: boolean; metaKey: boolean }> = {}) =>
  ({ key, ctrlKey: false, shiftKey: false, metaKey: false, ...mod });

/** Ein Zustand, der die Aufgabe erfüllt — so, wie ein Kind ihn herstellen würde. */
function loesung(a: Aufgabe): { text: string; von: number; bis: number } {
  const p = a.pruefung;
  if (p.art === "auswahl") return { text: a.text, ...p.ziel };
  if (p.art === "cursor") return { text: a.text, von: p.pos, bis: p.pos };
  if (p.art === "text") return { text: p.ergebnis, von: 0, bis: 0 };
  return { text: a.text, von: 0, bis: 0 };
}

describe("Übungstexte", () => {
  it("haben kurze Zeilen und brauchbare Ersatz-/Teilwörter", () => {
    for (const t of TEXTE) {
      for (const z of t.zeilen) expect(z.length).toBeLessThanOrEqual(46);
      const ein = eindeutige(t.zeilen, 1).map(w => w.wort);
      for (const [alt] of t.ersatz) expect(ein, `${t.titel}: ${alt}`).toContain(alt);
      for (const [ganz, teil] of t.teile) {
        expect(ein, `${t.titel}: ${ganz}`).toContain(ganz);
        expect(ganz.startsWith(teil) && teil.length < ganz.length).toBe(true);
      }
    }
  });
});

describe("Aufgaben würfeln", () => {
  const typen = Object.keys(GENERATOREN) as AufgabenTyp[];
  it.each(typen)("%s: lösbar und nicht schon gelöst", typ => {
    const r = zufall(42);
    for (let i = 0; i < 25; i++) {
      const a = wuerfle(typ, r);
      const startZustand = { text: a.text, von: a.start?.von ?? 0, bis: a.start?.bis ?? 0 };
      expect(pruefe(a, startZustand).geloest, a.auftrag).toBe(false);
      if (a.pruefung.art === "rueckgaengig") {
        const zw = pruefe(a, { text: a.pruefung.zwischen, von: 0, bis: 0 });
        expect(zw).toEqual({ geloest: false, zwischen: true });
        expect(pruefe(a, startZustand, true).geloest).toBe(true);
      } else {
        expect(pruefe(a, loesung(a)).geloest, a.auftrag).toBe(true);
      }
    }
  });

  it("Lektionen und Challenges sind auf Server und Browser gleich", () => {
    for (const l of LEKTIONEN) expect(lektionsAufgaben(l, zufall(1))).toEqual(lektionsAufgaben(l, zufall(1)));
    for (const m of Object.keys(MODI) as (keyof typeof MODI)[]) {
      const a = challengeAufgaben(m, zufall(5));
      expect(a).toHaveLength(MODI[m].anzahl);
      // jeder Typ kommt dran, bevor sich einer wiederholt
      const erste = a.slice(0, Math.min(MODI[m].anzahl, MODI[m].typen.length)).map(x => x.typ);
      expect(new Set(erste).size).toBe(erste.length);
    }
  });
});

describe("Prüfen", () => {
  const text = "Zwei Liter Milch, und Eier";
  it("Auswahl: Leerzeichen und Satzzeichen am Rand zählen nicht", () => {
    const ziel = { von: 11, bis: 16 }; // Milch
    expect(auswahlPasst(text, { von: 11, bis: 17 }, ziel)).toBe(true); // »Milch,«
    expect(auswahlPasst(text, { von: 10, bis: 18 }, ziel)).toBe(true); // » Milch, «
    expect(auswahlPasst(text, { von: 11, bis: 15 }, ziel)).toBe(false); // »Milc«
    expect(auswahlPasst(text, { von: 5, bis: 16 }, ziel)).toBe(false);
  });
  it("Text: doppelte Leerzeichen und leere Zeilen zählen nicht", () => {
    expect(normalisiereText("Zwei  Liter ,Milch\n\n Eier \n")).toBe(normalisiereText("Zwei Liter,Milch\nEier"));
    expect(normalisiereText("Liter Milch")).not.toBe(normalisiereText("LiterMilch"));
  });
});

describe("Techniken erkennen", () => {
  it("ordnet Tasten zu", () => {
    expect(technikAusTaste(taste("ArrowRight", { ctrlKey: true, shiftKey: true }))).toBe("strgUmschaltPfeil");
    expect(technikAusTaste(taste("ArrowLeft", { ctrlKey: true }))).toBe("strgPfeil");
    expect(technikAusTaste(taste("ArrowRight", { shiftKey: true }))).toBe("umschaltPfeil");
    expect(technikAusTaste(taste("ArrowRight"))).toBeNull();
    expect(technikAusTaste(taste("End", { shiftKey: true }))).toBe("umschaltPos1Ende");
    expect(technikAusTaste(taste("Home"))).toBe("pos1ende");
    expect(technikAusTaste(taste("A", { ctrlKey: true, shiftKey: true }))).toBe("strgA");
    expect(technikAusTaste(taste("x", { metaKey: true }))).toBe("ausschneiden");
    expect(technikAusTaste(taste("z", { ctrlKey: true }))).toBe("rueckgaengig");
    expect(technikAusTaste(taste("Backspace"))).toBe("loeschen");
    expect(technikAusTaste(taste("k"))).toBe("tippen");
  });
  it("zählt Kürzel, aber keine Buchstaben oder Modifikatoren", () => {
    expect(zaehltAlsAktion(taste("Shift", { shiftKey: true }))).toBe(false);
    expect(zaehltAlsAktion(taste("k"))).toBe(false);
    expect(zaehltAlsAktion(taste("c", { ctrlKey: true }))).toBe(true);
    expect(zaehltAlsAktion(taste("End"))).toBe(true);
  });
});

describe("Textfeld", () => {
  const aufgabe = wuerfle("wortMarkieren", zufall(3));
  const ziel = aufgabe.pruefung.art === "auswahl" ? aufgabe.pruefung.ziel : { von: 0, bis: 0 };

  function markiereMitMaus(feld: HTMLTextAreaElement, detail: number) {
    fireEvent.mouseDown(feld, { button: 0, detail });
    feld.setSelectionRange(ziel.von, ziel.bis);
    fireEvent.mouseUp(window);
  }

  it("meldet gelöst mit der verlangten Technik", () => {
    vi.useFakeTimers();
    const onGeloest = vi.fn();
    render(<Textfeld aufgabe={aufgabe} verlangt={["doppelklick"]} onGeloest={onGeloest} />);
    const feld = screen.getByLabelText("Übungstext") as HTMLTextAreaElement;
    act(() => markiereMitMaus(feld, 2));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onGeloest).toHaveBeenCalledWith(expect.objectContaining({ aktionen: 0, techniken: ["doppelklick"] }));
    vi.useRealTimers();
  });

  it("ohne die verlangte Technik nur ein Hinweis", () => {
    vi.useFakeTimers();
    const onGeloest = vi.fn();
    render(<Textfeld aufgabe={aufgabe} verlangt={["doppelklick"]} onGeloest={onGeloest} />);
    const feld = screen.getByLabelText("Übungstext") as HTMLTextAreaElement;
    act(() => markiereMitMaus(feld, 1));
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onGeloest).not.toHaveBeenCalled();
    expect(screen.getByText(/übe hier: Doppelklick/)).toBeTruthy();
    vi.useRealTimers();
  });

  it("Bearbeiten: geänderter Text löst die Aufgabe", () => {
    vi.useFakeTimers();
    const a = wuerfle("wortLoeschen", zufall(9));
    const onGeloest = vi.fn();
    render(<Textfeld aufgabe={a} onGeloest={onGeloest} />);
    const feld = screen.getByLabelText("Übungstext") as HTMLTextAreaElement;
    fireEvent.keyDown(feld, { key: "Delete" });
    act(() => { fireEvent.input(feld, { target: { value: a.pruefung.art === "text" ? a.pruefung.ergebnis : "" } }); });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(onGeloest).toHaveBeenCalledWith(expect.objectContaining({ aktionen: 1, techniken: ["loeschen"] }));
    vi.useRealTimers();
  });
});

describe("Werkzeug", () => {
  it("öffnet alle drei Blätter", () => {
    render(<Markieren />);
    expect(screen.getByText(/Doppelklick: ein Wort/, { selector: "h2" })).toBeTruthy();
    fireEvent.click(screen.getByText(/Challenge/, { selector: "button" }));
    expect(screen.getByText("Markier-Sprint", { exact: false })).toBeTruthy();
    fireEvent.click(screen.getAllByText("Los!")[0]);
    expect(screen.getByLabelText("Übungstext")).toBeTruthy();
    fireEvent.click(screen.getByText("Abbrechen"));
    fireEvent.click(screen.getByText(/Spickzettel/, { selector: "button" }));
    expect(screen.getByText(/Markieren mit der Tastatur/)).toBeTruthy();
  });
});
