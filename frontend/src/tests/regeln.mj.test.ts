import { describe, expect, it } from "vitest";
import { FARBEN, laufeDurch, programm, starte } from "@/lib/regeln/maschine";
import { MJ_BEISPIELE } from "@/lib/regeln/mj-beispiele";

describe("Beispiele aus MarkovJunior", () => {
  // Gemessen wird die Zahl der Schritte, nicht die Uhrzeit: unter der vollen
  // Testlast laufen die Rechnungen ein Vielfaches langsamer als im Browser.
  it.each(MJ_BEISPIELE.map(b => [b.id, b] as const))("%s läuft in vertretbar vielen Schritten zu Ende", (_id, b) => {
    const p = programm(b.programm);
    const l = laufeDurch(p, starte(p, b.start, 1), 400_000);
    expect(l.fertig, `${b.id} nicht fertig nach ${l.gesamt} Schritten`).toBe(true);
    expect(l.gesamt).toBeGreaterThan(0);
    expect(l.gesamt).toBeLessThan(150_000);
    // jede Farbe hat einen Namen und eine Farbe
    for (const c of new Set(l.raster.z)) expect(FARBEN[c], `${b.id}: Farbe ${c}`).toBeDefined();
  }, 120_000);
});
