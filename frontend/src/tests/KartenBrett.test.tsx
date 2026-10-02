// Eingebettete Kartenfrage (Caputh/TaskCrawler): sammelt Antworten, »finden« per Klick, Auflösung.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import type { KartenAntwort, KartenBrettDaten } from "@/lib/karten/quiz";

vi.mock("@/components/karten/KartenAnsicht", () => ({
  default: ({ onKlick }: { onKlick?: (t: unknown[]) => void }) => (
    <button onClick={() => onKlick?.([{ ebene: "de-staedte", id: "tok-jena", name: "", eigenschaften: {} }])}>Karte antippen</button>
  ),
}));

import KartenBrett, { kartenAntwortVollstaendig } from "@/components/karten/KartenBrett";

const basis = (modus: "benennen" | "finden"): KartenBrettDaten => ({
  titel: "T", brett: "b1", katalog: [], karte: { art: "stumm", region: "deutschland", ebenen: ["de-staedte"], ausschnitt: null, auswahl: {} },
  spiel: { modus, auswahl: { "de-staedte": ["tok-erfurt", "tok-jena"] }, aufgaben: modus === "benennen"
    ? [{ nr: 1, marke: "1", kategorie: "Städte", ebene: "de-staedte", anker: [11, 51] }, { nr: 2, marke: "2", kategorie: "Städte", ebene: "de-staedte", anker: [11.5, 51] }]
    : [{ nr: 1, name: "Jena", kategorie: "Städte", ebene: "de-staedte" }] },
});

let zuletzt: KartenAntwort = { antworten: {} };
function Huelle({ brett }: { brett: KartenBrettDaten }) {
  const [a, setA] = useState<KartenAntwort>({ antworten: {} });
  zuletzt = a;
  return <KartenBrett brett={brett} antwort={a} onChange={setA} />;
}

describe("KartenBrett", () => {
  it("benennen sammelt Namen je Nummer", () => {
    const brett = basis("benennen");
    render(<Huelle brett={brett} />);
    fireEvent.change(screen.getByLabelText("Name für 1"), { target: { value: "Erfurt" } });
    expect(zuletzt).toEqual({ antworten: { 1: "Erfurt" } });
    expect(kartenAntwortVollstaendig(brett, zuletzt)).toBe(false);
    fireEvent.change(screen.getByLabelText("Name für 2"), { target: { value: "Jena" } });
    expect(kartenAntwortVollstaendig(brett, zuletzt)).toBe(true);
  });

  it("finden setzt beim Antippen das Token der aktuellen Aufgabe; Auflösung bewertet", () => {
    const brett = basis("finden");
    const { rerender } = render(<Huelle brett={brett} />);
    expect(screen.getByText(/Finde: Jena/)).toBeTruthy();
    fireEvent.click(screen.getByText("Karte antippen"));
    expect(zuletzt).toEqual({ antworten: { 1: "tok-jena" } });
    rerender(<KartenBrett brett={brett} antwort={zuletzt} disabled
      loesung={{ 1: { name: "Jena", marke: "1", token: "tok-jena", ebene: "de-staedte" } }} />);
    expect(screen.getByText(/✅/)).toBeTruthy();
  });
});
