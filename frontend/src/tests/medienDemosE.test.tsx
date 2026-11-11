import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DiaDemo } from "@/components/medien/demos/Dia";
import { PolaroidDemo } from "@/components/medien/demos/Polaroid";
import { DisketteStationDemo } from "@/components/medien/demos/Diskette";
import nachweise from "@/lib/medien/demo-bilder.json";
import { FREI } from "../../scripts/commons-galerie.mjs";

describe("Medien-Demos Dia, Polaroid, Diskette", () => {
  it("Dia rendert mit Foto", () => {
    const { container } = render(<DiaDemo />);
    expect(container.querySelector("img")).toBeTruthy();
    expect(screen.getByText("Dolomiten 1978")).toBeTruthy();
  });
  it("Polaroid rendert und löst aus", () => {
    render(<PolaroidDemo />);
    fireEvent.click(screen.getByText(/Auslösen/));
    expect(screen.getByText(/Entwickelt sich/)).toBeTruthy();
  });
  it("Diskette: Einlegen zeigt Verzeichnis, Schreibschutz meldet Fehler", () => {
    render(<DisketteStationDemo />);
    fireEvent.click(screen.getByTestId("schutz"));
    fireEvent.click(screen.getByText(/Einlegen/));
    expect(screen.getByText(/README.TXT/)).toBeTruthy();
    fireEvent.click(screen.getByText(/💾 Speichern/));
    expect(screen.getByText(/schreibgeschützt/)).toBeTruthy();
  });
  it("Nachweise sind frei und Dateien vorhanden", () => {
    for (const [id, n] of Object.entries(nachweise)) {
      expect(FREI.test(n.lizenz), id).toBe(true);
      expect(existsSync(join(process.cwd(), "public", n.datei)), id).toBe(true);
    }
  });
});
