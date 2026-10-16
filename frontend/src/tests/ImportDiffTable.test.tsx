// CSV-Vorschau der Benutzerverwaltung: eine Tabelle für Lehrkräfte und Schüler.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ImportDiffTable } from "@/components/admin/ImportDiffTable";
import type { StudentDiffRow } from "@/lib/api";

const ROWS: StudentDiffRow[] = [
  { key: "a", action: "new", csv_data: { nachname: "Abel", vorname: "Ada", klasse: "7a" }, db_data: null, changed_fields: [] },
  { key: "b", action: "update", csv_data: { nachname: "Bauer", vorname: "Ben", klasse: "8b", role: "Admin" },
    db_data: { klasse: "7b" }, changed_fields: ["klasse"] },
];

function zeige(extra?: Parameters<typeof ImportDiffTable>[0]["extra"]) {
  const props = {
    rows: ROWS, summary: "1 neu · 1 geändert", filter: "all" as const, setFilter: vi.fn(),
    selected: new Set(["a"]), setSelected: vi.fn(), toggleRow: vi.fn(), newLabel: "Neuer Schüler", extra,
  };
  render(<ImportDiffTable {...props} />);
  return props;
}

describe("ImportDiffTable", () => {
  it("zeigt Zeilen, Status und die Änderung alt → neu", () => {
    zeige();
    expect(screen.getByText("1 neu · 1 geändert")).toBeInTheDocument();
    expect(screen.getByText("Neuer Schüler")).toBeInTheDocument();
    expect(screen.getByText("NEU")).toBeInTheDocument();
    expect(screen.getByText("GEÄNDERT")).toBeInTheDocument();
    expect(screen.getByText("7b")).toHaveClass("line-through");
    expect(screen.getByText("1 ausgewählt")).toBeInTheDocument();
    expect(screen.queryByText("Rolle")).toBeNull();
  });

  it("Zusatzspalte nur, wenn übergeben (Rolle bei Lehrkräften)", () => {
    zeige({ header: "Rolle", cell: r => r.csv_data.role || "Lehrer" });
    expect(screen.getByText("Rolle")).toBeInTheDocument();
    expect(screen.getByText("Lehrer")).toBeInTheDocument();
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("Filter, Alle auswählen und Zeilenklick melden sich nach oben", () => {
    const p = zeige();
    fireEvent.click(screen.getByText("Nur neu"));
    expect(p.setFilter).toHaveBeenCalledWith("new");
    fireEvent.click(screen.getByText("Alle auswählen"));
    expect(p.setSelected).toHaveBeenCalledWith(new Set(["a", "b"]));
    fireEvent.click(screen.getByText("Bauer"));
    expect(p.toggleRow).toHaveBeenCalledWith("b");
  });
});
