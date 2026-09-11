import { describe, it, expect } from "vitest";
import {
  ANZAHL_SPALTEN, ANZAHL_ZEILEN, ZIEL_LEISTE, ZIEL_QUER, ZIEL_RAD, scrollArt, spalten, zeilen,
} from "@/lib/maus/scrollen";

describe("Scrollen: Listen", () => {
  it("erzeugt die richtige Anzahl an Zeilen und Spalten", () => {
    expect(zeilen()).toHaveLength(ANZAHL_ZEILEN);
    expect(spalten()).toHaveLength(ANZAHL_SPALTEN);
  });

  it("erzeugt dieselbe Liste bei jedem Aufruf", () => {
    expect(zeilen()).toEqual(zeilen());
    expect(spalten()).toEqual(spalten());
  });

  it("jede Zeile hat einen eigenen Namen mit Nummer", () => {
    const z = zeilen();
    expect(z[0].label).toContain("Nr. 1");
    expect(z[ZIEL_RAD].label).toContain(`Nr. ${ZIEL_RAD + 1}`);
  });

  it("die Ziele liegen innerhalb der Liste", () => {
    expect(ZIEL_RAD).toBeGreaterThan(0);
    expect(ZIEL_RAD).toBeLessThan(ANZAHL_ZEILEN - 1);
    expect(ZIEL_LEISTE).toBeGreaterThan(ZIEL_RAD);
    expect(ZIEL_LEISTE).toBeLessThan(ANZAHL_ZEILEN);
    expect(ZIEL_QUER).toBe(ANZAHL_SPALTEN - 1);
  });
});

describe("Scrollen: Erkennung", () => {
  it("erkennt das Mausrad", () => {
    expect(scrollArt(3, 0)).toBe("rad");
    expect(scrollArt(1, 500)).toBe("rad");
  });

  it("erkennt die Scrollleiste, wenn kein Rad benutzt wurde", () => {
    expect(scrollArt(0, 400)).toBe("leiste");
  });

  it("erkennt, wenn nichts gescrollt wurde", () => {
    expect(scrollArt(0, 0)).toBe("keins");
  });
});
