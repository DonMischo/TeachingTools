import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChallengeSpiel from "@/components/challenge/ChallengeSpiel";
import type { ChallengeQuelle } from "@/lib/challenge/useChallengeLauf";
import { MATERIALIEN, materialVon, SEG, ueberfahrt } from "@/lib/challenge/brueckeSpiel";

const brett = {
  stufe: 2, etappe: 1, leben: 3, fertig: false, spiel: "normal", deck: null,
  etappen: [{ nr: 1, titel: "Eins", erledigt: false }, { nr: 2, titel: "Zwei", erledigt: false }],
  challenges: [{ id: "c1", text: "Was ist eine Wippe?", image: null, formula: null, strength: 1, erledigt: false }],
  fakten: [{ id: "f1", text: "Zweiseitiger Hebel", image: null, formula: null, info: null }],
};
const antwort = { qualitaet: 1, treffer: true, komplett: true, kombo: false, schaden: 1, falsch_gewaehlt: 0, leben: 3,
  zurueck_zur_karte: false, etappe_geschafft: true, fertig: false, stufe: 2 };

beforeEach(() => {
  // Bewegung erlaubt: sonst schaltet der Rahmen ohne Belohnungsmoment sofort um
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as never;
});

describe("Belohnungsmoment", () => {
  it("Etappe geschafft: Konfetti und Banner, danach die Karte", async () => {
    const quelle: ChallengeQuelle = {
      schluessel: "jubel",
      info: vi.fn().mockResolvedValue({ title: "T", subject: null, stand: null, settings: { spiele: ["normal"], theme: "klassisch", startstufe: 2 } }),
      start: vi.fn().mockResolvedValue(brett),
      antwort: vi.fn().mockResolvedValue({ ...antwort, brett }),
      deck: vi.fn(),
    };
    const u = userEvent.setup();
    const { container } = render(<ChallengeSpiel quelle={quelle} />);
    await u.click(await screen.findByRole("button", { name: "Los" }));
    await u.click(await screen.findByText("Was ist eine Wippe?"));
    await u.click(screen.getByText("Zweiseitiger Hebel"));
    await u.click(screen.getByRole("button", { name: "Angreifen" }));
    expect(await screen.findByText("Weiter geht's auf der Karte.")).toBeTruthy();
    expect(container.querySelector("[data-konfetti]")).toBeTruthy();
    await waitFor(() => expect(screen.queryByText("Weiter geht's auf der Karte.")).toBeNull(), { timeout: 5000 });
    expect(screen.getByText("🎉 Etappe geschafft!")).toBeTruthy(); // Hinweis auf der Karte
  }, 10000);
});

describe("Brückenbau-Material", () => {
  it("fest je Fakt, alle Sorten kommen vor, Überfahrt reicht übers andere Ufer", () => {
    expect(materialVon("f1")).toBe(materialVon("f1"));
    const sorten = new Set(Array.from({ length: 60 }, (_, i) => materialVon(`f${i}`)));
    expect(sorten).toEqual(new Set(Object.keys(MATERIALIEN)));
    expect(ueberfahrt(0, [4])).toBeGreaterThan(4 * SEG);
  });
});
