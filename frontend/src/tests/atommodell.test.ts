/**
 * Prüft die Rechnung hinter den Atommodellen: Besetzung der Orbitale, die
 * Elektronen je Schale, Bindigkeit und Neutronen — und das Bindungslabor.
 */
import { describe, expect, it } from "vitest";
import {
  aussen, bindigkeit, energiestufen, kaestchen, madelung, MODELLE, neutronen, orbitale,
  orbitalName, plaetze, schalen,
} from "@/lib/pse/atommodell";
import { baue, bindungsrichtungen, freiePlaetze, summenformel, uebertrage, VORLAGEN } from "@/lib/pse/bindung";
import { pseElement, pseNummer } from "@/lib/pse/elemente";

const el = (symbol: string) => pseElement(symbol)!;
/** Die Besetzung als Text: »1s2 2s2 2p1«. */
const konf = (symbol: string) =>
  orbitale(el(symbol)).map(o => `${orbitalName(o)}${o.zahl}`).join(" ");
const sch = (symbol: string) => schalen(orbitale(el(symbol)));

describe("Besetzung der Orbitale", () => {
  it("füllt nach der Madelung-Regel — 4s vor 3d", () => {
    const namen = madelung(20).map(orbitalName);
    expect(namen).toEqual(["1s", "2s", "2p", "3s", "3p", "4s"]);
  });

  it("besetzt Bor mit 1s² 2s² 2p¹", () => {
    expect(konf("B")).toBe("1s2 2s2 2p1");
  });

  it.each([
    ["H", "1s1"], ["He", "1s2"], ["C", "1s2 2s2 2p2"],
    ["O", "1s2 2s2 2p4"], ["Ne", "1s2 2s2 2p6"],
  ])("%s → %s", (symbol, soll) => expect(konf(symbol)).toBe(soll));

  it("übernimmt die gemessenen Ausnahmen der Nebengruppen", () => {
    // Chrom hat 3d⁵ 4s¹, nicht 3d⁴ 4s² — die Regel sagt das Falsche,
    // PubChem das Richtige.
    expect(konf("Cr")).toContain("3d5");
    expect(konf("Cr")).toContain("4s1");
    expect(konf("Cu")).toContain("3d10");
  });

  it("verteilt bei jedem Element genau so viele Elektronen wie Protonen", () => {
    for (const e of [1, 5, 18, 26, 47, 79, 92, 118].map(z => pseNummer(z)!)) {
      expect(orbitale(e).reduce((s, o) => s + o.zahl, 0), e.name).toBe(e.z);
    }
  });
});

describe("Schalenmodell", () => {
  it("legt Bor mit 2 innen und 3 außen", () => {
    expect(sch("B")).toEqual([2, 3]);
    expect(aussen(sch("B"))).toBe(3);
  });

  it.each([
    ["H", [1]], ["He", [2]], ["Ne", [2, 8]], ["Na", [2, 8, 1]], ["Ar", [2, 8, 8]],
  ])("%s → %j", (symbol, soll) => expect(sch(symbol)).toEqual(soll));

  it("zählt beim Eisen die angefangene vierte Schale mit", () => {
    // 2, 8, 14, 2 — die dritte Schale ist noch nicht voll, die vierte hat schon
    // zwei. Genau darum gibt es Nebengruppen.
    expect(sch("Fe")).toEqual([2, 8, 14, 2]);
  });
});

describe("Kästchen nach Hund", () => {
  it("besetzt erst einzeln, dann gepaart", () => {
    // p-Orbital, drei Kästchen: 1 → ein einzelnes, 3 → drei einzelne,
    // 4 → eines gepaart, 6 → alle gepaart.
    expect(kaestchen(1, 1)).toEqual(["einzeln", "leer", "leer"]);
    expect(kaestchen(3, 1)).toEqual(["einzeln", "einzeln", "einzeln"]);
    expect(kaestchen(4, 1)).toEqual(["paar", "einzeln", "einzeln"]);
    expect(kaestchen(6, 1)).toEqual(["paar", "paar", "paar"]);
  });

  it("gibt dem s-Orbital ein Kästchen, dem d-Orbital fünf", () => {
    expect(kaestchen(2, 0)).toEqual(["paar"]);
    expect(kaestchen(5, 2)).toEqual(Array(5).fill("einzeln"));
  });

  it("zeigt genau so viele Elektronen, wie das Orbital hat", () => {
    for (const l of [0, 1, 2, 3]) {
      for (let zahl = 0; zahl <= plaetze(l); zahl++) {
        const summe = kaestchen(zahl, l).reduce((s, f) => s + (f === "paar" ? 2 : f === "einzeln" ? 1 : 0), 0);
        expect(summe, `l=${l}, ${zahl}e`).toBe(zahl);
      }
    }
  });
});

describe("Energiestufen", () => {
  it("zeigt bei Bor drei Stufen: 1s, 2s, 2p", () => {
    const r = energiestufen(el("B"));
    expect(r.map(o => `${orbitalName(o)}${o.zahl}`)).toEqual(["1s2", "2s2", "2p1"]);
  });

  it("verliert kein Elektron — auch nicht bei den Ausnahmen", () => {
    for (const e of [1, 5, 24, 26, 46, 79, 92, 118].map(z => pseNummer(z)!)) {
      expect(energiestufen(e).reduce((s, o) => s + o.zahl, 0), e.name).toBe(e.z);
    }
  });

  it("nimmt auch Orbitale auf, die die Regel noch nicht vorsieht", () => {
    // Uran hat ein Elektron im 6d, obwohl Madelung erst 5f füllen würde.
    const u = energiestufen(pseNummer(92)!);
    expect(u.find(o => o.n === 6 && o.l === 2)?.zahl).toBe(1);
  });

  it("steigt in der Energie — 4s steht vor 3d", () => {
    const r = energiestufen(el("Fe")).map(orbitalName);
    expect(r.indexOf("4s")).toBeLessThan(r.indexOf("3d"));
  });
});

describe("Bindigkeit", () => {
  it.each([
    ["H", 1], ["B", 3], ["C", 4], ["N", 3], ["O", 2], ["F", 1], ["Cl", 1], ["He", 0], ["Ne", 0],
  ])("%s ist %i-bindig", (symbol, soll) => expect(bindigkeit(el(symbol))).toBe(soll));

  it("gibt bei Nebengruppenelementen keine Zahl vor", () => {
    expect(bindigkeit(el("Fe"))).toBe(0);
  });
});

describe("Kern", () => {
  it("nennt für Bor 5 Protonen und 6 Neutronen", () => {
    // 10,81 u rundet auf 11 — das ist ¹¹B, vier Fünftel allen Bors.
    expect(el("B").z).toBe(5);
    expect(neutronen(el("B"))).toBe(6);
  });

  it("kommt ohne Masse ohne Neutronenzahl aus", () => {
    expect(neutronen({ ...el("B"), masse: null })).toBeNull();
  });
});

describe("Die Modelle", () => {
  it("führen vom Teilchen- zum Orbitalmodell", () => {
    expect(MODELLE.map(m => m.id)).toEqual(["teilchen", "kern", "schalen", "energie", "orbital"]);
  });

  it("nennen bei jedem Modell, was es kann und wo es aufhört", () => {
    for (const m of MODELLE) {
      expect(m.wer.length, m.id).toBeGreaterThan(3);
      expect(m.kann.length, m.id).toBeGreaterThan(20);
      expect(m.luecke.length, m.id).toBeGreaterThan(20);
    }
  });
});

describe("Summenformel", () => {
  it.each([
    [["O", "H", "H"], "H2O"],
    [["N", "H", "H", "H"], "NH3"],
    [["H", "Cl"], "HCl"],
    [["C", "H", "H", "H", "H"], "CH4"],
    [["B", "F", "F", "F"], "BF3"],
    [["C", "O", "O"], "CO2"],
    [["H", "H"], "H2"],
  ])("%j → %s", (symbole, soll) => expect(summenformel(symbole)).toBe(soll));
});

describe("Elektronenübertragung", () => {
  it("lässt Bor seine drei Elektronen an die drei Fluore abgeben", () => {
    const u = uebertrage(["B", "F", "F", "F"]);
    expect(u.geht).toBe(true);
    const bor = u.ionen.find(i => i.e.symbol === "B")!;
    expect(bor.ladung).toBe(3);
    // Nach der Abgabe bleibt die K-Schale: zwei Elektronen, wie beim Helium.
    expect(bor.schalen).toEqual([2]);
    expect(bor.aussen).toBe(2);
    expect(bor.voll).toBe(true);
    for (const f of u.ionen.filter(i => i.e.symbol === "F")) {
      expect(f.ladung).toBe(-1);
      expect(f.schalen).toEqual([2, 8]);
      expect(f.voll).toBe(true);
    }
    // Jedes Fluorid hat genau ein Elektron, und zwar vom Bor.
    const f = u.ionen.find(i => i.e.symbol === "F")!;
    expect(f.bekommt).toEqual([{ von: u.ionen.findIndex(i => i.e.symbol === "B"), zahl: 1 }]);
  });

  it("sagt klar, dass Bor dabei ein Duett bekommt und kein Oktett", () => {
    const text = uebertrage(["B", "F", "F", "F"]).hinweise.join(" ");
    expect(text).toMatch(/Bor gibt 3 Elektronen ab/);
    expect(text).toMatch(/2 auf der äußersten Schale/);
    expect(text).toMatch(/Heliums/);
  });

  it("macht aus Natrium und Chlor Na⁺ und Cl⁻", () => {
    const u = uebertrage(["Na", "Cl"]);
    expect(u.geht).toBe(true);
    expect(u.ionen.map(i => [i.e.symbol, i.ladung])).toEqual([["Na", 1], ["Cl", -1]]);
    expect(u.ionen[0].schalen).toEqual([2, 8]);
    expect(u.ionen[1].schalen).toEqual([2, 8, 8]);
    expect(u.ionen.every(i => i.voll)).toBe(true);
    expect(u.hinweise.join(" ")).toMatch(/volle Außenschale/);
  });

  it("lässt vom Wasserstoff einen nackten Kern übrig", () => {
    const u = uebertrage(["O", "H", "H"]);
    const h = u.ionen.find(i => i.e.symbol === "H")!;
    expect(h.ladung).toBe(1);
    expect(h.schalen).toEqual([]);
    expect(u.ionen.find(i => i.e.symbol === "O")!.ladung).toBe(-2);
    expect(u.hinweise.join(" ")).toMatch(/nackter Kern/);
  });

  it("überträgt zwischen gleichen Atomen nichts", () => {
    const u = uebertrage(["O", "O"]);
    expect(u.ionen).toHaveLength(0);
    expect(u.hinweise.join(" ")).toMatch(/teilen sich die Elektronen/);
  });

  it("gleicht die Ladungen immer aus, wenn die Bilanz aufgeht", () => {
    for (const symbole of [["B", "F", "F", "F"], ["Na", "Cl"], ["O", "H", "H"],
      ["C", "H", "H", "H", "H"], ["C", "O", "O"], ["Al", "Cl", "Cl", "Cl"]]) {
      const u = uebertrage(symbole);
      expect(u.geht, symbole.join("")).toBe(true);
      expect(u.ionen.reduce((s, i) => s + i.ladung, 0), symbole.join("")).toBe(0);
    }
  });

  it("merkt, wenn die Bilanz nicht aufgeht", () => {
    // Ein Bor und ein Fluor: drei abgegebene Elektronen, nur eines gebraucht.
    const u = uebertrage(["B", "F"]);
    expect(u.geht).toBe(false);
    expect(u.hinweise.join(" ")).toMatch(/Bilanz geht nicht auf/);
  });
});

describe("Freie Elektronenpaare", () => {
  /** Die Bindungsrichtungen des gebauten Moleküls, Atom für Atom. */
  const richtungenVon = (symbole: string[]) => bindungsrichtungen(baue(symbole));

  it("legt die zwei Paare des Wassers symmetrisch über den Sauerstoff", () => {
    const v = baue(["O", "H", "H"]);
    const o = v.zentrum!;
    const p = freiePlaetze(richtungenVon(["O", "H", "H"])[o], 2);
    expect(p).toHaveLength(2);
    // Die beiden H hängen unten (y positiv), die freien Paare zeigen nach oben.
    expect(Math.sin(p[0])).toBeLessThan(0);
    expect(Math.sin(p[1])).toBeLessThan(0);
    // Und sie stehen symmetrisch: die seitlichen Anteile heben sich auf.
    expect(Math.cos(p[0]) + Math.cos(p[1])).toBeCloseTo(0, 5);
  });

  it("verteilt die drei Paare des Fluors gleichmäßig um seine eine Bindung", () => {
    const p = freiePlaetze([0], 3).map(w => (w * 180) / Math.PI);
    expect(p.map(Math.round)).toEqual([90, 180, 270]);
  });

  it("hält die Paare von den Bindungen weg", () => {
    // Drei Bindungen wie beim Bortrifluorid, ein freies Paar: es muss in eine
    // der Lücken, nicht auf eine Bindung.
    const bindungen = [0, (2 * Math.PI) / 3, (4 * Math.PI) / 3];
    for (const w of freiePlaetze(bindungen, 1)) {
      const naechste = Math.min(...bindungen.map(b =>
        Math.abs(Math.atan2(Math.sin(w - b), Math.cos(w - b)))));
      expect(naechste).toBeGreaterThan(0.5);
    }
  });

  it("verteilt ohne Bindung rundherum und gibt ohne Paare nichts zurück", () => {
    expect(freiePlaetze([], 4)).toHaveLength(4);
    expect(freiePlaetze([], 0)).toHaveLength(0);
    expect(freiePlaetze([1.2], 0)).toHaveLength(0);
  });

  it("gibt jedem Atom jeder Vorlage so viele Plätze, wie es Paare hat", () => {
    for (const v of VORLAGEN) {
      const b = baue(v.symbole);
      const r = bindungsrichtungen(b);
      b.atome.forEach((a, i) => {
        expect(freiePlaetze(r[i], a.einsam), `${v.label}: ${a.e.symbol}`).toHaveLength(a.einsam);
      });
    }
  });
});

describe("Bindungslabor", () => {
  it("baut Bortrifluorid mit drei Einfachbindungen", () => {
    const v = baue(["B", "F", "F", "F"]);
    expect(v.formel).toBe("BF3");
    expect(v.gesetzt).toBe("BF₃");
    expect(v.name).toBe("Bortrifluorid");
    expect(v.bindungen).toHaveLength(3);
    expect(v.bindungen.every(b => b.grad === 1)).toBe(true);
    // Bor steht in der Mitte, nicht das Fluor.
    expect(v.atome[v.zentrum!].e.symbol).toBe("B");
  });

  it("zeigt den Elektronenmangel des Bors", () => {
    const v = baue(["B", "F", "F", "F"]);
    const bor = v.atome.find(a => a.e.symbol === "B")!;
    expect(bor.huelle).toBe(6);
    expect(bor.erfuellt).toBe(false);
    expect(bor.einsam).toBe(0);
    // Das Fluor dagegen hat sein Oktett und drei freie Paare.
    const fluor = v.atome.find(a => a.e.symbol === "F")!;
    expect(fluor.huelle).toBe(8);
    expect(fluor.einsam).toBe(3);
    expect(v.hinweise.join(" ")).toMatch(/Elektronenmangel|sechs Außenelektronen|Sextett/);
  });

  it("gibt dem Wasser zwei freie Paare und einen Winkel", () => {
    const v = baue(["O", "H", "H"]);
    expect(v.name).toBe("Wasser");
    const o = v.atome[v.zentrum!];
    expect(o.e.symbol).toBe("O");
    expect(o.einsam).toBe(2);
    expect(o.erfuellt).toBe(true);
    // Die beiden H liegen nicht einander gegenüber, sondern gewinkelt.
    const h = v.atome.filter(a => a.e.symbol === "H");
    expect(h[0].x).toBeCloseTo(-h[1].x, 5);
    expect(h[0].y).toBeGreaterThan(0.3);
    expect(v.atome.every(a => a.erfuellt)).toBe(true);
  });

  it("macht aus Kohlenstoff und zwei Sauerstoff zwei Doppelbindungen", () => {
    const v = baue(["C", "O", "O"]);
    expect(v.formel).toBe("CO2");
    expect(v.bindungen.map(b => b.grad)).toEqual([2, 2]);
    expect(v.atome.every(a => a.erfuellt)).toBe(true);
    // Gestreckt: die Sauerstoffe liegen einander gegenüber.
    const o = v.atome.filter(a => a.e.symbol === "O");
    expect(o[0].x).toBeCloseTo(-o[1].x, 5);
    expect(o[0].y).toBeCloseTo(0, 5);
  });

  it.each([
    [["N", "N"], 3], [["O", "O"], 2], [["H", "H"], 1], [["H", "Cl"], 1],
  ])("bindet %j mit Grad %i", (symbole, grad) => {
    const v = baue(symbole);
    expect(v.bindungen).toHaveLength(1);
    expect(v.bindungen[0].grad).toBe(grad);
    expect(v.atome.every(a => a.erfuellt)).toBe(true);
  });

  it("setzt beim Methan vier Wasserstoffe um den Kohlenstoff", () => {
    const v = baue(["C", "H", "H", "H", "H"]);
    expect(v.atome[v.zentrum!].e.symbol).toBe("C");
    expect(v.bindungen).toHaveLength(4);
    expect(v.atome.every(a => a.erfuellt)).toBe(true);
    expect(v.hinweise.join(" ")).toMatch(/Edelgaskonfiguration/);
  });

  it("sagt es, wenn mehr Nachbarn da sind als Bindungen möglich", () => {
    const v = baue(["B", "F", "F", "F", "F"]);
    expect(v.hinweise.join(" ")).toMatch(/nur 3 Bindungen/);
  });

  it("nimmt Edelgase nicht mit in die Bindung", () => {
    const v = baue(["O", "H", "Ne"]);
    expect(v.bindungen.some(b => v.atome[b.b].e.symbol === "Ne")).toBe(false);
    expect(v.hinweise.join(" ")).toMatch(/Edelgase/);
  });

  it("nimmt höchstens acht Atome", () => {
    const v = baue(Array(12).fill("H"));
    expect(v.atome).toHaveLength(8);
  });

  it("kommt mit einem einzelnen Atom und mit nichts aus", () => {
    expect(baue(["B"]).atome).toHaveLength(1);
    expect(baue(["B"]).bindungen).toHaveLength(0);
    expect(baue([]).atome).toHaveLength(0);
    expect(baue(["Xyz"]).atome).toHaveLength(0);
  });

  it("baut jede Vorlage ohne Murren und zur passenden Formel", () => {
    for (const v of VORLAGEN) {
      const b = baue(v.symbole);
      expect(b.atome, v.label).toHaveLength(v.symbole.length);
      expect(b.gesetzt, v.label).toBe(v.label);
      expect(b.name, v.label).not.toBeNull();
    }
  });

  it("lässt bei jeder Vorlage außer den Bor-artigen alle Oktetts aufgehen", () => {
    for (const v of VORLAGEN) {
      const b = baue(v.symbole);
      // Bor und Aluminium haben nur drei Außenelektronen — bei ihnen ist das
      // Sextett der Punkt der Sache, bei allen anderen muss es aufgehen.
      const mangel = v.symbole.some(sy => sy === "B" || sy === "Al");
      expect(b.atome.every(a => a.erfuellt), `${v.label}: ${b.atome.map(a => `${a.e.symbol} ${a.huelle}`).join(", ")}`)
        .toBe(!mangel);
    }
  });

  it("verteilt in jeder Vorlage genau so viele Bindungen, wie die Atome wollen", () => {
    for (const v of VORLAGEN) {
      const b = baue(v.symbole);
      for (const a of b.atome) {
        expect(a.gebunden, `${v.label}: ${a.e.symbol}`).toBeLessThanOrEqual(a.bindigkeit);
      }
    }
  });
});
