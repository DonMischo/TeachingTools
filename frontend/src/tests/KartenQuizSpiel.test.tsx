// Kartenquiz (Spieler): benennen mit Prüfung auf dem Server, Erfolg, Lösung nach Fehlversuchen.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { QuizSpiel } from "@/lib/karten/quiz";

const SPIEL: QuizSpiel = {
  titel: "Thüringen", einstellungen: { modus: "benennen", wortbank: false, max_punkte: 10 },
  katalog: [{ id: "de-staedte", name: "Städte", gruppe: "politisch", bereich: "de", geometrie: "punkt", quiz: true, bytes: 0,
    quelle: { name: "BKG", lizenz: "", url: "" } }],
  karte: { art: "stumm", region: "thueringen", ebenen: ["de-staedte"], ausschnitt: null, auswahl: {} },
  spiel: { modus: "benennen", auswahl: { "de-staedte": ["t1", "t2"] }, aufgaben: [
    { nr: 1, marke: "1", kategorie: "Städte", ebene: "de-staedte", anker: [11, 51] },
    { nr: 2, marke: "2", kategorie: "Städte", ebene: "de-staedte", anker: [11.5, 51] }] },
  erfolge: [{ id: "alle-de-staedte", name: "Städte-Profi", icon: "🏙️" }],
  stand: { antworten: {}, richtig: 0, erfolge: [] },
};

const { antworten } = vi.hoisted(() => ({ antworten: [] as { nr: number; antwort: string }[] }));
vi.mock("@/lib/api", () => ({ api: { karten: {
  quiz: async () => SPIEL,
  quizAntwort: async (_c: string, nr: number, antwort: string) => {
    antworten.push({ nr, antwort });
    if (nr === 1) return { richtig: true, versuche: 1, neue_erfolge: [], stand: { antworten: { 1: { richtig: true, versuche: 1 } }, richtig: 1, erfolge: [] } };
    const versuche = antworten.filter((a) => a.nr === 2).length;
    return { richtig: false, versuche, neue_erfolge: [], ...(versuche >= 2 ? { loesung: "Jena" } : {}),
      stand: { antworten: { 1: { richtig: true, versuche: 1 }, 2: { richtig: false, versuche } }, richtig: 1, erfolge: [] } };
  },
} } }));
vi.mock("@/components/karten/KartenAnsicht", () => ({ default: () => <div data-testid="karte" /> }));

import KartenQuizSpiel from "@/components/karten/KartenQuizSpiel";

describe("Kartenquiz (Spieler)", () => {
  it("prüft Antworten auf dem Server und zeigt nach zwei Fehlern die Lösung", async () => {
    render(<KartenQuizSpiel code="KQ1" token="gast" />);
    fireEvent.change(await screen.findByLabelText("Name für 1"), { target: { value: "Erfurt" } });
    fireEvent.click(screen.getByLabelText("1 prüfen"));
    expect(await screen.findByText("✓ richtig")).toBeTruthy();
    expect(screen.getByText("✓ 1 / 2")).toBeTruthy();

    for (const versuch of ["Weimar", "Gera"]) {
      fireEvent.change(screen.getByLabelText("Name für 2"), { target: { value: versuch } });
      fireEvent.click(screen.getByLabelText("2 prüfen"));
      await screen.findByText(/Leider nicht|Noch nicht/);
    }
    expect(await screen.findByText(/richtig ist »Jena«/)).toBeTruthy();
    expect(antworten.map((a) => a.antwort)).toEqual(["Erfurt", "Weimar", "Gera"]);
  });
});
