import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Boss from "@/components/challenge/modi/Boss";
import { SKINS } from "@/components/challenge/modi/boss/figuren";
import { THEMES } from "@/lib/challenge/themes";
import { baueBossKarte, bossSeed } from "@/lib/challenge/bossKarte";
import { begehbar, weg } from "@/lib/gebaeude/plan";

const LANG = { timeout: 15000 };
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
  it("Sammeln: Truhe betreten, Mini-Monster im Klicker-Kampf besiegen, Fakten ins Inventar", async () => {
    const u = userEvent.setup();
    zeige(brett(), mkLauf());
    await u.click(screen.getByRole("button", { name: "Truhe öffnen" }));
    expect(await screen.findByText("Fakt Alpha", {}, LANG)).toBeInTheDocument();
    expect(screen.getByText("Fakt Beta")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "OK" }));
    await u.click(screen.getByRole("button", { name: "Mini-Monster herausfordern" }));
    expect(await screen.findByText("Was tust du?", {}, LANG)).toBeInTheDocument();
    const schlag = screen.getByRole("button", { name: "Angreifen" });
    for (let i = 0; i < 4; i++) await u.click(schlag);
    expect(screen.queryByText("Fakt Gamma")).not.toBeInTheDocument();
    await u.click(schlag);
    expect(screen.getByText("Fakt Gamma")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Weiter" }));
    await u.click(screen.getByRole("button", { name: "Zum Kampf" }));
    expect(screen.getByRole("button", { name: /Fakt Gamma/ })).toBeInTheDocument();
  }, 40000);

  it("Kampfstart: mit reduzierter Bewegung ohne Übergang, sonst mit Text und Klick zum Überspringen", async () => {
    const u = userEvent.setup();
    const { unmount } = zeige(brett(), mkLauf());
    await u.click(screen.getByRole("button", { name: "Mini-Monster herausfordern" }));
    await screen.findByRole("button", { name: "Angreifen" }, LANG);
    expect(screen.queryByText("Ein wilder Holzklotz erscheint!")).not.toBeInTheDocument();
    unmount();

    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as never;
    zeige(brett(), mkLauf());
    await u.click(screen.getByRole("button", { name: "Mini-Monster herausfordern" }));
    expect(await screen.findByText("Ein wilder Holzklotz erscheint!", {}, LANG)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Angreifen" })).not.toBeInTheDocument();
    await u.click(screen.getByText("Klicken zum Überspringen"));
    expect(screen.getByRole("button", { name: "Angreifen" })).toBeInTheDocument();
  }, 40000);

  it("Arena beginnt mit dem Übergang des Skins", async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener() {}, removeEventListener() {} }) as never;
    const u = userEvent.setup();
    zeige(brett({ fakten: [] }), mkLauf(), "rap");
    expect(screen.getByText("Battle! Der Gegner greift zum Mikro!")).toBeInTheDocument();
    await u.click(screen.getByText("Klicken zum Überspringen"));
    expect(screen.getByText("Frage Eins")).toBeInTheDocument();
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

describe("Bosskarte", () => {
  it("ist je Seed gleich und jede Truhe/jedes Monster ist vom Start erreichbar", () => {
    for (const n of [1, 3, 6, 11]) for (const seed of [1001, 2003, 5006]) {
      const a = baueBossKarte(seed, n), b = baueBossKarte(seed, n);
      expect(b).toEqual(a);
      expect(a.objekte.length).toBe(Math.ceil(n / 2));
      expect(a.objekte.flatMap((o) => o.faktIdx).sort((x, y) => x - y)).toEqual(Array.from({ length: n }, (_, i) => i));
      for (const o of a.objekte) expect(weg(a.R, a.st, a.start, [o.x, o.y]).length).toBeGreaterThan(0);
    }
  });
});

describe("Spielfigur", () => {
  it("macht mit den Pfeiltasten Schritte auf der Karte, nie in die Wand", async () => {
    const u = userEvent.setup();
    zeige(brett(), mkLauf());
    const k = baueBossKarte(bossSeed(1, 3), 3);
    const figur = screen.getByRole("img", { name: "Spielfigur" });
    expect(figur.dataset.feld).toBe(k.start.join(","));
    const keys: [string, [number, number]][] = [["{ArrowRight}", [1, 0]], ["{ArrowLeft}", [-1, 0]], ["{ArrowDown}", [0, 1]], ["{ArrowUp}", [0, -1]]];
    const [taste, [dx, dy]] = keys.find(([, [x, y]]) => begehbar(k.R, k.st, [k.start[0] + x, k.start[1] + y]))!;
    await u.keyboard(taste);
    expect(figur.dataset.feld).toBe(`${k.start[0] + dx},${k.start[1] + dy}`);
    const wand = keys.find(([, [x, y]]) => !begehbar(k.R, k.st, [k.start[0] + dx + x, k.start[1] + dy + y]));
    if (wand) { await u.keyboard(wand[0]); expect(figur.dataset.feld).toBe(`${k.start[0] + dx},${k.start[1] + dy}`); }
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
