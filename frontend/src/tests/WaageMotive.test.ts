/**
 * Streichhölzer stehen und sind so hoch wie die Schachtel — sonst stapeln sich
 * flache Hölzchen in schiefen Reihen. Minus-Teile (abgebrannt, angebissen,
 * zerbrochen, schwarz) sind so groß wie ihr Plus-Gegenstück.
 */
import { describe, it, expect } from "vitest";
import { MOTIVE, motivSize } from "@/components/waage/Motive";

describe("Streichholz-Motiv", () => {
  it("Streichholz steht und ist so hoch wie die Schachtel", () => {
    const holz = motivSize("hoelzer", "n", false)!;
    const box = motivSize("hoelzer", "x", false)!;
    expect(holz.h).toBeGreaterThan(holz.w);
    expect(holz.h).toBe(box.h);
  });

  it("abgebrannte Teile sind so groß wie frische", () => {
    expect(motivSize("hoelzer", "n", true)).toEqual(motivSize("hoelzer", "n", false));
    expect(motivSize("hoelzer", "x", true)).toEqual(motivSize("hoelzer", "x", false));
  });

  it("jedes Motiv hat ein gleich großes Minus-Gegenstück (keine Feder mehr)", () => {
    for (const m of ["gummi", "murmeln", "muenzen"] as const) {
      for (const k of ["x", "n"] as const) expect(motivSize(m, k, true)).toEqual(motivSize(m, k, false));
    }
  });

  it("jedes Motiv benennt sein Minus", () => {
    for (const m of MOTIVE) expect(m.minus).toBeTruthy();
  });
});
