import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Alchemie from "@/components/challenge/modi/Alchemie";
import { THEMES } from "@/lib/challenge/themes";

const fakt = (id: string, text: string) => ({ id, text, image: null, formula: null, info: null });
const ch = (id: string, text: string, erledigt = false) => ({ id, text, image: null, formula: null, strength: 2, erledigt });
const brett = {
  stufe: 1, etappe: 1, leben: 3, fertig: false, etappen: [], spiel: "alchemie", deck: null,
  challenges: [ch("c1", "Rezept Eins"), ch("c2", "Rezept Zwei", true)],
  fakten: [fakt("f1", "Zutat Alpha"), fakt("f2", "Zutat Beta")],
};
const antwort = (o = {}) => ({ qualitaet: 1, treffer: true, komplett: true, kombo: false, schaden: 20, falsch_gewaehlt: 0, leben: 3,
  zurueck_zur_karte: false, etappe_geschafft: false, fertig: false, stufe: 1, ...o });
const mkLauf = (r = antwort()) => ({ waehle: vi.fn(), gelegt: vi.fn(), antworte: vi.fn().mockResolvedValue(r) });
const zeige = (lauf: ReturnType<typeof mkLauf>) =>
  render(<Alchemie brett={brett as never} theme={THEMES.klassisch} skin="" lauf={lauf as never} zurKarte={vi.fn()} />);

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as never;
});

describe("Alchemie", () => {
  it("Pflücken legt Zutaten ins Regal", async () => {
    const u = userEvent.setup();
    zeige(mkLauf());
    const buesche = screen.getAllByRole("button", { name: "Busch pflücken" });
    await u.click(buesche[0]);
    expect(screen.getByText("Zutat Alpha")).toBeInTheDocument();
    await u.click(screen.getAllByRole("button", { name: "Busch pflücken" })[0]);
    await u.click(screen.getByRole("button", { name: "In die Küche" }));
    expect(screen.getByRole("button", { name: /Zutat Beta/ })).toBeInTheDocument();
  });

  it("Brauen ruft antworte; erledigte Rezepte werden nicht angeboten", async () => {
    const u = userEvent.setup();
    const lauf = mkLauf();
    zeige(lauf);
    for (const b of screen.getAllByRole("button", { name: "Busch pflücken" })) await u.click(b);
    await u.click(screen.getByRole("button", { name: "In die Küche" }));
    expect(screen.getByText("Rezept Eins")).toBeInTheDocument();
    expect(screen.queryByText("Rezept Zwei")).not.toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: /Zutat Alpha/ }));
    await u.click(screen.getByRole("button", { name: "Brauen" }));
    expect(lauf.antworte).toHaveBeenCalledWith("c1", ["f1"], false);
    expect(await screen.findByText("Der Trank leuchtet!")).toBeInTheDocument();
  });

  it("Daneben zeigt die Puff-Wolke", async () => {
    const u = userEvent.setup();
    zeige(mkLauf(antwort({ treffer: false, komplett: false, schaden: 0 })));
    for (const b of screen.getAllByRole("button", { name: "Busch pflücken" })) await u.click(b);
    await u.click(screen.getByRole("button", { name: "In die Küche" }));
    await u.click(screen.getByRole("button", { name: /Zutat Alpha/ }));
    await u.click(screen.getByRole("button", { name: "Brauen" }));
    expect(await screen.findByText("Puff! Daneben.")).toBeInTheDocument();
    expect(screen.getByText("Daneben")).toBeInTheDocument();
  });
});
