/**
 * Das Zählwerk zum Selberdrehen: ohne »mitdrehen« bleibt jede Walze für sich,
 * mit »mitdrehen« wandert der Übertrag Walze für Walze nach links — jede ein
 * Stück später als die vorige. Tastatur: Pfeile, Ziffern, Enter.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { DrehZaehlwerk, VERZUG_MS } from "@/components/stellenwert/DrehZaehlwerk";
import type { Basis } from "@/lib/stellenwert";

afterEach(() => { vi.useRealTimers(); });

function baue(basis: Basis, stellen: number, start: number, mitdrehen: boolean) {
  const werte: number[] = [];
  const laeuft: boolean[] = [];
  const enter = vi.fn();
  render(<DrehZaehlwerk basis={basis} stellen={stellen} start={start} mitdrehen={mitdrehen}
    onWert={n => werte.push(n)} onLaeuft={l => laeuft.push(l)} onEnter={enter} />);
  return { wert: () => werte.at(-1), laeuft, enter };
}

describe("DrehZaehlwerk", () => {
  it("ohne Mitdrehen läuft nur die eine Walze über", () => {
    const z = baue(16, 3, 0x0ff, false);
    expect(z.wert()).toBe(0x0ff);
    fireEvent.click(screen.getByRole("button", { name: "Einer hochdrehen" }));
    expect(z.wert()).toBe(0x0f0);
    fireEvent.click(screen.getByRole("button", { name: "Einer runterdrehen" }));
    expect(z.wert()).toBe(0x0ff);
  });

  it("mit Mitdrehen wandert der Übertrag Walze für Walze", () => {
    vi.useFakeTimers();
    const z = baue(16, 3, 0x0ff, true);
    fireEvent.click(screen.getByRole("button", { name: "Einer hochdrehen" }));
    expect(z.wert()).toBe(0x0f0);          // erst nur die Einer
    expect(z.laeuft.at(-1)).toBe(true);
    act(() => { vi.advanceTimersByTime(VERZUG_MS); });
    expect(z.wert()).toBe(0x000);          // dann die 16er
    act(() => { vi.advanceTimersByTime(VERZUG_MS); });
    expect(z.wert()).toBe(0x100);          // zuletzt die 256er
    expect(z.laeuft.at(-1)).toBe(false);
  });

  it("rückwärts wird ausgeliehen: 1000₂ − 1 = 0111₂", () => {
    vi.useFakeTimers();
    const z = baue(2, 4, 0b1000, true);
    fireEvent.click(screen.getByRole("button", { name: "Einer runterdrehen" }));
    act(() => { vi.advanceTimersByTime(VERZUG_MS * 3); });
    expect(z.wert()).toBe(0b0111);
  });

  it("die linke Walze läuft ganz vorn einfach über", () => {
    vi.useFakeTimers();
    const z = baue(10, 2, 99, true);
    fireEvent.click(screen.getByRole("button", { name: "Einer hochdrehen" }));
    act(() => { vi.advanceTimersByTime(VERZUG_MS * 3); });
    expect(z.wert()).toBe(0);
  });

  it("Tastatur: Fokus auf den Einern, Pfeile drehen, Ziffer setzt und springt weiter, Enter prüft", () => {
    const z = baue(10, 3, 120, false);
    const einer = screen.getByRole("button", { name: /^Einer: / });
    expect(document.activeElement).toBe(einer);
    fireEvent.keyDown(einer, { key: "ArrowUp" });
    expect(z.wert()).toBe(121);
    fireEvent.keyDown(einer, { key: "ArrowLeft" });
    const zehner = screen.getByRole("button", { name: /^Zehner: / });
    expect(document.activeElement).toBe(zehner);
    fireEvent.keyDown(zehner, { key: "7" });
    expect(z.wert()).toBe(171);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^Einer: / }));
    fireEvent.keyDown(document.activeElement!, { key: "Enter" });
    expect(z.enter).toHaveBeenCalledTimes(1);
  });
});
