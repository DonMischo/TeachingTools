// Kartensatz-Editor: Objekt per Klick wählen, nummerieren, Tabelle, speichern.
// Die MapLibre-Fläche ist gemockt (kein WebGL in jsdom) — sie meldet Klicks über einen Knopf.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Katalog } from "@/lib/karten/stil";

const KATALOG: Katalog = {
  stand: "2026-10-01",
  ebenen: [
    { id: "de-laender", name: "Bundesländer", gruppe: "politisch", bereich: "de", geometrie: "flaeche", quiz: true, bytes: 1, quelle: { name: "BKG", lizenz: "dl-de/by-2.0", url: "" } },
    { id: "de-staedte", name: "Städte", gruppe: "politisch", bereich: "de", geometrie: "punkt", quiz: true, bytes: 1, quelle: { name: "BKG", lizenz: "dl-de/by-2.0", url: "" } },
    { id: "de-fluesse", name: "Flüsse", gruppe: "topographisch", bereich: "de", geometrie: "linie", quiz: true, bytes: 1, quelle: { name: "BKG", lizenz: "dl-de/by-2.0", url: "" } },
  ],
};
const STAEDTE = { type: "FeatureCollection", features: [
  { type: "Feature", geometry: { type: "Point", coordinates: [11.03, 50.98] }, properties: { id: "16051000", name: "Erfurt", ew: 218793 } },
  { type: "Feature", geometry: { type: "Point", coordinates: [11.59, 50.93] }, properties: { id: "16053000", name: "Jena", ew: 110000 } },
] };

const { anlegen, exportieren } = vi.hoisted(() => ({
  exportieren: vi.fn(async (_body?: unknown) => ({ datei: new Blob(["%PDF"]), name: "karte.pdf" })),
  anlegen: vi.fn(async (body?: { inhalt: unknown }) => ({ id: 7, titel: "Test", geteilt: false, eigen: true, autor: "", aktualisiert_am: "", inhalt: body?.inhalt })),
}));
vi.mock("@/lib/api", () => ({
  api: { karten: {
    katalog: async () => KATALOG,
    ebene: async (id: string) => (id === "de-staedte" ? STAEDTE : { type: "FeatureCollection", features: [] }),
    saetze: async () => [],
    anlegen: (b: { inhalt: unknown }) => anlegen(b),
    export: (b: unknown) => exportieren(b),
  } },
}));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { user_type: "teacher", role: "teacher" }, ready: true }) }));
vi.mock("@/components/karten/KartenAnsicht", () => ({
  default: ({ onKlick, bildRef }: { onKlick: (t: unknown[]) => void; bildRef?: { current: unknown } }) => {
    if (bildRef) bildRef.current = async () => "data:image/png;base64,iVBORw0KGgo=";
    return (
    <div>
      <button onClick={() => onKlick([
        { ebene: "de-laender", id: "16", name: "Thüringen", eigenschaften: {} },
        { ebene: "de-staedte", id: "16053000", name: "Jena", eigenschaften: {} },
      ])}>Klick auf Jena</button>
    </div>
    );
  },
}));

import Karten from "@/components/karten/Karten";

function zeige() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}><Karten /></QueryClientProvider>);
}

describe("Kartensatz-Editor", () => {
  beforeEach(() => anlegen.mockClear());

  it("wählt per Klick in der aktiven Ebene, nummeriert, zeigt die Tabelle und speichert nur ids", async () => {
    zeige();
    fireEvent.click(await screen.findByText("🎯 Auswählen"));
    // Ebene Städte ist voreingestellt; Bundesland unter dem Klick wird ignoriert
    fireEvent.change(screen.getByDisplayValue("keine"), { target: { value: "gross" } });
    fireEvent.click(screen.getByText("Klick auf Jena"));

    const tabelle = await screen.findByRole("region", { name: "Arbeitsblatt" });
    await waitFor(() => expect(within(tabelle).getByText("A")).toBeTruthy());
    expect(within(tabelle).queryByText("Jena")).toBeNull();
    fireEvent.click(within(tabelle).getByLabelText(/Lösung zeigen/));
    expect(within(tabelle).getByText("Jena")).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText(/Name, z\. B\./), { target: { value: "Städte Thüringen" } });
    fireEvent.click(screen.getByText(/Speichern als neu/));
    await waitFor(() => expect(anlegen).toHaveBeenCalled());
    const body = anlegen.mock.calls[0][0] as { titel: string; inhalt: { auswahl: Record<string, unknown> } };
    expect(body.titel).toBe("Städte Thüringen");
    expect(body.inhalt.auswahl).toEqual({ "de-staedte": { zeigen: "alle", objekte: ["16053000"], nummerierung: "gross" } });
  });

  it("Suche fügt hinzu, zweiter Klick wählt ab", async () => {
    zeige();
    fireEvent.click(await screen.findByText("🎯 Auswählen"));
    fireEvent.change(screen.getByPlaceholderText(/Suchen und hinzufügen/), { target: { value: "erf" } });
    fireEvent.click(await screen.findByText("Erfurt"));
    fireEvent.click(screen.getByText("Klick auf Jena"));
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("Erfurt"), expect.stringContaining("Jena")]));
    fireEvent.click(screen.getByText("Klick auf Jena"));
    expect(screen.queryByText("Jena", { selector: "span" })).toBeNull();
  });
});

describe("Arbeitsblatt-Export", () => {
  it("schickt Kartenbild, Aufgabe und Marken mit Namen an den Server", async () => {
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    zeige();
    fireEvent.click(await screen.findByText("🎯 Auswählen"));
    fireEvent.change(screen.getByDisplayValue("keine"), { target: { value: "zahl" } });
    fireEvent.click(screen.getByText("Klick auf Jena"));
    fireEvent.change(await screen.findByLabelText("Variante"), { target: { value: "aufgabe" } });
    fireEvent.click(screen.getByText(/^\s*PDF$/));
    await waitFor(() => expect(exportieren).toHaveBeenCalled());
    const body = exportieren.mock.calls[0][0] as Record<string, unknown>;
    expect(body).toMatchObject({
      format: "pdf", variante: "aufgabe", karte: "data:image/png;base64,iVBORw0KGgo=",
      gruppen: [{ name: "Städte", eintraege: [{ marke: "1", name: "Jena" }] }],
    });
    expect(String(body.aufgabe)).toMatch(/Finde und benenne/);
  });
});
