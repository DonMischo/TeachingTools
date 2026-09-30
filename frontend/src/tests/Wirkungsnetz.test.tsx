import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Wirkungsnetz from "@/components/leviathan/Wirkungsnetz";
import { neuesSpiel } from "@/lib/leviathan/motor";
import { STANDARD_EINSTELLUNGEN } from "@/lib/leviathan/typen";

describe("Wirkungsnetz", () => {
  it("zeigt nach einem Klick, was ein Bereich beeinflusst und wovon er abhängt", () => {
    render(<Wirkungsnetz z={neuesSpiel("industrie", STANDARD_EINSTELLUNGEN, 1)} />);
    fireEvent.click(screen.getByRole("button", { name: /^Vertrauen:/ }));
    expect(screen.getByText(/Vertrauen wirkt auf/)).toBeInTheDocument();
    expect(screen.getByText(/und wird beeinflusst von/)).toBeInTheDocument();
    expect(screen.getAllByText(/Rothstein & Uslaner 2005/).length).toBeGreaterThan(0);
  });

  it("verteilt Punkte direkt im Netz über + und −", () => {
    const plus: string[] = [];
    const minus: string[] = [];
    render(<Wirkungsnetz z={neuesSpiel("industrie", STANDARD_EINSTELLUNGEN, 1)} onPlus={(h) => plus.push(h)} onMinus={(h) => minus.push(h)} />);
    fireEvent.click(screen.getByRole("button", { name: "Bildung & Medienkompetenz: ein Punkt dazu" }));
    fireEvent.click(screen.getByRole("button", { name: "Wirtschaft: ein Punkt weniger" }));
    expect(plus).toEqual(["bildung"]);
    expect(minus).toEqual(["wirtschaft"]);
  });
});
