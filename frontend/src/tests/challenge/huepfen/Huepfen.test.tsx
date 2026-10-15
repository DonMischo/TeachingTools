import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Huepfen from "@/components/challenge/modi/Huepfen";
import { themeVon } from "@/lib/challenge/themes";

const antwort = (extra = {}) => ({
  qualitaet: 0, treffer: false, komplett: false, kombo: false, schaden: 0, falsch_gewaehlt: 1,
  leben: 2, zurueck_zur_karte: false, etappe_geschafft: false, fertig: false, stufe: 2, ...extra,
});
const brett = () => ({
  stufe: 2, etappe: 1, leben: 3, fertig: false, spiel: "huepfen", deck: null,
  etappen: [{ nr: 1, titel: "E", erledigt: false }],
  challenges: [
    { id: "c1", text: "Was ist eine Wippe?", image: null, formula: null, strength: 1, erledigt: false },
    { id: "c2", text: "Schon geschafft", image: null, formula: null, strength: 1, erledigt: true },
  ],
  fakten: [
    { id: "f1", text: "Zweiseitiger Hebel", image: null, formula: null, info: null },
    { id: "x1", text: "Ein Hebel erzeugt Energie", image: null, formula: null, info: null },
  ],
});
let lauf: any;
function zeige() {
  lauf = { waehle: vi.fn(), gelegt: vi.fn(), antworte: vi.fn().mockResolvedValue(antwort()) };
  return render(<Huepfen brett={brett() as any} theme={themeVon("klassisch")} skin="" lauf={lauf} zurKarte={() => {}} />);
}

beforeEach(() => {
  window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as any;
});

describe("Huepfen", () => {
  it("sammelt per »Alles einsammeln« ins Inventar", async () => {
    const u = userEvent.setup();
    zeige();
    expect(screen.queryByText("Zweiseitiger Hebel")).toBeNull();
    await u.click(screen.getByRole("button", { name: "Alles einsammeln" }));
    expect(screen.getByText("Zweiseitiger Hebel")).toBeTruthy();
  });
  it("schließt auf: antworte(id, [faktIds], false) und zeigt Daneben", async () => {
    const u = userEvent.setup();
    zeige();
    await u.click(screen.getByRole("button", { name: "Alles einsammeln" }));
    await u.click(screen.getByRole("button", { name: /Tür: Was ist eine Wippe/ }));
    await u.click(screen.getByText("Zweiseitiger Hebel"));
    await u.click(screen.getByRole("button", { name: "Aufschließen" }));
    await waitFor(() => expect(lauf.antworte).toHaveBeenCalledWith("c1", ["f1"], false));
    expect(await screen.findByText("Daneben")).toBeTruthy();
  });
  it("ein vollständig beantwortetes Tor geht auf, ein unvollständiges bleibt zu", async () => {
    const u = userEvent.setup();
    const { container } = zeige();
    expect(container.querySelectorAll('[data-tor="zu"]')).toHaveLength(1);
    await u.click(screen.getByRole("button", { name: "Alles einsammeln" }));
    await u.click(screen.getByRole("button", { name: /Tür: Was ist eine Wippe/ }));
    await u.click(screen.getByText("Zweiseitiger Hebel"));
    await u.click(screen.getByRole("button", { name: "Aufschließen" }));
    await screen.findByText("Daneben");
    expect(container.querySelectorAll('[data-tor="zu"]')).toHaveLength(1);
    lauf.antworte.mockResolvedValue(antwort({ komplett: true, treffer: true }));
    await u.click(screen.getByRole("button", { name: /Tür: Was ist eine Wippe/ }));
    await u.click(screen.getByText("Zweiseitiger Hebel"));
    await u.click(screen.getByRole("button", { name: "Aufschließen" }));
    await waitFor(() => expect(container.querySelectorAll('[data-tor="zu"]')).toHaveLength(0));
    expect(container.querySelectorAll('[data-tor="offen"]').length).toBeGreaterThanOrEqual(1);
  });
  it("bietet erledigte Challenges nicht an", () => {
    zeige();
    expect(screen.queryByRole("button", { name: /Schon geschafft/ })).toBeNull();
  });
});
