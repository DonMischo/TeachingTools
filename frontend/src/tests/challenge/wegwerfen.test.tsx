import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, renderHook, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useAblage } from "@/lib/challenge/useAblage";
import Fundkarte from "@/components/challenge/Fundkarte";
import { THEMES, themeVon } from "@/lib/challenge/themes";
import Boss from "@/components/challenge/modi/Boss";
import Detektiv from "@/components/challenge/modi/Detektiv";
import Gericht from "@/components/challenge/modi/Gericht";
import Huepfen from "@/components/challenge/modi/Huepfen";

beforeEach(() => {
  window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as never;
});

const fakt = (id: string, text: string) => ({ id, text, image: null, formula: null, info: null });
const brett = (spiel: string) => ({
  stufe: 2, etappe: 1, leben: 3, fertig: false, spiel, deck: null,
  etappen: [{ nr: 1, titel: "E", erledigt: false }],
  challenges: [{ id: "c1", text: "Offene Aufgabe", image: null, formula: null, strength: 1, erledigt: false }],
  fakten: [fakt("f1", "Fakt Alpha"), fakt("f2", "Fakt Beta")],
});
const mkLauf = () => ({
  waehle: vi.fn(), gelegt: vi.fn(), antworte: vi.fn(), deckSetzen: vi.fn(), spielWechseln: vi.fn(), spielwert: vi.fn(), hatBestenliste: false,
});
const nichtGesendet = (l: ReturnType<typeof mkLauf>) => {
  expect(l.antworte).not.toHaveBeenCalled(); expect(l.deckSetzen).not.toHaveBeenCalled();
};

describe("useAblage", () => {
  it("wirft weg und holt zurück", () => {
    const { result } = renderHook(() => useAblage());
    act(() => result.current.wegwerfen("a"));
    act(() => result.current.wegwerfen("a"));
    expect(result.current.weg).toEqual(["a"]);
    expect(result.current.istWeg("a")).toBe(true);
    act(() => result.current.zurueckholen("a"));
    expect(result.current.weg).toEqual([]);
  });
  it("leert sich, wenn die Etappe wechselt", () => {
    const { result, rerender } = renderHook(({ k }) => useAblage(k), { initialProps: { k: 1 } });
    act(() => result.current.wegwerfen("a"));
    rerender({ k: 2 });
    expect(result.current.weg).toEqual([]);
  });
});

describe("Fundkarte", () => {
  it("zeigt Wegwerfen nur mit onWegwerfen", async () => {
    const f = fakt("f1", "Fakt Alpha");
    const { rerender } = render(<Fundkarte fakt={f} onOk={() => {}} />);
    expect(screen.queryByRole("button", { name: /wegwerfen/ })).toBeNull();
    const weg = vi.fn();
    rerender(<Fundkarte fakt={f} onOk={() => {}} onWegwerfen={weg} />);
    await userEvent.setup().click(screen.getByRole("button", { name: "»Fakt Alpha« wegwerfen" }));
    expect(weg).toHaveBeenCalled();
  });
});

describe("Wegwerfen in den Modi", () => {
  it("Boss: weggeworfen ist nicht im Gepäck, Zurückholen bringt es wieder", async () => {
    const u = userEvent.setup(); const lauf = mkLauf();
    render(<Boss brett={brett("boss") as never} theme={THEMES.klassisch} skin="monster" lauf={lauf as never} zurKarte={() => {}} />);
    await u.click(screen.getByRole("button", { name: "Alles einsammeln" }));
    const reg = screen.getByRole("region", { name: "Ausrüsten" });
    await u.click(within(reg).getByRole("button", { name: "»Fakt Alpha« wegwerfen" }));
    expect(within(reg).queryByRole("button", { name: /^Fakt Alpha$/ })).toBeNull();
    await u.click(screen.getByText(/Papierkorb \(1\)/));
    await u.click(screen.getByRole("button", { name: "»Fakt Alpha« zurückholen" }));
    expect(within(reg).getByRole("button", { name: /^Fakt Alpha$/ })).toBeTruthy();
    nichtGesendet(lauf);
  });

  it("Detektiv: weggeworfene Beweise werden nicht angeboten, Zurückholen stellt sie wieder her", async () => {
    const u = userEvent.setup(); const lauf = mkLauf();
    render(<Detektiv brett={brett("detektiv") as never} theme={themeVon("wald")} skin="monster" lauf={lauf as never} zurKarte={() => {}} />);
    await u.click(screen.getByRole("button", { name: "Alles einsammeln" }));
    await u.click(screen.getByRole("button", { name: "Zum Verhör" }));
    await u.click(screen.getByRole("button", { name: /Offene Aufgabe/ }));
    await u.click(screen.getByRole("button", { name: "»Fakt Alpha« wegwerfen" }));
    expect(screen.queryByRole("button", { name: /^Fakt Alpha$/ })).toBeNull();
    await u.click(screen.getByText(/Papierkorb \(1\)/));
    await u.click(screen.getByRole("button", { name: "»Fakt Alpha« zurückholen" }));
    expect(screen.getByRole("button", { name: /^Fakt Alpha$/ })).toBeTruthy();
    nichtGesendet(lauf);
  });

  it("Gericht: weggeworfene Beweise stehen nicht für Einspruch! bereit", async () => {
    const u = userEvent.setup(); const lauf = mkLauf();
    render(<Gericht brett={brett("gericht") as never} theme={themeVon("wald")} skin="monster" lauf={lauf as never} zurKarte={() => {}} />);
    await u.click(screen.getByRole("button", { name: "Zur Verhandlung" }));
    await u.click(screen.getByRole("button", { name: "»Fakt Alpha« wegwerfen" }));
    expect(screen.queryByRole("button", { name: /^Fakt Alpha$/ })).toBeNull();
    await u.click(screen.getByText(/Papierkorb \(1\)/));
    await u.click(screen.getByRole("button", { name: "»Fakt Alpha« zurückholen" }));
    expect(screen.getByRole("button", { name: /^Fakt Alpha$/ })).toBeTruthy();
    nichtGesendet(lauf);
  });

  it("Huepfen: weggeworfene Schlüssel liegen nicht am Schloss", async () => {
    const u = userEvent.setup(); const lauf = mkLauf();
    render(<Huepfen brett={brett("huepfen") as never} theme={themeVon("klassisch")} skin="" lauf={lauf as never} zurKarte={() => {}} />);
    await u.click(screen.getByRole("button", { name: "Alles einsammeln" }));
    await u.click(screen.getByRole("button", { name: "»Fakt Alpha« wegwerfen" }));
    await u.click(screen.getByRole("button", { name: /Tür: Offene Aufgabe/ }));
    expect(screen.queryByRole("button", { name: /^Fakt Alpha$/ })).toBeNull();
    await u.click(screen.getByText(/Papierkorb \(1\)/));
    await u.click(screen.getByRole("button", { name: "»Fakt Alpha« zurückholen" }));
    expect(screen.getByRole("button", { name: /^Fakt Alpha$/ })).toBeTruthy();
    nichtGesendet(lauf);
  });
});
