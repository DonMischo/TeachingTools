/**
 * Das Teilchenmodell: Zustände aus Schmelz- und Siedepunkt, Mischen,
 * Lösen — und Reaktionen, bei denen kein Atom verloren geht.
 */
import { describe, expect, it } from "vitest";
import { kugelFarbe, loestSichIn, mischbar, mischText, phaseVon, stoff, STOFFE } from "@/lib/atome/stoffe";
import {
  atomZahl, BREITE, einzelSzene, TRENNUNGEN, trennSzene, verteilung, mischSzene, REAKTIONEN, reaktionsSzene, schritt, stoffZahl, zuende, type Szene,
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

describe("Flüssigkeit", () => {
  /** Wasser einschwingen lassen, dann 10 s lang messen. */
  const messe = (T: number) => {
    const sz = einzelSzene("h2o", T, zufall);
    laufe(sz, 3);
    const schwerpunkt: number[] = [], lose: number[] = [], mitte: number[] = [], rand: number[] = [];
    for (let k = 0; k < 40; k++) {
      for (let i = 0; i < 15; i++) schritt(sz, 1 / 60, zufall);
      const f = sz.t.filter(p => p.bewegung === "fluessig");
      schwerpunkt.push(f.reduce((a, p) => a + p.x, 0) / f.length);
      // Anteil ohne Nachbarn in 1,4 Durchmessern — schwebt allein über der Flüssigkeit.
      lose.push(f.filter(p => !f.some(q => q !== p && Math.hypot(q.x - p.x, q.y - p.y) < 21)).length / f.length);
      const m = f.filter(p => Math.abs(p.x - BREITE / 2) < BREITE * 0.15);
      const r = f.filter(p => Math.abs(p.x - BREITE / 2) > BREITE * 0.35);
      mitte.push(m.reduce((a, p) => a + p.vy, 0) / m.length);
      rand.push(r.reduce((a, p) => a + p.vy, 0) / r.length);
    }
    const mittel = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    const streuung = Math.sqrt(mittel(schwerpunkt.map(x => (x - mittel(schwerpunkt)) ** 2)));
    return { streuung, lose: mittel(lose), mitte: mittel(mitte), rand: mittel(rand) };
  };

  it("schwappt nicht und bleibt beisammen", () => {
    const m = messe(20);
    expect(m.streuung).toBeLessThan(6);
    expect(m.lose).toBeLessThan(0.03);
  });

  it("wälzt sich nahe am Siedepunkt um: in der Mitte hoch, am Rand runter", () => {
    const m = messe(85);
    // y wächst nach unten.
    expect(m.mitte).toBeLessThan(-10);
    expect(m.rand).toBeGreaterThan(10);
  });
});

describe("Fester Stoff im Gitter", () => {
  it("Eis im Gemisch mit Ethanol rastet ganz ein, das Ethanol bleibt flüssig", () => {
    const sz = mischSzene("h2o", "ethanol", 20, zufall);
    laufe(sz, 1);
    sz.wand = false;
    laufe(sz, 2);
    sz.T = -20;
    laufe(sz, 8);
    const wasser = sz.t.filter(p => p.s === 0), ethanol = sz.t.filter(p => p.s === 1);
    expect(wasser.filter(p => p.bewegung === "gitter").length / wasser.length).toBeGreaterThan(0.9);
    expect(ethanol.every(p => p.bewegung === "fluessig")).toBe(true);
  });

  it("Kristallteilchen bleiben nah an ihrem Platz", () => {
    const sz = einzelSzene("h2o", -50, zufall);
    laufe(sz, 2);
    const r = sz.stoffe[0].r;
    // Kein Nachbar näher als zwei Drittel Durchmesser: es schwingt, aber es rückt nicht.
    for (const p of sz.t) {
      const nn = Math.min(...sz.t.filter(q => q !== p).map(q => Math.hypot(q.x - p.x, q.y - p.y)));
      expect(nn).toBeGreaterThan(1.3 * r);
    }
  });
});

describe("Trennen", () => {
  const trenn = (id: string) => TRENNUNGEN.find(t => t.id === id)!;

  it("Destillation: aus Wein geht nur das Ethanol in die Vorlage", () => {
    const t = trenn("wein");
    const sz = trennSzene(t, 20, zufall);
    laufe(sz, 1);
    expect(verteilung(sz)[1]).toEqual([0, 0]);
    sz.T = t.ziel;
    laufe(sz, 30);
    const [kolben, vorlage] = verteilung(sz);
    expect(vorlage[1] / (kolben[1] + vorlage[1])).toBeGreaterThan(0.6);
    expect(vorlage[0]).toBe(0);
  });

  it("Destillation: aus Salzwasser kommt salzfreies Wasser", () => {
    const t = trenn("salzwasser-d");
    const sz = trennSzene(t, t.ziel, zufall);
    laufe(sz, 12);
    const [kolben, vorlage] = verteilung(sz);
    expect(vorlage[0]).toBeGreaterThan(kolben[0] * 0.3);
    expect(vorlage[1]).toBe(0);
  });

  it("Filtration: Sand bleibt oben, Wasser läuft durch", () => {
    const sz = trennSzene(trenn("sand"), 20, zufall);
    laufe(sz, 8);
    const [oben, unten] = verteilung(sz);
    expect(unten[0]).toBe(0);
    expect(unten[1]).toBeGreaterThan(oben[1] * 4);
  });

  it("Filtration: gelöstes Salz läuft mit durch", () => {
    const sz = trennSzene(trenn("salzwasser-f"), 20, zufall);
    laufe(sz, 8);
    const [oben, unten] = verteilung(sz);
    expect(unten[1]).toBeGreaterThan(oben[1] * 3);
  });
});
