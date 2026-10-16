import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Alchemie from "@/components/challenge/modi/Alchemie";
import { THEMES } from "@/lib/challenge/themes";

// Erkunden durch klickbare Objekte ersetzen: Betreten = Klick
vi.mock("@/components/challenge/pixel/Erkunden", () => ({
  default: ({ objekte, onBetreten }: { objekte: { id: string; label?: string }[]; onBetreten(id: string): void }) => (
    <div>{objekte.map((o) => <button key={o.id} onClick={() => onBetreten(o.id)}>{o.label}</button>)}</div>
  ),
}));

const fakt = (id: string, text: string) => ({ id, text, image: null, formula: null, info: null });
const ch = (id: string, text: string, erledigt = false) => ({ id, text, image: null, formula: null, strength: 2, erledigt });
const brett = {
  stufe: 1, etappe: 1, leben: 3, fertig: false, etappen: [], spiel: "alchemie", deck: null,
  challenges: [ch("c1", "Rezept Eins"), ch("c2", "Rezept Zwei", true)],
  fakten: [fakt("f1", "Zutat Alpha"), fakt("f2", "Zutat Beta")],
};
const antwort = (o = {}) => ({ qualitaet: 1, treffer: true, komplett: true, kombo: false, schaden: 20, falsch_gewaehlt: 0, leben: 3,
  zurueck_zur_karte: false, etappe_geschafft: false, fertig: false, stufe: 1, ...o });
const mkLauf = (r = antwort()) => ({ waehle: vi.fn(), gelegt: vi.fn(), antworte: vi.fn().mockResolvedValue(r), spielwert: vi.fn().mockResolvedValue({ gesamt: 0, max: 0 }) });
const zeige = (lauf: ReturnType<typeof mkLauf>) =>
  render(<Alchemie brett={brett as never} theme={THEMES.klassisch} skin="" lauf={lauf as never} zurKarte={vi.fn()} />);

async function inDenLaden(u: ReturnType<typeof userEvent.setup>) {
  for (const b of screen.getAllByRole("button", { name: /pflücken/ })) await u.click(b);
  await u.click(screen.getByRole("button", { name: "OK" }));
  await u.click(screen.getByRole("button", { name: "In den Laden" }));
}

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as never;
});

describe("Alchemie", () => {
  it("Pflücken im Labyrinth zeigt den Fakt und legt Zutaten ins Regal", async () => {
    const u = userEvent.setup();
    zeige(mkLauf());
    await u.click(screen.getAllByRole("button", { name: /pflücken/ })[0]);
    expect(screen.getByText("Zutat Alpha")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "OK" }));
    await u.click(screen.getAllByRole("button", { name: /pflücken/ })[0]);
    await u.click(screen.getByRole("button", { name: "OK" }));
    await u.click(screen.getByRole("button", { name: "In den Laden" }));
    expect(screen.getByRole("button", { name: /^Zutat Beta$/ })).toBeInTheDocument();
  });

  it("Abfüllen ruft antworte; Kunde bestellt nur offene Rezepte; Gold wird gemeldet", async () => {
    const u = userEvent.setup();
    const lauf = mkLauf();
    zeige(lauf);
    await inDenLaden(u);
    expect(screen.getByText("Rezept Eins")).toBeInTheDocument();
    expect(screen.queryByText("Rezept Zwei")).not.toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: /^Zutat Alpha$/ }));
    await u.click(screen.getByRole("button", { name: "Abfüllen" }));
    expect(lauf.antworte).toHaveBeenCalledWith("c1", ["f1"], false);
    expect(await screen.findByText("Der Kunde ist begeistert!")).toBeInTheDocument();
    expect(screen.getByText(/🪙 20/)).toBeInTheDocument();
    expect(screen.getByLabelText("Trankregal")).toHaveTextContent("(1)");
  });

  it("Kombo ergibt einen seltenen Glitzertrank", async () => {
    const u = userEvent.setup();
    zeige(mkLauf(antwort({ kombo: true })));
    await inDenLaden(u);
    await u.click(screen.getByRole("button", { name: /^Zutat Alpha$/ }));
    await u.click(screen.getByRole("button", { name: "Abfüllen" }));
    expect(await screen.findByText(/Glitzertrank/)).toBeInTheDocument();
  });

  it("Rühren ändert nur die Farbe, Daneben lässt den Kessel überlaufen", async () => {
    const u = userEvent.setup();
    zeige(mkLauf(antwort({ treffer: false, komplett: false, schaden: 0 })));
    await inDenLaden(u);
    fireEvent.click(screen.getByRole("button", { name: /Umrühren/ }));
    await u.click(screen.getByRole("button", { name: /^Zutat Alpha$/ }));
    await u.click(screen.getByRole("button", { name: "Abfüllen" }));
    expect(await screen.findByText(/Kessel läuft über/)).toBeInTheDocument();
    expect(screen.getByLabelText("Trankregal")).toHaveTextContent("(0)");
  });
});
