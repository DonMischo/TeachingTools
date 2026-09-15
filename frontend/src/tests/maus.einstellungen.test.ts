import { describe, it, expect } from "vitest";
import {
  akzentGewaehlt, gegenModus, hintergrundGewaehlt, modusGewaehlt,
  textGroesseGenug, zeigerFarbeGewaehlt, zeigerGroesseGenug, zielAkzent, zielHintergrund, zielZeigerFarbe,
} from "@/lib/maus/einstellungen";
import { AKZENTE, HINTERGRUENDE, STANDARD_AUSSEHEN } from "@/lib/maus/windows";

describe("Maus-Führerschein: Einstellungen — reine Logik", () => {
  it("wählt einen anderen Hintergrund als den aktuellen", () => {
    const ziel = zielHintergrund(STANDARD_AUSSEHEN, () => 0);
    expect(HINTERGRUENDE.some(h => h.id === ziel)).toBe(true);
    expect(ziel).not.toBe(STANDARD_AUSSEHEN.hintergrund);
  });

  it("wählt einen anderen Akzent als den aktuellen", () => {
    const ziel = zielAkzent(STANDARD_AUSSEHEN, () => 0.999);
    expect(AKZENTE.some(a => a.id === ziel)).toBe(true);
    expect(ziel).not.toBe(STANDARD_AUSSEHEN.akzent);
  });

  it("gegenModus ist das Gegenteil von aussehen.dunkel", () => {
    expect(gegenModus({ ...STANDARD_AUSSEHEN, dunkel: false })).toBe(true);
    expect(gegenModus({ ...STANDARD_AUSSEHEN, dunkel: true })).toBe(false);
  });

  it("zielZeigerFarbe bevorzugt gelb oder bunt, nie die aktuelle Farbe", () => {
    expect(zielZeigerFarbe({ ...STANDARD_AUSSEHEN, zeigerFarbe: "weiss" })).toBe("gelb");
    expect(zielZeigerFarbe({ ...STANDARD_AUSSEHEN, zeigerFarbe: "gelb" })).toBe("bunt");
    expect(zielZeigerFarbe({ ...STANDARD_AUSSEHEN, zeigerFarbe: "bunt" })).toBe("gelb");
  });

  it("hintergrundGewaehlt/modusGewaehlt/akzentGewaehlt vergleichen nur den jeweiligen Wert", () => {
    const a = { ...STANDARD_AUSSEHEN, hintergrund: "wald", dunkel: true, akzent: "gruen" };
    expect(hintergrundGewaehlt(a, "wald")).toBe(true);
    expect(hintergrundGewaehlt(a, "himmel")).toBe(false);
    expect(modusGewaehlt(a, true)).toBe(true);
    expect(modusGewaehlt(a, false)).toBe(false);
    expect(akzentGewaehlt(a, "gruen")).toBe(true);
    expect(akzentGewaehlt(a, "blau")).toBe(false);
  });

  it("zeigerGroesseGenug verlangt mindestens Stufe 3 UND größer als der Start", () => {
    expect(zeigerGroesseGenug({ ...STANDARD_AUSSEHEN, zeigerGroesse: 3 }, 1)).toBe(true);
    expect(zeigerGroesseGenug({ ...STANDARD_AUSSEHEN, zeigerGroesse: 2 }, 1)).toBe(false);
    expect(zeigerGroesseGenug({ ...STANDARD_AUSSEHEN, zeigerGroesse: 3 }, 3)).toBe(false);
  });

  it("zeigerFarbeGewaehlt und textGroesseGenug", () => {
    expect(zeigerFarbeGewaehlt({ ...STANDARD_AUSSEHEN, zeigerFarbe: "bunt" }, "bunt")).toBe(true);
    expect(zeigerFarbeGewaehlt({ ...STANDARD_AUSSEHEN, zeigerFarbe: "bunt" }, "gelb")).toBe(false);
    expect(textGroesseGenug({ ...STANDARD_AUSSEHEN, textGroesse: 150 })).toBe(true);
    expect(textGroesseGenug({ ...STANDARD_AUSSEHEN, textGroesse: 125 })).toBe(false);
  });
});
