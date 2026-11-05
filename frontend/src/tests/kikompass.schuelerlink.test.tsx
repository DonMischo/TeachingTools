import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const LINK = "https://chat.example.org/lernumgebung/klasse7";
const SETTINGS = { ais: { standard: LINK, stationen: {}, anzeige: "link" } };
const sitzungStand = vi.fn(async () => ({ ok: true }));

vi.mock("@/lib/api", () => ({
  api: {
    kikompass: {
      stand: async () => ({ einschaetzungen: [], stationen: {} }),
      speichern: async () => ({ ok: true }),
      meineSitzung: async () => ({ code: "KLASSE7", settings: SETTINGS }),
      sitzungStand: (...a: unknown[]) => sitzungStand(...(a as [])),
    },
    toolSessions: { get: async () => ({ code: "KLASSE7", tool_slug: "kikompass", settings: SETTINGS }) },
  },
}));

import KiKompass from "@/components/kikompass/KiKompass";

describe("Schülerkonto ohne Code", () => {
  it("sieht den AIS.chat-Link der zuletzt genutzten Sitzung in der Station", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <KiKompass konto speicherSchluessel="konto-student-1" name="Testkind" />
      </QueryClientProvider>,
    );
    fireEvent.click(await screen.findByRole("tab", { name: /KI-Führerschein/ }));
    fireEvent.click(screen.getByRole("button", { name: /Die KI irrt sich/ }));
    fireEvent.click(screen.getByRole("button", { name: /AIS\.chat/ }));
    expect(await screen.findByRole("link", { name: /AIS.chat öffnen/ })).toHaveAttribute("href", LINK);
    // Kein Eingabefeld für Lernende.
    expect(screen.queryByLabelText("AIS.chat-Link")).toBeNull();
  });
});
