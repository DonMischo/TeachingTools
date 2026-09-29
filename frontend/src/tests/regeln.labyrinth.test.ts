import { describe, expect, it } from "vitest";
import { K, durch, entferneWaende, erzeuge, loese, neuesLab, type Erzeuger, type Lab, type Loesung } from "@/lib/regeln/labyrinth";
import { istBaum, zufall, type Raster } from "@/lib/regeln/maschine";

const alsRaster = (l: Lab): Raster => ({ b: l.R, h: l.R, z: [...l.k].map(k => (k === K.WAND ? "B" : "W")) });
const ERZEUGER: Erzeuger[] = ["backtracker", "prim", "kruskal", "wilson"];

function lab(art: Erzeuger, seed: number, n = 12) {
  const l = neuesLab(n);
  durch(erzeuge(l, art, zufall(seed)));
  return l;
}

describe("Erzeuger", () => {
  it.each(ERZEUGER)("%s baut ein perfektes Labyrinth über alle Zellen", art => {
    for (const seed of [1, 2, 3]) {
      const l = lab(art, seed);
      expect(l.k.filter(k => k !== K.WAND && k !== K.OFFEN)).toHaveLength(0);
      expect(l.k.filter(k => k === K.OFFEN).length).toBe(2 * 12 * 12 - 1);
      expect(istBaum(alsRaster(l), "W")).toBe(true);
    }
  });

  it("hält nach jedem Schritt an", () => {
    const l = neuesLab(5);
    const gen = erzeuge(l, "backtracker", zufall(1));
    gen.next();
    expect(l.k.filter(k => k === K.KOPF)).toHaveLength(1);
    expect(l.liste).toEqual(["0|0"]);
  });

  it("gleicher Seed, gleiches Labyrinth", () => {
    expect([...lab("wilson", 5).k]).toEqual([...lab("wilson", 5).k]);
  });
});

describe("Löser", () => {
  const loesung = (l: Lab, art: "dfs" | "bfs" | "astar") => {
    const e: Loesung = { besucht: 0, weg: 0, gefunden: false };
    durch(loese(l, art, e));
    return e;
  };

  it("alle finden im perfekten Labyrinth denselben (einzigen) Weg", () => {
    const l = lab("backtracker", 4);
    const [d, b, a] = (["dfs", "bfs", "astar"] as const).map(art => loesung(l, art));
    expect(d.gefunden && b.gefunden && a.gefunden).toBe(true);
    expect(b.weg).toBe(d.weg);
    expect(a.weg).toBe(b.weg);
    expect(l.k.filter(k => k === K.WEG).length).toBe(2 * a.weg + 1);
  });

  it("mit Rundwegen: Breitensuche und A* finden den kürzesten Weg, A* schaut weniger an", () => {
    let dfsLaenger = false;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const l = lab("backtracker", seed, 15);
      expect(entferneWaende(l, 40, zufall(seed))).toBe(40);
      const d = loesung(l, "dfs"), b = loesung(l, "bfs"), a = loesung(l, "astar");
      expect(a.weg).toBe(b.weg);
      expect(d.weg).toBeGreaterThanOrEqual(b.weg);
      expect(a.besucht).toBeLessThanOrEqual(b.besucht);
      if (d.weg > b.weg) dfsLaenger = true;
    }
    expect(dfsLaenger).toBe(true);
  });
});
