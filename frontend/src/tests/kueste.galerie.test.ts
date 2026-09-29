import { describe, expect, it } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import { GALERIE, nachweisFuer } from "@/lib/kueste/galerie";
import nachweise from "@/lib/kueste/bilder.json";

describe("Galerie »Echte Küsten«", () => {
  it("jedes Bild hat Datei, freie Lizenz und Urheber", () => {
    for (const b of GALERIE) {
      const n = nachweisFuer(b.id);
      expect(n, b.id).toBeDefined();
      expect(n!.lizenz).toMatch(/^(CC0|CC BY(-SA)? [0-9.]+( de)?|Public domain)/i);
      expect(n!.urheber.length).toBeGreaterThan(0);
      expect(existsSync(join(process.cwd(), "public", n!.datei)), n!.datei).toBe(true);
    }
  });

  it("es gibt keine Nachweise ohne Bild in der Galerie", () => {
    const ids = new Set(GALERIE.map(b => b.id));
    for (const id of Object.keys(nachweise)) expect(ids.has(id), id).toBe(true);
  });
});
