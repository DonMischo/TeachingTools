import { describe, it, expect, vi, beforeEach } from "vitest";
import { configure, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Bruecke from "@/components/challenge/modi/Bruecke";
import { THEMES } from "@/lib/challenge/themes";
import { ausgang, durchhang, kameraX, karren, lueckeX, sterne, weltBreite } from "@/lib/challenge/brueckeSpiel";

// Laufen und Animationen brauchen unter Last (ganze Suite parallel) länger als 1 s.
configure({ asyncUtilTimeout: 8000 });

const brett = {
  stufe: 2, etappe: 1, leben: 3, fertig: false, spiel: "bruecke", deck: null, etappen: [],
  challenges: [
    { id: "c1", text: "Frage eins", image: null, formula: null, strength: 1, erledigt: false },
    { id: "c2", text: "Frage zwei", image: null, formula: null, strength: 1, erledigt: true },
    { id: "c3", text: "Frage drei", image: null, formula: null, strength: 1, erledigt: false },
  ],
  fakten: [
    { id: "f1", text: "Fakt eins", image: null, formula: null, info: { text: "Merke", source: undefined } },
    { id: "x1", text: "Fakt zwei", image: null, formula: null, info: null },
  ],
};
const antw = (e = {}) => ({ qualitaet: 0, treffer: false, komplett: false, kombo: false, schaden: 0, falsch_gewaehlt: 1, leben: 2, zurueck_zur_karte: false, etappe_geschafft: false, fertig: false, stufe: 2, ...e });
const mk = (r = antw()) => ({ waehle: vi.fn(), gelegt: vi.fn(), antworte: vi.fn().mockResolvedValue(r), deckSetzen: vi.fn(), spielwert: vi.fn(), hatBestenliste: false });
const zeige = (lauf: ReturnType<typeof mk>) => render(<Bruecke brett={brett as any} theme={THEMES.klassisch} skin="monster" lauf={lauf as any} zurKarte={() => {}} />);

beforeEach(() => { window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} }) as never; });

async function sammle(u: ReturnType<typeof userEvent.setup>) {
  await u.click(screen.getByRole("button", { name: "Alles einsammeln" }));
}

describe("Bruecke-Geometrie", () => {
  it("Lücken, Kamera, Sterne, Ausgang", () => {
    expect(lueckeX(1)).toBe(lueckeX(0) + 50);
    expect(kameraX(0, 3)).toBeGreaterThanOrEqual(0);
    expect(kameraX(2, 3)).toBeLessThanOrEqual(weltBreite(3));
    expect(sterne(0)).toBe(3); expect(sterne(2)).toBe(2); expect(sterne(9)).toBe(1);
    expect(ausgang({ treffer: true, komplett: true })).toBe("haelt");
    expect(ausgang({ treffer: true, komplett: false })).toBe("biegt");
    expect(ausgang({ treffer: false, komplett: false })).toBe("bricht");
    expect(durchhang("biegt", 0.4)).toBeGreaterThan(durchhang("haelt", 0.4));
    expect(karren("bricht", 1).fall).toBeGreaterThan(0);
    expect(karren("haelt", 1).fall).toBe(0);
  });
});

describe("Bruecke", () => {
  it("sammelt im Wald, legt Bretter, Testfahrt zeigt Daneben", async () => {
    const lauf = mk(); const u = userEvent.setup();
    zeige(lauf);
    await sammle(u);
    expect(screen.queryByText("Frage zwei")).toBeNull();
    expect(screen.getByText("Frage eins")).toBeTruthy();
    await u.click(screen.getByText("Fakt eins"));
    expect(lauf.gelegt).toHaveBeenCalled();
    await u.click(screen.getByRole("button", { name: "Testfahrt" }));
    await waitFor(() => expect(lauf.antworte).toHaveBeenCalledWith("c1", ["f1"], false));
    expect(await screen.findByText("Daneben")).toBeTruthy();
  });

  it("findet Bretter im Wald-Labyrinth", async () => {
    const lauf = mk(); const u = userEvent.setup();
    zeige(lauf);
    await u.click(screen.getAllByRole("button", { name: "Brett aufheben" })[0]);
    expect(await screen.findByText("Gefunden!", {}, { timeout: 15000 })).toBeTruthy();
  }, 20000);

  it("mehrere Lücken: nach einer haltenden Brücke geht es zur nächsten, Sterne werden gemeldet", async () => {
    const lauf = mk(antw({ treffer: true, komplett: true }));
    const u = userEvent.setup();
    zeige(lauf);
    await sammle(u);
    await u.click(screen.getByText("Fakt eins"));
    await u.click(screen.getByRole("button", { name: "Testfahrt" }));
    await screen.findByText(/Treffer!/);
    expect(await screen.findByText("Frage drei", {}, { timeout: 3000 })).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Fakt zwei").closest("button")!.disabled).toBe(false), { timeout: 3000 });
    await u.click(screen.getByText("Fakt zwei"));
    await u.click(screen.getByRole("button", { name: "Testfahrt" }));
    await waitFor(() => expect(lauf.spielwert).toHaveBeenCalledWith("bruecke", 1, 3, 3));
  });
});
