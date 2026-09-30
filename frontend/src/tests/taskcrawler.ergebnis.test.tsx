import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { baueErgebnisPdf, formelText, klartext } from "@/lib/taskcrawler/ergebnisPdf";
import { CompletionCard } from "@/components/exitgame/FolienTeile";

describe("Ergebnissicherung: Formeln als Klartext", () => {
  it.each([
    ["3x + 4 = 19", "3x + 4 = 19"],
    ["A = \\frac{a + c}{2} \\cdot h", "A = (a + c)/2 · h"],
    ["x^2 - 4 = 0", "x² - 4 = 0"],
    ["E = m \\cdot c^{2}", "E = m · c²"],
    ["10^{-3}", "10^(-3)"],
    ["\\sqrt{16} = 4", "Wurzel(16) = 4"],
    ["\\text{Fläche} \\approx 3{,}5", "Fläche ca. 3,5"],
  ])("%s", (ein, aus) => expect(formelText(ein)).toBe(aus));

  it("übersetzt Formeln im Fließtext, entfernt Fettdruck und Zeichen außerhalb der PDF-Schrift", () => {
    expect(klartext("Für **Trapeze** gilt $A = \\frac{a+c}{2} \\cdot h$ 🚀")).toBe("Für Trapeze gilt A = (a + c)/2 · h");
  });
});

describe("Ergebnissicherung: PDF", () => {
  it("setzt Kopf, Abschnitte und nummerierte Merksätze — auch über mehrere Seiten", async () => {
    const lang = Array.from({ length: 14 }, (_, i) => ({ titel: `Aufgabe ${i + 1}`, text: `Merksatz Nummer ${i + 1}.\n- erster Punkt\n- zweiter Punkt mit $x^2$` }));
    const doc = await baueErgebnisPdf({
      titel: "Zeitreise der Medien", name: "Mia", datum: new Date(2026, 8, 30), akzent: "#2563eb",
      abschnitte: [
        { abschnitt: 1, titel: "Treppe aus der Urzeit", eintraege: lang.slice(0, 7) },
        { abschnitt: 2, titel: "", eintraege: lang.slice(7) },
      ],
    });
    expect(doc.getNumberOfPages()).toBeGreaterThan(1);
    const roh = doc.output();
    for (const s of ["Ergebnissicherung", "Zeitreise der Medien", "Mia", "30.09.2026", "Abschnitt 2", "Merksatz Nummer 14", "Seite 1 von"]) {
      expect(roh, s).toContain(s);
    }
  });
});

describe("Abschlusskarte", () => {
  const summary = { id: 1, status: "finished" as const, current_slide_idx: 0, solved_slide_ids: [], errors_total: 0, hints_total: 0,
    easier_taken_total: 0, elapsed_seconds: 300, started_at: "", finished_at: "" };

  it("zeigt den PDF-Knopf nur, wenn es Merksätze gibt", () => {
    const { rerender } = render(<CompletionCard completion={null} summary={summary} />);
    expect(screen.queryByText(/PDF herunterladen/)).toBeNull();
    rerender(<CompletionCard completion={null} summary={summary} titel="T" name="Mia"
      sicherung={[{ abschnitt: 1, titel: "", eintraege: [{ titel: "", text: "a" }, { titel: "", text: "b" }] }]} />);
    expect(screen.getByText(/2 Merksätze/)).toBeTruthy();
    expect((screen.getByLabelText("Name fürs PDF") as HTMLInputElement).value).toBe("Mia");
    fireEvent.change(screen.getByLabelText("Name fürs PDF"), { target: { value: "Mia K." } });
    expect(screen.getByRole("button", { name: /PDF herunterladen/ })).toBeTruthy();
  });
});
