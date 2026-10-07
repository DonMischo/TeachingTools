// ☰-Kartenmenü: Kartennetz immer, Seitenformat (A4 für den Export) nur, wo es gesetzt werden kann.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import KartenMenue from "@/components/karten/KartenMenue";
import { verhaeltnisVon } from "@/lib/karten/seite";
import { mussDrehen } from "@/lib/karten/drehen";

describe("Kartenmenü", () => {
  it("wählt das Seitenformat", () => {
    const setSeite = vi.fn();
    render(<KartenMenue projektion="equalearth" setProjektion={() => {}} seite="frei" setSeite={setSeite} />);
    fireEvent.click(screen.getByLabelText("Kartenmenü"));
    expect(screen.getByRole("radiogroup", { name: "Seitenformat" })).toBeTruthy();
    fireEvent.click(screen.getByLabelText(/A4 quer/));
    expect(setSeite).toHaveBeenCalledWith("a4-quer");
  });

  it("zeigt ohne setSeite (Quiz, Üben) nur das Kartennetz", () => {
    render(<KartenMenue projektion="mercator" setProjektion={() => {}} />);
    fireEvent.click(screen.getByLabelText("Kartenmenü"));
    expect(screen.getByRole("radiogroup", { name: "Kartennetz" })).toBeTruthy();
    expect(screen.queryByRole("radiogroup", { name: "Seitenformat" })).toBeNull();
  });

  it("A4 hoch ist höher als breit, A4 quer dieselbe Fläche gedreht, Bildschirm frei", () => {
    expect(verhaeltnisVon("a4-hoch")).toBeLessThan(1);
    expect(verhaeltnisVon("a4-quer")).toBeCloseTo(1 / verhaeltnisVon("a4-hoch")!, 1);
    expect(verhaeltnisVon("frei")).toBeUndefined();
  });

  it("gedreht wird nur echtes Querformat", () => {
    expect(mussDrehen(1477, 1028)).toBe(true);
    expect(mussDrehen(800, 1000)).toBe(false);
    expect(mussDrehen(500, 500)).toBe(false);
  });
});

describe("Kartenbild drehen", () => {
  it("liest die Größe aus dem PNG-Kopf", async () => {
    const { pngGroesse } = await import("@/lib/karten/drehen");
    // 89 50 4E 47 0D 0A 1A 0A | 00 00 00 0D 49 48 44 52 | Breite 1477 | Höhe 1028
    const kopf = Uint8Array.of(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 5, 197, 0, 0, 4, 4);
    const url = "data:image/png;base64," + btoa(String.fromCharCode(...kopf));
    expect(pngGroesse(url)).toEqual({ breite: 1477, hoehe: 1028 });
    expect(pngGroesse("data:image/png;base64,iVBORw0KGgo=")).toBeNull();
  });
});
