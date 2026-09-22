/**
 * Das Attention-Minispiel.
 *
 * Der wichtigste Test ist der über die Paare: Zwei Sätze eines Paares müssen
 * sich in **genau einem** Wort unterscheiden und trotzdem verschiedene
 * Antworten haben. Stimmt das nicht, ist die ganze Lehre der Station dahin —
 * und das sieht man einem Datensatz von Hand nicht an.
 */
import { describe, it, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { ATTENTION_AUFGABEN, partner } from "@/lib/ki/attention";
import { Attention } from "@/components/ki/Attention";

/** Die anklickbaren Wörter der Bühne — SVG-Gruppen, keine <button>. */
function woerter(container: HTMLElement) {
  const svg = container.querySelector('svg[aria-label^="Satz:"]')!;
  return [...svg.querySelectorAll('g[role="button"]')];
}

function tippe(container: HTMLElement, wort: string) {
  const treffer = woerter(container).find(g => g.querySelector("text")?.textContent === wort);
  if (!treffer) throw new Error(`»${wort}« ist gerade nicht anzutippen`);
  fireEvent.click(treffer);
}

describe("Die Aufgaben", () => {
  it("zeigt auf Wörter, die es gibt", () => {
    for (const a of ATTENTION_AUFGABEN) {
      const max = a.woerter.length - 1;
      expect(a.frage, a.id).toBeLessThanOrEqual(max);
      expect(a.ziel, a.id).toBeLessThanOrEqual(max);
      expect(a.wahlbar, a.id).toContain(a.ziel);
      for (const w of a.wahlbar) expect(w, a.id).toBeLessThanOrEqual(max);
      for (const k of Object.keys(a.modell)) expect(Number(k), a.id).toBeLessThanOrEqual(max);
      if (a.schluesselwort !== undefined) expect(a.schluesselwort, a.id).toBeLessThanOrEqual(max);
    }
  });

  it("lässt das fragende Wort nicht selbst anklickbar sein", () => {
    for (const a of ATTENTION_AUFGABEN) {
      expect(a.wahlbar, a.id).not.toContain(a.frage);
    }
  });

  it("gibt dem richtigen Wort das größte Gewicht", () => {
    for (const a of ATTENTION_AUFGABEN) {
      const eintraege = Object.entries(a.modell).sort((x, y) => y[1] - x[1]);
      expect(Number(eintraege[0][0]), `${a.id}: stärkster Bogen zeigt woanders hin`).toBe(a.ziel);
    }
  });

  it("unterscheidet Paare in genau einem Wort — mit anderer Antwort", () => {
    const paare = new Set(ATTENTION_AUFGABEN.map(a => a.paar).filter(Boolean));
    expect(paare.size).toBeGreaterThan(2);
    for (const a of ATTENTION_AUFGABEN) {
      const b = partner(a);
      if (!b) continue;
      expect(b.woerter.length, `${a.id}: Partner ist anders lang`).toBe(a.woerter.length);
      const anders = a.woerter
        .map((w, i) => (w === b.woerter[i] ? -1 : i))
        .filter(i => i >= 0);
      expect(anders, `${a.id}: unterscheidet sich in ${anders.length} Wörtern`).toHaveLength(1);
      // Und genau dieses Wort wird in der Auflösung hervorgehoben.
      expect(a.schluesselwort, `${a.id}: falsches Schlüsselwort`).toBe(anders[0]);
      expect(a.woerter[a.ziel], `${a.id}: gleiche Antwort wie ${b.id}`).not.toBe(b.woerter[b.ziel]);
    }
  });
});

describe("Spielen", () => {
  it("bestätigt die richtige Antwort und erklärt sie", () => {
    const { container } = render(<Attention />);
    tippe(container, "Pokal");
    expect(screen.getByText(/✓ Genau/)).toBeTruthy();
    expect(screen.getByText(/Zu groß« ist der Pokal/)).toBeTruthy();
  });

  it("zeigt bei einer falschen Antwort, wo der Bogen hingehört hätte", () => {
    const { container } = render(<Attention />);
    tippe(container, "Koffer,");
    expect(screen.getByText(/✗ Knapp daneben/)).toBeTruthy();
    // Zwei Bögen: der eigene und der gestrichelt richtige.
    const gestrichelt = container.querySelectorAll('svg path[stroke-dasharray]');
    expect(gestrichelt.length).toBe(1);
  });

  it("nimmt nach der Antwort keine zweite mehr an", () => {
    const { container } = render(<Attention />);
    tippe(container, "Pokal");
    // Nach der Antwort ist nichts mehr anklickbar — sonst könnte man raten.
    expect(woerter(container)).toHaveLength(0);
  });

  it("zeigt die Bögen des Modells erst auf Knopfdruck", () => {
    const { container } = render(<Attention />);
    const boegen = () => container.querySelectorAll('svg path[stroke-linecap="round"]').length;
    tippe(container, "Pokal");
    const vorher = boegen();
    fireEvent.click(screen.getByText(/Was ein Modell ansieht/));
    expect(boegen()).toBeGreaterThan(vorher);
  });

  it("stellt das Paar nebeneinander, sobald beide Sätze dran waren", () => {
    const { container } = render(<Attention />);
    expect(screen.queryByText("Ein Wort — andere Antwort")).toBeNull();
    tippe(container, "Pokal");
    fireEvent.click(screen.getByText(/Nächster Satz/));
    tippe(container, "Koffer,");
    expect(screen.getByText("Ein Wort — andere Antwort")).toBeTruthy();
  });
});
