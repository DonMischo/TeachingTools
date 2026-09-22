/**
 * Das Ratespiel »Mensch gegen Maschine«.
 *
 * Der eine Fall, der es kaputt macht: Wenn das richtige Wort nicht unter den
 * Vorschlägen steht, kann niemand gewinnen — und niemand sieht, woran es lag.
 * Genau das prüft der erste Test, und zwar über den ganzen Korpus hinweg.
 */
import { describe, it, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import { Raten } from "@/components/ki/Raten";
import { KORPORA } from "@/lib/ki/korpora";
import { trainiere, woerterAus } from "@/lib/ki/trainieren";
import { fortsetzungen, type Wort } from "@/lib/ki/wortnetz";

/** Dieselbe Auswahl, die die Station aufbaut. */
function auswahl(korpusText: string, titel: string, pos: number, anzahl = 6) {
  const woerter = woerterAus(korpusText);
  const netz = trainiere(korpusText, 2, titel);
  const verlauf: Wort[] = [];
  for (let i = Math.max(0, pos - 2); i < pos; i++) {
    const w = netz.woerter.find(x => x.text === woerter[i]);
    if (w) verlauf.push(w);
  }
  const alle = fortsetzungen(netz, verlauf).kandidaten;
  const liste = alle.slice(0, anzahl).map(k => k.wort.text);
  if (!liste.includes(woerter[pos])) liste[liste.length - 1] = woerter[pos];
  return { liste, richtig: woerter[pos], tipp: alle[0]?.wort.text ?? "" };
}

describe("Die Auswahl", () => {
  it("enthält immer das richtige Wort", () => {
    for (const korpus of KORPORA) {
      const woerter = woerterAus(korpus.text);
      for (let pos = 4; pos < Math.min(woerter.length - 1, 60); pos++) {
        const { liste, richtig } = auswahl(korpus.text, korpus.titel, pos);
        expect(liste, `${korpus.slug}@${pos}`).toContain(richtig);
      }
    }
  });

  it("bietet nie ein Wort doppelt an", () => {
    for (const korpus of KORPORA) {
      for (let pos = 4; pos < 40; pos++) {
        const { liste } = auswahl(korpus.text, korpus.titel, pos);
        expect(new Set(liste).size, `${korpus.slug}@${pos}`).toBe(liste.length);
      }
    }
  });

  it("schlägt höchstens sechs Wörter vor", () => {
    for (let pos = 4; pos < 40; pos++) {
      expect(auswahl(KORPORA[0].text, KORPORA[0].titel, pos).liste.length).toBeLessThanOrEqual(6);
    }
  });
});

describe("Spielen", () => {
  it("zählt Mensch und Maschine getrennt", () => {
    const { container } = render(<Raten />);
    const { liste, richtig, tipp } = auswahl(KORPORA[0].text, KORPORA[0].titel, 4);

    // Absichtlich falsch tippen, wo es geht.
    const falsch = liste.find(w => w !== richtig);
    const knopf = [...container.querySelectorAll("button")]
      .find(b => b.textContent === (falsch ?? richtig))!;
    fireEvent.click(knopf);

    expect(screen.getByText(new RegExp(falsch ? "✗ Es war" : "✓ Getroffen"))).toBeTruthy();
    // Das Netz hat unabhängig davon getippt — sein Punkt hängt nicht an meinem.
    const text = container.textContent ?? "";
    expect(text).toContain(`👤 Du: ${falsch ? 0 : 1}`);
    expect(text).toContain(`🤖 Netz: ${tipp === richtig ? 1 : 0}`);
  });

  it("nimmt pro Runde nur eine Antwort an", () => {
    const { container } = render(<Raten />);
    const knopf = [...container.querySelectorAll("button")]
      .find(b => /^[A-Za-zÄÖÜäöüß.]+$/.test(b.textContent ?? "") && (b.textContent ?? "").length < 14)!;
    fireEvent.click(knopf);
    fireEvent.click(knopf);
    expect((container.textContent ?? "").match(/von 1 Wort/)).toBeTruthy();
  });
});
