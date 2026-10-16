import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, configure, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Erkunden from "@/components/challenge/pixel/Erkunden";
import { THEMES } from "@/lib/challenge/themes";
import { markovKarte } from "@/lib/challenge/markovKarte";

// Laufen und Animationen brauchen unter Last (ganze Suite parallel) länger als 1 s.
configure({ asyncUtilTimeout: 8000 });

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener() {}, removeEventListener() {} }) as never;
});
const feld = () => screen.getByRole("img", { name: "Spielfigur" }).dataset.feld;

describe("Erkunden", () => {
  const karte = markovKarte(3, 4, "labyrinth");
  const zeig = (onBetreten = vi.fn(), objekte = [{ id: "ziel", x: karte.orte[0].x, y: karte.orte[0].y, label: "Ziel", render: () => <span /> }]) =>
    render(<Erkunden karte={karte} theme={THEMES.klassisch} objekte={objekte} onBetreten={onBetreten} label="Test" kachel="hecke" />);

  it("Pfeiltaste bewegt, Wand blockiert", async () => {
    const u = userEvent.setup();
    zeig();
    expect(feld()).toBe(karte.start.join(","));
    const [sx, sy] = karte.start;
    const frei = ([["{ArrowRight}", 1, 0], ["{ArrowDown}", 0, 1]] as const).find(([, dx, dy]) => karte.begehbar([sx + dx, sy + dy]))!;
    await u.keyboard(frei[0]);
    expect(feld()).toBe(`${sx + frei[1]},${sy + frei[2]}`);
    const wand = ([["{ArrowLeft}", -1, 0], ["{ArrowUp}", 0, -1]] as const).find(([, dx, dy]) => !karte.begehbar([sx + frei[1] + dx, sy + frei[2] + dy]))!;
    const vor = feld();
    await u.keyboard(wand[0]);
    expect(feld()).toBe(vor);
  });

  it("gehaltene Taste läuft gleichmäßig, Tastenwiederholung zählt nicht, Loslassen hält an", () => {
    vi.useFakeTimers();
    try {
      zeig();
      const [sx, sy] = karte.start;
      const r = ([["ArrowRight", 1, 0], ["ArrowDown", 0, 1], ["ArrowLeft", -1, 0], ["ArrowUp", 0, -1]] as const)
        .find(([, dx, dy]) => karte.begehbar([sx + dx, sy + dy]))!;
      const taste = (typ: "keydown" | "keyup", repeat = false) => act(() => { window.dispatchEvent(new KeyboardEvent(typ, { key: r[0], repeat })); });
      taste("keydown");
      expect(feld()).toBe(`${sx + r[1]},${sy + r[2]}`); // erster Schritt sofort
      for (let i = 0; i < 10; i++) taste("keydown", true); // Systemwiederholung: kein Extra-Schritt
      expect(feld()).toBe(`${sx + r[1]},${sy + r[2]}`);
      taste("keyup");
      const nach = feld();
      act(() => { vi.advanceTimersByTime(1000); });
      expect(feld()).toBe(nach); // losgelassen: steht
    } finally { vi.useRealTimers(); }
  });

  it("Klick läuft zum Objekt und meldet onBetreten", async () => {
    const u = userEvent.setup();
    const betreten = vi.fn();
    zeig(betreten);
    await u.click(screen.getByRole("button", { name: "Ziel" }));
    await vi.waitFor(() => expect(betreten).toHaveBeenCalledWith("ziel"), { timeout: 8000 });
    expect(feld()).toBe(`${karte.orte[0].x},${karte.orte[0].y}`);
  }, 15000);
});
