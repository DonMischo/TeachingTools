/**
 * Die Spielerseite des Tipp-Rennens (/play/wettschreiben/[code]).
 *
 * Geprüft wird vor allem, was ein Gast ohne Konto zu sehen bekommt, bevor er
 * überhaupt drin ist — genau dort steckten die beiden Fehler, die erst im
 * Browser auffielen: ein unbekannter Code zeigte trotzdem das Beitrittsformular,
 * und der Beitritt ging ohne den frisch geholten Gast-Token hinaus.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
  useParams: () => ({ code: "RACE01" }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

const guestStatus = vi.fn();
const rennenLesen = vi.fn();
const rennenBeitreten = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    guest: { status: (...a: unknown[]) => guestStatus(...a) },
    wettschreiben: {
      lesen: (...a: unknown[]) => rennenLesen(...a),
      beitreten: (...a: unknown[]) => rennenBeitreten(...a),
    },
  },
}));

// Gast-Sitzung: `join` liefert die frische Sitzung zurück, `session` bleibt in
// derselben Runde noch leer — genau die Falle, um die es unten geht.
const guestJoin = vi.fn();
let gastSitzung: { token: string; name: string; expiresAt: number } | null = null;
let abgelaufen = false;
vi.mock("@/hooks/useGuestSession", () => ({
  useGuestSession: () => ({
    session: gastSitzung,
    token: gastSitzung?.token ?? null,
    expired: abgelaufen,
    loaded: true,
    join: (...a: unknown[]) => guestJoin(...a),
    clear: vi.fn(),
    markExpired: vi.fn(),
  }),
}));

let angemeldet: unknown = null;
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: angemeldet, ready: true }),
}));

class MockWebSocket {
  onmessage: ((e: { data: string }) => void) | null = null;
  close = vi.fn();
  send = vi.fn();
}
vi.stubGlobal("WebSocket", class extends MockWebSocket {
  constructor(..._args: unknown[]) { super(); }
});

import WettschreibenPlayPage from "@/app/play/wettschreiben/[code]/page";

const RENNEN = {
  code: "RACE01",
  title: "Runde 1",
  text: "die zeit ist um",
  status: "lobby",
  allow_guests: true,
  teilnehmer: [],
};

async function zeigen() {
  await act(async () => { render(<WettschreibenPlayPage />); });
}

beforeEach(() => {
  localStorage.clear();
  gastSitzung = null;
  abgelaufen = false;
  angemeldet = null;
  guestStatus.mockReset().mockResolvedValue({ allow_guests: true });
  rennenLesen.mockReset().mockResolvedValue(RENNEN);
  rennenBeitreten.mockReset().mockResolvedValue({ teilnehmer_id: 7, name: "Bo" });
  guestJoin.mockReset().mockImplementation(async () => {
    gastSitzung = { token: "gast-token", name: "Bo", expiresAt: Date.now() + 3_600_000 };
    return gastSitzung;
  });
});

afterEach(() => vi.clearAllMocks());

describe("Wettschreiben — Beitritt", () => {
  it("sagt bei unbekanntem Code, dass es den Code nicht gibt", async () => {
    guestStatus.mockRejectedValue(new Error("404"));
    await zeigen();
    expect(await screen.findByText(/Diesen Code kenne ich nicht/)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Dein Name")).not.toBeInTheDocument();
  });

  it("fragt den öffentlichen Gast-Status, solange niemand angemeldet ist", async () => {
    await zeigen();
    await waitFor(() => expect(guestStatus).toHaveBeenCalledWith("wettschreiben", "RACE01"));
    // Ohne Identität ist das Rennen selbst gar nicht lesbar — also gar nicht erst fragen.
    expect(rennenLesen).not.toHaveBeenCalled();
  });

  it("sperrt, wenn die Lehrkraft keine Gäste erlaubt hat", async () => {
    guestStatus.mockResolvedValue({ allow_guests: false });
    await zeigen();
    expect(await screen.findByText(/Gäste sind hier nicht freigeschaltet/)).toBeInTheDocument();
  });

  it("zeigt das Beitrittsformular, wenn Gäste erlaubt sind", async () => {
    await zeigen();
    expect(await screen.findByPlaceholderText("Dein Name")).toBeInTheDocument();
  });

  it("schickt den frisch geholten Gast-Token mit dem Beitritt", async () => {
    const user = userEvent.setup();
    await zeigen();
    await user.type(await screen.findByPlaceholderText("Dein Name"), "Bo");
    await user.click(screen.getByRole("button", { name: /Beitreten/ }));

    await waitFor(() => expect(guestJoin).toHaveBeenCalledWith("wettschreiben", "Bo"));
    // Der Token stammt aus dem Rückgabewert von join(), nicht aus dem State —
    // der trägt in dieser Runde noch null, der Beitritt käme sonst als 401 zurück.
    await waitFor(() =>
      expect(rennenBeitreten).toHaveBeenCalledWith("RACE01", "Bo", "gast-token"));
  });

  it("meldet einen gescheiterten Beitritt im Formular", async () => {
    const user = userEvent.setup();
    rennenBeitreten.mockRejectedValue(new Error("Dieses Rennen ist schon gelaufen."));
    await zeigen();
    await user.type(await screen.findByPlaceholderText("Dein Name"), "Bo");
    await user.click(screen.getByRole("button", { name: /Beitreten/ }));
    expect(await screen.findByText(/schon gelaufen/)).toBeInTheDocument();
  });

  it("blockt hart, wenn das Gastfenster abgelaufen ist", async () => {
    abgelaufen = true;
    await zeigen();
    expect(await screen.findByRole("heading", { name: "Sitzung abgelaufen" })).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Dein Name")).not.toBeInTheDocument();
  });
});

describe("Wettschreiben — angemeldet", () => {
  beforeEach(() => { angemeldet = { role: "student", name: "Ada" }; });

  it("liest das Rennen direkt, ohne den Gast-Umweg", async () => {
    await zeigen();
    await waitFor(() => expect(rennenLesen).toHaveBeenCalledWith("RACE01", undefined));
    expect(guestStatus).not.toHaveBeenCalled();
  });

  it("zeigt nach dem Beitritt den Renntext und wartet auf den Start", async () => {
    const user = userEvent.setup();
    await zeigen();
    await user.type(await screen.findByPlaceholderText("Dein Name"), "Ada");
    await user.click(screen.getByRole("button", { name: /Beitreten/ }));

    expect(await screen.findByRole("textbox", { name: "Renntext tippen" })).toBeInTheDocument();
    expect(screen.getByText(/Gleich geht es los/)).toBeInTheDocument();
    // In der Lobby ist noch keine Stelle markiert — getippt wird erst nach dem Start.
    expect(document.querySelector("[data-aktuell]")).toBeNull();
  });
});
