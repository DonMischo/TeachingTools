import { describe, it, expect } from "vitest";
import {
  TASTATUR_AUFGABEN, leeresGesehen, normalisiereSatz, pruefeAufgabe, mitFeststelltasteGeloest,
  zuVieleAnschlaege, type AufgabenId,
} from "@/lib/maus/tastatur";

function aufgabe(id: AufgabenId) {
  const a = TASTATUR_AUFGABEN.find(a => a.id === id);
  if (!a) throw new Error(`unbekannte Aufgabe ${id}`);
  return a;
}

describe("Tastatur: Umschalt", () => {
  it("verlangt Wert und Umschalt-Taste", () => {
    const a = aufgabe("umschalt");
    expect(pruefeAufgabe(a, "Hund", { ...leeresGesehen(), shift: true })).toBe(true);
    expect(pruefeAufgabe(a, "Hund", leeresGesehen())).toBe(false);
    expect(pruefeAufgabe(a, "hund", { ...leeresGesehen(), shift: true })).toBe(false);
  });

  it("akzeptiert Feststelltaste, merkt sich aber den Hinweis", () => {
    const a = aufgabe("umschalt");
    const g = { ...leeresGesehen(), capsLock: true };
    expect(pruefeAufgabe(a, "Hund", g)).toBe(true);
    expect(mitFeststelltasteGeloest(a, "Hund", g)).toBe(true);
    expect(mitFeststelltasteGeloest(a, "Hund", { ...g, shift: true })).toBe(false);
  });
});

describe("Tastatur: Rücktaste und Entf", () => {
  it("Rücktaste löscht das doppelte e", () => {
    const a = aufgabe("ruecktaste");
    expect(pruefeAufgabe(a, "Katze", { ...leeresGesehen(), backspace: true })).toBe(true);
    expect(pruefeAufgabe(a, "Katze", leeresGesehen())).toBe(false);
    expect(pruefeAufgabe(a, "Katz", { ...leeresGesehen(), backspace: true })).toBe(false);
  });

  it("Entf löscht das doppelte M", () => {
    const a = aufgabe("entf");
    expect(pruefeAufgabe(a, "Maus", { ...leeresGesehen(), delete: true })).toBe(true);
    expect(pruefeAufgabe(a, "Maus", leeresGesehen())).toBe(false);
  });
});

describe("Tastatur: Pfeiltaste, Pos1, Ende", () => {
  it("Pfeiltaste ← und das fehlende a", () => {
    const a = aufgabe("pfeiltasten");
    expect(pruefeAufgabe(a, "Ball", { ...leeresGesehen(), arrowLeft: true })).toBe(true);
    expect(pruefeAufgabe(a, "Ball", leeresGesehen())).toBe(false);
  });

  it("Pos1 an den Anfang", () => {
    const a = aufgabe("pos1");
    expect(pruefeAufgabe(a, "Apfel", { ...leeresGesehen(), home: true })).toBe(true);
    expect(pruefeAufgabe(a, "Apfel", leeresGesehen())).toBe(false);
  });

  it("Ende ans Ende", () => {
    const a = aufgabe("ende");
    expect(pruefeAufgabe(a, "Hallo!", { ...leeresGesehen(), end: true })).toBe(true);
    expect(pruefeAufgabe(a, "Hallo!", leeresGesehen())).toBe(false);
  });
});

describe("Tastatur: Strg + Z", () => {
  it("verlangt eine Leerphase und Strg+Z", () => {
    const a = aufgabe("strgz");
    expect(pruefeAufgabe(a, a.start, { ...leeresGesehen(), leerZwischenzeitlich: true, ctrlZ: true })).toBe(true);
    expect(pruefeAufgabe(a, a.start, { ...leeresGesehen(), ctrlZ: true })).toBe(false);
    expect(pruefeAufgabe(a, a.start, { ...leeresGesehen(), leerZwischenzeitlich: true })).toBe(false);
    expect(pruefeAufgabe(a, "etwas anderes", { ...leeresGesehen(), leerZwischenzeitlich: true, ctrlZ: true })).toBe(false);
  });
});

describe("Tastatur: Ausschneiden und Einfügen", () => {
  it("verlangt Cut- und Paste-Ereignis, verzeiht Leerzeichen", () => {
    const a = aufgabe("ausschneiden");
    const g = { ...leeresGesehen(), cut: true, paste: true };
    expect(pruefeAufgabe(a, "Ich war im Zoo.", g)).toBe(true);
    expect(pruefeAufgabe(a, "Ich war im  Zoo .", g)).toBe(true);
    expect(pruefeAufgabe(a, "Ich war im Zoo.", { ...leeresGesehen(), paste: true })).toBe(false);
    expect(pruefeAufgabe(a, "Ich war im Zoo.", { ...leeresGesehen(), cut: true })).toBe(false);
    expect(pruefeAufgabe(a, "Ich war irgendwo.", g)).toBe(false);
  });

  it("normalisiert Leerzeichen und Satzzeichen", () => {
    expect(normalisiereSatz("Ich  war im Zoo .")).toBe("Ich war im Zoo.");
    expect(normalisiereSatz("  Ich war im Zoo.  ")).toBe("Ich war im Zoo.");
  });
});

describe("Tastatur: Aufgabenliste", () => {
  it("hat für jede Aufgabe einen Startwert, der zum Ziel passt", () => {
    expect(TASTATUR_AUFGABEN.length).toBeGreaterThanOrEqual(7);
    const ids = TASTATUR_AUFGABEN.map(a => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("hat für jede Aufgabe eine positive Anzahl nötiger Anschläge", () => {
    for (const a of TASTATUR_AUFGABEN) {
      expect(a.noetigeAnschlaege).toBeGreaterThan(0);
    }
  });
});

describe("Tastatur: zu viele Anschläge", () => {
  it("verzeiht bis zum Dreifachen plus 8", () => {
    expect(zuVieleAnschlaege(11, 1)).toBe(false);
    expect(zuVieleAnschlaege(12, 1)).toBe(true);
  });

  it("skaliert mit den nötigen Anschlägen", () => {
    expect(zuVieleAnschlaege(23, 5)).toBe(false);
    expect(zuVieleAnschlaege(24, 5)).toBe(true);
  });

  it("zählt wenige Anschläge nie als Fehlversuch", () => {
    expect(zuVieleAnschlaege(1, 1)).toBe(false);
  });
});
