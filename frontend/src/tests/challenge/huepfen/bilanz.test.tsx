import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Huepfen from "@/components/challenge/modi/Huepfen";
import { themeVon } from "@/lib/challenge/themes";

const brett = {
  stufe: 2, etappe: 1, leben: 3, fertig: false, spiel: "huepfen", deck: null, etappen: [],
  challenges: [{ id: "c1", text: "Frage", image: null, formula: null, strength: 1, erledigt: false }],
  fakten: [{ id: "f1", text: "Fakt", image: null, formula: null, info: null }],
};
beforeEach(() => {
  window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as any;
});

describe("Hüpfen: Etappenbilanz und Fahnen", () => {
  it("An der Tür steht die Bilanz mit Sternen; Fahnen sind sichtbar, die Startfahne ist oben", async () => {
    const lauf: any = { waehle: vi.fn(), gelegt: vi.fn(), antworte: vi.fn(), spielwert: vi.fn() };
    const { container } = render(<Huepfen brett={brett as any} theme={themeVon("klassisch")} skin="" lauf={lauf} zurKarte={() => {}} />);
    expect(container.querySelector('[data-fahne="oben"]')).toBeTruthy();
    expect(container.querySelector('[data-fahne="unten"]')).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: /Tür: Frage/ }));
    const b = screen.getByLabelText("Etappenbilanz");
    expect(b.textContent).toMatch(/💎 0\/\d+/);
    expect(b.textContent).toContain("☆☆☆");
  });
});
