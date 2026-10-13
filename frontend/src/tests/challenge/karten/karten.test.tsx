import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Karten from "@/components/challenge/modi/Karten";
import { THEMES } from "@/lib/challenge/themes";

const brett = (extra = {}) => ({
  stufe: 2, etappe: 1, leben: 3, fertig: false, spiel: "karten", deck: ["f1", "x1"], etappen: [],
  challenges: [
    { id: "c1", text: "Frage eins", image: null, formula: null, strength: 1, erledigt: false },
    { id: "c2", text: "Frage zwei", image: null, formula: null, strength: 1, erledigt: true },
  ],
  fakten: [
    { id: "f1", text: "Fakt eins", image: null, formula: null, info: null },
    { id: "x1", text: "Fakt zwei", image: null, formula: null, info: null },
  ],
  ...extra,
});
const antw = (e = {}) => ({ qualitaet: 0, treffer: false, komplett: false, kombo: false, schaden: 0, falsch_gewaehlt: 1, leben: 2, zurueck_zur_karte: false, etappe_geschafft: false, fertig: false, stufe: 2, ...e });
const mk = () => ({ waehle: vi.fn(), gelegt: vi.fn(), antworte: vi.fn().mockResolvedValue(antw()), deckSetzen: vi.fn().mockResolvedValue(undefined) });
const zeige = (b: any, lauf: any) =>
  render(<Karten brett={b} theme={THEMES.klassisch} skin="monster" lauf={lauf} zurKarte={() => {}} />);

describe("Karten", () => {
  it("baut das Deck und setzt es", async () => {
    const lauf = mk(); const u = userEvent.setup();
    zeige(brett({ deck: null }), lauf);
    await u.click(screen.getByText("Fakt eins"));
    await u.click(screen.getByRole("button", { name: "Deck fertig" }));
    expect(lauf.deckSetzen).toHaveBeenCalledWith(["f1"]);
  });
  it("spielt gestapelte Karten aus und zeigt Daneben", async () => {
    const lauf = mk(); const u = userEvent.setup();
    zeige(brett(), lauf);
    expect(screen.queryByText("Frage zwei")).toBeNull();
    await u.click(screen.getByText("Frage eins"));
    await u.click(screen.getByText("Fakt eins"));
    await u.click(screen.getByRole("button", { name: "Ausspielen" }));
    await waitFor(() => expect(lauf.antworte).toHaveBeenCalledWith("c1", ["f1"], false));
    expect(await screen.findByText("Daneben")).toBeTruthy();
  });
});
