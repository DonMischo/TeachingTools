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
const mk = () => ({ waehle: vi.fn(), gelegt: vi.fn(), antworte: vi.fn().mockResolvedValue(antw()), deckSetzen: vi.fn().mockResolvedValue(undefined), spielwert: vi.fn().mockResolvedValue(null), hatBestenliste: false });
const zeige = (b: any, lauf: any) =>
  render(<Karten brett={b} theme={THEMES.klassisch} skin="monster" lauf={lauf} zurKarte={() => {}} />);

describe("Karten", () => {
  it("draftet: Booster aufdecken, wählen, Fertig setzt das Deck", async () => {
    const lauf = mk(); const u = userEvent.setup();
    zeige(brett({ deck: null }), lauf);
    await u.click(screen.getAllByRole("button", { name: "Karte aufdecken" })[0]);
    // beide Karten (Booster hat nur 2 Fakten) sichtbar
    const wahl = screen.getByText("Fakt eins");
    await u.click(wahl);
    expect(lauf.deckSetzen).not.toHaveBeenCalled(); // Ziel = 2 Karten, erst eine gewählt
    await u.click(screen.getByRole("button", { name: "Fertig" }));
    expect(lauf.deckSetzen).toHaveBeenCalledTimes(1);
    expect(lauf.deckSetzen.mock.calls[0][0]).toEqual(["f1"]);
  });
  it("zieht die Hand, kostet Energie und spielt gestapelte Karten aus (Daneben)", async () => {
    const lauf = mk(); const u = userEvent.setup();
    zeige(brett(), lauf);
    expect(screen.queryByText("Frage zwei")).toBeNull();
    expect(screen.getByText(/Stapel: 0/)).toBeTruthy(); // beide Karten in der Hand
    await u.click(screen.getByText("Frage eins"));
    await u.click(screen.getByText("Fakt eins"));
    expect(screen.getByLabelText("Energie 2 von 3")).toBeTruthy();
    await u.click(screen.getByRole("button", { name: "Ausspielen" }));
    await waitFor(() => expect(lauf.antworte).toHaveBeenCalledWith("c1", ["f1"], false));
    expect(await screen.findByText(/^Daneben/)).toBeTruthy();
    await waitFor(() => expect(lauf.spielwert).toHaveBeenCalledWith("karten", 1, expect.any(Number), 3), { timeout: 3000 }); // gedrosselt gemeldet
  });
  it("Zug beenden: Hand bleibt, Energie voll", async () => {
    const lauf = mk(); const u = userEvent.setup();
    zeige(brett(), lauf);
    await u.click(screen.getByText("Frage eins"));
    await u.click(screen.getByText("Fakt eins"));
    await u.click(screen.getByRole("button", { name: "Zug beenden" }));
    expect(screen.getByLabelText("Energie 3 von 3")).toBeTruthy();
    expect(screen.getByText(/Zug 2/)).toBeTruthy();
  });
  it("Abwerfen-Modus markiert Karten und wirft sie ab", async () => {
    const lauf = mk(); const u = userEvent.setup();
    zeige(brett(), lauf);
    await u.click(screen.getByRole("button", { name: "Abwerfen" }));
    await u.click(screen.getByText("Fakt eins"));
    expect(screen.getByText("Fakt eins").closest("button")!.getAttribute("aria-pressed")).toBe("true");
    await u.click(screen.getByRole("button", { name: /1 abwerfen/ }));
    await u.click(screen.getByRole("button", { name: "Mischen" }));
    expect(screen.getByText(/Ablage: 0/)).toBeTruthy();
  });
  it("Hand liegt in Reihen ohne negative Überlappung", () => {
    zeige(brett(), mk());
    expect(screen.getByLabelText("Deine Hand").className).toContain("kt-fach");
    expect(document.body.innerHTML + document.head.innerHTML).not.toMatch(/margin-left:\s*-1\.25rem/);
  });
});
