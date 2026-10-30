import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import ElemonApp from "@/components/klikk/elemon/ElemonApp";
import { neuerStand } from "@/lib/klikk/motor";
import type { Stand } from "@/lib/klikk/typen";

function Huelle({ start }: { start: Stand }) {
  const [s, setS] = useState(start);
  const [offen, setOffen] = useState(true);
  return <>
    {offen && <ElemonApp s={s} setze={f => setS(f)} />}
    <button onClick={() => setOffen(o => !o)}>App wechseln</button>
    <output data-testid="stand">{JSON.stringify(s.elemon ?? null)}</output>
  </>;
}
const stand = () => JSON.parse(screen.getByTestId("stand").textContent!);

describe("Elemon-App", () => {
  it("Starter wählen, wild kämpfen bis zum Ende, Duell ohne Sitzung erklärt", async () => {
    vi.useFakeTimers();
    render(<Huelle start={{ ...neuerStand(3), phase: "woche" }} />);
    fireEvent.click(screen.getByText("Nicht erlauben"));
    fireEvent.click(screen.getByText("Funkfuchs"));
    expect(stand().team[0].art).toBe("fox");
    expect(stand().standort).toBe(false);

    fireEvent.click(screen.getAllByText(/Suchen/)[0]);
    expect(stand().energie).toBe(4);
    expect(screen.getByText(/taucht auf/)).toBeTruthy();

    // Angreifen, bis der Kampf vorbei ist
    for (let i = 0; i < 30 && !screen.queryByText("Weiter"); i++) {
      const angriff = screen.queryByText("⚔️ Angriff");
      if (angriff) {
        fireEvent.click(angriff);
        fireEvent.click(screen.getAllByText(/Stärke/)[0]);
      }
      await act(async () => { await vi.advanceTimersByTimeAsync(4000); });
    }
    expect(screen.getByText(/Gewonnen|Verloren/)).toBeTruthy();
    fireEvent.click(screen.getByText("Weiter"));

    fireEvent.click(screen.getByText("⚔️ Duell"));
    expect(screen.getByText(/gemeinsam über einen Sitzungscode/)).toBeTruthy();
    vi.useRealTimers();
  });

  it("merkt sich, wo man war: Reiter und laufender Kampf bleiben beim Wiederöffnen", async () => {
    render(<Huelle start={{ ...neuerStand(3), phase: "woche" }} />);
    fireEvent.click(screen.getByText("Nicht erlauben"));
    fireEvent.click(screen.getByText("Panzerkröte"));
    fireEvent.click(screen.getByText("📖 Kartei"));
    fireEvent.click(screen.getByText("App wechseln"));
    fireEvent.click(screen.getByText("App wechseln"));
    expect(screen.getByText(/Gefangen: 1 von/)).toBeTruthy();

    fireEvent.click(screen.getByText("🗺️ Karte"));
    fireEvent.click(screen.getAllByText(/Suchen/)[0]);
    fireEvent.click(screen.getByText("App wechseln"));
    fireEvent.click(screen.getByText("App wechseln"));
    expect(screen.getByText("⚔️ Angriff")).toBeTruthy();
    expect(stand().energie).toBe(4);
  });
});
