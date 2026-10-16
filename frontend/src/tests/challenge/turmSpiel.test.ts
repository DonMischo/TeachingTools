import { describe, it, expect } from "vitest";
import { anfuehrerFaellt, neuerZustand, schritt, startWelle, welleAnzahl, welleHp, welleTempo, zeitFaktor, ZEITSCHLEIFE } from "@/lib/challenge/turmSpiel";

const pfad: [number, number][] = Array.from({ length: 40 }, (_, i) => [i, 0]);

describe("Turm-Stärke", () => {
  it("Leben, Tempo und Anzahl wachsen mit der Welle (gedeckelt)", () => {
    expect(welleHp(5)).toBeGreaterThan(welleHp(1));
    expect(welleTempo(5)).toBeGreaterThan(welleTempo(1));
    expect(welleAnzahl(5)).toBe(welleAnzahl(1) + 2);
    expect(welleHp(99)).toBe(4);
    expect(welleAnzahl(99)).toBe(14);
    const a = neuerZustand(), b = neuerZustand();
    startWelle(a); b.welle = 4; startWelle(b);
    expect(b.warteschlange[0].hp).toBeGreaterThan(a.warteschlange[0].hp);
    expect(b.warteschlange.length).toBeGreaterThan(a.warteschlange.length);
  });
});

describe("Zeitschleife", () => {
  const weg = (faktor: number) => {
    const z = neuerZustand(); startWelle(z);
    schritt(z, pfad, [], 0.01);
    const t0 = z.gegner[0].t;
    for (let i = 0; i < 20; i++) schritt(z, pfad, [], 0.05 * faktor);
    return z.gegner[0].t - t0;
  };
  it("Faktoren", () => {
    expect(zeitFaktor(false, false)).toBe(1);
    expect(zeitFaktor(true, false)).toBe(ZEITSCHLEIFE);
    expect(zeitFaktor(true, true)).toBe(0);
  });
  it("Gegner legen in der Zeitschleife ca. 4× weniger Weg zurück", () => {
    expect(weg(1) / weg(zeitFaktor(true, false))).toBeCloseTo(4, 1);
  });
});

describe("Schwächung durch gefallene Anführer", () => {
  it("senkt aktuelles und künftiges Leben, stapelt und deckelt", () => {
    const z = neuerZustand(); startWelle(z, ["c1", "c2", "c3", "c4", "c5"]);
    schritt(z, pfad, [], 3);
    const g = z.gegner.find((x) => !x.anfuehrer)!, hp = g.hp;
    const basis = (() => { const y = neuerZustand(); startWelle(y); return y.warteschlange[0].hp; })();
    anfuehrerFaellt(z, "c1");
    expect(g.hp).toBeCloseTo(hp * 0.6);
    expect(z.schwaeche).toBeCloseTo(0.15);
    const y = neuerZustand(); y.schwaeche = 0.15; startWelle(y);
    expect(y.warteschlange[0].hp).toBeCloseTo(basis * 0.85);
    ["c2", "c3", "c4", "c5"].forEach((id) => anfuehrerFaellt(z, id));
    expect(z.schwaeche).toBeCloseTo(0.6);
  });
  it("ohne gefallenen Anführer keine Schwächung", () => {
    const z = neuerZustand(); startWelle(z);
    schritt(z, pfad, [], 3);
    expect(z.schwaeche).toBe(0);
  });
});
