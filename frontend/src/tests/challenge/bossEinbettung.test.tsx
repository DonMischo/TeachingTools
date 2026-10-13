import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChallengeSpiel from "@/components/challenge/ChallengeSpiel";
import type { ChallengeQuelle } from "@/lib/challenge/useChallengeLauf";

const brett = {
  stufe: 2, etappe: 1, leben: 3, fertig: false, spiel: "normal", deck: null,
  etappen: [{ nr: 1, titel: "Der Hebel", erledigt: false }],
  challenges: [{ id: "c1", text: "Was ist eine Wippe?", image: null, formula: null, strength: 1, erledigt: false }],
  fakten: [{ id: "f1", text: "Zweiseitiger Hebel", image: null, formula: null, info: null }],
};
const antwort = { qualitaet: 1, treffer: true, komplett: true, kombo: false, schaden: 1, falsch_gewaehlt: 0, leben: 3,
  zurueck_zur_karte: false, etappe_geschafft: false, fertig: true, stufe: 2, attempt: { id: 5 }, code_fragments: [] };

describe("ChallengeSpiel mit eigener Quelle", () => {
  it("nutzt die Quelle und zeigt am Ende »Boss besiegt!« mit Weiter", async () => {
    const quelle: ChallengeQuelle = {
      schluessel: "boss:5:b1", direkt: true,
      info: vi.fn().mockResolvedValue({ title: "Drache", subject: null, stand: null, settings: { spiele: ["normal", "karten"], theme: "klassisch", startstufe: 2 } }),
      start: vi.fn().mockResolvedValue(brett),
      antwort: vi.fn().mockResolvedValue(antwort),
      deck: vi.fn(),
    };
    const onAntwort = vi.fn(); const onFertig = vi.fn();
    const u = userEvent.setup();
    render(<ChallengeSpiel quelle={quelle} onAntwort={onAntwort} onFertig={onFertig} />);
    await u.click(await screen.findByRole("button", { name: "Los" }));
    await u.click(await screen.findByText("Was ist eine Wippe?"));
    await u.click(screen.getByText("Zweiseitiger Hebel"));
    await u.click(screen.getByRole("button", { name: "Angreifen" }));
    await waitFor(() => expect(quelle.antwort).toHaveBeenCalledWith(expect.objectContaining({ challenge_id: "c1", fakt_ids: ["f1"] })));
    expect(onAntwort).toHaveBeenCalledWith(expect.objectContaining({ fertig: true }));
    expect(await screen.findByText("Boss besiegt!")).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Weiter" }));
    expect(onFertig).toHaveBeenCalled();
  });
});
