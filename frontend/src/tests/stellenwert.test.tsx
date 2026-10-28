/**
 * Stellenwerttafeln: Zerlegen, Lesen, Zahlwörter und Rechenwege stimmen,
 * jede gewürfelte Übungsaufgabe ist mit ihrer eigenen Lösung richtig, die
 * Spiel-Logik bleibt im Rahmen, und jedes Blatt öffnet.
 */
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import Stellenwert from "@/components/stellenwert/Stellenwert";
import { loesungsTafel } from "@/components/stellenwert/Ueben";
import {
  UEB_ARTEN, abziehWeg, geaenderteStellen, uebertragsSchritte, dez, divisionsWeg, erzeugeAufgabe, lies, loesungText, paeckchen, pruefe, schreibe, spalten,
  zahlwort, zuDezimalWeg, type Stufe,
} from "@/lib/stellenwert";
import {
  codiere, decodiere, farbAbstand, farbSterne, hexFarbe, neueZeile, zaehlRunde, zaehlZiel, zehnerSchritt, zielFarbe,
} from "@/lib/stellenwertSpiele";

function zufall(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe("Zahlen schreiben und lesen", () => {
  it("schreibt gruppiert in jeder Basis", () => {
    expect(schreibe(1234567, 10).replace(/\s/g, " ")).toBe("1 234 567");
    expect(schreibe(10, 2, 8)).toBe("0000 1010");
    expect(schreibe(255, 16)).toBe("FF");
    expect(dez(3.05, 2)).toBe("3,05");
  });

  it("liest Komma, Tausenderpunkte und Präfixe", () => {
    expect(lies("47.305", 10)).toBe(47305);
    expect(lies("3,075", 10)).toBe(3.075);
    expect(lies("1 000 000", 10)).toBe(1e6);
    expect(lies("0b1010", 2)).toBe(10);
    expect(lies("#ff", 16)).toBe(255);
    expect(lies("102", 2)).toBeNull();
    expect(lies("G1", 16)).toBeNull();
  });

  it("benennt die Spalten", () => {
    expect(spalten(10, 3, -2).map(s => s.kurz)).toEqual(["T", "H", "Z", "E", "z", "h"]);
    expect(spalten(2, 3).map(s => s.wert)).toEqual(["8", "4", "2", "1"]);
    expect(spalten(16, 2)[0].name).toBe("256er");
  });
});

describe("Zahlwörter", () => {
  it.each([
    [0, "null"], [1, "eins"], [11, "elf"], [21, "einundzwanzig"], [101, "einhunderteins"], [1000, "eintausend"],
    [2005, "zweitausendfünf"], [101000, "einhunderteintausend"], [1e6, "eine Million"],
    [2030005, "zwei Millionen dreißigtausendfünf"], [3e9 + 17, "drei Milliarden siebzehn"],
  ])("%d → %s", (n, w) => expect(zahlwort(n)).toBe(w));
});

describe("Rechenwege", () => {
  it("Ziffer mal Stellenwert ergibt die Zahl", () => {
    expect(zuDezimalWeg(0b1011, 2).reduce((s, x) => s + x.produkt, 0)).toBe(11);
    expect(zuDezimalWeg(0x2af, 16).map(x => x.produkt)).toEqual([512, 160, 15]);
  });
  it("Division mit Rest liefert die Ziffern von unten nach oben", () => {
    const w = divisionsWeg(13, 2);
    expect(w.map(z => z.rest).reverse().join("")).toBe("1101");
    expect(divisionsWeg(0, 2)).toEqual([{ zahl: 0, quotient: 0, rest: 0 }]);
  });
  it("Übertragsschritte am Zählwerk", () => {
    const h = uebertragsSchritte(0x0ff, 1, 16, 3);
    expect(h.map(s => [s.nachher, s.uebertrag])).toEqual([[0, true], [0, true], [1, false]]);
    const m = uebertragsSchritte(0b1000, -1, 2, 4);
    expect(m.map(s => s.nachher)).toEqual([1, 1, 1, 0]);
    // + 10₂: die Einer bleiben, ab den Zweiern wird addiert
    expect(uebertragsSchritte(0b0110, 2, 2, 4).map(s => s.nachher)).toEqual([0, 0, 0, 1]);
    expect(uebertragsSchritte(5, 100, 10, 3).map(s => s.nachher)).toEqual([5, 0, 1]);
  });

  it("Abziehen endet bei 0", () => {
    const w = abziehWeg(200, 16);
    expect(w.at(-1)?.nachher).toBe(0);
    expect(w.map(x => x.ziffer)).toEqual([12, 8]);
  });
  it("Päckchen: jede Hex-Ziffer hat vier Bits", () => {
    expect(paeckchen(0xa5, 2)).toEqual([{ hex: 10, bits: [1, 0, 1, 0] }, { hex: 5, bits: [0, 1, 0, 1] }]);
  });
});

describe("Übungsaufgaben", () => {
  it("jede Art und Stufe ist mit ihrer eigenen Lösung richtig", () => {
    const r = zufall(7);
    for (const a of UEB_ARTEN) for (const s of [1, 2, 3] as Stufe[]) for (let i = 0; i < 60; i++) {
      const auf = erzeugeAufgabe(a.id, s, r);
      expect(pruefe(auf, loesungText(auf).replace(/[₀-₉]/g, "")), `${a.id}/${s}: ${auf.frage}`).toBe(true);
      expect(auf.weg.length).toBeGreaterThan(0);
      const lt = loesungsTafel(auf);
      expect(Object.entries(lt.werte).reduce((x, [e, d]) => x + d * auf.basis ** Number(e), 0)).toBeCloseTo(auf.loesung, 6);
      expect(lt.basis).toBe(auf.basis);
      expect(auf.weg.join(" ")).not.toMatch(/NaN|undefined/);
      if (auf.tafel) {
        const t = auf.tafel;
        const wert = Object.entries(t.ziffern).reduce((x, [e, d]) => x + d * 10 ** Number(e), 0);
        expect(wert).toBeCloseTo(auf.loesung, 6);
      }
    }
  });
});

describe("Spiele", () => {
  it("Bit-Fall bleibt in der Bitbreite", () => {
    const r = zufall(3);
    for (let i = 0; i < 100; i++) {
      const z = neueZeile(i, 1 + (i % 6), 10, r);
      expect(z.ziel).toBeGreaterThan(0);
      expect(z.ziel).toBeLessThan(2 ** z.bits);
    }
  });
  it("Farben: Stufe 2 hat 0 als Einerstelle, Abstand und Sterne passen", () => {
    const r = zufall(5);
    for (let i = 0; i < 50; i++) expect(hexFarbe(zielFarbe(2, r))).toMatch(/^#([0-9A-F]0){3}$/);
    expect(farbAbstand([0, 0, 0], [255, 255, 255])).toBeCloseTo(1);
    expect(farbSterne(0)).toBe(3);
  });
  it("Zählwerk läuft nie aus der Anzeige", () => {
    const r = zufall(9);
    for (const s of [1, 2, 3] as const) for (let i = 0; i < 100; i++) {
      const z = zaehlRunde(s, [2, 10, 16], r);
      expect(zaehlZiel(z)).toBeGreaterThanOrEqual(0);
      expect(zaehlZiel(z)).toBeLessThan(z.basis ** z.stellen);
      expect(z.start).toBeLessThan(z.basis ** z.stellen);
    }
  });
  it("Zehnersystem: Stellenwert-Schritte mit Übertrag, im gewählten Bereich", () => {
    const r = zufall(11);
    for (const stellen of [4, 7, 10]) for (const s of [1, 2, 3] as const) for (let i = 0; i < 100; i++) {
      const z = zaehlRunde(s, [10], r, stellen);
      expect(z.stellen).toBe(stellen);
      expect(zaehlZiel(z)).toBeGreaterThanOrEqual(0);
      expect(zaehlZiel(z)).toBeLessThan(10 ** stellen);
      const { anzahl, exp } = zehnerSchritt(z.schritt);
      expect(anzahl * 10 ** exp).toBe(Math.abs(z.schritt));
      expect(anzahl).toBeLessThan(10);
      if (s === 1) expect(z.schritt).toBe(1);
      // jede Aufgabe hat mindestens einen Übertrag (zwei Walzen drehen sich)
      expect(geaenderteStellen(z.start, zaehlZiel(z), 10, stellen).length).toBeGreaterThan(1);
    }
  });

  it("Geheimbotschaft hin und zurück", () => {
    expect(codiere("Hi", 2)).toEqual(["01001000", "01101001"]);
    expect(codiere("Hi", 16)).toEqual(["48", "69"]);
    expect(decodiere("48 69", 16)).toBe("Hi");
    expect(decodiere(codiere("Grüße!", 2).join(" "), 2)).toBe("Gruesse!");
    expect(decodiere("4G", 16)).toBeNull();
  });
});

describe("Oberfläche", () => {
  it("Plus über 9 bündelt automatisch in die Zehner", () => {
    render(<Stellenwert />);
    // Start: 135
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole("button", { name: "Einer plus eins" }));
    expect(screen.getByLabelText("Zehner: 4")).toBeTruthy();
    expect(screen.getByLabelText("Einer: 0")).toBeTruthy();
  });

  it("jedes Blatt und jedes Spiel öffnet", () => {
    render(<Stellenwert />);
    for (const name of [/Verstehen/, /Üben/]) fireEvent.click(screen.getByRole("button", { name }));
    expect(screen.getByTestId("aufgabe").textContent).not.toBe("");
    fireEvent.click(screen.getByRole("button", { name: /Spiele/ }));
    for (const spiel of [/Hex-Farbmischer/, /Zählwerk-Rennen/, /Geheimbotschaft/, /Bit-Fall/]) {
      fireEvent.click(screen.getAllByRole("button", { name: spiel })[0]);
    }
    expect(screen.getByRole("button", { name: /Los geht/ })).toBeTruthy();
  });

  it("Zählwerk-Rennen: feste Aufgabenzahl, Zehnersystem bis 1 Million mit beschrifteten Walzen", () => {
    render(<Stellenwert />);
    fireEvent.click(screen.getByRole("button", { name: /Spiele/ }));
    fireEvent.click(screen.getAllByRole("button", { name: /Zählwerk-Rennen/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: /10 Aufgaben/ }));
    fireEvent.click(screen.getByRole("button", { name: /Binär/ }));
    fireEvent.click(screen.getByRole("button", { name: /Hexadezimal/ }));
    fireEvent.click(screen.getByRole("button", { name: /bis 1 Million/ }));
    fireEvent.click(screen.getByRole("button", { name: /Start/ }));
    expect(screen.getByText(/Aufgabe 1 von 10/)).toBeTruthy();
    expect(screen.getByRole("img", { name: /Zählwerk zeigt \d{7}$/ })).toBeTruthy();
    expect(screen.getByText("M")).toBeTruthy();
  });

  it("Zählwerk-Rennen: Enter prüft, Fehler bleibt stehen, Enter geht weiter, Fokus bleibt im Feld", () => {
    vi.useFakeTimers();
    try {
      render(<Stellenwert />);
      fireEvent.click(screen.getByRole("button", { name: /Spiele/ }));
      fireEvent.click(screen.getAllByRole("button", { name: /Zählwerk-Rennen/ })[0]);
      fireEvent.click(screen.getByRole("button", { name: /10 Aufgaben/ }));
      fireEvent.click(screen.getByRole("button", { name: /Start/ }));
      const feld = screen.getByLabelText("Was zeigt das Zählwerk dann?") as HTMLInputElement;
      expect(document.activeElement).toBe(feld);
      // »0« ist nie richtig: jede Aufgabe endet über 0
      fireEvent.change(feld, { target: { value: "0" } });
      fireEvent.submit(feld.closest("form")!);
      expect(screen.getByText(/Leider falsch/)).toBeTruthy();
      expect(screen.getByText("richtig")).toBeTruthy();
      act(() => { vi.advanceTimersByTime(3000); });
      expect(screen.getByText(/Leider falsch/)).toBeTruthy();
      expect(document.activeElement).toBe(feld);
      fireEvent.submit(feld.closest("form")!);
      expect(screen.queryByText(/Leider falsch/)).toBeNull();
      expect(screen.getByText(/Aufgabe 2 von 10/)).toBeTruthy();
      expect(document.activeElement).toBe(feld);
    } finally {
      vi.useRealTimers();
    }
  });

  it("die Erklärungen öffnen als Popup mit Beispiel", () => {
    render(<Stellenwert />);
    fireEvent.click(screen.getByRole("button", { name: /Spiele/ }));
    fireEvent.click(screen.getAllByRole("button", { name: /Zählwerk-Rennen/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: /So geht/ }));
    expect(screen.getByRole("dialog", { name: /Zählwerk-Rennen/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Drehen/ }));
    expect(screen.getByText(/Ergebnis: 100/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Schließen" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /Geheimbotschaft/ })[0]);
    fireEvent.click(screen.getByRole("button", { name: /So geht/ }));
    expect(screen.getByRole("dialog", { name: /Geheimbotschaft/ })).toBeTruthy();
  });
});
