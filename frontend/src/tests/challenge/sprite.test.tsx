import { describe, it, expect, vi, afterEach } from "vitest";
import { act, render } from "@testing-library/react";
import { Sprite, type Frame } from "@/components/challenge/pixel/Sprite";

const f = (x: number): Frame => ({ x, y: 0, w: 16, h: 16 });
const STEHEN = f(0);
const LAUF = [f(16), f(32), f(48)];
const bildX = (c: HTMLElement) => c.querySelector("img")!.style.transform.match(/translate\((-?\d+)px/)![1] + "px";

afterEach(() => vi.useRealTimers());

describe("Sprite-Animation", () => {
  it("ein neues {frames, fps}-Objekt je Render setzt den Takt nicht zurück", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<Sprite src="a.png" frame={STEHEN} scale={1} animation={{ frames: LAUF, fps: 10 }} />);
    expect(bildX(container)).toBe("-16px");
    // alle 50 ms neu rendern (wie ein Schritt der Figur): nach 200 ms trotzdem zwei Bilder weiter
    for (let t = 0; t < 4; t++) {
      act(() => { vi.advanceTimersByTime(50); });
      rerender(<Sprite src="a.png" frame={STEHEN} scale={1} animation={{ frames: LAUF, fps: 10 }} />);
    }
    expect(bildX(container)).toBe("-48px");
  });

  it("jeder neue Lauf beginnt bei Bild 0", () => {
    vi.useFakeTimers();
    const { container, rerender } = render(<Sprite src="a.png" frame={STEHEN} scale={1} animation={{ frames: LAUF, fps: 10 }} />);
    act(() => { vi.advanceTimersByTime(100); });
    expect(bildX(container)).toBe("-32px");
    rerender(<Sprite src="a.png" frame={STEHEN} scale={1} />);
    rerender(<Sprite src="a.png" frame={STEHEN} scale={1} animation={{ frames: LAUF, fps: 10 }} />);
    expect(bildX(container)).toBe("-16px");
  });
});
