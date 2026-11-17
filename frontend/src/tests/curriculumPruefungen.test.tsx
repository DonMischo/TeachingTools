import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { api } from "@/lib/api";
import { Pruefungen } from "@/components/curriculum/Pruefungen";
import { Anhaenge, GewaehlteDateien, dateiArt } from "@/components/fragmente/Anhaenge";

vi.spyOn(api.stundenplaner, "toolRefs").mockResolvedValue([
  { type: "simulation", label: "🔬 Simulation", requires_ref: true, uses_class: false, items: [{ ref_id: "prozent", label: "💯 Prozent" }] },
  { type: "fragmente", label: "🗂️ Fragmente", requires_ref: true, uses_class: false, items: [{ ref_id: "c4:r9", label: "Mathe › Kl. 6 · Brüche › LK Brüche" }] },
]);

describe("Tests und Klassenarbeiten", () => {
  it("legt einen Test nur mit Namen an", () => {
    const aendern = vi.fn();
    render(<Pruefungen liste={[]} onChange={aendern} />);
    fireEvent.click(screen.getByText("+ Test / Klassenarbeit"));
    const feld = screen.getByLabelText("Name");
    fireEvent.change(feld, { target: { value: "Klassenarbeit Brüche" } });
    fireEvent.keyDown(feld, { key: "Enter" });
    expect(aendern).toHaveBeenCalledWith([expect.objectContaining({ name: "Klassenarbeit Brüche", link: null })]);
  });

  it("verknüpft später mit Fragmente — der Picker bietet nur Fragmente und Links an", async () => {
    const aendern = vi.fn();
    render(<Pruefungen liste={[{ id: "p1", name: "LK Brüche", link: null }]} onChange={aendern} />);
    fireEvent.click(screen.getByText("🔗 verknüpfen"));
    expect(await screen.findByText("🗂️ Fragmente")).toBeTruthy();
    expect(screen.queryByText("🔬 Simulation")).toBeNull();
    fireEvent.click(screen.getByText("🗂️ Fragmente"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "c4:r9" } });
    fireEvent.click(screen.getByText("Einbinden"));
    expect(aendern).toHaveBeenCalledWith([{ id: "p1", name: "LK Brüche",
      link: { type: "fragmente", ref_id: "c4:r9", url: null, label: "Mathe › Kl. 6 · Brüche › LK Brüche" } }]);
  });

  it("zeigt verknüpfte Tests mit nur einem Link und ohne Knöpfe, wenn nur gelesen wird", () => {
    render(<Pruefungen liste={[{ id: "p1", name: "Test 1", link: { type: "fragmente", ref_id: "c4", url: null, label: "Mathe" } }]} />);
    expect(screen.getByText("▶ Mathe")).toBeTruthy();
    expect(screen.queryByText("+ Test / Klassenarbeit")).toBeNull();
    expect(screen.queryByText("🔗 verknüpfen")).toBeNull();
  });
});

describe("Anhänge", () => {
  it("zeigt Dokumente mit Name, Endung und Herunterladen", () => {
    const pdf = vi.fn();
    render(<Anhaenge onPdf={pdf} media={[
      { id: 1, kind: "pdf", path: "/u/a.pdf", name: "AB Brüche.pdf", order_index: 0 },
      { id: 2, kind: "file", path: "/u/b.docx", name: "Test.docx", order_index: 1 },
      { id: 3, kind: "image", path: "/u/c.png", name: "Bild.png", order_index: 2 },
    ]} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("DOCX")).toBeTruthy();
    fireEvent.click(screen.getByText("AB Brüche.pdf"));
    expect(pdf).toHaveBeenCalledWith("/u/a.pdf");
    expect(screen.getByLabelText("Test.docx herunterladen").getAttribute("download")).toBe("Test.docx");
    expect(dateiArt("x.ods").art).toBe("Tabelle");
  });

  it("listet gewählte Dateien vor dem Hochladen", () => {
    const weg = vi.fn();
    render(<GewaehlteDateien dateien={[new File(["x".repeat(2048)], "notizen.md")]} onEntfernen={weg} />);
    expect(screen.getByText("notizen.md")).toBeTruthy();
    expect(screen.getByText("MD · 2 KB")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("notizen.md nicht hochladen"));
    expect(weg).toHaveBeenCalledWith(0);
  });
});
