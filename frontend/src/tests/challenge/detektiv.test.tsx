import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { themeVon } from "@/lib/challenge/themes";
import Modus from "@/components/challenge/modi/Detektiv";

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} }) as never;
});

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
  const lauf = { waehle: vi.fn(), gelegt: vi.fn(), antworte: vi.fn().mockResolvedValue(a), deckSetzen: vi.fn(), spielWechseln: vi.fn(), spielwert: vi.fn(), hatBestenliste: false };
  const ui = render(<Modus brett={brett as never} theme={themeVon("wald")} skin="monster" lauf={lauf as never} zurKarte={() => {}} />);
  return { lauf, ui, u: userEvent.setup() };
};

async function sammle(u: ReturnType<typeof userEvent.setup>) {
  await u.click(screen.getByRole("button", { name: "🔦 Zum Tatort" }));
  await u.click(screen.getByRole("button", { name: "Alles einsammeln" }));
  await u.click(screen.getByRole("button", { name: "Zur Ermittlungswand" }));
}
const vorlegen = async (u: ReturnType<typeof userEvent.setup>) => {
  await u.click(screen.getByRole("button", { name: /Offene Aufgabe/ }));
  await u.click(screen.getByRole("button", { name: "Spur anheften: Zweiseitiger Hebel" }));
  await u.click(screen.getByRole("button", { name: "Beweis vorlegen" }));
};

describe("Detektiv", () => {
  it("beginnt mit der Fallakte: Fallname aus der Etappe, Beteiligte mit Foto", () => {
    baue();
    const akte = screen.getByRole("group", { name: "Fallakte" });
    expect(akte.textContent).toContain("Fall: »Der Hebel«");
    expect(akte.textContent).toMatch(/2 Spuren/);
    expect(screen.getByRole("group", { name: "Beteiligte" }).querySelectorAll("figure")).toHaveLength(2);
  });

  it("Tatort ist dunkel: die Taschenlampe leuchtet, die Minikarte verrät keine Spuren", async () => {
    const { u, ui } = baue();
    await u.click(screen.getByRole("button", { name: "🔦 Zum Tatort" }));
    expect(ui.container.querySelector("[data-licht]")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Verdächtige Stelle untersuchen" }).length).toBeGreaterThanOrEqual(4); // 2 Spuren + 2 leere Stellen
  });

  it("heftet Beweise an die Aussage, legt vor und wertet; falsch: der Verdächtige grinst", async () => {
    const { lauf, u } = baue();
    await sammle(u);
    await vorlegen(u);
    expect(lauf.antworte).toHaveBeenCalledWith("c1", ["f1"], false);
    expect(await screen.findByText("Daneben")).toBeTruthy();
    expect(screen.getByText(/Beweisen Sie das erst mal!/)).toBeTruthy();
  });

  it("widerlegte Aussage: Stempel und rote Fäden zu den Beweisen, dann FALL GELÖST", async () => {
    const { u } = baue(antwort({ treffer: true, komplett: true, schaden: 10 }));
    await sammle(u);
    await vorlegen(u);
    await waitFor(() => expect(screen.getByText(/Treffer!/)).toBeTruthy());
    expect(screen.getAllByText("WIDERLEGT")).toHaveLength(2); // c2 war schon erledigt
    expect(screen.getByText("FALL GELÖST!")).toBeTruthy();
  });

  it("erledigte Aussagen lassen sich nicht wählen", async () => {
    const { u } = baue();
    await sammle(u);
    expect((screen.getByRole("button", { name: /Schon erledigt/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("meldet den Spielwert beim Abbau", async () => {
    const { lauf, u, ui } = baue();
    await u.click(screen.getByRole("button", { name: "🔦 Zum Tatort" }));
    await u.click(screen.getByRole("button", { name: "Alles einsammeln" }));
    ui.unmount();
    expect(lauf.spielwert).toHaveBeenCalledWith("detektiv", 1, 2, 2);
  });
});
