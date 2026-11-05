import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Normal from "@/components/challenge/modi/Normal";
import { THEMES } from "@/lib/challenge/themes";

const fakt = (id: string, text: string) => ({ id, text, image: null, formula: null, info: null });
const ch = (id: string, text: string, erledigt = false) => ({ id, text, image: null, formula: null, strength: 2, erledigt });
const brett = (challenges = [ch("c1", "Frage Eins"), ch("c2", "Frage Zwei", true)]) => ({
  stufe: 1, etappe: 1, leben: 3, fertig: false, etappen: [], spiel: "normal", deck: null, challenges,
  fakten: [fakt("f1", "Fakt Alpha"), fakt("f2", "Fakt Beta")],
});
const antwort = (komplett: boolean) => ({ qualitaet: 0, treffer: komplett, komplett, kombo: false, schaden: 0, falsch_gewaehlt: 0, leben: 3,
  zurueck_zur_karte: false, etappe_geschafft: false, fertig: false, stufe: 1 });
const mkLauf = (komplett: boolean) => ({ waehle: vi.fn(), gelegt: vi.fn(), antworte: vi.fn().mockResolvedValue(antwort(komplett)) });

describe("Normal", () => {
  it("trennt Fragen und Fakten in eigene Rahmen; gelöste Fragen sind grün", () => {
    render(<Normal brett={brett() as never} theme={THEMES.klassisch} skin="monster" lauf={mkLauf(true) as never} zurKarte={() => {}} />);
    const fragen = screen.getByRole("region", { name: "Fragen" });
    expect(within(fragen).getByText("1/2 gelöst", { exact: false })).toBeInTheDocument();
    expect(within(fragen).getByRole("button", { name: /Frage Zwei/ })).toHaveAttribute("data-zustand", "geloest");
    expect(within(screen.getByRole("region", { name: "Fakten" })).getByRole("button", { name: "Fakt Alpha" })).toBeInTheDocument();
    expect(within(fragen).getByRole("button", { name: /Frage Eins/ }).querySelector("[data-frage]")).not.toBeNull(); // hervorgehobene Frage
  });

  it("zeigt an jeder Frage, wie viele Fakten nötig sind", () => {
    const b = brett([{ ...ch("c1", "Frage Eins"), noetig: 2 }, { ...ch("c2", "Frage Zwei"), noetig: 1 }] as never);
    render(<Normal brett={b as never} theme={THEMES.klassisch} skin="monster" lauf={mkLauf(true) as never} zurKarte={() => {}} />);
    expect(screen.getByLabelText("2 Fakten nötig")).toHaveTextContent("🃏🃏");
    expect(screen.getByLabelText("1 Fakt nötig")).toHaveTextContent("🃏");
  });

  it("falsch beantwortete Frage wird rot markiert", async () => {
    const u = userEvent.setup();
    render(<Normal brett={brett() as never} theme={THEMES.klassisch} skin="monster" lauf={mkLauf(false) as never} zurKarte={() => {}} />);
    await u.click(screen.getByRole("button", { name: /Frage Eins/ }));
    await u.click(screen.getByRole("button", { name: "Fakt Alpha" }));
    await u.click(screen.getByRole("button", { name: "Angreifen" }));
    expect(await screen.findByRole("button", { name: /Falsch beantwortet:\s*Frage Eins/ })).toHaveAttribute("data-zustand", "falsch");
  });
});
