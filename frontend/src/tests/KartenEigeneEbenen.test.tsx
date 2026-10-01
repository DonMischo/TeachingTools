// Eigene Kartenebenen: hochladen schaltet die neue Ebene ein; Fehlermeldung des Servers erscheint lesbar.
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Ebene } from "@/lib/karten/stil";

// Fehlerfall ohne vi.fn: Vitest 4 hängt an jedes vi.fn-Ergebnis ein eigenes Promise
// und meldet dessen Ablehnung als unbehandelt, obwohl die Komponente sie fängt.
const { hochladen, fehler } = vi.hoisted(() => ({ hochladen: vi.fn(), fehler: { text: "" } }));
vi.mock("@/lib/api", () => ({ api: { karten: { eigeneHochladen: (f: File, t: string) =>
  fehler.text ? Promise.reject(new Error(fehler.text)) : hochladen(f, t) } } }));

import EigeneEbenen from "@/components/karten/EigeneEbenen";

const EIGEN: Ebene = {
  id: "eigen-3", name: "Burgen", gruppe: "eigen", bereich: "eigen", geometrie: "punkt", quiz: true, anzahl: 2, bytes: 0,
  quelle: { name: "Eigene Daten", lizenz: "", url: "" },
  eigen: { id: 3, eigen: true, geteilt: false, namensfeld: "name", felder: ["name", "art"], dateiname: "burgen.kml" },
};

function zeige(schalte = vi.fn(), ebenen: Ebene[] = []) {
  const qc = new QueryClient();
  render(<QueryClientProvider client={qc}><EigeneEbenen ebenen={ebenen} an={[]} schalte={schalte} lehrkraft /></QueryClientProvider>);
  return schalte;
}

describe("Eigene Ebenen", () => {
  beforeEach(() => { hochladen.mockReset(); fehler.text = ""; });

  it("lädt hoch und schaltet die neue Ebene ein", async () => {
    hochladen.mockResolvedValue({ ...EIGEN });
    const schalte = zeige();
    const datei = new File(["{}"], "burgen.kml");
    fireEvent.change(screen.getByLabelText("Datei für eigene Ebene"), { target: { files: [datei] } });
    fireEvent.change(screen.getByPlaceholderText(/Name der Ebene/), { target: { value: "Burgen" } });
    fireEvent.click(screen.getByText(/Hochladen/));
    await waitFor(() => expect(schalte).toHaveBeenCalledWith("eigen-3"));
    expect(hochladen).toHaveBeenCalledWith(datei, "Burgen");
    expect(screen.getByText(/mit 2 Objekten geladen/)).toBeTruthy();
  });

  it("zeigt die Meldung des Servers ohne JSON-Hülle", async () => {
    fehler.text = '{"detail":"Erlaubt sind GeoJSON, KML, KMZ und GPX."}';
    zeige();
    fireEvent.change(screen.getByLabelText("Datei für eigene Ebene"), { target: { files: [new File(["x"], "a.shp")] } });
    fireEvent.click(screen.getByText(/Hochladen/));
    expect(await screen.findByText("Erlaubt sind GeoJSON, KML, KMZ und GPX.")).toBeTruthy();
  });

  it("listet eigene Ebenen mit Löschknopf", () => {
    zeige(vi.fn(), [EIGEN]);
    expect(screen.getByText("Burgen")).toBeTruthy();
    expect(screen.getByLabelText("Burgen löschen")).toBeTruthy();
  });
});
