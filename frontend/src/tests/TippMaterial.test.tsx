import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "./helpers";
import TippMaterial from "@/components/tippen/TippMaterial";
import { api } from "@/lib/api";

// Die Freigabe wird als Hook gemockt — der Weg über die Abfrage macht
// Sichtbarkeitstests flakig (siehe useAvailability).
const darf = vi.fn(() => true);
vi.mock("@/hooks/useAvailability", () => ({
  useAvailability: () => ({ can: (...a: unknown[]) => darf(...(a as [])), ready: true }),
}));

const SAMMLUNG = {
  id: 7,
  title: "Die Zelle",
  description: null,
  texts: [{ title: "Bausteine", text: "Die Zelle hat eine Membran." }],
  words: ["zellkern"],
  settings: { lock_on_error: true },
  created_by: 1,
};

beforeEach(() => {
  darf.mockReturnValue(true);
  vi.spyOn(api.tipptexte, "list").mockResolvedValue([
    { id: 7, title: "Die Zelle", description: null, anzahl_texte: 1, anzahl_woerter: 1 },
  ]);
  vi.spyOn(api.tipptexte, "get").mockResolvedValue(SAMMLUNG);
});

describe("TippMaterial", () => {
  it("bietet die eingebauten Lektionen und die hochgeladenen Sammlungen an", async () => {
    renderWithProviders(<TippMaterial gewaehlt={null} onWaehlen={() => {}} />);
    expect(screen.getByRole("option", { name: /Eingebaute Lektionen/ })).toBeInTheDocument();
    expect(await screen.findByRole("option", { name: /Die Zelle/ })).toBeInTheDocument();
  });

  it("lädt die gewählte Sammlung und meldet sie nach oben", async () => {
    const gewaehlt = vi.fn();
    renderWithProviders(<TippMaterial gewaehlt={null} onWaehlen={gewaehlt} />);
    await screen.findByRole("option", { name: /Die Zelle/ });

    fireEvent.change(screen.getByLabelText("Material"), { target: { value: "7" } });
    await waitFor(() => expect(gewaehlt).toHaveBeenCalledWith(SAMMLUNG));
  });

  it("meldet zurück auf die Lektionen, wenn wieder umgestellt wird", async () => {
    const gewaehlt = vi.fn();
    renderWithProviders(<TippMaterial gewaehlt={SAMMLUNG} onWaehlen={gewaehlt} />);
    fireEvent.change(screen.getByLabelText("Material"), { target: { value: "" } });
    expect(gewaehlt).toHaveBeenCalledWith(null);
  });

  it("zeigt Hochladen nur mit Freigabe", async () => {
    darf.mockReturnValue(false);
    renderWithProviders(<TippMaterial gewaehlt={null} onWaehlen={() => {}} />);
    await screen.findByRole("option", { name: /Die Zelle/ });
    expect(screen.queryByRole("button", { name: /Hochladen/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Vorlage/ })).not.toBeInTheDocument();
  });

  it("zeigt Hochladen und Vorlage mit Freigabe", async () => {
    renderWithProviders(<TippMaterial gewaehlt={null} onWaehlen={() => {}} />);
    await screen.findByRole("option", { name: /Die Zelle/ });
    expect(screen.getByRole("button", { name: /Hochladen/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Vorlage/ })).toBeInTheDocument();
  });

  it("sagt, ob die Fehlersperre für dieses Material gilt", () => {
    // Getrennt gerendert: rerender() aus dem Helfer legt den QueryClient-Provider
    // nicht wieder um den Baum.
    const { unmount } = renderWithProviders(<TippMaterial gewaehlt={SAMMLUNG} onWaehlen={() => {}} />);
    expect(screen.getByText(/mit Fehlersperre/)).toBeInTheDocument();
    unmount();

    const ohne = { ...SAMMLUNG, settings: { lock_on_error: false } };
    renderWithProviders(<TippMaterial gewaehlt={ohne} onWaehlen={() => {}} />);
    expect(screen.getByText(/ohne Fehlersperre/)).toBeInTheDocument();
  });

  it("meldet einen fehlgeschlagenen Upload im Klartext", async () => {
    vi.spyOn(api.tipptexte, "upload").mockRejectedValue(new Error("Text 1: Tottasten"));
    renderWithProviders(<TippMaterial gewaehlt={null} onWaehlen={() => {}} />);
    await screen.findByRole("option", { name: /Die Zelle/ });

    const eingabe = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(eingabe, {
      target: { files: [new File(["{}"], "s.json", { type: "application/json" })] },
    });
    expect(await screen.findByText(/Tottasten/)).toBeInTheDocument();
  });
});
