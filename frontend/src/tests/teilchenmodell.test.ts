/**
 * Das Teilchenmodell: Zustände aus Schmelz- und Siedepunkt, Mischen,
 * Lösen — und Reaktionen, bei denen kein Atom verloren geht.
 */
import { describe, expect, it } from "vitest";
import { kugelFarbe, loestSichIn, mischbar, mischText, phaseVon, stoff, STOFFE } from "@/lib/atome/stoffe";
import {
  atomZahl, einzelSzene, mischSzene, REAKTIONEN, reaktionsSzene, schritt, stoffZahl, zuende, type Szene,
} from "@/lib/atome/teilchen";

const zufall = (() => { let s = 11; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const laufe = (sz: Szene, sekunden: number) => {
  for (let i = 0; i < sekunden * 60; i++) schritt(sz, 1 / 60, zufall);
};
const anteil = (sz: Szene, art: string) => sz.t.filter(p => p.bewegung === art).length / sz.t.length;

describe("Zustände", () => {
  it.each([
    ["h2o", -10, "fest"], ["h2o", 20, "flüssig"], ["h2o", 100, "gasförmig"],
    ["hg", 20, "flüssig"], ["fe", 20, "fest"], ["co2", -60, "gasförmig"], ["co2", -90, "fest"],
    ["he", -272, "flüssig"], ["zucker", 200, "zersetzt"], ["oel", 100, "flüssig"],
  ] as const)("%s bei %i °C ist %s", (id, T, soll) => expect(phaseVon(stoff(id), T)).toBe(soll));

  it("jeder Stoff hat sinnvolle Werte", () => {
    for (const s of STOFFE) {
      if (s.schmelz !== null && s.siede !== null) expect(s.siede).toBeGreaterThanOrEqual(s.schmelz);
      expect(s.formen.length).toBeGreaterThan(0);
      expect(s.dichte).toBeGreaterThan(0);
    }
    expect(new Set(STOFFE.map(s => s.id)).size).toBe(STOFFE.length);
    // Im Kugelmodell hat jeder Stoff seine eigene Farbe.
    expect(STOFFE.every(s => kugelFarbe(s) !== "#9ca3af")).toBe(true);
  });

  it("Eis liegt im Gitter, Wasserdampf fliegt", () => {
    const eis = einzelSzene("h2o", -20, zufall);
    laufe(eis, 1);
    expect(anteil(eis, "gitter")).toBe(1);
    eis.T = 150;
    laufe(eis, 3);
    expect(anteil(eis, "gas")).toBe(1);
  });

  it("Wasser gefriert wieder von unten zum Gitter", () => {
    const w = einzelSzene("h2o", 20, zufall);
    laufe(w, 1);
    expect(anteil(w, "fluessig")).toBe(1);
    w.T = -20;
    laufe(w, 6);
    expect(anteil(w, "gitter")).toBeGreaterThan(0.9);
  });
});

describe("Mischen", () => {
  it("weiß, was sich mischt", () => {
    expect(mischbar(stoff("h2o"), stoff("ethanol"))).toBe(true);
    expect(mischbar(stoff("h2o"), stoff("oel"))).toBe(false);
    expect(mischbar(stoff("hexan"), stoff("oel"))).toBe(true);
    expect(loestSichIn(stoff("nacl"), stoff("h2o"))).toBe(true);
    expect(loestSichIn(stoff("nacl"), stoff("oel"))).toBe(false);
    expect(loestSichIn(stoff("i2"), stoff("ethanol"))).toBe(true);
    expect(mischText(stoff("h2o"), stoff("oel"), 20)).toMatch(/Speiseöl .* schwimmt oben/);
  });

  it("Öl schwimmt nach dem Wegziehen der Wand auf dem Wasser", () => {
    const sz = mischSzene("h2o", "oel", 20, zufall);
    laufe(sz, 1);
    sz.wand = false;
    laufe(sz, 8);
    // y wächst nach unten: das Öl soll fast ganz über der Mitte liegen.
    const ys = sz.t.map(p => p.y).sort((a, b) => a - b);
    const mitte = ys[Math.floor(ys.length / 2)];
    const oel = sz.t.filter(p => p.s === 1);
    expect(oel.filter(p => p.y < mitte).length / oel.length).toBeGreaterThan(0.75);
  });

  it("Salz löst sich in Wasser", () => {
    const sz = mischSzene("nacl", "h2o", 40, zufall);
    laufe(sz, 1);
    sz.wand = false;
    laufe(sz, 8);
    expect(sz.t.filter(p => p.geloest).length).toBeGreaterThan(5);
  });
});

describe("Reaktionen", () => {
  it("jede Reaktion ist ausgeglichen", () => {
    for (const r of REAKTIONEN) {
      const zaehle = (seite: [string, number][]) => {
        const z: Record<string, number> = {};
        for (const [id, n] of seite) {
          for (const f of stoff(id).formen) for (const [sym] of f.atome) z[sym] = (z[sym] ?? 0) + n;
        }
        return z;
      };
      expect(zaehle(r.produkte), r.id).toEqual(zaehle(r.edukte));
    }
  });

  it("Knallgas bleibt kalt ruhig und explodiert mit Funken — ohne Atome zu verlieren", () => {
    const sz = reaktionsSzene(REAKTIONEN.find(r => r.id === "knallgas")!, 20, zufall);
    const vorher = atomZahl(sz);
    laufe(sz, 1);
    expect(sz.umsatz).toBe(0);
    zuende(sz, 320, 180, 2000);
    laufe(sz, 4);
    expect(sz.umsatz).toBeGreaterThan(5);
    expect(atomZahl(sz)).toEqual(vorher);
    expect(stoffZahl(sz)[sz.stoffe.findIndex(s => s.id === "h2o")]).toBe(sz.umsatz * 2);
  });

  it("Salmiak bildet sich nach dem Öffnen der Wand von selbst", () => {
    const sz = reaktionsSzene(REAKTIONEN.find(r => r.id === "salmiak")!, 20, zufall);
    laufe(sz, 1);
    expect(sz.umsatz).toBe(0);
    sz.wand = false;
    laufe(sz, 4);
    expect(sz.umsatz).toBeGreaterThan(0);
  });
});
