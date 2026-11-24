/** Ähnlichkeit und Maßstab: Streckung, Ähnlichkeitsfaktor, Maßstab, Aufgaben, Spielziel und die Blätter. */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Aehnlichkeit from "@/components/aehnlichkeit/Aehnlichkeit";
import { dreieckAusSeiten } from "@/components/aehnlichkeit/Aehnlich";
import { BEISPIELE, beispielFuer } from "@/components/aehnlichkeit/Beispiele";
import {
  aehnlichkeitsFaktor, aufgabe, AUFGABEN_ARTEN, MASSSTAEBE, flaeche, inWirklichkeit, imBild, laengeText, passung, streckeFigur, umfang, winkel, zoomZiel, FIGUREN,
} from "@/lib/aehnlichkeit";

function zufall(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}

describe("Rechnung", () => {
  it("Streckung: Längen · |k|, Fläche · k², Winkel bleiben", () => {
    for (const f of FIGUREN) for (const k of [-2, 0.5, 3]) {
      const b = streckeFigur(f.f, { x: 1, y: -2 }, k);
      expect(umfang(b)).toBeCloseTo(umfang(f.f) * Math.abs(k), 9);
      expect(flaeche(b)).toBeCloseTo(flaeche(f.f) * k * k, 9);
      winkel(b).forEach((w, i) => expect(w).toBeCloseTo(winkel(f.f)[i], 6));
    }
  });
  it("ähnliche Dreiecke erkennen", () => {
    const a = dreieckAusSeiten(3, 4, 5)!;
    expect(aehnlichkeitsFaktor(a, dreieckAusSeiten(6, 8, 10)!)).toBeCloseTo(2, 9);
    expect(aehnlichkeitsFaktor(a, dreieckAusSeiten(4, 5, 6)!)).toBeNull();
    expect(dreieckAusSeiten(1, 2, 5)).toBeNull();
  });
  it("Maßstab", () => {
    expect(laengeText(inWirklichkeit(4, { bild: 1, echt: 50000 }))).toBe("2 km");
    expect(imBild(500, { bild: 1, echt: 100 })).toBe(5);
    expect(laengeText(inWirklichkeit(10, { bild: 10, echt: 1 }))).toBe("1 cm");
    // je Maßstab ein Beispiel, die Bildlängen geben echte Maße
    for (const x of MASSSTAEBE) expect(beispielFuer(x.m)).not.toBeNull();
    const laenge = (id: string, name: string) => { const s = BEISPIELE.find(b => b.id === id)!.strecken.find(t => t.name.startsWith(name))!; return Math.hypot(s.nach[0] - s.von[0], s.nach[1] - s.von[1]); };
    expect(laengeText(inWirklichkeit(laenge("lageplan", "Laufbahn"), { bild: 1, echt: 1000 }))).toBe("100 m");
    expect(laengeText(inWirklichkeit(laenge("bauplan", "Tür"), { bild: 1, echt: 100 }))).toBe("90 cm");
    expect(laengeText(inWirklichkeit(laenge("modellbahn", "Figur"), { bild: 1, echt: 87 }))).toBe("1,74 m");
    expect(Math.round(inWirklichkeit(laenge("atlas", "Berlin"), { bild: 1, echt: 3000000 }) / 100000)).toBeGreaterThan(480);
  });
  it("Aufgaben: Lösung passt zum Rechenweg-Ende", () => {
    const r = zufall(8);
    for (const a of AUFGABEN_ARTEN) for (let i = 0; i < 30; i++) {
      const x = aufgabe(a.id, r);
      expect(Number.isFinite(x.loesung)).toBe(true);
      expect(x.loesung).toBeGreaterThan(0);
      expect(x.weg.length).toBeGreaterThan(0);
    }
  });
  it("Spielziel ist mit dem richtigen Z und k genau zu treffen", () => {
    const r = zufall(1);
    for (let i = 0; i < 30; i++) {
      const z = zoomZiel(r, 3);
      expect(passung(streckeFigur(z.fig.f, z.z, z.k), z.ziel)).toBeCloseTo(0, 9);
    }
  });
});

describe("Oberfläche", () => {
  it("öffnet jedes Blatt", () => {
    render(<Aehnlichkeit />);
    expect(screen.getByRole("img", { name: "Zentrische Streckung" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Ähnliche Figuren/ }));
    expect(screen.getByText(/Ähnlich mit k = 1,5/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Maßstab/ }));
    expect(screen.getByRole("img", { name: /Wanderkarte im Maßstab 1 : 25/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Bauplan eines Hauses/ }));
    expect(screen.getByRole("img", { name: /Bauplan eines Hauses im Maßstab 1 : 100/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /📏 Tür/ }));
    expect(document.body.textContent).toContain("= 90 cm in Wirklichkeit");
    fireEvent.click(screen.getByRole("button", { name: /Üben/ }));
    expect(screen.getByRole("button", { name: "Prüfen" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Zoom-Treffer/ }));
    fireEvent.click(screen.getByRole("button", { name: "Treffer prüfen" }));
    expect(screen.getByText(/Gesucht war Z/)).toBeTruthy();
  });
});
