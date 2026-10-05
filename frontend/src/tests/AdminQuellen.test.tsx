// Admin »Quellen und Lizenzen«: Werkzeuge mit Quellen, Kartenkatalog, Lizenzen, npm-Lizenzen aus node_modules.
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("@/contexts/AuthContext", () => {
  // stabil wie der echte AuthContext (Seiten laden bei jeder Änderung von auth neu)
  const wert = { auth: { user_type: "teacher", role: "admin" }, ready: true };
  return { useAuth: () => wert };
});
vi.mock("@/lib/api", () => ({ api: { karten: { katalog: async () => ({ stand: "", ebenen: [
  { id: "de-laender", name: "Bundesländer", bereich: "de", quelle: { name: "© GeoBasis-DE / BKG (2026)", lizenz: "dl-de/by-2.0", url: "https://www.govdata.de/dl-de/by-2-0" } },
  { id: "de-fluesse", name: "Flüsse", bereich: "de", quelle: { name: "© GeoBasis-DE / BKG (2026)", lizenz: "dl-de/by-2.0", url: "https://www.govdata.de/dl-de/by-2-0" } },
] }) } } }));

import QuellenSeite from "@/app/admin/quellen/page";

describe("Admin: Quellen und Lizenzen", () => {
  it("gruppiert nach Werkzeug, fasst Kartenebenen je Quelle zusammen und nennt die Lizenz", async () => {
    render(<QueryClientProvider client={new QueryClient()}><QuellenSeite /></QueryClientProvider>);
    expect(await screen.findByText("© GeoBasis-DE / BKG (2026)")).toBeTruthy();
    expect(screen.getByText("Ebenen: Bundesländer, Flüsse")).toBeTruthy();
    expect(screen.getByText("🚦 GTA – Verkehr")).toBeTruthy();
    expect(screen.getByText("OpenStreetMap")).toBeTruthy();
    // EVAG-Fahrplan: offene Fahrplandaten, mit Quelle genannt
    expect(screen.getByText(/EVAG-Haltestellenfahrplan/).closest("tr")?.textContent).toContain("Open Data");
    // npm: Lizenz aus node_modules, nicht geraten
    expect(screen.getByText("maplibre-gl").closest("tr")?.textContent).toContain("BSD-3-Clause");
    expect(await screen.findByText("🪐 Sonnensystem")).toBeTruthy();
  });
});
