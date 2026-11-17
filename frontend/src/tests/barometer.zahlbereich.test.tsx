/** Zahl außerhalb von num_min … num_max: der Server verwirft sie still — die
 * Seite muss das zeigen und das Absenden sperren, statt »gespeichert« zu melden. */
import { describe, it, expect, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { zahlAusserhalb, zahlBereich } from "@/lib/barometer";

vi.mock("next/navigation", () => ({ useParams: () => ({ code: "ZAHL01" }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ auth: { role: "student" } }) }));
const send = vi.fn();
let onMsg: (m: Record<string, unknown>) => void = () => {};
vi.mock("@/hooks/useLiveSocket", () => ({
  useLiveSocket: (_p: unknown, h: (m: Record<string, unknown>) => void) => { onMsg = h; return { send }; },
}));

import BarometerPlayPage from "@/app/play/barometer/[code]/page";

const alter = {
  id: 1, order: 0, text: "Wie alt bist du?", kind: "number", options: [], chart: null,
  scale_min: 1, scale_max: 6, scale_min_label: null, scale_max_label: null,
  same_slide: false, block: null, intro: null, show_if: null, scale_style: "zahlen",
  max_choices: null, num_min: 9, num_max: 21, unit: null,
};

describe("Zahlenbereich", () => {
  it("Helfer", () => {
    expect(zahlAusserhalb(alter, 42)).toBe(true);
    expect(zahlAusserhalb(alter, 21)).toBe(false);
    expect(zahlAusserhalb(alter, undefined)).toBe(false);
    expect(zahlBereich(alter)).toBe("zwischen 9 und 21");
    expect(zahlBereich({ num_min: null, num_max: 5 })).toBe("höchstens 5");
  });

  it("sperrt Absenden bei 42 und gibt es bei 14 frei", async () => {
    const user = userEvent.setup();
    render(<BarometerPlayPage />);
    act(() => onMsg({ event: "state", status: "active", mode: "self", questions: [alter], my_answers: {} }));

    const feld = await screen.findByLabelText("Zahl");
    expect(screen.getByText("Erlaubt: zwischen 9 und 21")).toBeTruthy();
    await user.type(feld, "42");
    expect(screen.getByText("Bitte eine Zahl zwischen 9 und 21 eingeben.")).toBeTruthy();
    const absenden = screen.getByRole("button", { name: "Absenden" }) as HTMLButtonElement;
    expect(absenden.disabled).toBe(true);

    await user.clear(feld);
    await user.type(feld, "14");
    expect(absenden.disabled).toBe(false);
    await user.click(absenden);
    expect(send).toHaveBeenCalledWith({ action: "submit", answers: [{ question_id: 1, value: 14 }] });
  });
});
