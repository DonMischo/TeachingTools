import { describe, expect, it } from "vitest";
import {
  BLOCK_ZIEL, KONTER_ZIEL, ZEITEN, istStufe, kampfEingabe, kampfFuer, sammelFuer, kampfLoslassen, kampfSchritt, neuerKampf, taktStelle, taktTreffer,
} from "@/lib/gebaeude/kampf";

const fest = (...werte: number[]) => { let i = 0; return () => werte[i++ % werte.length]; };

describe("kampfFuer", () => {
  it("nimmt das vorgegebene Minispiel, sonst reihum — Bossspiele nur am Tor", () => {
    expect(kampfFuer("block", 0)).toBe("block");
    expect(kampfFuer(undefined, 1)).toBe("ausweichen");
    expect(kampfFuer("runen", 0)).toBe("konter");
    expect(kampfFuer("kraft", 0, true)).toBe("kraft");
    expect(kampfFuer("block", 1, true)).toBe("kraft");
  });
});

describe("sammelFuer", () => {
  it("Info-Stationen: nur vorgegebene Stationsspiele, sonst Erz (null)", () => {
    expect(sammelFuer("folge")).toBe("folge");
    expect(sammelFuer(undefined)).toBeNull();
    expect(sammelFuer("runen")).toBeNull();
  });
});

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

describe("Schildblock", () => {
  it("gelingt, wenn man im grünen Bereich loslässt", () => {
    const k = neuerKampf("block", "mittel");
    kampfEingabe(k, "los");
    expect(k.haelt).toBe(true);
    kampfSchritt(k, k.ladeZeit * BLOCK_ZIEL);
    kampfLoslassen(k);
    expect(k.ergebnis).toBe("gut");
  });

  it("misslingt zu früh und bei zu langem Halten; leicht darf noch einmal", () => {
    const frueh = neuerKampf("block", "mittel");
    kampfEingabe(frueh, "los");
    kampfSchritt(frueh, frueh.ladeZeit * 0.3);
    kampfLoslassen(frueh);
    expect(frueh.ergebnis).toBe("schlecht");

    const lang = neuerKampf("block", "mittel");
    kampfEingabe(lang, "los");
    kampfSchritt(lang, lang.ladeZeit * (BLOCK_ZIEL + lang.halb) + 0.02);
    expect(lang.ergebnis).toBe("schlecht");

    const sanft = neuerKampf("block", "leicht");
    kampfEingabe(sanft, "los");
    kampfSchritt(sanft, 0.2);
    kampfLoslassen(sanft);
    expect(sanft.ergebnis).toBeNull();
    expect(sanft.ladung).toBe(0);
    // ohne Halten lädt nichts
    kampfSchritt(sanft, 1);
    expect(sanft.ladung).toBe(0);
  });
});

describe("Schwachstelle", () => {
  it("lässt Stellen aufleuchten und zählt Treffer bis zum Sieg", () => {
    const k = neuerKampf("ziel", "mittel", fest(0.1));
    expect(k.ziel).toBeNull();
    for (let n = 0; n < ZEITEN.mittel.zielNoetig; n++) {
      kampfSchritt(k, 0.55);
      expect(k.ziel).not.toBeNull();
      kampfEingabe(k, k.ziel!);
    }
    expect(k.ergebnis).toBe("gut");
  });

  it("straft die falsche Seite und das Verpassen — außer auf leicht", () => {
    const falsch = neuerKampf("ziel", "mittel", fest(0.1));
    kampfSchritt(falsch, 0.55);
    kampfEingabe(falsch, falsch.ziel === "hoch" ? "runter" : "hoch");
    expect(falsch.ergebnis).toBe("schlecht");

    const lahm = neuerKampf("ziel", "schwer", fest(0.1));
    kampfSchritt(lahm, 0.55);
    kampfSchritt(lahm, ZEITEN.schwer.zielFade + 0.01);
    expect(lahm.ergebnis).toBe("schlecht");

    const sanft = neuerKampf("ziel", "leicht", fest(0.1));
    kampfSchritt(sanft, 0.55);
    kampfSchritt(sanft, ZEITEN.leicht.zielFade + 0.01);
    expect(sanft.ergebnis).toBeNull();
    expect(sanft.ziel).toBeNull();
    kampfSchritt(sanft, 0.35);
    expect(sanft.ziel).not.toBeNull();
  });
});

describe("Runen", () => {
  it("zeigt erst die Reihe und nimmt dann die Eingabe an", () => {
    const k = neuerKampf("runen", "mittel", fest(0.1, 0.3, 0.6, 0.9));
    const n = k.folge.length;
    kampfSchritt(k, 0.01);
    expect(k.zeigt).toBe(0);
    kampfEingabe(k, k.folge[0]);
    expect(k.pos).toBe(0); // beim Zeigen zählt nichts
    kampfSchritt(k, k.zeig);
    expect(k.zeigt).toBe(1);
    kampfSchritt(k, n * k.zeig + 0.5);
    expect(k.phase).toBe("eingeben");
    for (const t of k.folge) kampfEingabe(k, t);
    expect(k.ergebnis).toBe("gut");
  });

  it("bricht bei einer falschen Rune ab; leicht zeigt die Reihe noch einmal", () => {
    const hart = neuerKampf("runen", "schwer", fest(0.1));
    kampfSchritt(hart, hart.folge.length * hart.zeig + 0.5);
    kampfEingabe(hart, "runter");
    expect(hart.ergebnis).toBe("schlecht");
    const sanft = neuerKampf("runen", "leicht", fest(0.1));
    kampfSchritt(sanft, sanft.folge.length * sanft.zeig + 0.5);
    kampfEingabe(sanft, "runter");
    expect(sanft.ergebnis).toBeNull();
    expect(sanft.phase).toBe("zeigen");
    expect(sanft.t).toBe(0);
  });
});

describe("Kräftemessen", () => {
  /** drückt `rate`-mal je Sekunde, bis der Kampf entschieden ist */
  const spiele = (stufe: "leicht" | "mittel" | "schwer", rate: number) => {
    const k = neuerKampf("kraft", stufe);
    let naechster = 0;
    for (let t = 0; t < 12 && !k.ergebnis; t += 0.02) {
      kampfSchritt(k, 0.02);
      if (t >= naechster) { kampfEingabe(k, "los"); naechster += 1 / rate; }
    }
    return k.ergebnis;
  };

  it("gewinnt, wer im Takt drückt — auf jeder Stufe", () => {
    expect(spiele("leicht", 2.2)).toBe("gut");
    expect(spiele("mittel", 2.2)).toBe("gut");
    expect(spiele("schwer", 2.2)).toBe("gut");
  });

  it("verliert, wer nichts tut oder nur hämmert", () => {
    expect(spiele("mittel", 0.01)).toBe("schlecht");
    expect(spiele("mittel", 12)).toBe("schlecht");
  });
});

describe("Erz-Takt", () => {
  it("schwingt hin und zurück; in der Mitte ist der Volltreffer", () => {
    const d = ZEITEN.mittel.taktDauer;
    expect(taktStelle(0, "mittel")).toBe(0);
    expect(taktStelle(d / 2, "mittel")).toBeCloseTo(1, 5);
    expect(taktStelle(d / 4, "mittel")).toBeCloseTo(0.5, 5);
    expect(taktTreffer(d / 4, "mittel")).toBe(true);
    expect(taktTreffer(d * 0.75, "mittel")).toBe(true);
    expect(taktTreffer(0, "mittel")).toBe(false);
    expect(taktTreffer(d / 2, "mittel")).toBe(false);
  });
});
