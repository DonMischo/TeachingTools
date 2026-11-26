/**
 * Sitzungsübersicht: eine Liste für alle Werkzeuge, plus Schließen/Wiederöffnen.
 *
 * Vertraglich: in der Werkzeugliste darf man nur die
 * eigenen Sitzungen schließen — fremde sieht man als Admin, anfassen nicht.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/contexts/AuthContext", () => {
  // stabil wie der echte AuthContext (Seiten laden bei jeder Änderung von auth neu)
  const wert = { auth: { role: "admin" } };
  return { useAuth: () => wert };
});
vi.mock("@/contexts/ToastContext", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const sessions = vi.fn();
const close = vi.fn();
const reopen = vi.fn();
vi.mock("@/lib/api", () => ({
  api: {
    play: {
      sessions: (...a: unknown[]) => sessions(...a),
      close: (...a: unknown[]) => close(...a),
      reopen: (...a: unknown[]) => reopen(...a),
    },
    classes: { list: async () => [] },
    groups: { list: async () => [] },
  },
}));

import { SitzungListe } from "@/components/sitzung/SitzungListe";
import { ToolSessionList } from "@/components/ToolSessionList";

function row(over: Record<string, unknown> = {}) {
  return {
    tool: "simulation", label: "🧮 Simulation", code: "AAA111",
    join_url: "/play/simulation/AAA111", status: "open", closed: false,
    mine: true, created_at: null, tool_slug: "tippen", ref_id: null,
    ref_title: null, owner: "Anna Müller", ...over,
  };
}

function withQuery(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("SitzungListe", () => {
  it("zeigt je Sitzung eine Zeile mit Status, Code und Klasse", () => {
    render(<SitzungListe eintraege={[
      { code: "A1", klasse: "5a", status: { label: "offen", ton: "live" } },
      { code: "B2", klasse: "5b" },
    ]} />);
    const zeilen = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(zeilen).toHaveLength(2);
    expect(within(zeilen[0]).getByText("offen")).toBeInTheDocument();
    expect(within(zeilen[0]).getByText("5a")).toBeInTheDocument();
  });

  it("sagt Bescheid, wenn nichts läuft", () => {
    render(<SitzungListe eintraege={[]} leer="Nichts los." />);
    expect(screen.getByText("Nichts los.")).toBeInTheDocument();
  });

  it("startet erst, wenn eine Klasse gewählt ist — außer »Ohne Klasse«", async () => {
    const user = userEvent.setup();
    const start = vi.fn();
    withQuery(<SitzungListe eintraege={[]} neu={{ onStart: start, ohneKlasse: true }} />);
    expect(screen.getByRole("button", { name: "Starten" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Ohne Klasse" }));
    expect(start).toHaveBeenCalledWith(null);
  });
});

describe("ToolSessionList", () => {
  beforeEach(() => {
    sessions.mockReset(); close.mockReset(); reopen.mockReset();
    close.mockResolvedValue(row({ closed: true }));
    reopen.mockResolvedValue(row({ closed: false }));
  });

  it("fragt nur die Sitzungen dieses einen Werkzeugs ab", async () => {
    sessions.mockResolvedValue([row()]);
    withQuery(<ToolSessionList slug="tippen" />);
    await waitFor(() => expect(sessions).toHaveBeenCalledWith("simulation", "tippen"));
  });

  it("schließt eine eigene Sitzung und bietet danach das Wiederöffnen an", async () => {
    const user = userEvent.setup();
    // Erst offen, nach dem Schliessen liefert das erneute Laden sie geschlossen.
    sessions.mockResolvedValueOnce([row()])
            .mockResolvedValue([row({ closed: true, status: "closed" })]);
    withQuery(<ToolSessionList slug="tippen" />);

    await user.click(await screen.findByRole("button", { name: "Schließen" }));
    await waitFor(() => expect(close).toHaveBeenCalledWith("simulation", "AAA111"));

    expect(await screen.findByRole("button", { name: "Wieder öffnen" })).toBeInTheDocument();
  });

  it("lässt fremde Sitzungen sehen, aber nicht schließen", async () => {
    sessions.mockResolvedValue([row({ mine: false })]);
    withQuery(<ToolSessionList slug="tippen" />);

    expect(await screen.findByRole("link", { name: "Ansehen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Schließen" })).not.toBeInTheDocument();
  });

  it("nennt den geteilten Inhalt statt einer nackten Id", async () => {
    sessions.mockResolvedValue([row({ tool_slug: "zeitstrahl", ref_id: 7, ref_title: "Römische Kaiser" })]);
    withQuery(<ToolSessionList slug="zeitstrahl" />);
    expect(await screen.findByText("Römische Kaiser")).toBeInTheDocument();
  });
});
