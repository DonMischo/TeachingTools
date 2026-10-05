// Üben ohne Code: Satz laden, Aufgabe mit Auswahl beantworten, Lern-Erfolg melden, weiter.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { SelbstUebenSatz } from "@/lib/karten/quiz";

const SATZ: SelbstUebenSatz = {
  titel: "Thüringen",
  katalog: [{ id: "de-staedte", name: "Städte", gruppe: "politisch", bereich: "de", geometrie: "punkt", quiz: true, bytes: 0,
    quelle: { name: "BKG", lizenz: "", url: "" } }],
  karte: { art: "stumm", region: "thueringen", ebenen: ["de-staedte"], ausschnitt: null, auswahl: {} },
  spiel: { modus: "finden", aufgaben: [], auswahl: { "de-staedte": ["t1"] } },
  erfolge: [{ id: "tage", name: "Dranbleiben", icon: "📅", text: "an 1 Tagen üben" }],
  erreicht: [],
  lernen: { sicherheit: { 1: 0 }, schwach: 1, tage: 0 },
};

const { aufrufe } = vi.hoisted(() => ({ aufrufe: { naechste: 0, antworten: [] as unknown[] } }));
vi.mock("@/lib/api", () => ({ api: { karten: {
  selbstSatz: async () => SATZ,
  selbstNaechste: async () => {
    aufrufe.naechste += 1;
    return { nr: 1, richtung: "benennen", hilfe: "auswahl", kategorie: "Städte", ebene: "de-staedte", sicherheit: 0,
      anker: [11, 51], token: "t1", optionen: ["Erfurt", "Gotha", "Weimar", "Jena"] };
  },
  selbstAntwort: async (_id: number, body: unknown) => {
    aufrufe.antworten.push(body);
    return { richtig: true, name: "Erfurt", token: "t1", sicherheit: 0.5, neue_erfolge: ["tage"], erreicht: ["tage"],
      stand: { antworten: {}, richtig: 0, erfolge: [] }, lernen: { sicherheit: { 1: 0.5 }, schwach: 0, tage: 1 } };
  },
} } }));
vi.mock("@/components/karten/KartenAnsicht", () => ({ default: () => <div data-testid="karte" /> }));
vi.mock("next/link", () => ({ default: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a> }));

import KartenSelbstUeben from "@/components/karten/KartenSelbstUeben";

describe("Karten: Üben ohne Code", () => {
  it("stellt eine Aufgabe, meldet den Erfolg und holt die nächste", async () => {
    render(<KartenSelbstUeben satzId={7} />);
    fireEvent.click(await screen.findByRole("button", { name: "Erfurt" }));
    expect(await screen.findByText("🏆 Erfolg: 📅 Dranbleiben")).toBeTruthy();
    expect(aufrufe.antworten).toEqual([{ nr: 1, richtung: "benennen", antwort: "Erfurt" }]);
    expect(screen.getByTitle("Dranbleiben: an 1 Tagen üben").className).not.toContain("grayscale");
    fireEvent.click(screen.getByRole("button", { name: "Weiter →" }));
    await screen.findByRole("button", { name: "Gotha" });
    expect(aufrufe.naechste).toBe(2);
  });
});
