import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import Tag from "@/components/klikk/Tag";
import { ALLE_LESETEXTE, lesetextFuer, rechenAufgabe } from "@/lib/klikk/hausaufgaben";
import { AUFGABEN, aufgabe, loeseAufgabe, neuerStand } from "@/lib/klikk/motor";
import type { Stand } from "@/lib/klikk/typen";

const nachmittag = (tag = 0): Stand => ({ ...neuerStand(4), phase: "woche", tag, uhr: 15 * 60 });

describe("Hausaufgaben", () => {
  it("jede Buchseite hat eine Frage mit mindestens sechs Antworten und genau einer richtigen", () => {
    for (let tag = 0; tag < 5; tag++) expect(lesetextFuer(4, tag)).not.toBeNull();
    expect(new Set([1, 2, 3].map(seed => lesetextFuer(seed, 0)!.titel)).size).toBe(3);
    expect(lesetextFuer(4, 1)!.titel).toMatch(/Zauberlehrling/);
    expect(lesetextFuer(4, 4)!.titel).toMatch(/John Maynard/);
    for (const t of ALLE_LESETEXTE) {
      expect(t.antworten.length).toBeGreaterThanOrEqual(6);
      expect(new Set(t.antworten).size).toBe(t.antworten.length);
      expect(t.antworten[t.richtig]).toBeDefined();
    }
  });

  it("Mathe wird von Montag bis Freitag schwerer", () => {
    expect(rechenAufgabe(1, 0, 0).text).toMatch(/^\d+ · \d+$/);
    expect(rechenAufgabe(1, 2, 0).text).toContain("+");
    expect(rechenAufgabe(1, 3, 0).text).toContain("(");
    expect(rechenAufgabe(1, 4, 0).text).toContain("−");
  });

  it("die letzte Aufgabe ist Lesen: dauert länger, falsch heißt nochmal", () => {
    let s = { ...nachmittag(), hausaufgabenStand: AUFGABEN - 1 };
    const a = aufgabe(s);
    expect(a.art).toBe("lesen");
    const falsch = loeseAufgabe(s, (a.loesung + 1) % 6);
    expect(falsch.hausaufgabenStand).toBe(AUFGABEN - 1);
    expect(falsch.uhr).toBe(s.uhr + 6);
    s = loeseAufgabe(s, a.loesung);
    expect(s.hausaufgaben[0]).toBe(true);
    expect(s.uhr).toBe(15 * 60 + 15);
  });

  it("falsche Antwort sperrt die Simulation 10 Sekunden", async () => {
    vi.useFakeTimers();
    function Huelle() {
      const [s, setS] = useState<Stand>({ ...nachmittag(), hausaufgabenStand: AUFGABEN - 1 });
      return <Tag s={s} setze={f => setS(f)} />;
    }
    render(<Huelle />);
    const t = lesetextFuer(4, 0)!;
    expect(screen.getByText(t.frage)).toBeTruthy();
    fireEvent.click(screen.getByText(t.antworten[(t.richtig + 1) % t.antworten.length]));
    const sperre = screen.getByRole("alertdialog");
    // Die Buchseite bleibt in der Sperre lesbar
    expect(sperre.textContent).toContain(t.text.slice(0, 60));
    expect(screen.getByText(t.antworten[t.richtig]).closest("button")!.disabled).toBe(true);
    for (let i = 0; i < 11; i++) await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    fireEvent.click(screen.getByText(t.antworten[t.richtig]));
    expect(screen.getByText(/Erledigt/)).toBeTruthy();
    vi.useRealTimers();
  });
});
