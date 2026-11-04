import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const material = vi.fn();
const materialAnlegen = vi.fn();
vi.mock("@/lib/api", () => ({ api: { kikompass: { material: (...a: unknown[]) => material(...a), materialAnlegen: (...a: unknown[]) => materialAnlegen(...a) } } }));

import { Materialpool } from "@/components/kikompass/Materialpool";

const EINTRAG = {
  id: 1, titel: "Echt oder KI? Bildkarten", text: "Acht Karten.", fach: "Deutsch", klassen: "5-6",
  bereich: "reflektieren", stufe: "Ia", dimension: "ueber", art: "Sortieraufgabe", link: null,
  autor: "Bert B.", eigen: false, erstellt_am: "2026-11-04T10:00:00Z",
};

function zeige(vorlage = null as Parameters<typeof Materialpool>[0]["vorlage"]) {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <Materialpool vorlage={vorlage} onVorlageVerbraucht={() => {}} />
    </QueryClientProvider>,
  );
}

describe("KI-Kompass Materialpool", () => {
  beforeEach(() => { material.mockReset(); materialAnlegen.mockReset(); });

  it("zeigt geteiltes Material mit Feld und Autor, ohne Bearbeiten für Fremdes", async () => {
    material.mockResolvedValue([EINTRAG]);
    zeige();
    fireEvent.click(await screen.findByText("Echt oder KI? Bildkarten"));
    expect(screen.getByText(/Reflektieren · Stufe Ia · Lernen über KI/)).toBeInTheDocument();
    expect(screen.getByText(/Bert B\./)).toBeInTheDocument();
    expect(screen.queryByText(/Bearbeiten/)).toBeNull();
  });

  it("filtert über die API", async () => {
    material.mockResolvedValue([]);
    zeige();
    fireEvent.change(screen.getByLabelText("Bereich"), { target: { value: "anwenden" } });
    await waitFor(() => expect(material).toHaveBeenLastCalledWith(expect.objectContaining({ bereich: "anwenden" })));
  });

  it("übernimmt die Vorbelegung aus »Material erstellen« und speichert", async () => {
    material.mockResolvedValue([]);
    materialAnlegen.mockResolvedValue({ ...EINTRAG, eigen: true });
    zeige({ titel: "Werbung erkennen", text: "", fach: "Deutsch", klassen: "7", bereich: "anwenden", stufe: "Ib", dimension: "mit", art: "Fallbeispiel", link: null });
    expect(screen.getByDisplayValue("Werbung erkennen")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(materialAnlegen).toHaveBeenCalledWith(expect.objectContaining({ titel: "Werbung erkennen", bereich: "anwenden", link: null })));
  });
});
