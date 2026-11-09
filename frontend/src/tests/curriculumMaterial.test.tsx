import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { api } from "@/lib/api";
import { MaterialSammlung, Verknuepfungen } from "@/components/curriculum/Verknuepfungen";
import { umkehrOps, leereVorlage } from "@/lib/curriculum/modell";

vi.spyOn(api.stundenplaner, "toolRefs").mockResolvedValue([
  { type: "simulation", label: "🔬 Simulation", requires_ref: true, uses_class: false,
    items: [{ ref_id: "prozent", label: "💯 Prozent- und Zinsrechnung" }] },
  { type: "exitgame", label: "🗝️ TaskCrawler", requires_ref: true, uses_class: true, items: [] },
  { type: "fragmente", label: "🗂️ Fragmente", requires_ref: true, uses_class: false, items: [
    { ref_id: "c1", label: "🗂️ Mathe" }, { ref_id: "c1:r4", label: "Mathe › ✂ Video" },
    { ref_id: "c2", label: "🗂️ Bio" }, { ref_id: "c12:f1", label: "Physik › Karte" },
  ] },
]);

describe("Verknuepfungen", () => {
  it("bindet eine Simulation über den Picker ein", async () => {
    const aendern = vi.fn();
    render(<Verknuepfungen links={[]} onChange={aendern} />);
    fireEvent.click(screen.getByText("+ Material"));
    fireEvent.click(await screen.findByText("🔬 Simulation"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "prozent" } });
    fireEvent.click(screen.getByText("Einbinden"));
    expect(aendern).toHaveBeenCalledWith([{ type: "simulation", ref_id: "prozent", url: null, label: "💯 Prozent- und Zinsrechnung" }]);
  });

  it("bietet bei gesetzter Sammlung nur deren Fragmente an", async () => {
    render(<MaterialSammlung.Provider value={1}><Verknuepfungen links={[]} onChange={() => {}} /></MaterialSammlung.Provider>);
    fireEvent.click(screen.getByText("+ Material"));
    fireEvent.click(await screen.findByText("🗂️ Fragmente"));
    const optionen = [...screen.getByRole("combobox").querySelectorAll("option")].map(o => o.value).filter(Boolean);
    expect(optionen).toEqual(["c1", "c1:r4"]);
  });

  it("macht das Setzen der Sammlung rückgängig", () => {
    const v = { ...leereVorlage("Mathematik"), sammlung: 3 };
    expect(umkehrOps(v, [{ op: "sammlung", id: 5 }])).toEqual([{ op: "sammlung", id: 3 }]);
  });

  it("entfernt eine Verknüpfung und zeigt Lesenden nur das Öffnen", () => {
    const aendern = vi.fn();
    const link = { type: "link", ref_id: null, url: "https://example.org", label: "Video" };
    const { unmount } = render(<Verknuepfungen links={[link]} onChange={aendern} />);
    fireEvent.click(screen.getByLabelText("Video entfernen"));
    expect(aendern).toHaveBeenCalledWith([]);
    unmount();
    render(<Verknuepfungen links={[link]} />);
    expect(screen.getByText("▶ Video")).toBeTruthy();
    expect(screen.queryByText("+ Material")).toBeNull();
  });
});
