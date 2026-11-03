/**
 * Geometrie (Grundbegriffe): Jede gewürfelte Übung und Sachaufgabe ist
 * lösbar, die Rechnung hinter Winkeln, Symmetrie und Billard stimmt, und alle
 * Blätter öffnen.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Geometrie from "@/components/grundbegriffe/Geometrie";
import { ergebnis, stimmt } from "@/lib/geometrie/aufgabe";
import { z } from "@/lib/prozent";
import { spiegel } from "@/lib/koordinaten/spiel";
import { ACHSEN_FIGUREN, ANWENDUNG_ARTEN, UEBUNG_ARTEN, erzeugeAnwendung, erzeugeUebung, zeigerWinkel } from "@/lib/geometrie-aufgaben";
import {
  WINKEL_IDS, beziehung, drehfigur, halbeFigur, lage, loesungen, lotfuss, partner, punktsymmetrisch, schluessel, stoss,
  symmetrieAchsen, symmetrischeFigur, tischFuer, winkelArt, winkelGroesse, type Zelle,
} from "@/lib/grundbegriffe";

function zufall(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

const alle = [
  ...UEBUNG_ARTEN.map(a => (r: () => number) => erzeugeUebung(a.id, r)),
  ...ANWENDUNG_ARTEN.map(a => (r: () => number) => erzeugeAnwendung(a.id, r)),
];

describe("gewürfelte Aufgaben", () => {
  it("haben endliche Lösungen, die als richtig gelten", () => {
    const r = zufall(7);
    for (const erzeuge of alle) {
      for (let i = 0; i < 60; i++) {
        const a = erzeuge(r);
        expect(a.text.length).toBeGreaterThan(10);
        expect(a.loesung.length).toBeGreaterThan(0);
        for (const g of a.gesucht) {
          expect(Number.isFinite(g.wert)).toBe(true);
          if (g.optionen) {
            expect(stimmt(g, String(g.wert))).toBe(true);
            expect(stimmt(g, String((g.wert + 1) % g.optionen.length))).toBe(false);
          } else {
            // Ein Schüler tippt das Minus als Bindestrich.
            expect(stimmt(g, z(g.wert, g.nk ?? 2).replace("−", "-"))).toBe(true);
            expect(ergebnis(g)).toContain(g.label);
          }
        }
        const alles = a.text + a.loesung.join() + a.hinweise.join() + JSON.stringify(a.skizze ?? {});
        expect(alles).not.toMatch(/NaN|undefined|Infinity/);
      }
    }
  });

  it("Spiegeln im Koordinatensystem: Bildpunkt passt zur Regel", () => {
    const r = zufall(3);
    for (let i = 0; i < 80; i++) {
      const a = erzeugeUebung("spiegeln", r);
      const m = a.text.match(/P\((−?\d+) \| (−?\d+)\)/)!;
      const p = { x: Number(m[1].replace("−", "-")), y: Number(m[2].replace("−", "-")) };
      const [gx, gy] = a.gesucht;
      expect(Math.abs(gx.wert) <= 6 && Math.abs(gy.wert) <= 6).toBe(true);
      expect(gx.wert !== p.x || gy.wert !== p.y).toBe(true);
    }
  });

  it("Uhrzeiger", () => {
    expect(zeigerWinkel(3, 0)).toBe(90);
    expect(zeigerWinkel(6, 0)).toBe(180);
    expect(zeigerWinkel(9, 0)).toBe(90);
    expect(zeigerWinkel(12, 30)).toBe(165);
    expect(zeigerWinkel(2, 20)).toBe(50);
  });

  it("Symmetrieachsen der Figuren stimmen", () => {
    expect(ACHSEN_FIGUREN.find(f => f.name === "Quadrat")!.achsen).toBe(4);
    expect(ACHSEN_FIGUREN.find(f => f.name === "Parallelogramm")!.achsen).toBe(0);
  });
});

describe("Winkel und Geraden", () => {
  it("Winkelarten an den Grenzen", () => {
    expect([0, 45, 90, 120, 180, 270, 360].map(winkelArt)).toEqual(["null", "spitz", "recht", "stumpf", "gestreckt", "ueberstumpf", "voll"]);
  });

  it("Neben-, Scheitel-, Stufen- und Wechselwinkel", () => {
    expect(partner("α1", "scheitel")).toEqual(["γ1"]);
    expect(partner("α1", "stufen")).toEqual(["α2"]);
    expect(partner("γ1", "wechsel")).toEqual(["α2"]);
    expect(partner("β1", "neben").sort()).toEqual(["α1", "γ1"]);
    expect(beziehung("δ1", "β2")).toBe("wechsel");
    for (const w of WINKEL_IDS) {
      const phi = 63;
      for (const n of partner(w, "neben")) expect(winkelGroesse(w, phi) + winkelGroesse(n, phi)).toBe(180);
      for (const b of ["scheitel", "stufen", "wechsel"] as const) expect(winkelGroesse(partner(w, b)[0], phi)).toBe(winkelGroesse(w, phi));
    }
    // h gekippt: Stufenwinkel sind nicht mehr gleich, Scheitelwinkel schon
    expect(winkelGroesse("α2", 63, 10)).not.toBe(winkelGroesse("α1", 63, 10));
    expect(winkelGroesse("γ2", 63, 10)).toBe(winkelGroesse("α2", 63, 10));
  });

  it("Lage und Lot", () => {
    const P = (x: number, y: number) => ({ x, y });
    expect(lage(P(0, 0), P(2, 1), P(0, 3), P(4, 5))).toBe("parallel");
    expect(lage(P(0, 0), P(2, 1), P(0, 3), P(1, 1))).toBe("senkrecht");
    expect(lage(P(0, 0), P(2, 1), P(0, 3), P(3, 3))).toBe("schneiden");
    expect(lotfuss(P(3, 4), P(0, 0), P(10, 0))).toEqual(P(3, 0));
  });
});

describe("Symmetrie", () => {
  it("gewürfelte Figuren haben die verlangte Symmetrie", () => {
    const r = zufall(5);
    for (let i = 0; i < 40; i++) {
      expect(symmetrieAchsen(symmetrischeFigur(r, "senkrecht"))).toContain("senkrecht");
      expect(symmetrieAchsen(symmetrischeFigur(r, "vier")).length).toBe(4);
      expect(punktsymmetrisch(symmetrischeFigur(r, "punkt"))).toBe(true);
      const keine = symmetrischeFigur(r, "keine");
      expect(symmetrieAchsen(keine)).toEqual([]);
      expect(punktsymmetrisch(keine)).toBe(false);
    }
  });

  it("halbe Figur + Lösung ergibt eine symmetrische Figur im Blatt", () => {
    const r = zufall(11);
    for (const art of ["senkrecht", "waagerecht", "diagonal", "punkt"] as const) {
      for (let i = 0; i < 30; i++) {
        const h = halbeFigur(r, 10, art);
        const ganz: Zelle[] = [...h.vorlage, ...h.loesung];
        for (const [c, rr] of ganz) expect(c >= 0 && rr >= 0 && c < 10 && rr < 10).toBe(true);
        const v = new Set(h.vorlage.map(schluessel));
        expect(h.loesung.some(z => v.has(schluessel(z)))).toBe(false);
      }
    }
  });

  it("Drehfiguren: n gleiche Teile", () => {
    expect(drehfigur("windrad", 5).flaechen.length).toBe(5);
    expect(drehfigur("stern", 6).flaechen[0].length).toBe(12);
  });

  it("Spiegelregel aus dem Koordinaten-Lauf", () => {
    expect(spiegel({ x: 2, y: 3 }, { art: "senkrecht", k: 1 })).toEqual({ x: 0, y: 3 });
  });
});

describe("Winkel-Billard", () => {
  it("Einfallswinkel = Ausfallswinkel an der Bande", () => {
    const t = { w: 12, h: 7, ball: { x: 2, y: 2 }, loch: { x: 10, y: 2 }, klotze: [], pflicht: 1 };
    // 45° nach oben rechts: trifft die obere Bande bei x = 7 und kommt bei (12, 2) an … das Loch liegt bei (10, 2)
    const s = stoss(t, 45);
    expect(s.pfad[1].x).toBeCloseTo(7);
    expect(s.pfad[1].y).toBeCloseTo(7);
    // Spiegeltrick: Loch an der oberen Bande gespiegelt (10 | 12) → Richtung atan(10/8)
    const g = Math.round(Math.atan2(10, 8) * 180 / Math.PI);
    expect(stoss(t, g).versenkt).toBe(true);
    // Direkt geradeaus zählt nicht
    expect(stoss(t, 0).zuFrueh).toBe(true);
  });

  it("jeder gewürfelte Tisch ist mit ganzen Grad lösbar", () => {
    const r = zufall(13);
    for (let runde = 0; runde < 10; runde++) {
      const t = tischFuer(runde, r);
      expect(loesungen(t).length).toBeGreaterThan(0);
    }
  });
});

describe("Blätter", () => {
  it("alle Blätter öffnen, Übungen mit Word-Export", () => {
    render(<Geometrie />);
    expect(screen.getByRole("button", { name: /Messen/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Lagebeziehungen/ }));
    expect(screen.getAllByRole("button", { name: /Strecke/ }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Winkel an Geraden/ }));
    expect(screen.getByRole("button", { name: "Winkel α₁" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /🦋 Symmetrie/ }));
    expect(screen.getByRole("button", { name: /Neue Figur/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Achsen finden/ }));
    expect(screen.getAllByRole("button", { name: /senkrecht/ }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Spiegeln im Koordinatensystem/ }));
    expect(screen.getByRole("button", { name: "Punkt (0 | 0)" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /✍️ Übungen/ }));
    expect(screen.getByRole("button", { name: /Neue Aufgabe/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Arbeitsblatt/ }));
    expect(screen.getByRole("button", { name: /docx herunterladen/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /🏡 Anwendungen/ }));
    expect(screen.getByRole("button", { name: /Uhrzeiger/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Winkel-Billard/ }));
    fireEvent.click(screen.getByRole("button", { name: /Los geht/ }));
    expect(screen.getByRole("button", { name: /Stoß!/ })).toBeTruthy();
  });

  it("Koordinaten: Antippen setzt den Bildpunkt", () => {
    render(<Geometrie vorgabe={{ reiter: "koordinaten" }} />);
    fireEvent.click(screen.getByRole("button", { name: "• Punkt" }));
    fireEvent.click(screen.getByRole("button", { name: "Punkt (2 | -3)" }));
    expect((screen.getByLabelText("x von P′") as HTMLInputElement).value).toBe("2");
    expect((screen.getByLabelText("y von P′") as HTMLInputElement).value).toBe("-3");
  });
});
