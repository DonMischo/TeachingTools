import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, within, act, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Boss from "@/components/challenge/modi/Boss";
import Kampf from "@/components/challenge/modi/boss/Kampf";
import { SKINS } from "@/components/challenge/modi/boss/figuren";
import { THEMES } from "@/lib/challenge/themes";
import { baueBossKarte, bossSeed } from "@/lib/challenge/bossKarte";
import { EP_SIEG, anzahlMonster, epBalken, levelVon } from "@/lib/challenge/bossKarte";
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
const mkLauf = (r = antwort()) => ({ deckSetzen: vi.fn().mockResolvedValue(undefined), spielwert: vi.fn(), waehle: vi.fn(), gelegt: vi.fn(), antworte: vi.fn().mockResolvedValue(r) });
const zeige = (b: unknown, lauf: ReturnType<typeof mkLauf>, skin = "monster", zurKarte = vi.fn()) =>
  render(<Boss brett={b as never} theme={THEMES.klassisch} skin={skin} lauf={lauf as never} zurKarte={zurKarte} />);

const ruesteAus = async (u: ReturnType<typeof userEvent.setup>, namen?: RegExp[]) => {
  const reg = screen.getByRole("region", { name: "Ausrüsten" });
  const knoepfe = within(reg).getAllByRole("button").filter((b) => !/In den Kampf/.test(b.textContent ?? "") && !/wegwerfen/.test(b.getAttribute("aria-label") ?? ""));
  for (const k of knoepfe) if (!namen || namen.some((n) => n.test(k.textContent ?? ""))) await u.click(k);
  await u.click(within(reg).getByRole("button", { name: /In den Kampf/ }));
};

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
    await ruesteAus(u);
    await u.click(screen.getByRole("button", { name: "Kontern" }));
    expect(screen.getByRole("button", { name: /^Fakt Gamma$/ })).toBeInTheDocument();
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
    await ruesteAus(u);
    expect(screen.getByText("Frage Eins")).toBeInTheDocument();
    expect(screen.queryByText("Frage Zwei")).not.toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Kontern" }));
    await u.click(screen.getByRole("button", { name: /^Fakt Alpha$/ }));
    await u.click(screen.getByRole("button", { name: /^Fakt Beta$/ }));
    await u.click(screen.getByRole("button", { name: "Kontern" }));
    expect(lauf.antworte).toHaveBeenCalledWith("c1", ["f1", "f2"], false);
    expect(await screen.findByText("Daneben")).toBeInTheDocument();
  });

  it("Rap-Skin nennt den Konter »Konter-Line«", async () => {
    const u = userEvent.setup();
    zeige(brett(), mkLauf(), "rap");
    await u.click(screen.getByRole("button", { name: "Alles einsammeln" }));
    await ruesteAus(u);
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

describe("Kampfmenü", () => {
  const arena = async (b = brett(), lauf = mkLauf(), zurKarte = vi.fn(), skin = "monster") => {
    const u = userEvent.setup();
    zeige(b, lauf, skin, zurKarte);
    await u.click(screen.getByRole("button", { name: "Alles einsammeln" }));
    await ruesteAus(u);
    return u;
  };
  it("hat vier Felder und navigiert mit den Pfeiltasten wie im Game Boy", async () => {
    const u = await arena(brett({ challenges: [ch("c1", "Frage Eins"), ch("c3", "Frage Drei")] }));
    const namen = ["Kontern", "Tasche", "Wechseln", "Flucht"].map((n) => screen.getByRole("button", { name: n }));
    expect(document.activeElement).toBe(namen[0]);
    await u.keyboard("{ArrowRight}"); expect(document.activeElement).toBe(namen[1]);
    await u.keyboard("{ArrowDown}"); expect(document.activeElement).toBe(namen[3]);
    await u.keyboard("{ArrowLeft}"); expect(document.activeElement).toBe(namen[2]);
    await u.keyboard("{ArrowUp}"); expect(document.activeElement).toBe(namen[0]);
  });
  it("Flucht geht zur Karte", async () => {
    const zurKarte = vi.fn();
    const u = await arena(brett(), mkLauf(), zurKarte);
    await u.click(screen.getByRole("button", { name: "Flucht" }));
    expect(zurKarte).toHaveBeenCalled();
  });
  it("Wechseln nimmt den anderen Angriff (nur mit mehreren offenen)", async () => {
    const b = brett({ challenges: [ch("c1", "Frage Eins"), ch("c3", "Frage Drei")] });
    const u = await arena(b);
    await u.click(screen.getByRole("button", { name: "Wechseln" }));
    expect(screen.getByText("Frage Drei")).toBeInTheDocument();
  });
  it("Wechseln ist mit nur einem offenen Angriff gesperrt", async () => {
    await arena();
    expect(screen.getByRole("button", { name: "Wechseln" })).toBeDisabled();
  });
  it("Tasche: Tipp und Wissen nachlesen", async () => {
    const b = brett({ challenges: [{ ...ch("c1", "Frage Eins"), tip: "Denk an Hebel" }], fakten: [{ ...fakt("f1", "Fakt Alpha"), info: { text: "Mehr zu Alpha" } }] });
    const u = await arena(b);
    await u.click(screen.getByRole("button", { name: "Tasche" }));
    expect(screen.getByText(/Mehr zu Alpha/)).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "💡 Tipp benutzen" }));
    expect(screen.getByText(/Denk an Hebel/)).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Zurück" }));
    expect(screen.getByRole("button", { name: "Kontern" })).toBeInTheDocument();
  });
  it("zeigt einen Gegnerzug und wechselt zum Menü zurück, wenn der Kontern vorbei ist", async () => {
    const lauf = mkLauf();
    const u = await arena(brett(), lauf);
    expect(screen.getByText(/^Der Drache /)).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Kontern" }));
    await u.click(screen.getByRole("button", { name: /^Fakt Alpha$/ }));
    await u.click(screen.getByRole("button", { name: "Kontern" }));
    expect(await screen.findByRole("group", { name: "Was tust du?" })).toBeInTheDocument();
  });
});

describe("Held-EP", () => {
  it("Level aus EP", () => {
    expect(levelVon(0)).toBe(1);
    expect(levelVon(9)).toBe(1);
    expect(levelVon(10)).toBe(2);
    expect(levelVon(30)).toBe(3);
    expect(epBalken(15)).toEqual({ level: 2, wert: 5, max: 20 });
    expect(levelVon(EP_SIEG)).toBe(2); // schon der erste Sieg steigt auf
    expect(anzahlMonster(1)).toBe(0);
    expect(anzahlMonster(3)).toBe(1);
  });
  it("Sieg im Klicker-Kampf: EP, Aufstieg und Spielwert »boss«", async () => {
    const u = userEvent.setup();
    const lauf = mkLauf();
    zeige(brett(), lauf);
    await u.click(screen.getByRole("button", { name: "Mini-Monster herausfordern" }));
    const schlag = await screen.findByRole("button", { name: "Angreifen" }, LANG);
    for (let i = 0; i < 5; i++) await u.click(schlag);
    expect(screen.getByText(`Du erhältst ${EP_SIEG} EP!`)).toBeInTheDocument();
    expect(screen.getByText(/steigt auf Level 2 auf/)).toBeInTheDocument();
    await waitFor(() => expect(lauf.spielwert).toHaveBeenCalledWith("boss", 1, EP_SIEG, EP_SIEG), { timeout: 3000 }); // gedrosselt gemeldet
  }, 40000);
});

describe("Ausrüsten und Etappen", () => {
  it("Ausrüsten setzt das Deck, im Kampf liegen nur die gewählten Fakten", async () => {
    const u = userEvent.setup();
    const lauf = mkLauf();
    zeige(brett(), lauf);
    await u.click(screen.getByRole("button", { name: "Alles einsammeln" }));
    expect(screen.getByRole("button", { name: /In den Kampf/ })).toBeDisabled();
    await ruesteAus(u, [/Alpha/, /Gamma/]);
    expect(lauf.deckSetzen).toHaveBeenCalledWith(["f1", "f3"]);
    await u.click(screen.getByRole("button", { name: "Kontern" }));
    expect(screen.getByRole("button", { name: /^Fakt Alpha$/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Fakt Gamma$/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Fakt Beta$/ })).not.toBeInTheDocument();
  });
  it("mit gesetztem Deck geht es direkt in den Kampf; Etappenanzeige", () => {
    zeige(brett({ deck: ["f2"], geschafft_etappen: 1, gesamt_etappen: 3 }), mkLauf());
    expect(screen.queryByRole("region", { name: "Ausrüsten" })).not.toBeInTheDocument();
    expect(screen.getByText(/Etappe 2 von 3/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kontern" })).toBeInTheDocument();
  });
  it("Etappe geschafft zeigt den Übergang", async () => {
    const u = userEvent.setup();
    zeige(brett({ deck: ["f1"] }), mkLauf(antwort({ etappe_geschafft: true })));
    await u.click(screen.getByRole("button", { name: "Kontern" }));
    await u.click(screen.getByRole("button", { name: /^Fakt Alpha$/ }));
    await u.click(screen.getByRole("button", { name: "Kontern" }));
    expect(await screen.findByText(/der Drache flieht tiefer ins Verlies/)).toBeInTheDocument();
  });
});

describe("Mini-Monster schlägt zurück", () => {
  const start = async (reduziert = false) => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: reduziert, addEventListener() {}, removeEventListener() {} }) as never;
    vi.useFakeTimers();
    const u = { click: async (el: Element) => { await act(async () => { fireEvent.click(el); }); } };
    const fn = { onSieg: vi.fn(), onEnde: vi.fn(), onVerloren: vi.fn() };
    render(<Kampf theme={THEMES.klassisch} fakten={[fakt("f1", "Fakt Alpha")]} {...fn} />);
    if (!screen.queryByRole("button", { name: "Angreifen" })) await u.click(screen.getByText("Klicken zum Überspringen"));
    return { u, fn };
  };
  const kp = () => Number(screen.getByRole("progressbar", { name: "Lebenspunkte des Helden" }).getAttribute("aria-valuenow"));
  const zeit = (ms: number) => act(async () => { vi.advanceTimersByTime(ms); });
  afterEach(() => vi.useRealTimers());

  it("Angriffe kosten KP; bei 0 KP gibt es die Rückkehr zur Karte", async () => {
    const { u, fn } = await start();
    expect(kp()).toBe(30);
    await zeit(4100);
    expect(kp()).toBe(25);
    await zeit(6 * 2500);
    expect(screen.getByText("Du wurdest zurückgedrängt.")).toBeInTheDocument();
    expect(kp()).toBe(0);
    expect(screen.queryByRole("button", { name: "Angreifen" })).not.toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Zurück zur Karte" }));
    expect(fn.onVerloren).toHaveBeenCalled();
    expect(fn.onSieg).not.toHaveBeenCalled();
  });
  it("schnelles Klicken gewinnt ohne Schaden", async () => {
    const { u, fn } = await start();
    for (let i = 0; i < 5; i++) await u.click(screen.getByRole("button", { name: "Angreifen" }));
    expect(fn.onSieg).toHaveBeenCalled();
    expect(kp()).toBe(30);
  });
  it("Klick während der Ankündigung pariert", async () => {
    const { u } = await start();
    await zeit(3700);
    expect(screen.getByText("Der Holzklotz holt aus!")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Angreifen" }));
    await zeit(600);
    expect(kp()).toBe(30);
  });
  it("Bei reduzierter Bewegung kommt der erste Schlag später", async () => {
    await start(true);
    await zeit(3000);
    expect(kp()).toBe(30);
  });
});
