import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { TimelineSetDetail } from "@/components/timeline/types";
import { PracticeTab } from "@/components/timeline/ZeitstrahlUeben";
import { SharedTimeline } from "@/components/timeline/SharedTimeline";
import { LEER, rundeEintragen, zeitstrahlAnsicht } from "@/lib/zeitstrahl/sitzung";
import { fortschrittVon, zelle } from "@/lib/sitzung/typen";

const m = vi.hoisted(() => ({ content: vi.fn(), stand: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { toolSessions: { content: m.content }, sitzungen: { stand: m.stand } } }));
vi.mock("@/contexts/ToastContext", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const SET = {
  id: 1, title: "Rom", description: null, tags: [], grades: [], created_by_student: null,
  axis: { kind: "year", min: -800, max: 600 }, lanes: [],
  events: [
    { id: "rom", label: "Gründung Roms", value: -753 },
    { id: "rep", label: "Republik", value: -509, end: -27 },
    { id: "kai", label: "Kaiserzeit", value: -27, end: 476 },
  ],
} as unknown as TimelineSetDetail;

// jsdom kennt kein ResizeObserver (useElementWidth in timeline/scale.ts)
vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });

beforeEach(() => {
  localStorage.clear();
  m.content.mockReset().mockResolvedValue(SET);
  m.stand.mockReset().mockResolvedValue({ ok: true });
});

/** »Fehler finden« ohne Markierung: mindestens ein verschobenes Ereignis ist falsch. */
async function spielSpotRunde() {
  const u = userEvent.setup();
  await u.selectOptions(screen.getByLabelText("Modus"), "spot");
  await u.click(screen.getByRole("button", { name: "Runde starten" }));
  await u.click(screen.getByRole("button", { name: "Prüfen" }));
}

describe("PracticeTab", () => {
  it("meldet jede geprüfte Runde mit Ergebnis je Ereignis", async () => {
    const onRunde = vi.fn();
    render(<PracticeTab set={SET} visibleEvents={SET.events} isTeacher={false} onRunde={onRunde} />);
    expect(screen.queryByText(/Caputh-Frage/)).toBeNull();
    await spielSpotRunde();
    expect(onRunde).toHaveBeenCalledTimes(1);
    const { ratio, results } = onRunde.mock.calls[0][0];
    expect(Object.keys(results).sort()).toEqual(["kai", "rep", "rom"]);
    expect(Object.values(results)).toContain(false);
    expect(ratio).toBeLessThan(1);
  });

  it("zeigt der Lehrkraft die Kopier-Knöpfe", () => {
    render(<PracticeTab set={SET} visibleEvents={SET.events} isTeacher />);
    expect(screen.getByText(/Caputh-Frage/)).toBeInTheDocument();
  });
});

describe("SharedTimeline", () => {
  it("Üben meldet die Runde an den Sitzungsstand und merkt sie im Browser", async () => {
    render(<SharedTimeline code="ABC" guestToken="t" zugang={{ code: "ABC", token: "t" }} speicherSchluessel="gast-ABC" />);
    await userEvent.click(await screen.findByRole("button", { name: /Üben/ }));
    await spielSpotRunde();
    await waitFor(() => expect(m.stand).toHaveBeenCalled(), { timeout: 3000 });
    const [zugang, body] = m.stand.mock.calls.at(-1)!;
    expect(zugang).toEqual({ code: "ABC", token: "t" });
    expect(body.daten).toMatchObject({ runden: 1, gesamt: 3 });
    expect(Object.keys(body.daten.ereignisse).sort()).toEqual(["kai", "rep", "rom"]);
    expect(JSON.parse(localStorage.getItem("hp_zeitstrahl_stand_gast-ABC")!).runden).toBe(1);
  });

  it("ohne Zugang (Lehrkraft) wird nichts gemeldet", async () => {
    render(<SharedTimeline code="ABC" />);
    await userEvent.click(await screen.findByRole("button", { name: /Üben/ }));
    await spielSpotRunde();
    await new Promise(r => setTimeout(r, 1000));
    expect(m.stand).not.toHaveBeenCalled();
  });
});

describe("zeitstrahl/sitzung", () => {
  it("rundeEintragen zählt und überschreibt je Ereignis den letzten Stand", () => {
    const a = rundeEintragen(LEER, { rom: true, rep: false });
    const b = rundeEintragen(a, { rep: true, kai: false });
    expect(b).toEqual({ runden: 2, richtig: 2, gesamt: 4, ereignisse: { rom: true, rep: true, kai: false } });
  });

  it("bleibt unter 16 kB und wirft die ältesten Ereignisse zuerst hinaus", () => {
    let s = LEER;
    for (let i = 0; i < 1000; i++) s = rundeEintragen(s, { [`ereignis-mit-langer-id-${i}`]: i % 2 === 0 });
    expect(new TextEncoder().encode(JSON.stringify(s)).length).toBeLessThanOrEqual(15000);
    expect(s.ereignisse["ereignis-mit-langer-id-999"]).toBe(false);
    expect(s.ereignisse["ereignis-mit-langer-id-0"]).toBeUndefined();
    expect(s.runden).toBe(1000);
  });

  it("Ansicht: Ereignisse als Aufgaben, geschafft nur bei zuletzt richtig", () => {
    const a = zeitstrahlAnsicht(SET);
    expect(a.aufgaben!.map(x => x.id)).toEqual(["rom", "rep", "kai"]);
    expect(a.aufgaben![0].titel).toContain("Gründung Roms");
    const d = { runden: 2, richtig: 3, gesamt: 4, ereignisse: { rom: true, rep: false } };
    expect(a.geschafft!(d, "rom")).toBe(true);
    expect(a.geschafft!(d, "rep")).toBe(false);
    expect(a.geschafft!(d, "kai")).toBe(false);
    expect(fortschrittVon(a, d)).toBeCloseTo(1 / 3);
    expect(a.spalten.map(s => zelle(s, d))).toEqual(["2", "75 %", "1/3"]);
    expect(a.rang!.wert(d)).toBe(1);
    expect(a.spalten.map(s => zelle(s, {}))).toEqual(["", "", "0/3"]);
  });
});
