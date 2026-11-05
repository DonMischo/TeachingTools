/**
 * Körper-Spiele »Renovieren« und »Füllen«: Flächen mit Fenstern und Türen,
 * Tapetenbahnen, Fliesen bis Brusthöhe, günstigster Einkauf; Volumen,
 * Wasserhöhe im schrägen Becken, Sprung- und Pump-Ausgang; die Spiele öffnen.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Koerper from "@/components/koerper/Koerper";
import { ARTEN, auftrag, guenstigsterEinkauf, leererRaum, rechne, START_EINSTELLUNG, type ArtId } from "@/lib/koerper-renovieren";
import { BEHAELTER_REIHE, behaelter, hoeheBei, pumpe, schaetzOptionen, springe } from "@/lib/koerper-fuellen";

function zufall(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}

describe("Renovieren", () => {
  it("Streichen: Wände und Decke ohne Boden, Fenster und Tür abgezogen", () => {
    const r = leererRaum(5, 4, 2.5); // Fenster an Nord, Tür an Süd, Boden aus
    const x = rechne(r, "streichen", { ...START_EINSTELLUNG, anstriche: 2, ergiebigkeit: 7 });
    const waende = 2 * (5 + 4) * 2.5, decke = 20, abzug = 1.2 * 1.4 + 0.9 * 2;
    expect(x.netto).toBeCloseTo(waende + decke - abzug);
    expect(x.bedarf).toBeCloseTo((waende + decke - abzug) * 2 / 7);
    expect(x.teile.some(t => t.f === "boden")).toBe(false);
  });
  it("Tapezieren: Bahnen je Wand aufgerundet, Rollen nach Bahnlänge", () => {
    const r = { ...leererRaum(5, 4, 2.5), an: { ...leererRaum().an, decke: false } };
    const x = rechne(r, "tapezieren");
    // 5 m : 0,53 → 10 Bahnen, 4 m : 0,53 → 8 Bahnen; 2,6 m je Bahn → 3 Bahnen je Rolle
    expect(x.schluessel.wert).toBe(36);
    expect(x.bedarf).toBe(12);
  });
  it("Fliesen: nur bis zur Fliesenhöhe, Fenster ab Brüstung angeschnitten, Boden dabei", () => {
    const r = { ...leererRaum(3, 2, 2.5), an: { nord: true, ost: true, sued: true, west: true, decke: false, boden: true } };
    const x = rechne(r, "fliesen", { ...START_EINSTELLUNG, fliesenhoehe: 1.2 });
    const erwartet = 2 * (3 + 2) * 1.2 - 1.2 * 0.3 - 0.9 * 1.2 + 6;
    expect(x.netto).toBeCloseTo(erwartet);
    expect(x.bedarf).toBeCloseTo(erwartet * 1.1);
  });
  it("günstigster Einkauf deckt den Bedarf und ist nicht teurer als nur kleine Eimer", () => {
    for (const bedarf of [0.5, 2.4, 7.3, 12, 23.9]) {
      const g = ARTEN.streichen.gebinde, k = guenstigsterEinkauf(g, bedarf);
      expect(k.menge).toBeGreaterThanOrEqual(bedarf);
      expect(k.preis).toBeLessThanOrEqual(Math.ceil(bedarf / 2.5) * g[0].preis + 1e-9);
    }
  });
  it("gewürfelte Aufträge sind rechenbar", () => {
    const r = zufall(4);
    for (let i = 0; i < 60; i++) {
      const a = auftrag((["streichen", "tapezieren", "fliesen"] as ArtId[])[i % 3], r);
      const x = rechne(a.raum, a.art, a.einst);
      expect(x.netto).toBeGreaterThan(0);
      expect(x.bedarf).toBeGreaterThan(0);
      expect(a.text + x.zeilen.join()).not.toMatch(/NaN|undefined|Infinity/);
    }
  });
});

describe("Füllen", () => {
  it("Wasserhöhe ist die Umkehrung des Volumens, auch beim schrägen Boden", () => {
    const r = zufall(8);
    for (const art of ["pool", "rundpool", "sprungbecken"] as const) for (let i = 0; i < 10; i++) {
      const b = behaelter(art, r);
      expect(b.volumen(b.H)).toBeCloseTo(b.V, 3);
      for (const h of [0.3, b.T, b.H * 0.9]) expect(hoeheBei(b, b.volumen(h))).toBeCloseTo(h, 4);
    }
  });
  it("Sprung: zu flach, gut, übergelaufen", () => {
    const b = behaelter("pool", zufall(2));
    expect(springe(b, b.volumen(b.T) * 0.5).stufe).toBe("flach");
    expect(springe(b, (b.volumen(b.T) + b.V) / 2).stufe).toBe("gut");
    expect(springe(b, b.V * 1.2).stufe).toBe("ueber");
    expect(springe(b, 0).text).toMatch(/Flachköpper/);
  });
  it("Pumpen: schlapp, prall, peng", () => {
    const b = behaelter("ballon", zufall(3)), n = b.V / b.hub!;
    expect(pumpe(b, Math.floor(n * 0.5)).stufe).toBe("schlapp");
    expect(pumpe(b, Math.floor(n)).stufe).toBe("prall");
    expect(pumpe(b, Math.ceil(n * 1.2)).stufe).toBe("peng");
  });
  it("Schätzfrage hat die richtige Größenordnung unter vier Optionen", () => {
    const r = zufall(5);
    for (const art of BEHAELTER_REIHE) {
      const b = behaelter(art, r), s = schaetzOptionen(b.V, r);
      expect(s.optionen.length).toBe(4);
      expect(Math.abs(s.optionen[s.richtig] - b.V) / b.V).toBeLessThan(0.06);
    }
  });
});

describe("Spiele öffnen", () => {
  it("Renovieren und Füllen", () => {
    render(<Koerper />);
    fireEvent.click(screen.getByRole("button", { name: /Renovieren/ }));
    fireEvent.click(screen.getByRole("button", { name: /Los geht/ }));
    expect(screen.getByRole("button", { name: /Prüfen/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Planer/ }));
    expect(screen.getByText(/Günstigster Einkauf/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Füllen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Los geht/ }));
    expect(screen.getAllByRole("button", { name: /≈ .* l/ }).length).toBe(4);
  });
});
