/** Schrägbild und Risse: Projektionen, verdeckte Kanten, Würfelbau-Ansichten und der Reiter im Körper-Blatt. */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Risse from "@/components/koerper/Risse";
import { KOERPER, startMasse } from "@/lib/koerper";
import { ansichtVon, gleicheAnsicht, rissPoly, schraegbildBau, wuerfelZahl, zufallsBau, type Bau } from "@/lib/koerper-risse";

describe("Risse von Körpern", () => {
  it("Quader: Aufriss ist ein Rechteck aus 4 sichtbaren Kanten, nichts verdeckt", () => {
    const q = KOERPER.quader.poly!({ a: 6, b: 4, c: 3 });
    const s = rissPoly(q, "aufriss");
    expect(s.filter(x => !x.verdeckt)).toHaveLength(4);
    expect(s.filter(x => x.verdeckt)).toHaveLength(0);
    const xs = s.flatMap(x => [x.a.x, x.b.x]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(6, 9);
  });
  it("Pyramide: im Grundriss laufen die Seitenkanten sichtbar zur Spitze", () => {
    const p = KOERPER.pyramide4.poly!(startMasse(KOERPER.pyramide4));
    const s = rissPoly(p, "grundriss");
    expect(s.filter(x => !x.verdeckt).length).toBe(8);
  });
  it("Dreiseitiges Prisma hat im Seitenriss eine verdeckte Kante oder keine — nie mehr Kanten als der Körper", () => {
    const p = KOERPER.prisma3.poly!(startMasse(KOERPER.prisma3));
    for (const r of ["aufriss", "grundriss", "seitenriss"] as const) expect(rissPoly(p, r).length).toBeLessThanOrEqual(9);
  });
});

describe("Würfelbauten", () => {
  const b: Bau = [[2, 1], [0, 1], [1, 0]]; // 3 Spalten, 2 tief
  it("Ansichten", () => {
    const auf = ansichtVon(b, "aufriss");
    expect(auf.map(sp => sp.filter(Boolean).length)).toEqual([2, 1, 1]);
    const grund = ansichtVon(b, "grundriss");
    expect(grund.map(sp => sp.map(Number))).toEqual([[1, 1], [0, 1], [1, 0]]);
    const seite = ansichtVon(b, "seitenriss"); // vorn rechts
    expect(seite.map(sp => sp.filter(Boolean).length)).toEqual([1, 2]);
  });
  it("Schrägbild hat je Würfel drei Flächen", () => {
    expect(schraegbildBau(b)).toHaveLength(3 * wuerfelZahl(b));
  });
  it("Zufallsbauten haben in jeder Spalte etwas", () => {
    for (let i = 0; i < 50; i++) {
      const z = zufallsBau(Math.random, 3);
      expect(z.every(sp => sp.some(h => h > 0))).toBe(true);
      expect(gleicheAnsicht(ansichtVon(z, "aufriss"), ansichtVon(z, "aufriss"))).toBe(true);
    }
  });
});

describe("Oberfläche", () => {
  it("Anleitung, Editor, Zeichnen, Bauen öffnen", () => {
    render(<Risse />);
    expect(screen.getByRole("img", { name: "Schrägbild Quader" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Dreitafelbild" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Nächster Schritt →" }));
    expect(screen.getByText(/Tiefenkanten im Winkel von 45°/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "🧱 Würfelbau-Editor" }));
    fireEvent.click(screen.getByRole("button", { name: /Turm 1, Reihe 1/ }));
    expect(screen.getByText("13 Würfel")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "✏️ Ansichten zeichnen" }));
    fireEvent.click(screen.getByRole("button", { name: "Aufriss (vorn) Feld 1/1" }));
    fireEvent.click(screen.getByRole("button", { name: "Prüfen" }));
    expect(screen.getAllByText(/stimmt|noch nicht/).length).toBe(3);
    fireEvent.click(screen.getByRole("button", { name: "🏗️ Nach Plan bauen" }));
    expect(screen.getByText("Der Plan")).toBeTruthy();
  });
});
