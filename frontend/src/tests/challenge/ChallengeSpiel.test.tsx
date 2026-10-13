import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChallengeSpiel from "@/components/challenge/ChallengeSpiel";

const brett = (extra = {}) => ({
  stufe: 2, etappe: 1, leben: 3, fertig: false,
  etappen: [{ nr: 1, titel: "Der Hebel", erledigt: false }],
  challenges: [{ id: "c1", text: "Was ist eine Wippe?", image: null, formula: null, strength: 1, erledigt: false }],
  fakten: [
    { id: "f1", text: "Zweiseitiger Hebel", image: null, formula: null, info: { text: "Merke dir das.", source: { label: "Buch", url: "https://example.org" } } },
    { id: "x1", text: "Ein Hebel erzeugt Energie", image: null, formula: null, info: null },
  ],
  ...extra,
});
const antwort = (extra = {}) => ({
  qualitaet: 0, treffer: false, komplett: false, kombo: false, schaden: 0, falsch_gewaehlt: 1,
  leben: 2, zurueck_zur_karte: false, etappe_geschafft: false, fertig: false, stufe: 2, ...extra,
});

const m = vi.hoisted(() => ({ info: vi.fn(), start: vi.fn(), antwort: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { challenge: m } }));

beforeEach(() => {
  m.info.mockReset().mockResolvedValue({ title: "Hebel", subject: null, settings: {}, stand: { ergebnis: 0.8, fertig: false } });
  m.start.mockReset().mockResolvedValue(brett());
  m.antwort.mockReset().mockResolvedValue(antwort());
});

async function zumKampf() {
  const u = userEvent.setup();
  render(<ChallengeSpiel code="ABC" />);
  await u.click(await screen.findByRole("button", { name: "Los" }));
  await u.click(screen.getByText("Was ist eine Wippe?"));
  await u.click(screen.getByText("Zweiseitiger Hebel"));
  return u;
}

describe("ChallengeSpiel", () => {
  it("sendet die Antwort mit Zeiten und meldet »Daneben«", async () => {
    const u = await zumKampf();
    await u.click(screen.getByRole("button", { name: "Angreifen" }));
    await waitFor(() => expect(m.antwort).toHaveBeenCalled());
    const body = m.antwort.mock.calls[0][1];
    expect(body).toMatchObject({ challenge_id: "c1", fakt_ids: ["f1"], tipp: false });
    expect(body.lese_ms).toBeGreaterThanOrEqual(0);
    expect(body.wahl_ms).toBeGreaterThanOrEqual(0);
    expect(await screen.findByText("Daneben")).toBeTruthy();
  });

  it("wechselt nach drei Fehlversuchen zur Karte", async () => {
    m.antwort.mockResolvedValue(antwort({ zurueck_zur_karte: true, leben: 3 }));
    const u = await zumKampf();
    await u.click(screen.getByRole("button", { name: "Angreifen" }));
    expect(await screen.findByText(/Drei Fehlversuche/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Los" })).toBeTruthy();
  });

  it("zeigt am Ende das Ergebnis", async () => {
    m.antwort.mockResolvedValue(antwort({ treffer: true, komplett: true, fertig: true }));
    const u = await zumKampf();
    await u.click(screen.getByRole("button", { name: "Angreifen" }));
    expect(await screen.findByText("80 %")).toBeTruthy();
  });
});
