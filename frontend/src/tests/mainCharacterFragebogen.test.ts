/**
 * Main-Character-Fragebogen: jede Klasse ist erreichbar, gleiche Antworten
 * geben dasselbe Ergebnis, Talente bleiben im Rahmen, Vorschläge brauchen
 * mindestens zwei Hinweise.
 */
import { describe, expect, it } from "vitest";
import { SPIELKLASSEN, type KlasseId } from "@/lib/mainCharacter";
import { FRAGEN, auswerten } from "@/lib/mainCharacterFragebogen";

/** Wählt je Frage die Antwort, die `ziel` am meisten und den anderen am wenigsten gibt. */
function antwortenFuer(ziel: KlasseId): number[] {
  return FRAGEN.map(f => {
    let best = 0, bestWert = -Infinity;
    f.antworten.forEach((a, i) => {
      const fuer = a.klassen[ziel] ?? 0;
      const andere = Object.entries(a.klassen).filter(([k]) => k !== ziel).reduce((s, [, v]) => s + v!, 0);
      const w = fuer * 10 - andere;
      if (w > bestWert) { bestWert = w; best = i; }
    });
    return best;
  });
}

describe("Fragebogen", () => {
  it("hat 12 Fragen mit je mindestens vier Antworten", () => {
    expect(FRAGEN).toHaveLength(12);
    for (const f of FRAGEN) expect(f.antworten.length).toBeGreaterThanOrEqual(4);
  });

  it("jede spielbare Klasse ist erreichbar", () => {
    for (const k of SPIELKLASSEN) expect(auswerten(antwortenFuer(k)).klasse, k).toBe(k);
  });

  it("gleiche Antworten geben dasselbe Ergebnis", () => {
    const wahl = FRAGEN.map((_, i) => i % 4);
    expect(auswerten(wahl)).toEqual(auswerten([...wahl]));
  });

  it("Talente bleiben zwischen 0,7 und 1,4 und sind nicht alle gleich", () => {
    for (const k of SPIELKLASSEN) {
      const t = Object.values(auswerten(antwortenFuer(k)).talente);
      for (const v of t) {
        expect(v).toBeGreaterThanOrEqual(.7);
        expect(v).toBeLessThanOrEqual(1.4);
      }
      expect(Math.max(...t) - Math.min(...t), k).toBeGreaterThan(.1);
    }
  });

  it("ohne Antworten gibt es eine Klasse und neutrale Talente", () => {
    const a = auswerten([]);
    expect(SPIELKLASSEN).toContain(a.klasse);
    expect(Object.values(a.talente).every(v => v === 1)).toBe(true);
    expect(a.staerken).toEqual([]);
  });

  it("schlägt Stärken erst ab zwei Hinweisen vor", () => {
    const i = FRAGEN.findIndex(f => f.id === "thema");
    const j = FRAGEN.findIndex(f => f.id === "gruppe");
    const einmal: (number | undefined)[] = [];
    einmal[i] = 0; // neugierig
    expect(auswerten(einmal).staerken).not.toContain("neugierig");
    einmal[j] = 3; // neugierig
    expect(auswerten(einmal).staerken).toContain("neugierig");
  });
});
