import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, renderHook, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PixelMatrix } from "@/components/challenge/pixel/Matrix";
import { useChallengeLauf, sitzungsQuelle } from "@/lib/challenge/useChallengeLauf";
import ChallengeLehrkraft from "@/components/challenge/ChallengeLehrkraft";

const m = vi.hoisted(() => ({
  info: vi.fn(), start: vi.fn(), antwort: vi.fn(), uebersicht: vi.fn(), schueler: vi.fn(), stufen: vi.fn(), kalibrierung: vi.fn(),
  kalibrierungSetzen: vi.fn(), kalibrierungLoeschen: vi.fn(), standStufe: vi.fn(), csvPfad: vi.fn(() => "/x.csv"),
  einstellungen: vi.fn(), create: vi.fn(), classes: vi.fn(), get: vi.fn(), sessions: vi.fn(), groups: vi.fn(),
}));
vi.mock("@/lib/api", () => ({
  api: {
    challenge: m, toolSessions: { create: m.create, einstellungen: m.einstellungen, get: m.get }, classes: { list: m.classes },
    play: { sessions: m.sessions }, groups: { list: m.groups },
  },
}));
vi.mock("@/components/ToolSessionBar", () => ({ ToolSessionBar: () => null }));

const brett = { stufe: 2, etappe: 1, leben: 3, fertig: false, spiel: "normal", deck: null, etappen: [], challenges: [], fakten: [] };

describe("PixelMatrix", () => {
  it("zeichnet je nicht transparentem Pixel ein rect", () => {
    const { container } = render(<PixelMatrix bild={["a.b", ".a."]} palette={{ a: "#f00", b: "#00f" }} />);
    expect(container.querySelectorAll("rect")).toHaveLength(3);
  });
});

describe("useChallengeLauf", () => {
  beforeEach(() => {
    vi.spyOn(performance, "now");
    m.info.mockReset().mockResolvedValue({ title: "T", settings: { spiele: ["normal"] }, stand: null });
    m.start.mockReset().mockResolvedValue(brett);
    m.antwort.mockReset().mockResolvedValue({ fertig: false });
  });
  afterEach(() => vi.restoreAllMocks());

  it("misst Lese- und Wahlzeit und lädt das Brett neu", async () => {
    const { result } = renderHook(() => useChallengeLauf(sitzungsQuelle("ABC")));
    await waitFor(() => expect(result.current.brett).not.toBeNull());
    const t = vi.mocked(performance.now);
    t.mockReturnValue(1000); act(() => result.current.waehle());
    t.mockReturnValue(3000); act(() => result.current.gelegt());
    t.mockReturnValue(3500);
    await act(async () => { await result.current.antworte("c1", ["f1"], true); });
    expect(m.antwort.mock.calls[0][1]).toEqual({ challenge_id: "c1", fakt_ids: ["f1"], tipp: true, lese_ms: 2000, wahl_ms: 500 });
    expect(m.start).toHaveBeenCalledTimes(2);
  });
});

describe("ChallengeLehrkraft", () => {
  const sitzung = { code: "XYZ", settings: { startstufe: 2, spiele: ["normal"], theme: "klassisch" } };
  const viewKalib = (genug: boolean) => {
    const w = { lese_wpm: { "1": 100, "2": 120, "3": 140, "4": 160 }, antwortzeit: { schnell: 15, langsam: 40 } };
    m.kalibrierung.mockResolvedValue({ aktuell: w, vorschlag: w, stichprobe: { "1": 40 }, genug });
  };
  beforeEach(() => {
    Object.values(m).forEach((f) => f.mockReset?.());
    m.csvPfad.mockReturnValue("/x.csv");
    m.create.mockResolvedValue(sitzung);
    m.get.mockResolvedValue(sitzung);
    m.sessions.mockResolvedValue([{ code: "XYZ", ref_id: 1, mine: true, scope_label: "7a" }]);
    m.groups.mockResolvedValue([]);
    m.uebersicht.mockResolvedValue({ teilnehmer: [], punkte: [] });
    m.classes.mockResolvedValue([{ id: 7, code: "7a", display_name: "7a" }]);
    m.schueler.mockResolvedValue([{ id: 5, name: "Eva", startstufe: null, stand_id: null, stufe: null }]);
    m.stufen.mockResolvedValue({});
    m.kalibrierungSetzen.mockResolvedValue({});
  });
  const zeige = async () => {
    const u = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient()}><ChallengeLehrkraft satzId={1} titel="Hebel" /></QueryClientProvider>);
    await screen.findByLabelText("Etappen in zufälliger Reihenfolge"); // Sitzung der Klasse geladen
    return u;
  };

  it("ohne Sitzung: erst Klasse wählen, dann bekommt sie ihren eigenen Code", async () => {
    m.sessions.mockResolvedValue([]);
    const u = userEvent.setup();
    render(<QueryClientProvider client={new QueryClient()}><ChallengeLehrkraft satzId={1} titel="Hebel" /></QueryClientProvider>);
    const start = await screen.findByRole("button", { name: "Starten" });
    expect(start).toBeDisabled();
    const wahl = screen.getByLabelText("Neu für");
    await waitFor(() => expect(wahl.querySelectorAll("option")).toHaveLength(2));
    await u.selectOptions(wahl, "c7");
    await u.click(start);
    expect(m.create).toHaveBeenCalledWith("challenge", 1, { class_id: 7 });
    expect(await screen.findByLabelText("Etappen in zufälliger Reihenfolge")).toBeInTheDocument();
  });

  it("sendet die Startstufe je Schüler", async () => {
    const u = await zeige();
    await u.click(screen.getByText("Startstufen je Schüler·in"));
    const [klasse] = screen.getAllByLabelText("Klasse");
    await waitFor(() => expect(klasse.querySelectorAll("option")).toHaveLength(2));
    await u.selectOptions(klasse, "7");
    await u.selectOptions(await screen.findByLabelText("Startstufe Eva"), "3");
    expect(m.stufen).toHaveBeenCalledWith("XYZ", { 5: 3 });
  });

  it("speichert »Etappen in zufälliger Reihenfolge« und behält die übrigen Einstellungen", async () => {
    m.einstellungen.mockResolvedValue(sitzung);
    const u = await zeige();
    await u.click(screen.getByLabelText("Etappen in zufälliger Reihenfolge"));
    expect(m.einstellungen).toHaveBeenCalledWith("XYZ", { ...sitzung.settings, etappen_mischen: true });
  });

  it("übernimmt den Kalibrierungs-Vorschlag nur bei genug Daten", async () => {
    viewKalib(false);
    const u = await zeige();
    await u.click(screen.getByText("Kalibrierung der Anpassung"));
    await waitFor(() => expect(screen.getAllByLabelText("Klasse")[1].querySelectorAll("option")).toHaveLength(2));
    await u.selectOptions(screen.getAllByLabelText("Klasse")[1], "7");
    const knopf = await screen.findByRole("button", { name: "Vorschlag übernehmen" });
    expect((knopf as HTMLButtonElement).disabled).toBe(true);
    m.kalibrierung.mockReset(); viewKalib(true);
    await u.selectOptions(screen.getAllByLabelText("Klasse")[1], "");
    await u.selectOptions(screen.getAllByLabelText("Klasse")[1], "7");
    await waitFor(() => expect((screen.getByRole("button", { name: "Vorschlag übernehmen" }) as HTMLButtonElement).disabled).toBe(false));
    await u.click(screen.getByRole("button", { name: "Vorschlag übernehmen" }));
    expect(m.kalibrierungSetzen).toHaveBeenCalledWith(7, expect.objectContaining({ antwortzeit: { schnell: 15, langsam: 40 } }));
  });
});
