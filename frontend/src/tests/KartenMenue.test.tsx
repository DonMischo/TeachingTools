// ☰-Kartenmenü: Kartennetz immer, Seitenformat (A4 für den Export) nur, wo es gesetzt werden kann.
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import KartenMenue from "@/components/karten/KartenMenue";
import { verhaeltnisVon } from "@/lib/karten/seite";

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
});
