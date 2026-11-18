/** Notruf-Übung an der Wählscheibe: Leitstelle fragt die W-Fragen ab, am Ende Erfolg. */
import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Leitstelle } from "@/components/medien/demos/Notruf";

describe("Leitstelle (Notruf üben)", () => {
  it("112: nach dem Freizeichen vier W-Fragen, dann Erfolg und Rückblick", () => {
    vi.useFakeTimers();
    const geschafft = vi.fn();
    render(<Leitstelle nummer="112" auflegen={() => {}} geschafft={geschafft} />);
    expect(screen.getByText(/Leitstelle nimmt gleich ab/)).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.getByText(/Feuerwehr und Rettungsdienst, Notruf/, { selector: "p" })).toBeInTheDocument();
    for (const a of ["Schulhof, neben der Turnhalle", "Jemand ist gestürzt", "eine Person", "blutet am Knie"]) {
      fireEvent.change(screen.getByLabelText("Deine Antwort an die Leitstelle"), { target: { value: a } });
      fireEvent.click(screen.getByRole("button", { name: "Sagen" }));
    }
    expect(geschafft).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Rettungsdienst ist unterwegs/)).toBeInTheDocument();
    expect(screen.getByText("Schulhof, neben der Turnhalle")).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("110 meldet sich als Polizei und weist auf § 145 StGB hin", () => {
    vi.useFakeTimers();
    render(<Leitstelle nummer="110" auflegen={() => {}} />);
    act(() => { vi.advanceTimersByTime(4000); });
    expect(screen.getByText(/Polizei-Notruf/, { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText(/§ 145 StGB/)).toBeInTheDocument();
    vi.useRealTimers();
  });
});
