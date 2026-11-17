// Kartenquiz »benennen«: Objekt antippen → Karte zoomt hin, Antwortfeld darüber; Wortbank behält alle Namen; Alle kontrollieren.
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import type { QuizSpiel } from "@/lib/karten/quiz";
import type { Treffer } from "@/components/karten/KartenAnsicht";

const SPIEL: QuizSpiel = {
  titel: "Thüringen", einstellungen: { modus: "benennen", wortbank: true, max_punkte: 10 },
  katalog: [{ id: "de-staedte", name: "Städte", gruppe: "politisch", bereich: "de", geometrie: "punkt", quiz: true, bytes: 0,
    quelle: { name: "BKG", lizenz: "", url: "" } }],
  karte: { art: "stumm", region: "thueringen", ebenen: ["de-staedte"], ausschnitt: null, auswahl: {} },
  spiel: { modus: "benennen", auswahl: { "de-staedte": ["t1", "t2", "t3"] }, wortbank: ["Erfurt", "Gera", "Jena"], aufgaben: [
    { nr: 1, marke: "1", kategorie: "Städte", ebene: "de-staedte", anker: [11, 51], token: "t1" },
    { nr: 2, marke: "2", kategorie: "Städte", ebene: "de-staedte", anker: [11.5, 51], token: "t2" },
    { nr: 3, marke: "3", kategorie: "Städte", ebene: "de-staedte", anker: [12, 50.9], token: "t3" }] },
  erfolge: [],
  stand: { antworten: {}, richtig: 0, erfolge: [] },
};

const RICHTIG: Record<number, string> = { 1: "Erfurt", 2: "Jena", 3: "Gera" };
const h = vi.hoisted(() => ({
  antworten: [] as { nr: number; antwort: string }[],
  klick: null as null | ((t: Treffer[]) => void),
  fokus: [] as ([number, number] | undefined)[],
}));
vi.mock("@/lib/api", () => ({ api: { karten: {
  quiz: async () => SPIEL,
  quizAntwort: async (_c: string, nr: number, antwort: string) => {
    h.antworten.push({ nr, antwort });
    const antworten = Object.fromEntries(h.antworten.map((a) => [a.nr, { richtig: RICHTIG[a.nr] === a.antwort, versuche: 1 }]));
    const richtig = RICHTIG[nr] === antwort;
    return { richtig, versuche: 1, neue_erfolge: [],
      stand: { antworten, richtig: Object.values(antworten).filter((a) => a.richtig).length, erfolge: [] } };
  },
} } }));
vi.mock("@/components/karten/KartenAnsicht", () => ({
  default: ({ onKlick, fokus, ueberlagerung }: { onKlick: (t: Treffer[]) => void; fokus?: { punkt: [number, number] } | null; ueberlagerung?: ReactNode }) => {
    h.klick = onKlick;
    h.fokus.push(fokus?.punkt);
    return <div data-testid="karte">{ueberlagerung}</div>;
  },
}));

import KartenQuizSpiel from "@/components/karten/KartenQuizSpiel";

const treffer = (id: string): Treffer[] => [{ ebene: "de-staedte", id, name: "", eigenschaften: {} }];

describe("Kartenquiz: antippen und eingeben", () => {
  it("Antippen zoomt hin und öffnet die Wortbank mit allen Namen; Alle kontrollieren prüft alles Ausgefüllte", async () => {
    render(<KartenQuizSpiel code="KQ2" token="gast" />);
    await screen.findByTestId("karte");

    // Objekt 2 auf der Karte antippen → Fokus auf seinen Anker, Antwortfeld über der Karte
    act(() => h.klick!(treffer("t2")));
    expect(h.fokus.at(-1)).toEqual([11.5, 51]);
    const feld = within(screen.getByTestId("karte")).getByRole("form", { name: "Antwort für 2" });
    fireEvent.click(within(feld).getByRole("option", { name: "Jena" }));

    // Nächstes Objekt: »Jena« ist schon benutzt, steht aber weiter in der Wortbank
    fireEvent.click(within(feld).getByText("Nächste →"));
    expect(h.fokus.at(-1)).toEqual([12, 50.9]);
    const feld3 = within(screen.getByTestId("karte")).getByRole("form", { name: "Antwort für 3" });
    expect(within(feld3).getAllByRole("option").map((o) => o.textContent)).toEqual(["Erfurt", "Gera", "Jena"]);
    fireEvent.click(within(feld3).getByRole("option", { name: "Jena" }));

    // Über die Liste: Nummer 1 antippen
    fireEvent.click(screen.getByLabelText("1 auf der Karte zeigen"));
    expect(h.fokus.at(-1)).toEqual([11, 51]);
    fireEvent.click(within(screen.getByRole("form", { name: "Antwort für 1" })).getByRole("option", { name: "Erfurt" }));

    fireEvent.click(screen.getByText("✓ Alle kontrollieren"));
    expect(await screen.findByText(/2 von 3 richtig/)).toBeTruthy();
    expect(h.antworten).toEqual([{ nr: 1, antwort: "Erfurt" }, { nr: 2, antwort: "Jena" }, { nr: 3, antwort: "Jena" }]);
    expect(screen.getAllByText("✓ richtig")).toHaveLength(2);
  });

  it("Tippen ohne Aufgabe tut nichts", async () => {
    render(<KartenQuizSpiel code="KQ3" token="gast" />);
    await screen.findByTestId("karte");
    act(() => h.klick!(treffer("fremd")));
    expect(screen.queryByRole("form", { name: /Antwort für/ })).toBeNull();
  });
});
