import { describe, expect, it } from "vitest";
import { zufall } from "@/lib/regeln/maschine";
import { K, neuesLab } from "@/lib/regeln/labyrinth";
import { labyrinthMasse } from "@/lib/spielalgo/labyrinthMasse";
import { BAUM_STANDARD, wachsenderBaum } from "@/lib/spielalgo/wachsenderBaum";
import { BSP_STANDARD, bspRaster, erzeugeBsp, neuerBsp, zGang } from "@/lib/spielalgo/bsp";
import { NACHBARN_MAX, felsNachbarn, neueHoehle, regelUmrechnen } from "@/lib/spielalgo/hoehle";
import { minAbstand, neuerPoisson, poisson, voronoi } from "@/lib/spielalgo/verteilen";
import { GELAENDE_STANDARD, gelaende, wertRauschen } from "@/lib/spielalgo/rauschen";
import { neueSuche, suche, type Feld } from "@/lib/spielalgo/wege";
import { erzeugeAblauf, karte, kartenErreichbar, neuerAblauf, pruefe } from "@/lib/spielalgo/zyklisch";

function alle(g: Generator<string, unknown>): string[] {
  const n: string[] = [];
  for (let r = g.next(); !r.done; r = g.next()) n.push(r.value);
  return n;
}

describe("Growing Tree", () => {
  const baue = (o: Partial<typeof BAUM_STANDARD>, seed = 1, n = 16) => {
    const l = neuesLab(n);
    alle(wachsenderBaum(l, { ...BAUM_STANDARD, ...o }, zufall(seed)));
    return l;
  };

  it("baut für jede Einstellung ein perfektes Labyrinth", () => {
    for (const neueste of [0, 0.5, 1]) for (const geradeaus of [0, 1]) for (const waagrecht of [0, 0.5, 1]) {
      const l = baue({ neueste, geradeaus, waagrecht });
      expect(l.k.filter(k => k === K.OFFEN).length).toBe(2 * 16 * 16 - 1); // Zellen + Durchgänge eines Baums
      expect(labyrinthMasse(l).weg).toBeGreaterThan(0);
    }
  });

  it("neueste = 1 verhält sich wie der Backtracker: lange Gänge, wenig Sackgassen", () => {
    let bt = 0, pr = 0;
    for (const seed of [1, 2, 3]) {
      bt += labyrinthMasse(baue({ neueste: 1 }, seed)).sackgassen;
      pr += labyrinthMasse(baue({ neueste: 0 }, seed)).sackgassen;
    }
    expect(bt).toBeLessThan(pr);
  });

  it("Waagrecht-Vorliebe macht mehr waagrechte Durchgänge", () => {
    const zaehle = (w: number) => {
      const l = baue({ waagrecht: w });
      let wg = 0, sk = 0;
      for (let y = 1; y < l.R - 1; y++) for (let x = 1; x < l.R - 1; x++) {
        if (l.k[y * l.R + x] !== K.OFFEN || (x % 2) === (y % 2)) continue;
        if (x % 2 === 0) wg++; else sk++;
      }
      return wg / (wg + sk);
    };
    expect(zaehle(0.95)).toBeGreaterThan(0.6);
    expect(zaehle(0.05)).toBeLessThan(0.4);
  });
});

describe("BSP-Stellschrauben", () => {
  it("Streuung 0 schneidet genau in der Mitte", () => {
    const s = neuerBsp({ ...BSP_STANDARD, tiefe: 1, streuung: 0 });
    alle(erzeugeBsp(s, zufall(3)));
    expect(s.knoten[0].schnitt!.pos).toBe(32);
  });

  it("abwechselnd: Ebene 0 senkrecht, Ebene 1 waagrecht (wo möglich)", () => {
    const s = neuerBsp({ ...BSP_STANDARD, b: 60, h: 60, tiefe: 2, schnitt: "abwechselnd" });
    alle(erzeugeBsp(s, zufall(3)));
    expect(s.knoten[0].schnitt!.senkrecht).toBe(true);
    for (const i of s.knoten[0].kinder!) expect(s.knoten[i].schnitt!.senkrecht).toBe(false);
  });

  it("Rundgänge fügen Gänge hinzu, Z-Gänge sind lückenlos", () => {
    const s = neuerBsp({ ...BSP_STANDARD, rundgaenge: 3, gang: "Z" });
    const notizen = alle(erzeugeBsp(s, zufall(4)));
    const blaetter = s.knoten.filter(k => !k.kinder).length;
    expect(s.gaenge.length).toBe(blaetter - 1 + 3);
    expect(notizen.some(n => n.startsWith("Rundgang"))).toBe(true);
    expect(bspRaster(s).length).toBe(64 * 44);
    const g = zGang([2, 3], [11, 9], true);
    for (let i = 1; i < g.length; i++) expect(Math.abs(g[i][0] - g[i - 1][0]) + Math.abs(g[i][1] - g[i - 1][1])).toBe(1);
    expect(g[g.length - 1]).toEqual([11, 9]);
  });
});

describe("Höhlen-Nachbarschaft", () => {
  it("zählt 4, 8 oder 24 Nachbarn; Rand nur, wenn er Fels ist", () => {
    const hz = neueHoehle(9, 9, 1, zufall(1));
    for (const [art, max] of Object.entries(NACHBARN_MAX)) expect(felsNachbarn(hz, 4, 4, art as "moore")).toBe(max);
    const leer = neueHoehle(9, 9, 0, zufall(1));
    expect(felsNachbarn(leer, 0, 0, "moore", true)).toBe(5);
    expect(felsNachbarn(leer, 0, 0, "moore", false)).toBe(0);
  });

  it("rechnet Regeln anteilig um", () => {
    expect(regelUmrechnen([5, 6, 7, 8], "moore", "neumann")).toEqual([3, 4]);
    expect(regelUmrechnen([4, 5, 6, 7, 8], "moore", "moore2")).toEqual(Array.from({ length: 13 }, (_, i) => 12 + i));
  });
});

describe("Verteilen-Stellschrauben", () => {
  it("ortsabhängiger Abstand: dichter, wo r klein ist, Mindestabstand gilt überall", () => {
    const rOrt = (x: number) => (x < 100 ? 8 : 20);
    const s = neuerPoisson(200, 120, 20, 30, { rOrt, rMin: 8 });
    alle(poisson(s, zufall(2)));
    const links = s.punkte.filter(p => p.x < 90).length, rechts = s.punkte.filter(p => p.x > 110).length;
    expect(links).toBeGreaterThan(rechts * 3);
    expect(minAbstand(s.punkte)).toBeGreaterThanOrEqual(8);
  });

  it("Manhattan-Voronoi unterscheidet sich von Euklid", () => {
    const p = [{ x: 2, y: 2 }, { x: 15, y: 9 }, { x: 8, y: 17 }];
    expect(voronoi(p, 20, 20, 1, "manhattan")).not.toEqual(voronoi(p, 20, 20, 1, "euklid"));
  });
});

describe("Gelände-Stellschrauben", () => {
  it("Wertrauschen ist deterministisch und begrenzt, Formen ändern das Bild", () => {
    const r = wertRauschen(5);
    for (let i = 0; i < 100; i++) expect(Math.abs(r(i * 0.31, i * 0.17))).toBeLessThanOrEqual(1);
    const o = { ...GELAENDE_STANDARD, groesse: 32 };
    const glatt = gelaende(o), grat = gelaende({ ...o, form: "grat" }), wert = gelaende({ ...o, basis: "wert" });
    expect(grat).not.toEqual(glatt);
    expect(wert).not.toEqual(glatt);
  });
});

describe("Wegsuche-Stellschrauben", () => {
  const feld = (): Feld => {
    const b = 20, h = 12, kosten = new Uint8Array(b * h).fill(1);
    for (let y = 0; y < 10; y++) kosten[y * b + 10] = 0;
    return { b, h, kosten };
  };
  const lauf = (opt: Parameters<typeof suche>[5], art: "astar" | "dijkstra" = "astar") => {
    const f = feld(), s = neueSuche(f);
    alle(suche(f, 5 * 20 + 1, 5 * 20 + 18, art, s, opt));
    return s;
  };

  it("Gewicht > 1 schaut weniger an, Heuristik »keine« ist wie Dijkstra", () => {
    const a1 = lauf({ gewicht: 1 }), a3 = lauf({ gewicht: 3 }), a0 = lauf({ heuristik: "keine" }), d = lauf({}, "dijkstra");
    expect(a3.besucht).toBeLessThanOrEqual(a1.besucht);
    expect(a3.wegKosten).toBeGreaterThanOrEqual(a1.wegKosten);
    expect(a0.wegKosten).toBe(d.wegKosten);
  });

  it("diagonal: billiger, kürzer, keine Wandecken geschnitten", () => {
    const g = lauf({}), dg = lauf({ diagonal: true });
    expect(dg.gefunden).toBe(true);
    expect(dg.wegKosten).toBeLessThan(g.wegKosten);
    expect(dg.weg.length).toBeLessThan(g.weg.length);
    const f = feld();
    for (let i = 1; i < dg.weg.length; i++) {
      const a = dg.weg[i - 1], b = dg.weg[i], ax = a % 20, ay = (a / 20) | 0, bx = b % 20, by = (b / 20) | 0;
      if (ax !== bx && ay !== by) {
        expect(f.kosten[ay * 20 + bx]).toBeGreaterThan(0);
        expect(f.kosten[by * 20 + ax]).toBeGreaterThan(0);
      }
    }
  });
});

describe("Ablauf-Stellschrauben", () => {
  it("ohne Tempo bleiben Räume neutral, Aussicht 1 macht alle Nebenschleifen zu Aussichten", () => {
    const a = neuerAblauf();
    alle(erzeugeAblauf(a, { zyklus: "zweiwege", laenge: 2, neben: 2, tempo: false, aussicht: 1 }, zufall(3)));
    expect(a.knoten.some(k => k.art === "raum")).toBe(true);
    expect(a.kanten.filter(k => k.art === "sicht")).toHaveLength(2);
    expect(pruefe(a).loesbar).toBe(true);
  });

  it("größere Räume und mehr Annag-Runden halten die Karte lösbar", () => {
    for (let seed = 1; seed <= 10; seed++) {
      const a = neuerAblauf();
      alle(erzeugeAblauf(a, { zyklus: "schluessel", laenge: 3, neben: 2 }, zufall(seed)));
      const k = karte(a, 64, 44, true, { raumGroesse: 1.4, runden: 6 });
      const zu = kartenErreichbar(k, false), auf = kartenErreichbar(k, true);
      expect(zu[k.raeume[1].my * 64 + k.raeume[1].mx]).toBe(0);
      for (const r of k.raeume) expect(auf[r.my * 64 + r.mx]).toBe(1);
    }
  });
});
