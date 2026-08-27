/**
 * Der Playhub (/play): Code, Identität, rein — für jedes Werkzeug gleich.
 *
 * Der Hub kennt die Werkzeuge nicht; er fragt den Server, wer den Code kennt,
 * sammelt Name (und Avatar, wo er gebraucht wird) und legt beides für die
 * Werkzeugseite ab. Genau diese Arbeitsteilung wird hier geprüft — dass der Hub
 * also KEINE werkzeugeigene Beitritts-API ruft, sondern nur Gast-Token und
 * Identität hinterlässt.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

// Angemeldet oder nicht — pro Test umgeschaltet.
const authState: { auth: unknown } = { auth: null };
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: authState.auth, ready: true }),
}));

const mockResolve = vi.fn();
const mockGuestJoin = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    play: { resolve: (...a: unknown[]) => mockResolve(...a) },
    guest: { join: (...a: unknown[]) => mockGuestJoin(...a) },
  },
}));

import JoinPage from "@/app/play/page";
import { readPlayIdentity } from "@/lib/playIdentity";

const exitTicket = {
  tool: "exit-ticket", label: "🎫 Exit Ticket", code: "ABC123",
  join_url: "/play/exit-ticket/ABC123", status: "open", avatar: "none",
};
const caputh = {
  tool: "caputh", label: "🎲 Caputh", code: "ABC123",
  join_url: "/play/ABC123", status: "waiting", avatar: "always",
};
const simulation = {
  tool: "simulation", label: "🧮 Simulation", code: "ABC123",
  join_url: "/play/simulation/ABC123", status: null, avatar: "none",
};

async function enterCode(code: string) {
  const user = userEvent.setup();
  render(<JoinPage />);
  await user.type(screen.getByLabelText("Beitritts-Code"), code);
  await user.click(screen.getByRole("button", { name: "Beitreten" }));
  return user;
}

/** Zweiter Schritt: Name eintragen und abschicken. */
async function submitName(user: ReturnType<typeof userEvent.setup>, name: string) {
  const field = await screen.findByPlaceholderText("Dein Name");
  await user.type(field, name);
  await user.click(screen.getByRole("button", { name: "Beitreten" }));
}

describe("Playhub", () => {
  beforeEach(() => {
    localStorage.clear();
    authState.auth = null;
    mockPush.mockReset();
    mockResolve.mockReset();
    mockGuestJoin.mockReset();
    mockGuestJoin.mockResolvedValue({ token: "gast", name: "Bob" });
  });

  // ── Gäste ───────────────────────────────────────────────────────────────

  it("führt vom Code über die Identität ins Spiel", async () => {
    mockResolve.mockResolvedValue({ code: "ABC123", matches: [exitTicket] });
    const user = await enterCode("abc123");

    // Der Code geht in Großbuchstaben raus.
    await waitFor(() => expect(mockResolve).toHaveBeenCalledWith("ABC123"));
    expect(mockPush).not.toHaveBeenCalled();   // erst die Identität

    await submitName(user, "Bob");

    // Gast-Token für genau diesen Code + Werkzeug …
    await waitFor(() => expect(mockGuestJoin).toHaveBeenCalledWith("ABC123", "exit-ticket", "Bob"));
    // … und zwar dort abgelegt, wo die Spielerseite ihn sucht (useGuestSession).
    // Ohne das prägt der Hub den Token nur kurz und die Seite fragt erneut.
    expect(JSON.parse(localStorage.getItem("hp_guest_ABC123") ?? "null")?.token).toBe("gast");
    // … Identität für die Werkzeugseite hinterlegt …
    expect(readPlayIdentity("ABC123")?.name).toBe("Bob");
    // … und weiter.
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/play/exit-ticket/ABC123"));
  });

  it("fragt den Avatar nur, wo das Werkzeug ihn benutzt", async () => {
    mockResolve.mockResolvedValue({ code: "ABC123", matches: [exitTicket] });
    await enterCode("ABC123");
    await screen.findByPlaceholderText("Dein Name");
    expect(screen.queryByText("Avatar wählen")).not.toBeInTheDocument();
  });

  it("fragt den Avatar bei Caputh", async () => {
    mockResolve.mockResolvedValue({ code: "ABC123", matches: [caputh] });
    await enterCode("ABC123");
    expect(await screen.findByText("Avatar wählen")).toBeInTheDocument();
  });

  it("meldet, wenn Gäste für die Sitzung gesperrt sind", async () => {
    mockResolve.mockResolvedValue({ code: "ABC123", matches: [exitTicket] });
    mockGuestJoin.mockRejectedValue(new Error("Gäste sind für diese Sitzung nicht freigeschaltet"));
    const user = await enterCode("ABC123");
    await submitName(user, "Bob");

    expect(await screen.findByText(/nicht freigeschaltet/)).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
    expect(readPlayIdentity("ABC123")).toBeNull();
  });

  // ── Angemeldete ─────────────────────────────────────────────────────────

  it("leitet Angemeldete ohne Identitätsschritt durch", async () => {
    authState.auth = { user_type: "student", student: { vorname: "Ann", nachname: "M" } };
    mockResolve.mockResolvedValue({ code: "ABC123", matches: [exitTicket] });
    await enterCode("ABC123");

    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/play/exit-ticket/ABC123"));
    expect(mockGuestJoin).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText("Dein Name")).not.toBeInTheDocument();
  });

  it("lässt Angemeldete bei Caputh den Avatar wählen, den Namen aber nicht", async () => {
    authState.auth = { user_type: "student", student: { vorname: "Ann", nachname: "M" } };
    mockResolve.mockResolvedValue({ code: "ABC123", matches: [caputh] });
    const user = await enterCode("ABC123");

    expect(await screen.findByText("Avatar wählen")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Dein Name")).not.toBeInTheDocument();
    expect(screen.getByText("Ann M")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Beitreten" }));
    // Angemeldete brauchen keinen Gast-Token.
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/play/ABC123"));
    expect(mockGuestJoin).not.toHaveBeenCalled();
    expect(readPlayIdentity("ABC123")?.name).toBe("Ann M");
  });

  // ── Mehrdeutige Codes und Fehler ────────────────────────────────────────

  it("fragt nach, wenn ein Code zu mehreren Werkzeugen passt", async () => {
    mockResolve.mockResolvedValue({ code: "ABC123", matches: [exitTicket, simulation] });
    const user = await enterCode("ABC123");

    await waitFor(() => expect(screen.getByText(/Welches Spiel ist gemeint/)).toBeInTheDocument());
    expect(mockPush).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /Simulation/ }));
    await submitName(user, "Bob");
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith("/play/simulation/ABC123"));
  });

  it("markiert beendete Sitzungen in der Auswahl", async () => {
    mockResolve.mockResolvedValue({
      code: "ABC123",
      matches: [{ ...exitTicket, status: "closed" }, simulation],
    });
    await enterCode("ABC123");
    await waitFor(() => expect(screen.getByText("(beendet)")).toBeInTheDocument());
  });

  it("zeigt eine Meldung, wenn kein Werkzeug den Code kennt", async () => {
    mockResolve.mockRejectedValue(new Error("404"));
    await enterCode("NOPE12");
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Kein Spiel mit diesem Code gefunden.")
    );
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("fragt ohne Code gar nicht erst nach", async () => {
    const user = userEvent.setup();
    render(<JoinPage />);
    const btn = screen.getByRole("button", { name: "Beitreten" });
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(mockResolve).not.toHaveBeenCalled();
  });
});
