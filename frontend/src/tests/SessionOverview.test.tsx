/**
 * Sitzungsübersicht: Karten zu zweit pro Reihe, plus Schließen/Wiederöffnen.
 *
 * Zwei Dinge sind hier vertraglich: das Raster ist wirklich zweispaltig (darum
 * ging es bei der Umstellung), und in der Werkzeugliste darf man nur die
 * eigenen Sitzungen schließen — fremde sieht man als Admin, anfassen nicht.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ auth: { role: "admin" } }),
}));
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
  },
}));

import { SessionGrid } from "@/components/SessionGrid";
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

describe("SessionGrid", () => {
  it("stellt die Karten zu zweit in eine Reihe", () => {
    const { container } = render(
      <SessionGrid items={[{ code: "A", title: "5a" }, { code: "B", title: "5b" }]} />,
    );
    const list = container.querySelector("ul")!;
    expect(list.className).toContain("sm:grid-cols-2");
    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });

  it("sagt Bescheid, wenn nichts läuft", () => {
    render(<SessionGrid items={[]} empty="Nichts los." />);
    expect(screen.getByText("Nichts los.")).toBeInTheDocument();
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

    expect(await screen.findByRole("button", { name: "Ansehen" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Schließen" })).not.toBeInTheDocument();
  });

  it("nennt den geteilten Inhalt statt einer nackten Id", async () => {
    sessions.mockResolvedValue([row({ tool_slug: "zeitstrahl", ref_id: 7, ref_title: "Römische Kaiser" })]);
    withQuery(<ToolSessionList slug="zeitstrahl" />);
    expect(await screen.findByText("Römische Kaiser")).toBeInTheDocument();
  });
});
