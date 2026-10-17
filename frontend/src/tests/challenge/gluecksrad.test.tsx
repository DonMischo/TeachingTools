import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { themeVon } from "@/lib/challenge/themes";
import Modus from "@/components/challenge/modi/Gluecksrad";
import { RAD } from "@/lib/challenge/gluecksrad";

const brett = {
  stufe: 2, etappe: 1, leben: 3, fertig: false, spiel: "gluecksrad", deck: null,
  etappen: [{ nr: 1, titel: "Eins", erledigt: false }],
  challenges: [
    { id: "c1", text: "Lass Anna lesen!", image: null, formula: null, strength: 1, erledigt: false },
    { id: "c2", text: "Schon erledigt", image: null, formula: null, strength: 1, erledigt: true },
  ],
  fakten: [
    { id: "f1", text: "Fakt Eins", image: null, formula: null, info: null },
    { id: "f2", text: "Fakt Zwei", image: null, formula: null, info: null },
  ],
};
const antwort = (extra = {}) => ({
  qualitaet: 0, treffer: false, komplett: false, kombo: false, schaden: 0, falsch_gewaehlt: 1,
  leben: 2, zurueck_zur_karte: false, etappe_geschafft: false, fertig: false, stufe: 2, ...extra,
});
const feld = (art: string, betrag?: number) => RAD.findIndex((f) => f.art === art && (betrag === undefined || (f as { betrag: number }).betrag === betrag));
const wuerfle = (i: number) => vi.spyOn(Math, "random").mockReturnValue((i + 0.5) / RAD.length);

const baue = (a = antwort()) => {
  const lauf = { waehle: vi.fn(), gelegt: vi.fn(), antworte: vi.fn().mockResolvedValue(a), deckSetzen: vi.fn(), spielWechseln: vi.fn(), spielwert: vi.fn(), hatBestenliste: false };
  render(<Modus brett={brett as never} theme={themeVon("wald")} skin="monster" lauf={lauf as never} zurKarte={() => {}} />);
  return { lauf, u: userEvent.setup() };
};
const verdeckt = () => screen.queryAllByLabelText("verdeckt").length;
const rundengeld = () => Number(screen.getByText(/^Rundengeld/).querySelector("strong")!.textContent);
const konsonant = (u: ReturnType<typeof userEvent.setup>, b: string) => u.click(screen.getByRole("button", { name: `Konsonant ${b}` }));
const dreheBetrag = async (u: ReturnType<typeof userEvent.setup>, betrag: number) => {
  wuerfle(feld("betrag", betrag));
  await u.click(screen.getByRole("button", { name: "Drehen" }));
};

beforeEach(() => {
  window.matchMedia = ((q: string) => ({ matches: true, media: q, addEventListener() {}, removeEventListener() {} })) as never;
});
afterEach(() => vi.restoreAllMocks());

describe("Glücksrad", () => {
  it("verdeckt Buchstaben, lässt Satzzeichen offen und bietet Erledigtes nicht an", () => {
    baue();
    expect(verdeckt()).toBe(13); // »Lass Anna lesen!«
    expect(screen.getByText("!")).toBeTruthy();
    expect(screen.queryByText("Schon erledigt")).toBeNull();
  });

  it("Konsonant zahlt Betrag mal Anzahl", async () => {
    const { u } = baue();
    await dreheBetrag(u, 100);
    await konsonant(u, "N"); // 2× N in »Anna« + 1× in »lesen«
    expect(rundengeld()).toBe(300);
    expect(verdeckt()).toBe(10);
  });

  it("falscher Konsonant fügt dem Galgen ein Teil hinzu", async () => {
    const { u } = baue();
    await dreheBetrag(u, 100);
    await konsonant(u, "Z");
    expect(screen.getByRole("img", { name: "Galgen: 1 von 8 Teilen" })).toBeTruthy();
    expect(rundengeld()).toBe(0);
  });

  it("Vokal kostet 250, geht nur mit genug Rundengeld", async () => {
    const { u } = baue();
    expect((screen.getByRole("button", { name: "Vokal A kaufen" }) as HTMLButtonElement).disabled).toBe(true);
    await dreheBetrag(u, 500);
    await konsonant(u, "S"); // 3× S
    expect(rundengeld()).toBe(1500);
    await u.click(screen.getByRole("button", { name: "Vokal A kaufen" }));
    expect(rundengeld()).toBe(1250);
    expect(verdeckt()).toBe(7);
  });

  it("Bankrott setzt das Rundengeld auf 0", async () => {
    const { u } = baue();
    await dreheBetrag(u, 100);
    await konsonant(u, "N");
    expect(rundengeld()).toBe(300);
    wuerfle(feld("bankrott"));
    await u.click(screen.getByRole("button", { name: "Drehen" }));
    expect(rundengeld()).toBe(0);
  });

  it("voller Galgen deckt auf, nimmt das Geld und lässt das Rätsel lösbar", async () => {
    const { lauf, u } = baue();
    await dreheBetrag(u, 100);
    await konsonant(u, "N");
    for (const b of ["B", "C", "D", "F", "G", "H", "J", "K"]) {
      await dreheBetrag(u, 100);
      await konsonant(u, b);
    }
    expect(screen.getByRole("img", { name: "Galgen: 8 von 8 Teilen" })).toBeTruthy();
    expect(verdeckt()).toBe(0);
    expect(screen.getByRole("group", { name: "Rätselwand" }).textContent).toContain("L");
    await u.click(screen.getByRole("button", { name: /^Fakt Eins$/ }));
    await u.click(screen.getByRole("button", { name: "Lösen" }));
    expect(lauf.antworte).toHaveBeenCalledWith("c1", ["f1"], false);
  });

  it("Aufdecken zeigt alles ohne Geld", async () => {
    const { u } = baue();
    await dreheBetrag(u, 100);
    await konsonant(u, "N");
    await u.click(screen.getByRole("button", { name: /Aufdecken/ }));
    expect(verdeckt()).toBe(0);
  });

  it("Lösen ruft antworte und bankt Geld plus Bonus nur bei komplett", async () => {
    const { lauf, u } = baue(antwort({ treffer: true, komplett: true, schaden: 10 }));
    await dreheBetrag(u, 100);
    await konsonant(u, "N"); // 300 Rundengeld, 10 verdeckt
    await u.click(screen.getByRole("button", { name: /^Fakt Eins$/ }));
    await u.click(screen.getByRole("button", { name: "Lösen" }));
    expect(lauf.antworte).toHaveBeenCalledWith("c1", ["f1"], false);
    expect(await screen.findByText(/Bank: 500/)).toBeTruthy(); // 300 + 10 × 20
  });

  it("Teiltreffer und Daneben bringen nichts auf die Bank", async () => {
    const { u } = baue(antwort({ treffer: true }));
    await dreheBetrag(u, 100);
    await konsonant(u, "N");
    await u.click(screen.getByRole("button", { name: /^Fakt Eins$/ }));
    await u.click(screen.getByRole("button", { name: "Lösen" }));
    expect(await screen.findByText(/Teiltreffer/)).toBeTruthy();
    expect(screen.getByText(/Bank: 0/)).toBeTruthy();
    expect(rundengeld()).toBe(300);
  });
});
