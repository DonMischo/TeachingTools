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
import Challenge from "@/components/markieren/Challenge";
import Quellen from "@/components/markieren/Quellen";
import { faelle, pruefeFeld, quelltext } from "@/lib/markieren/quellen";
import { LEER, liesStand, mitRunde, schreibStand, type MarkierStand } from "@/lib/markieren/speicher";
import { vorfuehrung } from "@/lib/markieren/vorfuehren";

/** Stand wie im Werkzeug: Änderungen landen in `aktuell`. */
function standHalter(start: MarkierStand = LEER) {
  const h = { stand: start, aendern: (f: (s: MarkierStand) => MarkierStand) => { h.stand = f(h.stand); } };
  return h;
}

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

describe("Bestenliste", () => {
  it("die Offline-Fassung zeigt keinen Bestenlisten-Reiter", () => {
    render(<Markieren />);
    expect(screen.queryByText(/Bestenliste/, { selector: "button" })).toBeNull();
  });

  it("eine Runde mit Überspringen wird nicht gemeldet", () => {
    const melden = vi.fn(() => Promise.resolve({ platz: 1 }));
    const h = standHalter();
    render(<Challenge melden={melden} stand={LEER} aendern={h.aendern} />);
    fireEvent.click(screen.getAllByText("Los!")[0]);
    for (let i = 0; i < 10; i++) fireEvent.click(screen.getByText(/^Überspringen/));
    expect(screen.getByText(/Andere Challenge/)).toBeTruthy();
    expect(melden).not.toHaveBeenCalled();
    // gezählt als Runde, aber ohne Bestzeit
    expect(h.stand.challenge.markieren).toEqual({ best_ms: null, runden: 1 });
  });

  it("Überspringen kostet 30 Sekunden und behält nicht den Fokus", () => {
    render(<Challenge stand={LEER} aendern={() => {}} />);
    fireEvent.click(screen.getAllByText("Los!")[0]);
    const knopf = screen.getByText(/^Überspringen/);
    expect(knopf.textContent).toContain("+30 s");
    // mouseDown wird verhindert: der Knopf bekommt keinen Fokus, eine Leertaste überspringt nichts.
    expect(fireEvent.mouseDown(knopf)).toBe(false);
    fireEvent.click(knopf);
    expect(screen.getByText(/Aufgabe 2 von 10/)).toBeTruthy();
    // das neue Feld hat den Fokus, damit Tastenkürzel gleich im Text wirken
    expect(document.activeElement).toBe(screen.getByLabelText("Übungstext"));
  });

  it("gelöst und gleich danach übersprungen: das verspätete »gelöst« kommt nicht mehr an", () => {
    vi.useFakeTimers();
    const a = wuerfle("allesMarkieren", zufall(1));
    const onGeloest = vi.fn();
    const { unmount } = render(<Textfeld aufgabe={a} onGeloest={onGeloest} />);
    const feld = screen.getByLabelText("Übungstext") as HTMLTextAreaElement;
    act(() => { feld.setSelectionRange(0, a.text.length); fireEvent.select(feld); });
    expect(screen.getByText(/Geschafft/)).toBeTruthy();
    unmount(); // Überspringen baut das Feld ab, bevor die Pause um ist
    act(() => { vi.advanceTimersByTime(2000); });
    expect(onGeloest).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe("Quellen", () => {
  const heute = new Date(2026, 9, 29);
  const alle = faelle(heute);

  it("jeder Fall ist mit seinen Zielwerten lösbar, und die Vorlagen nennen nur echte Felder", () => {
    for (const f of alle) {
      for (const feld of f.felder) expect(pruefeFeld(feld, feld.ziel[0]).ok, `${f.id}/${feld.id}`).toBe(true);
      const ids = new Set(f.felder.map(x => x.id));
      for (const t of [...f.zitatSatz, ...f.verzeichnis]) if (typeof t !== "string") expect(ids.has(t.feld), `${f.id}: ${t.feld}`).toBe(true);
      // das Zitat steht wörtlich in der Quelle
      expect(quelltext(f.quelle)).toContain(f.felder.find(x => x.id === "zitat")!.ziel[0]);
    }
  });

  it("Fehlgriffe bekommen einen eigenen Hinweis", () => {
    const mond = alle.find(f => f.id === "mond")!;
    const feld = (id: string) => mond.felder.find(f => f.id === id)!;
    expect(pruefeFeld(feld("titel"), "Sternenfenster").hinweis).toMatch(/Name der ganzen Website/);
    expect(pruefeFeld(feld("url"), "https://sfw.link/m7Q2").hinweis).toMatch(/Kurzlink/);
    expect(pruefeFeld(feld("url"), "https://www.sternenfenster-wissen.de").hinweis).toMatch(/Startseite/);
    expect(pruefeFeld(feld("abruf"), "14.03.2025").hinweis).toMatch(/Datum des Artikels/);
    expect(pruefeFeld(feld("abruf"), "29.10.2026").ok).toBe(true);
    expect(pruefeFeld(feld("abruf"), "29.10.26").ok).toBe(true);
    const bienen = alle.find(f => f.id === "bienen")!;
    const bf = (id: string) => bienen.felder.find(f => f.id === id)!;
    expect(pruefeFeld(bf("nachname"), "Fink").hinweis).toMatch(/Lektorat/);
    expect(pruefeFeld(bf("seite"), "3").hinweis).toMatch(/Kapitel/);
    expect(pruefeFeld(bf("nachname"), "brandt").ok).toBe(true);
    const wasser = alle.find(f => f.id === "wasser")!;
    expect(pruefeFeld(wasser.felder.find(f => f.id === "autor")!, "Redaktion Wasserwelt").hinweis).toMatch(/keine Person/);
  });

  it("es gibt Zeitung, Zeitschrift, Video und Online-Lexikon", () => {
    expect(new Set(alle.map(f => f.quelle.art))).toEqual(new Set(["buch", "web", "zeitung", "heft", "video", "lexikon"]));
    const feld = (fall: string, id: string) => alle.find(f => f.id === fall)!.felder.find(f => f.id === id)!;
    expect(pruefeFeld(feld("igel", "nummer"), "76").hinweis).toMatch(/Jahrgang/);
    expect(pruefeFeld(feld("igel", "titel"), "Tiere im Garten").hinweis).toMatch(/Dachzeile/);
    expect(pruefeFeld(feld("roboter", "seite"), "22–23").hinweis).toMatch(/nur die Seite mit dem Zitat/);
    expect(pruefeFeld(feld("roboter", "seiten"), "22-23").ok).toBe(true);
    expect(pruefeFeld(feld("roboter", "titel"), "Roboter unter uns").hinweis).toMatch(/Titelthema/);
    expect(pruefeFeld(feld("regenbogen", "zeit"), "2:04").ok).toBe(true);
    expect(pruefeFeld(feld("regenbogen", "zeit"), "6:41").hinweis).toMatch(/Länge/);
    expect(pruefeFeld(feld("regenbogen", "kanal"), "ClipTube").hinweis).toMatch(/Plattform/);
    expect(pruefeFeld(feld("biber", "stand"), "29.10.2026").hinweis).toMatch(/heutige Datum/);
    expect(pruefeFeld(feld("biber", "stichwort"), "Wissensnetz").hinweis).toMatch(/Name des Lexikons/);
  });

  it("das Zitat muss wörtlich sein", () => {
    const zitat = alle[0].felder.find(f => f.id === "zitat")!;
    const satz = zitat.ziel[0];
    expect(pruefeFeld(zitat, `„${satz}“`).ok).toBe(true);
    expect(pruefeFeld(zitat, satz.slice(0, -1)).ok).toBe(true); // Punkt darf fehlen
    expect(pruefeFeld(zitat, satz.slice(0, 30)).hinweis).toMatch(/fehlt/);
    expect(pruefeFeld(zitat, satz + " Je länger sie").hinweis).toMatch(/zu viel/);
    expect(pruefeFeld(zitat, satz.toLowerCase()).hinweis).toMatch(/Groß- und Kleinschreibung/);
  });

  it("ein Fall wird im Referat gelöst", () => {
    render(<Quellen stand={LEER} aendern={() => {}} />);
    fireEvent.click(screen.getByText(/Das große Bienenbuch/, { selector: "span" }));
    const bienen = alle.find(f => f.id === "bienen")!;
    expect(bienen.felder.map(f => f.id)).toEqual(expect.arrayContaining(["nachnameBeleg", "jahrBeleg", "nachname", "jahr"]));
    for (const feld of bienen.felder) fireEvent.change(screen.getByLabelText(feld.label), { target: { value: feld.ziel[0] } });
    fireEvent.click(screen.getByText("Prüfen"));
    expect(screen.getByText(/Richtig zitiert/)).toBeTruthy();
    expect(screen.getByText(/Brandt, Johanna \(2021\): Das große Bienenbuch\. Leben, Arbeit und Sprache der Honigbiene\. Leipzig: Wiesengrund Verlag\./)).toBeTruthy();
  });
});

describe("Stand je Person", () => {
  it("Gäste am selben Rechner teilen keine Haken", () => {
    localStorage.clear();
    schreibStand("gast-name-mia", { ...LEER, lektionen: ["doppelklick", "strgA"] });
    expect(liesStand("gast-name-mia").lektionen).toEqual(["doppelklick", "strgA"]);
    expect(liesStand("gast-name-ben").lektionen).toEqual([]);
  });

  it("ohne Schlüssel gilt der frühere Stand aus den Einzelschlüsseln", () => {
    localStorage.clear();
    localStorage.setItem("hp_markieren_lektionen", JSON.stringify(["ziehen"]));
    localStorage.setItem("hp_markieren_bestzeit", JSON.stringify({ markieren: 40000 }));
    const s = liesStand();
    expect(s.lektionen).toEqual(["ziehen"]);
    expect(s.challenge.markieren).toEqual({ best_ms: 40000, runden: 0 });
    // ein Gast erbt davon nichts
    expect(liesStand("gast-name-mia")).toEqual(LEER);
  });

  it("Bestzeit nur ohne Überspringen und nur bei Verbesserung", () => {
    let s = mitRunde(LEER, "markieren", 50000, true).stand;
    expect(mitRunde(s, "markieren", 60000, true).rekord).toBe(false);
    expect(mitRunde(s, "markieren", 20000, false).rekord).toBe(false);
    const r = mitRunde(s, "markieren", 40000, true);
    s = r.stand;
    expect(r.rekord).toBe(true);
    expect(s.challenge.markieren).toEqual({ best_ms: 40000, runden: 2 });
  });
});

describe("Vorführen", () => {
  const typen = Object.keys(GENERATOREN) as AufgabenTyp[];
  it.each(typen)("%s: der vorgeführte Weg löst die Aufgabe", typ => {
    const r = zufall(7);
    for (let i = 0; i < 15; i++) {
      const a = wuerfle(typ, r);
      const schritte = vorfuehrung(a);
      expect(schritte.length, a.auftrag).toBeGreaterThan(0);
      let text = a.text, von = a.start?.von ?? 0, bis = a.start?.bis ?? 0, zwischen = false;
      for (const s of schritte) {
        if (s.wert !== undefined) text = s.wert;
        if (s.auswahl) ({ von, bis } = s.auswahl);
        expect(von, a.auftrag).toBeLessThanOrEqual(text.length);
        expect(bis, a.auftrag).toBeLessThanOrEqual(text.length);
        if (s.zeiger !== undefined) expect(s.zeiger).toBeLessThanOrEqual(text.length);
        zwischen = pruefe(a, { text, von: Math.min(von, bis), bis: Math.max(von, bis) }, zwischen).zwischen;
      }
      expect(pruefe(a, { text, von: Math.min(von, bis), bis: Math.max(von, bis) }, zwischen).geloest, a.auftrag).toBe(true);
    }
  });
});

describe("Zeilennummern", () => {
  it("folgen dem Text und markieren die Cursorzeile", () => {
    const a = wuerfle("zeileKopieren", zufall(5));
    render(<Textfeld aufgabe={a} onGeloest={() => {}} />);
    const feld = screen.getByLabelText("Übungstext") as HTMLTextAreaElement;
    const nummern = () => screen.getByTestId("zeilennummern").children;
    const vorher = a.text.split("\n").length;
    expect(nummern().length).toBe(vorher);
    act(() => { fireEvent.input(feld, { target: { value: a.text + "\nneu" } }); });
    expect(nummern().length).toBe(vorher + 1);
    act(() => { feld.focus(); feld.setSelectionRange(a.text.length + 2, a.text.length + 2); fireEvent.select(feld); });
    expect(nummern()[vorher].className).toContain("text-accent");
  });
});
