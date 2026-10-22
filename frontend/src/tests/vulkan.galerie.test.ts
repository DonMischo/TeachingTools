import { describe, expect, it } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import { BEREICHE, GALERIE, nachweisFuer } from "@/lib/vulkan/galerie";
import { TYPEN } from "@/lib/vulkan/modell";
import nachweise from "@/lib/vulkan/bilder.json";

describe("Galerie »Echte Vulkane«", () => {
  it("jedes Bild hat Datei, freie Lizenz und Urheber", () => {
    for (const b of GALERIE) {
      const n = nachweisFuer(b.id);
      expect(n, b.id).toBeDefined();
      expect(n!.lizenz).toMatch(/^(CC0|CC BY(-SA)? [0-9.]+( de| igo)?|Public domain)/i);
      expect(n!.urheber.length).toBeGreaterThan(0);
      expect(existsSync(join(process.cwd(), "public", n!.datei)), n!.datei).toBe(true);
    }
  });

  it("keine Nachweise ohne Bild, jeder Bereich und jeder Vulkantyp hat Bilder", () => {
    const ids = new Set(GALERIE.map(b => b.id));
    for (const id of Object.keys(nachweise)) expect(ids.has(id), id).toBe(true);
    for (const b of BEREICHE) expect(GALERIE.some(g => g.bereich === b.id), b.id).toBe(true);
    for (const t of TYPEN) expect(GALERIE.filter(g => g.typ === t.id).length, t.id).toBeGreaterThanOrEqual(3);
  });
});

describe("Wissen zu Vulkanen", () => {
  it("jeder Eintrag hat Text und nur Fotos, die es in der Galerie gibt; jeder Stoff führt zu einem Eintrag", async () => {
    const { WISSEN, GRUPPEN, WISSEN_ZU_STOFF } = await import("@/lib/vulkan/wissen");
    const ids = new Set(GALERIE.map(b => b.id));
    for (const w of WISSEN) {
      expect(w.absaetze.length, w.id).toBeGreaterThan(0);
      expect(GRUPPEN.some(g => g.id === w.gruppe), w.id).toBe(true);
      for (const b of w.bilder) expect(ids.has(b), `${w.id}: ${b}`).toBe(true);
    }
    expect(new Set(WISSEN.map(w => w.id)).size).toBe(WISSEN.length);
    for (const id of Object.values(WISSEN_ZU_STOFF)) expect(WISSEN.some(w => w.id === id), id).toBe(true);
  });
});
