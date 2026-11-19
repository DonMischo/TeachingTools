import { describe, expect, it } from "vitest";
import { zufall } from "@/lib/regeln/maschine";
import { durch, erzeuge, entferneWaende, neuesLab, type Erzeuger } from "@/lib/regeln/labyrinth";
import { labyrinthMasse } from "@/lib/spielalgo/labyrinthMasse";
import { BSP_STANDARD, bspRaster, erzeugeBsp, neuerBsp, ZELLE } from "@/lib/spielalgo/bsp";
import { HOEHLE_STANDARD, erzeugeHoehle, felsNachbarn, neueHoehle, regionen, runde, type Hoehle } from "@/lib/spielalgo/hoehle";
import { lloyd, minAbstand, neuerPoisson, poisson, voronoi, zufallsPunkte } from "@/lib/spielalgo/verteilen";
import { GELAENDE_STANDARD, fbm, gelaende, gradientRauschen } from "@/lib/spielalgo/rauschen";
import { flowfield, folge, neueSuche, suche, type Feld, type Suche } from "@/lib/spielalgo/wege";
import { KZ, ZYKLEN, erzeugeAblauf, karte, kartenErreichbar, neuerAblauf, pruefe, type Zyklus } from "@/lib/spielalgo/zyklisch";

/** Generator bis zum Ende laufen lassen, Notizen sammeln. */
function alle<T>(g: Generator<string, T>): string[] {
  const n: string[] = [];
  for (let r = g.next(); !r.done; r = g.next()) n.push(r.value);
  return n;
}

/** Zusammenhängende Felder (4er) im Raster, ausgehend vom ersten passenden. */
function zusammenhang(z: ArrayLike<number>, b: number, h: number, frei: (v: number) => boolean): { teile: number; felder: number } {
  const seen = new Uint8Array(b * h);
  let teile = 0, felder = 0;
  for (let s = 0; s < b * h; s++) {
    if (!frei(z[s]) || seen[s]) continue;
    teile++;
    const st = [s];
    seen[s] = 1;
    while (st.length) {
      const i = st.pop()!;
      felder++;
      const x = i % b, y = (i / b) | 0;
      for (const [xx, yy] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (xx < 0 || yy < 0 || xx >= b || yy >= h) continue;
        const j = yy * b + xx;
        if (!seen[j] && frei(z[j])) { seen[j] = 1; st.push(j); }
      }
    }
  }
  return { teile, felder };
}

describe("Labyrinth-Kennzahlen", () => {
  it.each(["backtracker", "prim", "kruskal", "wilson"] as Erzeuger[])("%s: Weg gefunden, Zahlen plausibel", art => {
    const l = neuesLab(12);
    durch(erzeuge(l, art, zufall(3)));
    const m = labyrinthMasse(l);
    expect(m.weg).toBeGreaterThanOrEqual(23); // mindestens 2·12−1 Zellen
    expect(m.sackgassen).toBeGreaterThan(0);
    expect(m.sackgassen + m.kreuzungen).toBeLessThan(144);
    expect(m.ganglaenge).toBeGreaterThan(1);
  });

  it("Backtracker hat weniger Sackgassen und längere Gänge als Prim", () => {
    let bt = 0, pr = 0, gbt = 0, gpr = 0;
    for (const seed of [1, 2, 3, 4]) {
      for (const [art, add] of [["backtracker", (m: ReturnType<typeof labyrinthMasse>) => { bt += m.sackgassen; gbt += m.ganglaenge; }],
        ["prim", (m: ReturnType<typeof labyrinthMasse>) => { pr += m.sackgassen; gpr += m.ganglaenge; }]] as const) {
        const l = neuesLab(16);
        durch(erzeuge(l, art, zufall(seed)));
        add(labyrinthMasse(l));
      }
    }
    expect(bt).toBeLessThan(pr);
    expect(gbt).toBeGreaterThan(gpr);
  });

  it("eingerissene Wände verkürzen den Weg oder lassen ihn gleich", () => {
    const l = neuesLab(16);
    durch(erzeuge(l, "backtracker", zufall(5)));
    const vorher = labyrinthMasse(l).weg;
    entferneWaende(l, 40, zufall(6));
    expect(labyrinthMasse(l).weg).toBeLessThanOrEqual(vorher);
  });
});

describe("BSP-Räume", () => {
  it.each([1, 2, 3, 7, 11])("Seed %i: Räume liegen in ihren Stücken, alles hängt zusammen", seed => {
    const s = neuerBsp(BSP_STANDARD);
    const notizen = alle(erzeugeBsp(s, zufall(seed)));
    expect(notizen.length).toBeGreaterThan(5);
    const blaetter = s.knoten.filter(k => !k.kinder);
    expect(blaetter.length).toBeGreaterThan(4);
    for (const k of blaetter) {
      const r = k.raum!, t = k.r;
      expect(r.x).toBeGreaterThan(t.x);
      expect(r.y).toBeGreaterThan(t.y);
      expect(r.x + r.b).toBeLessThan(t.x + t.b);
      expect(r.y + r.h).toBeLessThan(t.y + t.h);
      expect(Math.min(t.b, t.h)).toBeGreaterThanOrEqual(BSP_STANDARD.min);
    }
    // Gänge = innere Knoten = Blätter − 1
    expect(s.gaenge.length).toBe(blaetter.length - 1);
    const z = bspRaster(s);
    expect(zusammenhang(z, BSP_STANDARD.b, BSP_STANDARD.h, v => v !== ZELLE.WAND).teile).toBe(1);
  });

  it("gleicher Seed, gleiche Karte", () => {
    const a = neuerBsp(BSP_STANDARD), b = neuerBsp(BSP_STANDARD);
    alle(erzeugeBsp(a, zufall(9)));
    alle(erzeugeBsp(b, zufall(9)));
    expect(bspRaster(a)).toEqual(bspRaster(b));
  });
});

describe("Zellautomat-Höhlen", () => {
  it("Randzellen zählen als Fels", () => {
    const hz: Hoehle = { b: 3, h: 3, z: new Uint8Array(9), generation: 0, region: null };
    expect(felsNachbarn(hz, 0, 0)).toBe(5);
    expect(felsNachbarn(hz, 1, 1)).toBe(0);
  });

  it("eine Runde glättet: einzelne Felsen verschwinden, Löcher füllen sich", () => {
    const hz = neueHoehle(5, 5, 0, zufall(1));
    hz.z[12] = 1; // ein Fels allein in der Mitte
    runde(hz, [5, 6, 7, 8], [4, 5, 6, 7, 8]);
    expect(hz.z[12]).toBe(0);
    const voll = neueHoehle(5, 5, 1, zufall(1));
    voll.z[12] = 0; // ein Loch in vollem Fels
    runde(voll, [5, 6, 7, 8], [4, 5, 6, 7, 8]);
    expect(voll.z[12]).toBe(1);
  });

  it("Regionen werden nach Größe nummeriert", () => {
    const hz = neueHoehle(7, 1, 1, zufall(1));
    // frei: 1 Feld, Fels, 3 Felder
    [0, 2, 3, 4].forEach(i => { hz.z[i] = 0; });
    expect(regionen(hz)).toEqual([3, 1]);
    expect(hz.region![3]).toBe(0);
    expect(hz.region![0]).toBe(1);
  });

  it("am Ende bleibt genau eine zusammenhängende Höhle", () => {
    for (const seed of [1, 2, 3]) {
      const stand = { hz: neueHoehle(1, 1, 0, zufall(0)) };
      alle(erzeugeHoehle(stand, HOEHLE_STANDARD, zufall(seed)));
      const { b, h, z } = stand.hz;
      const t = zusammenhang(z, b, h, v => v === 0);
      expect(t.teile).toBe(1);
      expect(t.felder / (b * h)).toBeGreaterThan(0.2);
    }
  });
});

describe("Poisson-Disc und Voronoi", () => {
  it("Poisson hält den Mindestabstand ein und füllt die Fläche", () => {
    const s = neuerPoisson(200, 140, 12);
    alle(poisson(s, zufall(4)));
    expect(minAbstand(s.punkte)).toBeGreaterThanOrEqual(12);
    // dichteste Packung wäre ~ Fläche / (r²·0,87); Bridson schafft gut die Hälfte
    expect(s.punkte.length).toBeGreaterThan((200 * 140) / (12 * 12 * 0.87) * 0.45);
    expect(s.aktiv).toHaveLength(0);
  });

  it("reiner Zufall klumpt: kleinster Abstand viel kleiner", () => {
    const s = neuerPoisson(200, 140, 12);
    alle(poisson(s, zufall(4)));
    const z = zufallsPunkte(s.punkte.length, 200, 140, zufall(4));
    expect(minAbstand(z)).toBeLessThan(6);
  });

  it("Voronoi: jedes Pixel gehört dem nächsten Punkt", () => {
    const p = [{ x: 1, y: 1 }, { x: 9, y: 1 }];
    const v = voronoi(p, 10, 2);
    expect([...v.slice(0, 10)]).toEqual([0, 0, 0, 0, 0, 1, 1, 1, 1, 1]);
  });

  it("Lloyd macht die Abstände gleichmäßiger", () => {
    const p = zufallsPunkte(40, 100, 100, zufall(2));
    let q = p;
    for (let i = 0; i < 5; i++) q = lloyd(q, 100, 100);
    expect(minAbstand(q)).toBeGreaterThan(minAbstand(p));
  });
});

describe("Rauschen und Gelände", () => {
  it("ist deterministisch und bleibt im Bereich", () => {
    const r = gradientRauschen(7), r2 = gradientRauschen(7);
    for (let i = 0; i < 200; i++) {
      const x = i * 0.37, y = i * 0.91;
      expect(r(x, y)).toBe(r2(x, y));
      expect(Math.abs(fbm(r, x, y, 5))).toBeLessThanOrEqual(1.2);
    }
    expect(r(3, 4)).toBeCloseTo(0, 6); // an Gitterpunkten ist Gradientenrauschen 0
  });

  it("ist stetig: Nachbarpunkte unterscheiden sich kaum", () => {
    const r = gradientRauschen(3);
    for (let i = 0; i < 100; i++) expect(Math.abs(r(i * 0.13, 0.5) - r(i * 0.13 + 0.001, 0.5))).toBeLessThan(0.02);
  });

  it("Insel: Rand ist Wasser, Mitte im Schnitt höher", () => {
    const g = gelaende({ ...GELAENDE_STANDARD, groesse: 64 });
    let rand = 0, mitte = 0;
    for (let i = 0; i < 64; i++) rand += g[i] + g[63 * 64 + i];
    for (let y = 24; y < 40; y++) for (let x = 24; x < 40; x++) mitte += g[y * 64 + x];
    expect(rand / 128).toBeLessThan(0.15);
    expect(mitte / 256).toBeGreaterThan(rand / 128 + 0.2);
    expect(g.every(v => v >= 0 && v <= 1)).toBe(true);
  });

  it("Domain Warping verändert das Bild", () => {
    const a = gelaende({ ...GELAENDE_STANDARD, groesse: 32 });
    const b = gelaende({ ...GELAENDE_STANDARD, groesse: 32, warp: 1.5 });
    expect(a).not.toEqual(b);
  });
});

describe("Wegsuche", () => {
  // 20×12, Wand mit Lücke unten, Sumpf in der Mitte
  function feld(): Feld {
    const b = 20, h = 12, kosten = new Uint8Array(b * h).fill(1);
    for (let y = 0; y < 10; y++) kosten[y * b + 10] = 0;
    for (let y = 3; y < 9; y++) for (let x = 3; x < 8; x++) kosten[y * b + x] = 5;
    return { b, h, kosten };
  }
  const lauf = (art: Suche, f = feld(), start = 5 * 20 + 1, ziel = 5 * 20 + 18) => {
    const s = neueSuche(f);
    alle(suche(f, start, ziel, art, s));
    return s;
  };

  it("Dijkstra und A* finden gleich billige Wege, A* schaut weniger an", () => {
    const d = lauf("dijkstra"), a = lauf("astar");
    expect(d.gefunden && a.gefunden).toBe(true);
    expect(a.wegKosten).toBe(d.wegKosten);
    expect(a.besucht).toBeLessThan(d.besucht);
  });

  it("Greedy ist schnell, aber nicht unbedingt billig", () => {
    const d = lauf("dijkstra"), g = lauf("greedy");
    expect(g.gefunden).toBe(true);
    expect(g.wegKosten).toBeGreaterThanOrEqual(d.wegKosten);
    expect(g.besucht).toBeLessThan(d.besucht);
  });

  it("Weg ist zusammenhängend und meidet Wände", () => {
    const f = feld(), s = lauf("astar", f);
    for (let i = 1; i < s.weg.length; i++) {
      const a = s.weg[i - 1], b = s.weg[i];
      expect(Math.abs((a % 20) - (b % 20)) + Math.abs(((a / 20) | 0) - ((b / 20) | 0))).toBe(1);
      expect(f.kosten[b]).toBeGreaterThan(0);
    }
    expect(s.wegKosten).toBe(s.weg.slice(1).reduce((k, i) => k + f.kosten[i], 0));
  });

  it("eingemauertes Ziel: kein Weg", () => {
    const f = feld();
    for (let y = 0; y < 12; y++) f.kosten[y * 20 + 10] = 0;
    expect(lauf("astar", f).gefunden).toBe(false);
  });

  it("Flowfield: von jeder erreichbaren Zelle führt die Richtung ins Ziel", () => {
    const f = feld(), ziel = 5 * 20 + 18, ff = flowfield(f, ziel);
    expect(ff.dist[5 * 20 + 1]).toBe(lauf("dijkstra", f).wegKosten);
    for (let i = 0; i < f.b * f.h; i++) {
      if (!f.kosten[i]) continue;
      const w = folge(f, ff, i);
      expect(w[w.length - 1]).toBe(ziel);
    }
  });
});

describe("Zyklische Generierung", () => {
  const ZYK = Object.keys(ZYKLEN) as Zyklus[];

  it.each(ZYK)("%s: Ablauf ist für viele Seeds lösbar", zyklus => {
    for (let seed = 1; seed <= 25; seed++) {
      const a = neuerAblauf();
      const notizen = alle(erzeugeAblauf(a, { zyklus, laenge: 3, neben: 2 }, zufall(seed)));
      const p = pruefe(a);
      expect(p.loesbar).toBe(true);
      expect(notizen[notizen.length - 1]).toMatch(/lösbar/);
      expect(p.brauchtSchluessel).toBe(zyklus === "schluessel");
      expect(a.knoten.filter(k => k.art === "start")).toHaveLength(1);
      expect(a.knoten.filter(k => k.art === "ziel")).toHaveLength(1);
      expect(a.knoten.some(k => k.art === "raum")).toBe(false); // jeder Raum hat ein Tempo
    }
  });

  it("Start und Ziel liegen auf einer Schleife", () => {
    const a = neuerAblauf();
    alle(erzeugeAblauf(a, { zyklus: "zweiwege", laenge: 2, neben: 0 }, zufall(1)));
    // ohne gerichtete Kanten: zwei verschiedene Wege Start → Ziel, also Start mit 2 Nachbarn
    expect(a.kanten.filter(k => k.a === 0 || k.b === 0)).toHaveLength(2);
    expect(a.kanten.filter(k => k.a === 1 || k.b === 1)).toHaveLength(2);
  });

  it.each([false, true])("Karte (organisch=%s) übernimmt Schloss und Gitter", organisch => {
    for (let seed = 1; seed <= 40; seed++) {
      const a = neuerAblauf();
      alle(erzeugeAblauf(a, { zyklus: "schluessel", laenge: 3, neben: 2 }, zufall(seed)));
      const k = karte(a, 64, 44, organisch);
      const ziel = k.raeume[1], schluessel = k.raeume[a.knoten.find(n => n.art === "schluessel")!.id];
      expect(k.z.includes(KZ.TUER)).toBe(true);
      expect(k.z.includes(KZ.GITTER)).toBe(true);
      const zu = kartenErreichbar(k, false), auf = kartenErreichbar(k, true);
      expect(zu[schluessel.my * k.b + schluessel.mx]).toBe(1);
      expect(zu[ziel.my * k.b + ziel.mx]).toBe(0);
      expect(auf[ziel.my * k.b + ziel.mx]).toBe(1);
      // jeder Raum ist mit offener Tür erreichbar (Belohnungen hinter Gittern über die andere Seite)
      for (const r of k.raeume) expect(auf[r.my * k.b + r.mx]).toBe(1);
    }
  });

  it.each(ZYK)("%s: auf der Karte ist jeder Raum erreichbar", zyklus => {
    for (const organisch of [false, true]) for (let seed = 1; seed <= 15; seed++) {
      const a = neuerAblauf();
      alle(erzeugeAblauf(a, { zyklus, laenge: 5, neben: 3 }, zufall(seed)));
      const k = karte(a, 64, 44, organisch);
      const auf = kartenErreichbar(k, true);
      for (const r of k.raeume) expect(auf[r.my * k.b + r.mx]).toBe(1);
    }
  });

  it("Räume überlappen nicht", () => {
    const a = neuerAblauf();
    alle(erzeugeAblauf(a, { zyklus: "gefahr", laenge: 5, neben: 3 }, zufall(2)));
    const k = karte(a);
    for (const p of k.raeume) for (const q of k.raeume) {
      if (p === q) continue;
      const ueber = p.x < q.x + q.b && q.x < p.x + p.b && p.y < q.y + q.h && q.y < p.y + p.h;
      expect(ueber).toBe(false);
    }
  });
});
