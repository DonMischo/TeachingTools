import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { KinoDemo } from "@/components/medien/demos/Kino";
import { RadioDemo } from "@/components/medien/demos/Radio";
import nachweise from "@/lib/medien/kino-radio.json";
import { FREI } from "../../scripts/commons-galerie.mjs";

describe("Medien-Demos Kino und Radio", () => {
  it("Kino rendert", () => {
    render(<KinoDemo />);
    expect(screen.getByText(/Daumenkino/)).toBeTruthy();
  });
  it("Radio rendert", () => {
    render(<RadioDemo />);
    expect(screen.getByText(/Röhrenradio/)).toBeTruthy();
  });
  it("Nachweise sind frei und Dateien vorhanden", () => {
    for (const [id, n] of Object.entries(nachweise)) {
      expect(FREI.test(n.lizenz), id).toBe(true);
      expect(existsSync(join(process.cwd(), "public", n.datei)), id).toBe(true);
    }
  });
});
