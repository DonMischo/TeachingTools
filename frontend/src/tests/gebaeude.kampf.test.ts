import { describe, expect, it } from "vitest";
import { KONTER_ZIEL, ZEITEN, istStufe, kampfEingabe, kampfSchritt, neuerKampf } from "@/lib/gebaeude/kampf";

const fest = (...werte: number[]) => { let i = 0; return () => werte[i++ % werte.length]; };

describe("Konter", () => {
  it("gelingt im Fenster, misslingt davor und danach", () => {
    const im = neuerKampf("konter", "mittel");
    kampfSchritt(im, im.dauer * KONTER_ZIEL);
    kampfEingabe(im, "los");
    expect(im.ergebnis).toBe("gut");

    const frueh = neuerKampf("konter", "mittel");
    kampfSchritt(frueh, im.dauer * 0.3);
    kampfEingabe(frueh, "los");
    expect(frueh.ergebnis).toBe("schlecht");

    const spaet = neuerKampf("konter", "mittel");
    kampfSchritt(spaet, spaet.dauer * (KONTER_ZIEL + spaet.halb) + 0.01);
    expect(spaet.ergebnis).toBe("schlecht");
  });

  it("ist leicht nachsichtig: zu früh gedrückt zählt nicht", () => {
    const k = neuerKampf("konter", "leicht");
    kampfSchritt(k, k.dauer * 0.2);
    kampfEingabe(k, "los");
    expect(k.ergebnis).toBeNull();
    kampfSchritt(k, k.dauer * (KONTER_ZIEL - 0.2));
    kampfEingabe(k, "los");
    expect(k.ergebnis).toBe("gut");
  });

  it("wird mit der Stufe enger und schneller", () => {
    expect(ZEITEN.leicht.konterHalb).toBeGreaterThan(ZEITEN.mittel.konterHalb);
    expect(ZEITEN.mittel.konterHalb).toBeGreaterThan(ZEITEN.schwer.konterHalb);
    expect(ZEITEN.leicht.reaktion).toBeGreaterThan(ZEITEN.schwer.reaktion);
    expect(ZEITEN.leicht.folgeLaenge).toBeLessThan(ZEITEN.schwer.folgeLaenge);
  });
});

describe("Ausweichen", () => {
  it("misst die Reaktionszeit ab dem Pfeil", () => {
    const k = neuerKampf("ausweichen", "mittel", fest(0.5, 0.2));
    expect(k.richtung).toBe("links");
    kampfSchritt(k, k.ab + 0.31);
    kampfEingabe(k, "links");
    expect(k.ergebnis).toBe("gut");
    expect(k.reaktion).toBeCloseTo(0.31, 5);
  });

  it("straft die falsche Richtung, zu frühes Drücken und Zögern", () => {
    const falsch = neuerKampf("ausweichen", "mittel", fest(0.5, 0.9));
    kampfSchritt(falsch, falsch.ab + 0.1);
    kampfEingabe(falsch, "links");
    expect(falsch.ergebnis).toBe("schlecht");

    const frueh = neuerKampf("ausweichen", "mittel", fest(0.5, 0.9));
    kampfEingabe(frueh, "rechts");
    expect(frueh.ergebnis).toBe("schlecht");

    const lahm = neuerKampf("ausweichen", "schwer", fest(0.5, 0.9));
    kampfSchritt(lahm, lahm.ab + ZEITEN.schwer.reaktion + 0.01);
    expect(lahm.ergebnis).toBe("schlecht");

    // leicht: zu früh gedrückt zählt nicht
    const sanft = neuerKampf("ausweichen", "leicht", fest(0.5, 0.9));
    kampfEingabe(sanft, "rechts");
    expect(sanft.ergebnis).toBeNull();
  });
});

describe("Kombo", () => {
  it("verlangt die Tasten in der Reihenfolge", () => {
    const k = neuerKampf("folge", "mittel", fest(0.1, 0.3, 0.6, 0.9));
    expect(k.folge).toHaveLength(ZEITEN.mittel.folgeLaenge);
    for (const t of k.folge.slice(0, -1)) kampfEingabe(k, t);
    expect(k.ergebnis).toBeNull();
    expect(k.pos).toBe(k.folge.length - 1);
    kampfEingabe(k, k.folge[k.folge.length - 1]);
    expect(k.ergebnis).toBe("gut");
  });

  it("bricht bei einer falschen Taste ab — außer auf leicht", () => {
    const k = neuerKampf("folge", "schwer", fest(0.1));
    kampfEingabe(k, "runter");
    expect(k.ergebnis).toBe("schlecht");
    const l = neuerKampf("folge", "leicht", fest(0.1));
    kampfEingabe(l, "runter");
    expect(l.ergebnis).toBeNull();
    expect(l.pos).toBe(0);
  });

  it("läuft ab", () => {
    const k = neuerKampf("folge", "mittel");
    kampfSchritt(k, k.dauer);
    expect(k.ergebnis).toBe("schlecht");
    kampfEingabe(k, k.folge[0]);
    expect(k.pos).toBe(0);
  });
});

it("kennt die Stufen", () => {
  expect(["aus", "leicht", "mittel", "schwer"].every(istStufe)).toBe(true);
  expect(istStufe("unmöglich")).toBe(false);
});
