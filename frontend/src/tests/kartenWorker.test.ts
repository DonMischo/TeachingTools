// Die Kopie des MapLibre-Workers in public/ muss zur installierten Version passen,
// sonst verstehen sich Hauptthread und Worker nicht (leere Karte). Neu kopieren: npm run karten:worker
import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const WURZEL = join(__dirname, "..", "..");

describe("MapLibre-Worker", () => {
  it.each(["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"])("%s ist aktuell", (datei) => {
    const kopie = readFileSync(join(WURZEL, "public/karten/maplibre", datei));
    const original = readFileSync(join(WURZEL, "node_modules/maplibre-gl/dist", datei));
    expect(kopie.equals(original)).toBe(true);
  });
});
