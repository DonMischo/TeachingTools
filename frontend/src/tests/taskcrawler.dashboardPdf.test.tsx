/**
 * TaskCrawler-Live-Dashboard: Knopf »Ergebnissicherung (PDF)« holt die
 * Merksätze der Sitzung und speichert das PDF; ohne Merksätze ein Hinweis.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({ useParams: () => ({ code: "TC1234" }) }));
vi.mock("qrcode.react", () => ({ QRCodeSVG: () => <div data-testid="qrcode" /> }));
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: () => Promise.resolve({ ip: "192.168.1.100" }) }));
vi.stubGlobal("WebSocket", class {
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: (() => void) | null = null;
  close = vi.fn();
  send = vi.fn();
});

const speichere = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/taskcrawler/ergebnisPdf", () => ({ speichereErgebnisPdf: (...a: unknown[]) => speichere(...a) }));

import * as apiModule from "@/lib/api";
import HostPage from "@/app/aktivitaeten/taskcrawler/host/[code]/page";

const ABSCHNITTE = [{ abschnitt: 1, titel: "Die Tür", eintraege: [{ titel: "", text: "1 + 1 = 2" }] }];

function zeige() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><HostPage /></QueryClientProvider>);
}

describe("TaskCrawler-Dashboard: Ergebnissicherung als PDF", () => {
  beforeEach(() => {
    speichere.mockClear();
    vi.spyOn(apiModule.api.exitgame.sessions, "get").mockResolvedValue({ join_code: "TC1234" } as never);
    vi.spyOn(apiModule.api.exitgame.sessions, "report").mockResolvedValue({ attempts: [] } as never);
  });

  it("lädt die Merksätze und speichert das PDF mit Titel und Akzentfarbe", async () => {
    const holen = vi.spyOn(apiModule.api.exitgame.sessions, "ergebnissicherung")
      .mockResolvedValue({ title: "Testspiel", ergebnissicherung: ABSCHNITTE, akzent: "#f0abfc" });
    zeige();
    await userEvent.click(await screen.findByRole("button", { name: /Ergebnissicherung \(PDF\)/ }));
    await waitFor(() => expect(speichere).toHaveBeenCalledTimes(1));
    expect(holen).toHaveBeenCalledWith("TC1234");
    expect(speichere).toHaveBeenCalledWith({ titel: "Testspiel", abschnitte: ABSCHNITTE, akzent: "#f0abfc" });
  });

  it("ohne Merksätze kein PDF, sondern ein Hinweis", async () => {
    vi.spyOn(apiModule.api.exitgame.sessions, "ergebnissicherung")
      .mockResolvedValue({ title: "Leer", ergebnissicherung: [], akzent: null });
    zeige();
    await userEvent.click(await screen.findByRole("button", { name: /Ergebnissicherung \(PDF\)/ }));
    expect(await screen.findByText(/keine Ergebnissicherung/)).toBeInTheDocument();
    expect(speichere).not.toHaveBeenCalled();
  });
});
