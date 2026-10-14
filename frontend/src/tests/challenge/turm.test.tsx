import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { themeVon } from "@/lib/challenge/themes";
import Modus from "@/components/challenge/modi/Turm";
import { anfuehrerFaellt, kaufe, neuerZustand, schritt, startWelle, verbessere, wellePossible } from "@/lib/challenge/turmSpiel";

const brett = {
  stufe: 2, etappe: 1, leben: 3, fertig: false, spiel: "turm", deck: null,
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
const bisAnfuehrer = async (u: ReturnType<typeof userEvent.setup>) => {
  await u.click(screen.getByRole("button", { name: "Welle starten" }));
  return screen.findByRole("button", { name: /Anführer: Offene Aufgabe/ }, { timeout: 15000 });
};

beforeEach(() => { window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} }) as never; });

describe("Turm-Logik", () => {
  const pfad: [number, number][] = [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0]];
  const plaetze: [number, number][] = [[2, 1]];
  it("Türme kosten Gold und schießen Schwarm-Gegner ab", () => {
    const z = neuerZustand();
    expect(kaufe(z, 0, "pfeil")).toBe(true);
    expect(z.gold).toBe(100);
    expect(kaufe(z, 0, "pfeil")).toBe(false);
    startWelle(z);
    for (let i = 0; i < 400; i++) schritt(z, pfad, plaetze, 0.05);
    expect(z.abschuesse).toBeGreaterThan(0);
    expect(z.gold).toBeGreaterThan(100);
  });
  it("verbessern kostet Gold und hebt die Stufe", () => {
    const z = neuerZustand();
    kaufe(z, 0, "pfeil");
    expect(verbessere(z, 0)).toBe(true);
    expect(z.tuerme[0].stufe).toBe(2);
  });
  it("Anführer sind für Türme unverwundbar und fallen nur durch Wissen", () => {
    const z = neuerZustand();
    kaufe(z, 0, "pfeil");
    startWelle(z, ["c1"]);
    for (let i = 0; i < 1500; i++) schritt(z, pfad, plaetze, 0.05);
    const g = z.gegner.find((x) => x.anfuehrer === "c1")!;
    expect(g).toBeTruthy();
    expect(g.hp).toBe(g.max);
    expect(wellePossible(z)).toBe(true);
    const gold = z.gold;
    anfuehrerFaellt(z, "c1");
    expect(z.gegner.find((x) => x.anfuehrer === "c1")).toBeUndefined();
    expect(z.gold).toBeGreaterThan(gold);
  });
  it("Durchbrüche kosten Gold, nie unter null", () => {
    const z = neuerZustand();
    z.gold = 3;
    startWelle(z);
    for (let i = 0; i < 600; i++) schritt(z, pfad, plaetze, 0.05);
    expect(z.gold).toBe(0);
    expect(z.burg).toBeLessThan(z.burgMax);
  });
});

describe("Turm", () => {
  it("Welle starten, Anführer anklicken, Fakten legen und mit Feuer! werten", async () => {
    const { lauf, u } = baue();
    await bisAnfuehrer(u).then((b) => u.click(b));
    await u.click(screen.getByRole("button", { name: /Zweiseitiger Hebel/ }));
    expect(lauf.gelegt).toHaveBeenCalled();
    await u.click(screen.getByRole("button", { name: "Feuer!" }));
    expect(lauf.antworte).toHaveBeenCalledWith("c1", ["f1"], false);
    expect(await screen.findByText("Daneben")).toBeTruthy();
  }, 30000);

  it("komplette Treffer lassen den Anführer fallen", async () => {
    const { u } = baue(antwort({ treffer: true, komplett: true, schaden: 10 }));
    await bisAnfuehrer(u).then((b) => u.click(b));
    await u.click(screen.getByRole("button", { name: /Zweiseitiger Hebel/ }));
    await u.click(screen.getByRole("button", { name: "Feuer!" }));
    await waitFor(() => expect(screen.getByText(/Treffer!/)).toBeTruthy());
    await u.click(screen.getByRole("button", { name: "Weiter" }));
    expect(screen.queryByRole("button", { name: /Anführer: Offene Aufgabe/ })).toBeNull();
  }, 30000);

  it("bietet erledigte Challenges nicht an", async () => {
    const { u } = baue();
    await bisAnfuehrer(u);
    expect(screen.queryByText(/Schon erledigt/)).toBeNull();
  }, 30000);

  it("baut einen Turm auf einem Bauplatz", async () => {
    const { u } = baue();
    await u.click(screen.getByRole("button", { name: "Bauplatz 1" }));
    await u.click(screen.getByRole("button", { name: /Pfeilturm/ }));
    expect(screen.getByRole("button", { name: /Pfeilturm, Stufe 1/ })).toBeTruthy();
    expect(screen.getByLabelText("Gold").textContent).toContain("100");
  });
});
