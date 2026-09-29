import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { STANDARD_FAECHER, alleFaecher, faecherFuer, istVonHand, passtZumFach } from "@/lib/faecher";
import { FachEditor, FachFilter } from "@/components/Faecher";

describe("Fächer", () => {
  it("jede Simulationskarte hat Standardfächer", () => {
    const seite = readFileSync(resolve(__dirname, "../app/simulationen/page.tsx"), "utf-8");
    const slugs = [...seite.matchAll(/slug: "([a-z]+)"/g)].map(m => m[1]);
    expect(slugs.length).toBeGreaterThan(10);
    for (const s of slugs) expect(STANDARD_FAECHER[s]?.length, s).toBeGreaterThan(0);
  });

  it("von Hand gesetzte Fächer ersetzen die Voreinstellung, auch eine leere Liste", () => {
    expect(faecherFuer("wilson", undefined)).toEqual(["Geografie"]);
    expect(faecherFuer("wilson", { wilson: ["Geschichte", "Geografie"] })).toEqual(["Geschichte", "Geografie"]);
    expect(faecherFuer("wilson", { wilson: [] })).toEqual([]);
    expect(istVonHand("wilson", { wilson: [] })).toBe(true);
    expect(istVonHand("kueste", { wilson: [] })).toBe(false);
  });

  it("Filter: mehrere Fächer sind oder-verknüpft, Groß-/Kleinschreibung egal", () => {
    expect(passtZumFach(["Physik", "Geografie"], [])).toBe(true);
    expect(passtZumFach(["Physik", "Geografie"], ["geografie"])).toBe(true);
    expect(passtZumFach(["Mathematik"], ["Physik", "Mathematik"])).toBe(true);
    expect(passtZumFach(["Mathematik"], ["Physik"])).toBe(false);
  });

  it("alle Fächer: bekannte in fester Reihenfolge, eigene alphabetisch dahinter, ohne Doppelte", () => {
    expect(alleFaecher([["Zeichnen", "Physik"], ["Mathematik", "physik", "Astro-AG"]]))
      .toEqual(["Mathematik", "Physik", "Astro-AG", "Zeichnen"]);
  });

  it("die Filterleiste schaltet Fächer an und aus", () => {
    const setzen = vi.fn();
    render(<FachFilter faecher={["Physik", "Chemie"]} gewaehlt={["Physik"]} setzen={setzen} />);
    fireEvent.click(screen.getByText("Chemie"));
    expect(setzen).toHaveBeenLastCalledWith(["Physik", "Chemie"]);
    fireEvent.click(screen.getByText("Physik"));
    expect(setzen).toHaveBeenLastCalledWith([]);
    fireEvent.click(screen.getByText("Alle Fächer"));
    expect(setzen).toHaveBeenLastCalledWith([]);
  });

  it("der Editor fügt ein eigenes Fach hinzu, entfernt eines und setzt zurück", () => {
    const speichern = vi.fn(), zurueck = vi.fn();
    render(<FachEditor faecher={["Geografie"]} vonHand vorschlaege={[]} speichern={speichern} zuruecksetzen={zurueck} />);
    const feld = screen.getByLabelText("Fach hinzufügen");
    fireEvent.change(feld, { target: { value: "  Geschichte  " } });
    fireEvent.keyDown(feld, { key: "Enter" });
    expect(speichern).toHaveBeenLastCalledWith(["Geografie", "Geschichte"]);
    fireEvent.click(screen.getByLabelText("Geografie entfernen"));
    expect(speichern).toHaveBeenLastCalledWith([]);
    fireEvent.click(screen.getByTitle("Zurück zur Voreinstellung"));
    expect(zurueck).toHaveBeenCalled();
  });
});
