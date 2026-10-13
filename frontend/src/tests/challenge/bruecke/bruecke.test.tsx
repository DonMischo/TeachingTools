import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Bruecke from "@/components/challenge/modi/Bruecke";
import { THEMES } from "@/lib/challenge/themes";

const brett = {
  stufe: 2, etappe: 1, leben: 3, fertig: false, spiel: "bruecke", deck: null, etappen: [],
  challenges: [
    { id: "c1", text: "Frage eins", image: null, formula: null, strength: 1, erledigt: false },
    { id: "c2", text: "Frage zwei", image: null, formula: null, strength: 1, erledigt: true },
  ],
  fakten: [
    { id: "f1", text: "Fakt eins", image: null, formula: null, info: { text: "Merke", source: undefined } },
    { id: "x1", text: "Fakt zwei", image: null, formula: null, info: null },
  ],
};
const antw = (e = {}) => ({ qualitaet: 0, treffer: false, komplett: false, kombo: false, schaden: 0, falsch_gewaehlt: 1, leben: 2, zurueck_zur_karte: false, etappe_geschafft: false, fertig: false, stufe: 2, ...e });
const mk = () => ({ waehle: vi.fn(), gelegt: vi.fn(), antworte: vi.fn().mockResolvedValue(antw()), deckSetzen: vi.fn() });

describe("Bruecke", () => {
  it("sammelt Bretter, baut und zeigt Daneben", async () => {
    const lauf = mk(); const u = userEvent.setup();
    render(<Bruecke brett={brett as any} theme={THEMES.klassisch} skin="monster" lauf={lauf as any} zurKarte={() => {}} />);
    await u.click(screen.getAllByRole("button", { name: "Brett aufsammeln" })[0]);
    expect(screen.getByText("Merke")).toBeTruthy();
    await u.click(screen.getAllByRole("button", { name: "Brett aufsammeln" })[1]);
    expect(screen.queryByText("Frage zwei")).toBeNull();
    await u.click(screen.getByText("Frage eins"));
    await u.click(screen.getByText("Fakt eins"));
    await u.click(screen.getByRole("button", { name: "Bauen" }));
    await waitFor(() => expect(lauf.antworte).toHaveBeenCalledWith("c1", ["f1"], false));
    expect(await screen.findByText("Daneben")).toBeTruthy();
  });
});
