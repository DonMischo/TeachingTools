import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Bestenliste from "@/components/challenge/Bestenliste";
import Huepfen from "@/components/challenge/modi/Huepfen";
import { themeVon } from "@/lib/challenge/themes";

const zeilen = [
  { platz: 1, name: "Ben", edelsteine: 9, max: 20, ich: false },
  { platz: 2, name: "Anna", edelsteine: 5, max: 20, ich: true },
];

describe("Bestenliste", () => {
  it("zeigt Platz, Name, Edelsteine und hebt die eigene Zeile hervor", async () => {
    render(<Bestenliste laden={vi.fn().mockResolvedValue(zeilen)} />);
    expect(await screen.findByText("Ben")).toBeTruthy();
    expect(screen.getByText("Anna (du)").closest("tr")?.getAttribute("aria-current")).toBe("true");
    expect(screen.getByText("9/20")).toBeTruthy();
  });
  it("leere Liste", async () => {
    render(<Bestenliste laden={vi.fn().mockResolvedValue([])} />);
    expect(await screen.findByText(/Noch keine Edelsteine/)).toBeTruthy();
  });
  it("Hüpfen: Knopf nur mit Bestenliste, öffnet das Panel", async () => {
    window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as any;
    const brett: any = { stufe: 2, etappe: 1, leben: 3, fertig: false, spiel: "huepfen", deck: null, etappen: [],
      challenges: [{ id: "c1", text: "T", image: null, formula: null, strength: 1, erledigt: false }],
      fakten: [{ id: "f1", text: "F", image: null, formula: null, info: null }] };
    const lauf: any = { waehle: vi.fn(), gelegt: vi.fn(), antworte: vi.fn(), hatBestenliste: true, bestenliste: vi.fn().mockResolvedValue(zeilen), spielwert: vi.fn() };
    render(<Huepfen brett={brett} theme={themeVon("klassisch")} skin="" lauf={lauf} zurKarte={() => {}} />);
    await userEvent.setup().click(screen.getByRole("button", { name: /Bestenliste/ }));
    expect(await screen.findByText("Ben")).toBeTruthy();
    expect(lauf.bestenliste).toHaveBeenCalledWith("huepfen");
  });
});
