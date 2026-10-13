/**
 * Einheitenleitern und Umrechnung — wie auf dem Merkblatt Klasse 5.
 */
import { describe, it, expect } from "vitest";
import { KATEGORIEN, bestEinheit, faktor, kategorie, kommaStellen, laengenSchritt, schritt, umrechnen, zahl } from "@/lib/groessen";

const idx = (kat: string, id: string) => kategorie(kat).einheiten.findIndex(e => e.id === id);

describe("Leitern", () => {
  it("haben je Nachbarpaar genau eine Umrechnungszahl", () => {
    for (const k of KATEGORIEN) expect(k.schritte).toHaveLength(k.einheiten.length - 1);
  });

  it("rechnen über mehrere Stufen: 1 m = 1 000 mm, 1 km² = 1 000 000 m², 1 d = 86 400 s", () => {
    const L = kategorie("laenge"), F = kategorie("flaeche"), Z = kategorie("zeit");
    expect(faktor(L, idx("laenge", "m"), idx("laenge", "mm"))).toBe(1000);
    expect(faktor(F, idx("flaeche", "km2"), idx("flaeche", "m2"))).toBe(1e6);
    expect(faktor(Z, idx("zeit", "d"), idx("zeit", "s"))).toBe(86400);
  });

  it("Volumen: 1 m³ = 1 000 l, 1 l = 1 000 ml", () => {
    const V = kategorie("volumen");
    expect(faktor(V, idx("volumen", "m3"), idx("volumen", "l"))).toBe(1000);
    expect(faktor(V, idx("volumen", "l"), idx("volumen", "ml"))).toBe(1000);
  });

  it("zur größeren Einheit wird geteilt", () => {
    const L = kategorie("laenge");
    expect(schritt(L, idx("laenge", "cm"), idx("laenge", "m"))).toEqual({ op: ":", zahl: 100 });
  });
});

describe("umrechnen", () => {
  it("Dezimalzahlen bleiben exakt", () => {
    const G = kategorie("gewicht");
    const r = umrechnen(G, 1500, idx("gewicht", "g"), idx("gewicht", "kg"));
    expect(r.wert).toBe(1.5);
    expect(r.exakt).toBe(true);
  });

  it("Zeit bricht nicht immer ab: 1 min = 1/60 h", () => {
    const Z = kategorie("zeit");
    const r = umrechnen(Z, 1, idx("zeit", "min"), idx("zeit", "h"));
    expect(r.exakt).toBe(false);
    expect(r.bruch).toEqual([1, 60]);
    expect(umrechnen(Z, 90, idx("zeit", "min"), idx("zeit", "h")).wert).toBe(1.5);
    expect(umrechnen(Z, 90, idx("zeit", "min"), idx("zeit", "h")).exakt).toBe(true);
  });
});

describe("zahl", () => {
  it("schreibt wie im Heft: Tausender getrennt, Komma statt Punkt, kein Exponent", () => {
    const sp = String.fromCharCode(0x202f);
    expect(zahl(1000000)).toBe(`1${sp}000${sp}000`);
    expect(zahl(0.25)).toBe("0,25");
    expect(zahl(1e-9)).toBe("0,000000001");
    expect(zahl(0.1 + 0.2)).toBe("0,3");
    expect(zahl(42.2)).toBe("42,2");
    expect(zahl(42195 / 1000)).toBe("42,195");
  });
});

describe("Hilfen", () => {
  it("Komma wandert bei Zehnerpotenzen", () => {
    expect(kommaStellen(1000)).toBe(3);
    expect(kommaStellen(60)).toBeNull();
  });

  it("wählt die lesbarste Einheit", () => {
    const L = kategorie("laenge");
    expect(bestEinheit(L, 1.4)).toEqual({ i: idx("laenge", "m"), wert: 1.4 });
    expect(L.einheiten[bestEinheit(L, 42195).i].id).toBe("km");
    expect(L.einheiten[bestEinheit(L, 0.005).i].id).toBe("mm");
  });
});

describe("Umrechnungszahl als Länge hoch 2 bzw. 3", () => {
  it("m² → cm² ist · 100², m³ → cm³ (ml) ist · 100³", () => {
    expect(laengenSchritt(kategorie("flaeche"), idx("flaeche", "m2"), idx("flaeche", "cm2"))).toEqual({ op: "·", basis: 100, hoch: 2 });
    expect(laengenSchritt(kategorie("volumen"), idx("volumen", "m3"), idx("volumen", "ml"))).toEqual({ op: "·", basis: 100, hoch: 3 });
  });

  it("Ar und Hektar sind Quadrate: ha → a ist · 10², km² → ha ist · 10²", () => {
    expect(laengenSchritt(kategorie("flaeche"), idx("flaeche", "ha"), idx("flaeche", "a"))).toEqual({ op: "·", basis: 10, hoch: 2 });
    expect(laengenSchritt(kategorie("flaeche"), idx("flaeche", "km2"), idx("flaeche", "ha"))).toEqual({ op: "·", basis: 10, hoch: 2 });
  });

  it("zur größeren Einheit geteilt: l → m³ ist : 10³", () => {
    expect(laengenSchritt(kategorie("volumen"), idx("volumen", "l"), idx("volumen", "m3"))).toEqual({ op: ":", basis: 10, hoch: 3 });
  });

  it("hl, dl, cl haben keine Länge dahinter — und Länge selbst hat keine Hochzahl", () => {
    expect(laengenSchritt(kategorie("volumen"), idx("volumen", "l"), idx("volumen", "dl"))).toBeNull();
    expect(laengenSchritt(kategorie("volumen"), idx("volumen", "m3"), idx("volumen", "hl"))).toBeNull();
    expect(laengenSchritt(kategorie("laenge"), idx("laenge", "m"), idx("laenge", "cm"))).toBeNull();
  });
});
