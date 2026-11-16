import { describe, expect, it } from "vitest";
import {
  DURCHGANG, NAH, WAND, ZELLE, baueFreiPlan, feldMitte, freiAbstaende, freiWeg, freieStrecke, istFrei, ortBei, ortMitte, schiebeHeraus,
} from "@/lib/gebaeude/frei";

const zeichne = (e: ReturnType<typeof baueFreiPlan>["ebenen"][number]) => {
  const zeilen: string[] = [];
  for (let y = 0; y < e.h; y++) {
    let s = "";
    for (let x = 0; x < e.b; x++) s += " .o+"[e.art[y * e.b + x]];
    zeilen.push(s);
  }
  return zeilen.join("\n");
};

describe("freie Karte", () => {
  it("hat je Station einen Platz, dazu Ankunft und Ausgang — alles erreichbar", () => {
    for (const seed of [1, 7, 42, 1234]) {
      for (const organisch of [false, true]) {
        const plan = baueFreiPlan([3, 6, 1], seed, [organisch, organisch, organisch]);
        expect(plan.ebenen).toHaveLength(3);
        plan.ebenen.forEach((e, i) => {
          expect(e.raeume).toHaveLength([3, 6, 1][i]);
          const d = freiAbstaende(e, e.start);
          for (const r of e.raeume) expect(d[r.y * e.b + r.x], zeichne(e)).toBeGreaterThan(0);
          expect(d[e.ziel[1] * e.b + e.ziel[0]]).toBeGreaterThan(0);
          // das Ziel liegt am weitesten weg, die Stationen sind nach Entfernung sortiert
          const ds = e.raeume.map(r => d[r.y * e.b + r.x]);
          expect([...ds].sort((a, b) => a - b)).toEqual(ds);
          expect(d[e.ziel[1] * e.b + e.ziel[0]]).toBeGreaterThanOrEqual(Math.max(...ds));
        });
      }
    }
  });

  it("ist bei gleichem Seed gleich", () => {
    const a = baueFreiPlan([4, 4], 99, [true, false]), b = baueFreiPlan([4, 4], 99, [true, false]);
    expect(a.ebenen.map(e => Array.from(e.art))).toEqual(b.ebenen.map(e => Array.from(e.art)));
    expect(a.ebenen[0].ziel).toEqual(b.ebenen[0].ziel);
  });

  it("ist luftig: der Rand bleibt zu, Plätze sind ganz frei, Wege drei Felder breit", () => {
    const e = baueFreiPlan([5], 3)[`ebenen`][0];
    for (let i = 0; i < e.b; i++) {
      expect(istFrei(e, i, 0) || istFrei(e, i, e.h - 1) || istFrei(e, 0, i) || istFrei(e, e.b - 1, i)).toBe(false);
    }
    for (const r of e.raeume) {
      for (let y = r.y - r.r; y <= r.y + r.r; y++) for (let x = r.x - r.r; x <= r.x + r.r; x++) expect(istFrei(e, x, y)).toBe(true);
    }
    // jeder Durchgang ist drei Felder breit
    const durch = Array.from(e.art).filter(a => a === DURCHGANG).length;
    expect(durch).toBeGreaterThan(0);
    expect(durch % 3).toBe(0);
    const frei = Array.from(e.art).filter(a => a !== WAND).length / e.art.length;
    expect(frei).toBeGreaterThan(0.3);
  });

  it("nagt Wald und Höhle an: mehr freie Felder, kein Loch im Rand", () => {
    const gerade = baueFreiPlan([5], 3, [false]).ebenen[0], wild = baueFreiPlan([5], 3, [true]).ebenen[0];
    const frei = (e: typeof gerade) => Array.from(e.art).filter(a => a !== WAND).length;
    expect(frei(wild)).toBeGreaterThan(frei(gerade));
    for (let i = 0; i < wild.b; i++) expect(istFrei(wild, i, 0) || istFrei(wild, 0, i)).toBe(false);
  });

  it("findet Wege über Felder", () => {
    const e = baueFreiPlan([4], 11).ebenen[0];
    const w = freiWeg(e, e.start, e.ziel);
    expect(w.length).toBeGreaterThan(5);
    expect(w[w.length - 1]).toEqual(e.ziel);
    for (const [x, y] of w) expect(istFrei(e, x, y)).toBe(true);
    expect(freiWeg(e, e.start, [0, 0])).toEqual([]);
  });
});

describe("Bewegung", () => {
  const e = baueFreiPlan([4], 11).ebenen[0];
  const [sx, sz] = [feldMitte(e.start[0]), feldMitte(e.start[1])];

  it("lässt die Figur im Freien stehen und schiebt sie aus Wänden", () => {
    expect(schiebeHeraus(e, sx, sz, 0.4)).toEqual([sx, sz]);
    // gegen den Rand der Karte laufen: sie bleibt auf freiem Boden
    let x = sx, z = sz;
    for (let k = 0; k < 400; k++) [x, z] = schiebeHeraus(e, x - 0.1, z - 0.07, 0.4);
    expect(istFrei(e, Math.floor(x / ZELLE), Math.floor(z / ZELLE))).toBe(true);
    for (const [dx, dz] of [[0.39, 0], [-0.39, 0], [0, 0.39], [0, -0.39]]) {
      expect(istFrei(e, Math.floor((x + dx) / ZELLE), Math.floor((z + dz) / ZELLE))).toBe(true);
    }
  });

  it("misst freie Strecken", () => {
    expect(freieStrecke(e, sx, sz, sx + 2, sz)).toBe(1);
    expect(freieStrecke(e, sx, sz, -5, -5)).toBeLessThan(1);
  });

  it("erkennt Station, Ziel und Rückweg", () => {
    const [rx, rz] = ortMitte(e, { art: "raum", raum: 2 });
    expect(ortBei(e, rx + 1, rz, false)).toEqual({ art: "raum", raum: 2 });
    expect(ortBei(e, rx + NAH + 0.5, rz, false)).toBeNull();
    const [zx, zz] = ortMitte(e, { art: "ziel" });
    expect(ortBei(e, zx, zz, false)).toEqual({ art: "ziel" });
    expect(ortBei(e, sx, sz, false)).toBeNull();
    expect(ortBei(e, sx, sz, true)).toEqual({ art: "zurueck" });
  });
});
