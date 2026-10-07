/**
 * Wächter für das Periodensystem: Raster, Kenndaten und Bildnachweise.
 *
 * Die Rasterplätze sind gerechnet, nicht getippt — deshalb prüft der Test
 * die Stellen, an denen die Rechnung schiefgehen kann: der Sprung von
 * Spalte 2 auf 13 in Periode 2/3 und die Lücke, die der f-Block in
 * Periode 6/7 hinterlässt.
 */
import { describe, expect, it } from "vitest";
import { celsius, HAUPTGRUPPEN, hauptgruppenName, KATEGORIEN, konfigurationHoch, PSE, pseElement, suche } from "@/lib/pse/elemente";
import { ALLE_PROBEN } from "@/lib/pse/bilder";
import { reaktionenZu, waageLink } from "@/lib/pse/reaktionen";
import { parseReaction } from "@/lib/chemie";

describe("Raster", () => {
  it("hat alle 118 Elemente mit deutschem Namen", () => {
    expect(PSE).toHaveLength(118);
    expect(PSE.every(e => e.name && e.name.length > 1)).toBe(true);
  });

  it.each([
    ["H", 1, 1], ["He", 18, 1],
    ["Li", 1, 2], ["Be", 2, 2], ["B", 13, 2], ["Ne", 18, 2],
    ["Na", 1, 3], ["Al", 13, 3],
    ["K", 1, 4], ["Ca", 2, 4], ["Sc", 3, 4], ["Fe", 8, 4], ["Kr", 18, 4],
    ["Cs", 1, 6], ["Ba", 2, 6], ["Hf", 4, 6], ["Au", 11, 6], ["Rn", 18, 6],
    ["Fr", 1, 7], ["Og", 18, 7],
  ])("%s steht in Spalte %i, Zeile %i", (symbol, spalte, zeile) => {
    const e = pseElement(symbol)!;
    expect([e.spalte, e.zeile]).toEqual([spalte, zeile]);
  });

  it("rückt Lanthanoide und Actinoide in die Zeilen 9 und 10 aus", () => {
    expect(pseElement("La")).toMatchObject({ zeile: 9, spalte: 3, periode: 6 });
    expect(pseElement("Lu")).toMatchObject({ zeile: 9, spalte: 17 });
    expect(pseElement("Ac")).toMatchObject({ zeile: 10, spalte: 3, periode: 7 });
    expect(pseElement("Lr")).toMatchObject({ zeile: 10, spalte: 17 });
  });

  it("belegt jeden Platz nur einmal", () => {
    const plaetze = PSE.map(e => `${e.spalte}/${e.zeile}`);
    expect(new Set(plaetze).size).toBe(PSE.length);
  });

  it("ordnet die Kategorien richtig zu", () => {
    expect(pseElement("Na")!.kategorie).toBe("alkali");
    expect(pseElement("Ca")!.kategorie).toBe("erdalkali");
    expect(pseElement("Fe")!.kategorie).toBe("uebergang");
    expect(pseElement("Cl")!.kategorie).toBe("halogen");
    expect(pseElement("Ar")!.kategorie).toBe("edelgas");
    expect(pseElement("Si")!.kategorie).toBe("halbmetall");
    expect(pseElement("O")!.kategorie).toBe("nichtmetall");
    expect(pseElement("U")!.kategorie).toBe("actinoid");
    // Wasserstoff steht links, ist aber kein Alkalimetall.
    expect(pseElement("H")!.kategorie).toBe("nichtmetall");
    expect(PSE.every(e => KATEGORIEN[e.kategorie])).toBe(true);
  });

  it("gibt den Hauptgruppen ihre Nummer und den Nebengruppen keine", () => {
    expect(pseElement("O")!.hauptgruppe).toBe(6);
    expect(pseElement("Cl")!.hauptgruppe).toBe(7);
    expect(pseElement("Fe")!.hauptgruppe).toBeNull();
    expect(pseElement("U")!.hauptgruppe).toBeNull();
  });
});

describe("Kenndaten", () => {
  it("rechnet Kelvin in Celsius um", () => {
    // Wasserstoff schmilzt bei 13,81 K = −259,3 °C.
    expect(celsius(pseElement("H")!.schmelzpunkt)).toBeCloseTo(-259.3, 1);
    expect(celsius(null)).toBeNull();
  });

  it("kennt die Atommassen der Schulelemente", () => {
    expect(pseElement("C")!.masse).toBeCloseTo(12.011, 3);
    expect(pseElement("Fe")!.masse).toBeCloseTo(55.85, 1);
  });

  it("findet über Name, Symbol und Ordnungszahl dasselbe Element", () => {
    for (const q of ["Eisen", "fe", "26"]) {
      expect(suche(q)[0].symbol).toBe("Fe");
    }
    expect(suche("")).toEqual([]);
  });
});

describe("Schreibweisen", () => {
  it("setzt die Elektronenkonfiguration hoch", () => {
    expect(konfigurationHoch("1s1")).toBe("1s¹");
    expect(konfigurationHoch("[Ar]4s2 3d6")).toBe("[Ar]4s² 3d⁶");
    expect(konfigurationHoch("[Xe]6s2 4f14 5d1")).toBe("[Xe]6s² 4f¹⁴ 5d¹");
    // Die Zahl vor dem Buchstaben ist die Schale und bleibt unten.
    expect(konfigurationHoch("[Rn]7s2 7p6")).toBe("[Rn]7s² 7p⁶");
  });

  it("kann jede Konfiguration des Periodensystems setzen", () => {
    for (const e of PSE) {
      const hoch = konfigurationHoch(e.konfiguration);
      // Nach einem Orbitalbuchstaben darf keine normale Ziffer mehr stehen.
      expect(/[spdf]\d/.test(hoch), `${e.symbol}: ${hoch}`).toBe(false);
    }
  });
});

describe("Hauptgruppen", () => {
  it("nennt die acht Gruppen beim Namen", () => {
    expect(hauptgruppenName(pseElement("Na")!)).toBe("Alkalimetalle");
    expect(hauptgruppenName(pseElement("Ca")!)).toBe("Erdalkalimetalle");
    expect(hauptgruppenName(pseElement("C")!)).toBe("Kohlenstoffgruppe");
    expect(hauptgruppenName(pseElement("O")!)).toBe("Chalkogene");
    expect(hauptgruppenName(pseElement("Cl")!)).toBe("Halogene");
    expect(hauptgruppenName(pseElement("Ar")!)).toBe("Edelgase");
    expect(Object.keys(HAUPTGRUPPEN)).toHaveLength(8);
  });

  it("macht Wasserstoff nicht zum Alkalimetall und gibt Nebengruppen keinen Namen", () => {
    expect(hauptgruppenName(pseElement("H")!)).toBeNull();
    expect(hauptgruppenName(pseElement("Fe")!)).toBeNull();
    expect(hauptgruppenName(pseElement("U")!)).toBeNull();
  });
});

describe("Bildnachweise", () => {
  it("nennt zu jedem Foto Lizenz, Urheber und Quelle", () => {
    expect(Object.keys(ALLE_PROBEN).length).toBeGreaterThan(90);
    for (const [symbol, b] of Object.entries(ALLE_PROBEN)) {
      expect(pseElement(symbol), `${symbol} ist kein Element`).toBeDefined();
      expect(b.lizenz, `${symbol} ohne Lizenz`).toBeTruthy();
      expect(b.urheber, `${symbol} ohne Urheber`).toBeTruthy();
      expect(b.seite).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
      expect(b.datei).toBe(`/pse/proben/${symbol}.webp`);
    }
  });

  it("nimmt nur freie Lizenzen auf", () => {
    for (const [symbol, b] of Object.entries(ALLE_PROBEN)) {
      expect(b.lizenz, `${symbol}: ${b.lizenz}`).toMatch(/^(public domain|cc0|cc by|fal|attribution)/i);
    }
  });
});

describe("Reaktionen", () => {
  it("liefert nur Gleichungen, die die Waage lesen kann", () => {
    const alle = PSE.flatMap(e => reaktionenZu(e.symbol));
    expect(alle.length).toBeGreaterThan(20);
    for (const r of alle) {
      const geparst = parseReaction(r.src);
      expect(geparst.ok, `${r.label}: ${r.src}`).toBe(true);
    }
  });

  it("verlinkt in den Chemiemodus der Gleichungswaage", () => {
    expect(waageLink("H2 + O2 -> H2O"))
      .toBe("/simulationen/gleichungswaage?reaktion=H2%20%2B%20O2%20-%3E%20H2O");
    // Der Link muss sich wieder auspacken lassen, sonst kommt die Waage nicht hin.
    const zurueck = decodeURIComponent(waageLink("Fe + O2 -> Fe2O3").split("reaktion=")[1]);
    expect(zurueck).toBe("Fe + O2 -> Fe2O3");
  });

  it("gibt für Elemente ohne Eintrag eine leere Liste", () => {
    expect(reaktionenZu("Og")).toEqual([]);
  });
});
