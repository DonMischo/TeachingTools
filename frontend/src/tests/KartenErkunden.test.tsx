// Kartentool per Code zum Erkunden: Katalog, Ebenen und Suche laufen über die
// Sitzung (mit Gast-Token), Lehrkraft-Werkzeuge bleiben aus — auch für eine
// Lehrkraft, die über den Code kommt.
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Katalog } from "@/lib/karten/stil";

const KATALOG: Katalog = {
  stand: "2026-10-01",
  ebenen: [
    { id: "de-laender", name: "Bundesländer", gruppe: "politisch", bereich: "de", geometrie: "flaeche", quiz: true, bytes: 1, quelle: { name: "BKG", lizenz: "dl-de/by-2.0", url: "" } },
    { id: "de-staedte", name: "Städte", gruppe: "politisch", bereich: "de", geometrie: "punkt", quiz: true, bytes: 1, quelle: { name: "BKG", lizenz: "dl-de/by-2.0", url: "" } },
  ],
};

const { sitzungKatalog, sitzungSuche, katalog, ansicht } = vi.hoisted(() => ({
  sitzungKatalog: vi.fn(async (_c: string, _t?: string | null) => KATALOG),
  sitzungSuche: vi.fn(async (_c: string, _q: string, _b?: string, _t?: string | null) => []),
  katalog: vi.fn(async () => KATALOG),
  ansicht: vi.fn(),
}));
vi.mock("@/lib/api", () => ({
  api: { karten: {
    katalog: () => katalog(),
    sitzungKatalog: (c: string, t?: string | null) => sitzungKatalog(c, t),
    sitzungEbene: async () => ({ type: "FeatureCollection", features: [] }),
    sitzungSuche: (c: string, q: string, b?: string, t?: string | null) => sitzungSuche(c, q, b, t),
    saetze: async () => [],
  } },
}));
vi.mock("@/contexts/AuthContext", () => {
  const wert = { auth: { user_type: "teacher", role: "teacher" }, ready: true };
  return { useAuth: () => wert };
});
vi.mock("@/components/karten/KartenAnsicht", () => ({
  default: (p: { stil: { sources: Record<string, { data?: unknown }> }; gastToken?: string | null }) => { ansicht(p); return <div>Karte</div>; },
}));
vi.mock("@/components/karten/UebenListe", () => ({ default: () => <div>Üben-Liste</div> }));

import Karten from "@/components/karten/Karten";

async function zeige(zugang?: { code: string; token?: string | null }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={qc}><Karten zugang={zugang} /></QueryClientProvider>);
  await screen.findByText("Karte");
}

describe("Karten erkunden per Code", () => {
  it("lädt über die Sitzung mit Token und zeigt keine Lehrkraft-Werkzeuge", async () => {
    await zeige({ code: "KX12", token: "gast" });
    expect(sitzungKatalog).toHaveBeenCalledWith("KX12", "gast");
    expect(katalog).not.toHaveBeenCalled();
    expect(screen.queryByText(/Auswählen/)).toBeNull();
    expect(screen.queryByText("Üben-Liste")).toBeNull();
    // MapLibre holt die Ebenen von der Sitzungsadresse, mit dem Token
    const p = ansicht.mock.calls.at(-1)![0] as { stil: { sources: Record<string, { data?: unknown }> }; gastToken?: string | null };
    expect(p.gastToken).toBe("gast");
    const urls = Object.values(p.stil.sources).map(s => String(s.data ?? ""));
    expect(urls.some(u => u.startsWith("/api/karten/sitzung/KX12/ebenen/"))).toBe(true);
    expect(urls.some(u => u.startsWith("/api/karten/ebenen/"))).toBe(false);
  });

  it("die Ortssuche fragt die Sitzung", async () => {
    await zeige({ code: "KX12", token: "gast" });
    vi.useFakeTimers();
    try {
      fireEvent.change(screen.getByLabelText("Auf der Karte suchen"), { target: { value: "Erfurt" } });
      await act(async () => { vi.advanceTimersByTime(300); });
      expect(sitzungSuche).toHaveBeenCalledWith("KX12", "Erfurt", "de", "gast");
    } finally {
      vi.useRealTimers();
    }
  });

  it("ohne Code bleibt alles wie gehabt", async () => {
    await zeige();
    expect(katalog).toHaveBeenCalled();
    expect(screen.getByText(/Auswählen/)).toBeTruthy();
  });
});
