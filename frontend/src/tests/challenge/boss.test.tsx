import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Boss from "@/components/challenge/modi/Boss";
import { SKINS } from "@/components/challenge/modi/boss/figuren";
import { THEMES } from "@/lib/challenge/themes";

const fakt = (id: string, text: string) => ({ id, text, image: null, formula: null, info: null });
const ch = (id: string, text: string, erledigt = false) => ({ id, text, image: null, formula: null, strength: 2, erledigt });
const brett = (o: Record<string, unknown> = {}) => ({
  stufe: 1, etappe: 1, leben: 3, fertig: false, etappen: [], spiel: "boss", deck: null,
  challenges: [ch("c1", "Frage Eins"), ch("c2", "Frage Zwei", true)],
  fakten: [fakt("f1", "Fakt Alpha"), fakt("f2", "Fakt Beta"), fakt("f3", "Fakt Gamma")], ...o,
});
const antwort = (o = {}) => ({ qualitaet: 1, treffer: true, komplett: true, kombo: false, schaden: 20, falsch_gewaehlt: 0, leben: 3,
  zurueck_zur_karte: false, etappe_geschafft: false, fertig: false, stufe: 1, ...o });
const mkLauf = (r = antwort()) => ({ waehle: vi.fn(), gelegt: vi.fn(), antworte: vi.fn().mockResolvedValue(r) });
const zeige = (b: unknown, lauf: ReturnType<typeof mkLauf>, skin = "monster") =>
  render(<Boss brett={b as never} theme={THEMES.klassisch} skin={skin} lauf={lauf as never} zurKarte={vi.fn()} />);

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} }) as never;
});

describe("Boss", () => {
  it("Sammeln: Truhe und Monster geben Fakten ins Inventar", async () => {
    const u = userEvent.setup();
    zeige(brett(), mkLauf());
    await u.click(screen.getByRole("button", { name: "Truhe öffnen" }));
    expect(screen.getByText("Fakt Alpha")).toBeInTheDocument();
    const mon = screen.getByRole("button", { name: /Mini-Monster/ });
    for (let i = 0; i < 5; i++) await u.click(mon);
    expect(screen.getByText("Fakt Gamma")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Zum Kampf" }));
    expect(screen.getByRole("button", { name: /Fakt Gamma/ })).toBeInTheDocument();
  });

  it("Kontern ruft antworte mit den gelegten Fakten und zeigt Daneben", async () => {
    const u = userEvent.setup();
    const lauf = mkLauf(antwort({ treffer: false, komplett: false, schaden: 0 }));
    zeige(brett(), lauf);
    await u.click(screen.getByRole("button", { name: "Alles einsammeln" }));
    expect(screen.getByText("Frage Eins")).toBeInTheDocument();
    expect(screen.queryByText("Frage Zwei")).not.toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: /Fakt Alpha/ }));
    await u.click(screen.getByRole("button", { name: /Fakt Beta/ }));
    await u.click(screen.getByRole("button", { name: "Kontern" }));
    expect(lauf.antworte).toHaveBeenCalledWith("c1", ["f1", "f2"], false);
    expect(await screen.findByText("Daneben")).toBeInTheDocument();
  });

  it("Rap-Skin nennt den Konter »Konter-Line«", async () => {
    const u = userEvent.setup();
    zeige(brett(), mkLauf(), "rap");
    await u.click(screen.getByRole("button", { name: "Alles einsammeln" }));
    expect(screen.getByRole("button", { name: "Konter-Line" })).toBeInTheDocument();
  });
});

describe("Skins", () => {
  it("alle vier Skins haben gleichmäßige Pixelbilder", () => {
    expect(Object.keys(SKINS).sort()).toEqual(["einhorn", "monster", "prinzessin", "rap"]);
    for (const s of Object.values(SKINS)) for (const f of [s.held, s.boss]) {
      expect(new Set(f.bild.map((z) => z.length)).size).toBe(1);
      for (const c of new Set(f.bild.join("").replace(/\./g, ""))) expect(f.palette[c], `${f.name}: ${c}`).toBeDefined();
    }
  });
});
