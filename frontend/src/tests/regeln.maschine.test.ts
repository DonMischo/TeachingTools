import { describe, expect, it } from "vitest";
import {
  drehungen, istBaum, laufeDurch, programm, programmText, regel, regelText,
  schritt, starte, zaehle, zelle, zusammenhaengend,
} from "@/lib/regeln/maschine";
import { RAETSEL, STATIONEN, rundwege } from "@/lib/regeln/lehrgang";

const bild = (l: { raster: { z: string[] } }) => l.raster.z.join("");

describe("Regeln als Text", () => {
  it("liest und schreibt Regeln und Programme", () => {
    expect(regelText(regel("rbb → ggr"))).toBe("RBB=GGR");
    expect(regelText(regel("WB/BB=WB/BW"))).toBe("WB/BB=WB/BW");
    const text = "markov: RBB=GGR, RGG=WWR\neins x12: WBW=WWW";
    const p = programm(text);
    expect(p.bloecke).toHaveLength(2);
    expect(p.bloecke[1].grenze).toBe(12);
    expect(programmText(p)).toBe(text);
  });

  it("lehnt ungleich große Muster ab", () => {
    expect(() => regel("RB=WWR")).toThrow();
    expect(() => regel("RB/B=WR/W")).toThrow();
    expect(() => programm("irgendwas: RB=WR")).toThrow();
  });
});

describe("Drehungen", () => {
  it("findet vier Richtungen einer geraden Regel", () => {
    const d = drehungen(regel("RB=WR"));
    expect(d).toHaveLength(4);
    expect(d.map(v => `${v.aus.b}x${v.aus.h}`).sort()).toEqual(["1x2", "1x2", "2x1", "2x1"]);
  });

  it("zählt eine symmetrische Regel nur einmal", () => {
    expect(drehungen(regel("B=R"))).toHaveLength(1);
    expect(drehungen(regel("WBW=WWW"))).toHaveLength(2);
  });

  it("wendet die Regel in jeder Richtung an", () => {
    // Der rote Punkt in der Mitte kann in alle vier Richtungen laufen.
    const ziele = new Set<number>();
    for (let seed = 1; seed < 40; seed++) {
      const l = starte(programm("eins x1: RB=WR"), { b: 3, h: 3, grund: "B", mitte: "R" }, seed);
      laufeDurch(programm("eins x1: RB=WR"), l);
      ziele.add(l.raster.z.indexOf("R"));
    }
    expect([...ziele].sort()).toEqual([1, 3, 5, 7]);
  });
});

describe("Lauf", () => {
  it("gleicher Seed, gleiches Bild — anderer Seed, anderes Bild", () => {
    const p = programm("markov: RBB=GGR, RGG=WWR");
    const s = { b: 21, h: 21, grund: "B", mitte: "R" };
    const a = laufeDurch(p, starte(p, s, 7));
    const b = laufeDurch(p, starte(p, s, 7));
    const c = laufeDurch(p, starte(p, s, 8));
    expect(bild(a)).toBe(bild(b));
    expect(bild(a)).not.toBe(bild(c));
  });

  it("der Backtracker baut ein perfektes Labyrinth", () => {
    const p = programm("markov: RBB=GGR, RGG=WWR");
    const l = laufeDurch(p, starte(p, { b: 23, h: 23, grund: "B", mitte: "R" }, 3));
    expect(l.fertig).toBe(true);
    expect(zaehle(l.raster, "G")).toBe(0);
    expect(zaehle(l.raster, "R")).toBe(1);
    const wege = { ...l.raster, z: l.raster.z.map(c => (c === "R" ? "W" : c)) };
    // 11×11 Kreuzungen + 120 Gänge dazwischen
    expect(zaehle(wege, "W")).toBe(241);
    expect(istBaum(wege, "W")).toBe(true);
  });

  it("»alle« ersetzt in einem Schritt alle freien Treffer", () => {
    const p = programm("alle: WB=WW");
    const l = starte(p, { b: 5, h: 5, grund: "B", mitte: "W" }, 1);
    schritt(p, l);
    expect(zaehle(l.raster, "W")).toBe(5); // Mitte + vier Nachbarn
    expect(l.letzte).toHaveLength(4);
  });

  it("»markov« nimmt die zweite Regel nur, wenn die erste nirgends passt", () => {
    const p = programm("markov: RB=WR, R=G");
    const l = starte(p, { b: 3, h: 1, grund: "B" }, 1);
    l.raster.z[0] = "R";
    laufeDurch(p, l);
    expect(bild(l)).toBe("WWG");
    expect(l.zaehler[0]).toEqual([2, 1]);
  });

  it("die Schrittgrenze beendet einen Block, dann läuft der nächste", () => {
    const p = programm("eins x2: RB=WR\neins: R=G");
    const l = starte(p, { b: 6, h: 1, grund: "B" }, 1);
    l.raster.z[0] = "R";
    laufeDurch(p, l);
    expect(bild(l)).toBe("WWGBBB");
  });

  it("Treffer, die nichts ändern, zählen nicht (kein Endlos-Lauf)", () => {
    const p = programm("eins: W=W");
    const l = laufeDurch(p, starte(p, { b: 3, h: 3, grund: "W" }, 1), 50);
    expect(l.fertig).toBe(true);
    expect(l.gesamt).toBe(0);
  });

  it("Joker passen auf alles und lassen im Ersatz die Zelle stehen", () => {
    const p = programm("eins: R*B=W*R");
    const l = starte(p, { b: 3, h: 1, grund: "B" }, 1);
    l.raster.z = ["R", "U", "B"];
    laufeDurch(p, l);
    expect(bild(l)).toBe("WUR");
  });
});

describe("Prüfungen", () => {
  it("erkennt Zusammenhang und Rundwege", () => {
    const r = { b: 3, h: 3, z: [..."WWWWBWWWW"] };
    expect(zusammenhaengend(r, "W")).toBe(true);
    expect(istBaum(r, "W")).toBe(false);
    expect(rundwege(r, "W")).toBe(1);
    const zwei = { b: 3, h: 1, z: [..."WBW"] };
    expect(zusammenhaengend(zwei, "W")).toBe(false);
    expect(zelle(r, 1, 1)).toBe("B");
  });
});

describe("Lehrgang", () => {
  it.each(STATIONEN.map(s => [s.id, s] as const))("Station %s läuft durch", (_id, s) => {
    const p = programm(s.programm);
    const l = laufeDurch(p, starte(p, s.start, 42));
    expect(l.fertig).toBe(true);
    expect(l.gesamt).toBeGreaterThan(0);
  });

  it("Station 5 legt Zimmer, Flure und Türen an", () => {
    const s = STATIONEN.find(s => s.id === "grundriss")!;
    const p = programm(s.programm);
    const l = laufeDurch(p, starte(p, s.start, 42));
    expect(zaehle(l.raster, "U")).toBe(8 * 9);
    expect(zaehle(l.raster, "W")).toBeGreaterThan(100);
    expect(zaehle(l.raster, "Y")).toBeGreaterThan(0);
  });
});

describe("Rätsel", () => {
  it.each(RAETSEL.map(r => [r.id, r] as const))("%s: Lösung klappt, Vorlage nicht", (_id, r) => {
    for (const seed of [1, 2, 3]) {
      const p = programm(r.loesung);
      expect(p.bloecke.reduce((n, b) => n + b.regeln.length, 0)).toBeLessThanOrEqual(r.maxRegeln);
      expect(r.pruefe(laufeDurch(p, starte(p, r.start, seed)).raster)).toBeNull();
      const v = programm(r.vorlage);
      expect(r.pruefe(laufeDurch(v, starte(v, r.start, seed)).raster)).not.toBeNull();
    }
  });
});
