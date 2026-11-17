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

describe("Titel aus Dateiname", () => {
  it("nimmt Endung und Trenner weg", async () => {
    const { titelAusDatei } = await import("@/components/fragmente/Anhaenge");
    expect(titelAusDatei("AB_Brüche-kürzen_v2.pdf")).toBe("AB Brüche kürzen v2");
    expect(titelAusDatei("Klassenarbeit 7b.docx")).toBe("Klassenarbeit 7b");
  });
});

describe("Alte Karten entfernen", () => {
  it("lässt sich rückgängig machen: Lehrplan, Abgleich und Einheiten kommen zurück", async () => {
    const { umkehrOps, leereVorlage } = await import("@/lib/curriculum/modell");
    const v = leereVorlage("Mathematik");
    v.lehrplaene = [{ id: "alt", rolle: "alt", schulart: "RS", karten: [{ id: "a1" }] } as never];
    v.abgleich = [{ id: "p1", alt: ["a1"], neu: [], status: "entfallen" } as never];
    v.curriculum.klassen = [{ klasse: 5, wochen_verfuegbar: 36, themen: [{ id: "t1", titel: "E", wochen: null, inhalte: {}, karten: ["a1"] }] }];
    const zurueck = umkehrOps(v, [{ op: "lehrplan_loeschen", id: "alt" }])!;
    expect(zurueck[0]).toEqual({ op: "import", daten: { lehrplaene: [v.lehrplaene[0]], abgleich: v.abgleich } });
    expect(zurueck).toContainEqual({ op: "thema", klasse: 5, pos: 0, thema: v.curriculum.klassen[0].themen[0] });
  });
});

describe("☰-Menü", () => {
  it("öffnet, führt einen Punkt aus und schließt", async () => {
    const { Menue, MenueAbschnitt, MenuePunkt } = await import("@/components/curriculum/Menue");
    const los = vi.fn();
    render(<Menue><MenueAbschnitt titel="Plan"><MenuePunkt onClick={los}>⧉ Kopie</MenuePunkt></MenueAbschnitt></Menue>);
    expect(screen.queryByRole("menu")).toBeNull();
    fireEvent.click(screen.getByLabelText("Menü"));
    fireEvent.click(screen.getByRole("menuitem", { name: "⧉ Kopie" }));
    expect(los).toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
