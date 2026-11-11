import { describe, expect, it } from "vitest";
import { AUS, Druckluft, EIN, HUB } from "@/lib/stroemung/druckluft";

const e = { regler: 6e5, last: 400, zuluft: 50, abluft: 50 };

describe("Druckluftanlage", () => {
  it("Ventil auf: der Zylinder fährt aus, Ventil zu: die Feder holt ihn zurück", () => {
    const d = new Druckluft(e);
    d.schalte(true);
    d.laufe(3);
    expect(d.weg).toBeCloseTo(HUB, 6);
    d.schalte(false);
    d.laufe(3);
    expect(d.weg).toBe(0);
    expect(d.verbrauch).toBeGreaterThan(0);
  });

  it("zu schwere Last: p·A reicht nicht, nichts bewegt sich", () => {
    const d = new Druckluft({ ...e, last: 1200, regler: 5e5 });   // nötig ≈ 6,5 bar
    d.schalte(true);
    d.laufe(5);
    expect(d.weg).toBe(0);
  });

  it("weniger offene Zuluftdrossel: langsamer", () => {
    const zeit = (zuluft: number) => {
      const d = new Druckluft({ ...e, zuluft });
      d.schalte(true);
      let t = 0;
      while (d.weg < HUB && t < 30) { d.laufe(0.05); t += 0.05; }
      return t;
    };
    expect(zeit(15)).toBeGreaterThan(2 * zeit(60));
  });

  it("Dauerbetrieb: Hübe zählen, Kessel fällt, Druckschalter hält ihn zwischen 6 und 8 bar", () => {
    const d = new Druckluft(e, 6.2e5);
    d.automatik = true;
    let tiefst = Infinity, hoechst = 0;
    for (let i = 0; i < 1200; i++) { d.laufe(0.1); tiefst = Math.min(tiefst, d.kesselDruck); hoechst = Math.max(hoechst, d.kesselDruck); }
    expect(d.huebe).toBeGreaterThan(10);
    expect(tiefst).toBeGreaterThan(EIN - 0.3e5);
    expect(hoechst).toBeLessThan(AUS + 0.3e5);
    expect(hoechst).toBeGreaterThan(AUS - 0.3e5);   // der Kompressor hat mindestens einmal voll geladen
  });
});
