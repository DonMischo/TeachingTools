import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { themeVon } from "@/lib/challenge/themes";
import Modus from "@/components/challenge/modi/Detektiv";

const brett = {
  stufe: 2, etappe: 1, leben: 3, fertig: false, spiel: "detektiv", deck: null,
  etappen: [{ nr: 1, titel: "Der Hebel", erledigt: false }],
  challenges: [
    { id: "c1", text: "Offene Aufgabe", image: null, formula: null, strength: 1, erledigt: false },
    { id: "c2", text: "Schon erledigt", image: null, formula: null, strength: 1, erledigt: true },
  ],
  fakten: [
    { id: "f1", text: "Zweiseitiger Hebel", image: null, formula: null, info: { text: "Merke dir das.", source: null } },
    { id: "f2", text: "Kraft mal Weg", image: null, formula: null, info: null },
  ],
};
const antwort = (extra = {}) => ({
  qualitaet: 0, treffer: false, komplett: false, kombo: false, schaden: 0, falsch_gewaehlt: 1,
  leben: 2, zurueck_zur_karte: false, etappe_geschafft: false, fertig: false, stufe: 2, ...extra,
});
const baue = (a = antwort()) => {
  const lauf = { waehle: vi.fn(), gelegt: vi.fn(), antworte: vi.fn().mockResolvedValue(a), deckSetzen: vi.fn(), spielWechseln: vi.fn() };
  const ui = render(<Modus brett={brett as never} theme={themeVon("wald")} skin="monster" lauf={lauf as never} zurKarte={() => {}} />);
  return { lauf, ui, u: userEvent.setup() };
}

async function sammle(u: ReturnType<typeof userEvent.setup>) {
  for (const b of screen.getAllByRole("button", { name: /durchsuchen/ })) await u.click(b);
  expect(screen.getByText("Gefunden:")).toBeTruthy();
  await u.click(screen.getByRole("button", { name: "Weiter" }));
}

describe("Detektiv", () => {
  it("sammelt, legt Fakten auf die Challenge und wertet", async () => {
    const { lauf, u } = baue();
    await sammle(u);
    await u.click(screen.getByRole("button", { name: /Offene Aufgabe/ }));
    await u.click(screen.getByRole("button", { name: /Zweiseitiger Hebel/ }));
    await u.click(screen.getByRole("button", { name: "Beweisen" }));
    expect(lauf.antworte).toHaveBeenCalledWith("c1", ["f1"], false);
    expect(await screen.findByText("Daneben")).toBeTruthy();
  });

  it("zeigt komplette Treffer an", async () => {
    const { u } = baue(antwort({ treffer: true, komplett: true, schaden: 10 }));
    await sammle(u);
    await u.click(screen.getByRole("button", { name: /Offene Aufgabe/ }));
    await u.click(screen.getByRole("button", { name: /Zweiseitiger Hebel/ }));
    await u.click(screen.getByRole("button", { name: "Beweisen" }));
    await waitFor(() => expect(screen.getByText(/Treffer!/)).toBeTruthy());
  });

  it("bietet erledigte Challenges nicht an", async () => {
    const { u } = baue();
    await sammle(u);
    await u.click(screen.getByRole("button", { name: /Offene Aufgabe/ }));
    expect(screen.queryByText("Schon erledigt")).toBeNull();
  });
});
