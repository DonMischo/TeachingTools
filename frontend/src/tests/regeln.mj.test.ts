import { describe, expect, it } from "vitest";
import { FARBEN, laufeDurch, programm, starte } from "@/lib/regeln/maschine";
import { MJ_BEISPIELE } from "@/lib/regeln/mj-beispiele";

describe("Beispiele aus MarkovJunior", () => {
  it.each(MJ_BEISPIELE.map(b => [b.id, b] as const))("%s läuft im Browser in vertretbarer Zeit zu Ende", (_id, b) => {
    const p = programm(b.programm);
    const t0 = performance.now();
    const l = laufeDurch(p, starte(p, b.start, 1), 400_000);
    const ms = performance.now() - t0;
    expect(l.fertig, `${b.id} nicht fertig nach ${l.gesamt} Schritten`).toBe(true);
    expect(ms, `${b.id} braucht ${Math.round(ms)} ms`).toBeLessThan(6000);
    expect(l.gesamt).toBeGreaterThan(0);
    // jede Farbe hat einen Namen und eine Farbe
    for (const c of new Set(l.raster.z)) expect(FARBEN[c], `${b.id}: Farbe ${c}`).toBeDefined();
  });
});
