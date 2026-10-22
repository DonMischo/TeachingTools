import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GEIST_HALTEN, LebensBalken } from "@/components/challenge/LebensBalken";

const balken = () => screen.getByRole("progressbar", { name: "Leben" });
const breite = (teil: string) => (balken().querySelector(`[data-teil="${teil}"]`) as HTMLElement).style.width;

describe("LebensBalken", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("meldet den echten Wert und füllt anteilig", () => {
    render(<LebensBalken wert={6} max={8} label="Leben" />);
    expect(balken().getAttribute("aria-valuenow")).toBe("6");
    expect(breite("fuellung")).toBe("75%");
  });

  it("der Geisterbalken bleibt nach einem Treffer stehen und läuft dann nach", () => {
    const { rerender } = render(<LebensBalken wert={8} max={8} label="Leben" />);
    rerender(<LebensBalken wert={4} max={8} label="Leben" />);
    expect(breite("fuellung")).toBe("50%");
    expect(breite("geist")).toBe("100%");
    act(() => { vi.advanceTimersByTime(GEIST_HALTEN + 10); });
    expect(breite("geist")).toBe("50%");
  });

  it("schnelle Treffer sammeln sich im Geist bis nach dem letzten", () => {
    const { rerender } = render(<LebensBalken wert={8} max={8} label="Leben" />);
    rerender(<LebensBalken wert={6} max={8} label="Leben" />);
    act(() => { vi.advanceTimersByTime(GEIST_HALTEN / 2); });
    rerender(<LebensBalken wert={4} max={8} label="Leben" />);
    act(() => { vi.advanceTimersByTime(GEIST_HALTEN / 2 + 10); });
    expect(breite("geist")).toBe("100%"); // noch der Stand vor dem ersten Treffer
    act(() => { vi.advanceTimersByTime(GEIST_HALTEN); });
    expect(breite("geist")).toBe("50%");
  });

  it("Heilen füllt sofort, ohne Geist darüber", () => {
    const { rerender } = render(<LebensBalken wert={2} max={8} label="Leben" />);
    rerender(<LebensBalken wert={6} max={8} label="Leben" />);
    expect(breite("fuellung")).toBe("75%");
    expect(breite("geist")).toBe("75%");
  });

  it("warnt bei wenig Leben, aber nicht bei null und nicht ohne warnen", () => {
    const { rerender } = render(<LebensBalken wert={2} max={8} label="Leben" />);
    expect(balken().dataset.knapp).toBe("true");
    rerender(<LebensBalken wert={3} max={8} label="Leben" />);
    expect(balken().dataset.knapp).toBeUndefined();
    rerender(<LebensBalken wert={0} max={8} label="Leben" />);
    expect(balken().dataset.knapp).toBeUndefined();
    rerender(<LebensBalken wert={1} max={8} label="Leben" warnen={false} />);
    expect(balken().dataset.knapp).toBeUndefined();
  });
});
