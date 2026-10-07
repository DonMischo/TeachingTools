/**
 * Prüft den Weg vom IUPAC-Namen zum Molekül an der Summenformel: die ist
 * kurz, eindeutig und deckt Kette, Bindungsgrade und Endung zugleich ab.
 */
import { describe, expect, it } from "vitest";
import { ausName } from "@/lib/struktur/iupac";
import { molareMasse, summenformel } from "@/lib/struktur/molekuel";

const formel = (name: string): string => {
  const r = ausName(name);
  if (!r.ok) throw new Error(`${name}: ${r.fehler}`);
  return summenformel(r.m);
};

describe("Alkane, Alkene, Alkine", () => {
  it.each([
    ["Methan", "CH4"], ["Ethan", "C2H6"], ["Propan", "C3H8"], ["Butan", "C4H10"],
    ["n-Butan", "C4H10"], ["Octan", "C8H18"], ["Dodecan", "C12H26"],
    ["Ethen", "C2H4"], ["Propen", "C3H6"], ["Prop-2-en", "C3H6"],
    ["Ethin", "C2H2"], ["2-Pentin", "C5H8"], ["3-Methylbut-1-in", "C5H8"],
    ["Buta-1,3-dien", "C4H6"],
  ])("%s → %s", (name, soll) => expect(formel(name)).toBe(soll));

  it("zählt die Doppelbindung richtig ein", () => {
    const r = ausName("Prop-2-en");
    if (!r.ok) throw new Error(r.fehler);
    // Die Bindung zwischen C2 und C3 ist doppelt, die zwischen C1 und C2 nicht.
    expect(r.m.bindungen.find(b => b.a === 1 && b.b === 2)!.grad).toBe(2);
    expect(r.m.bindungen.find(b => b.a === 0 && b.b === 1)!.grad).toBe(1);
  });
});

describe("Ringe", () => {
  it.each([
    ["Cyclohexan", "C6H12"], ["Cyclopentan", "C5H10"],
    ["Cyclopenta-1,3-dien", "C5H6"], ["Cyclododeca-1,5,9-trien", "C12H18"],
    ["1,2-Dibromcyclohexan", "C6H10Br2"],
  ])("%s → %s", (name, soll) => expect(formel(name)).toBe(soll));

  it("schließt den Ring wirklich", () => {
    const r = ausName("Cyclohexan");
    if (!r.ok) throw new Error(r.fehler);
    expect(r.m.ring).toHaveLength(6);
    expect(r.m.bindungen).toHaveLength(6); // offene Kette hätte nur 5
  });

  it("lehnt zu kleine Ringe ab", () => {
    const r = ausName("Cycloethan");
    expect(r.ok).toBe(false);
  });
});

describe("Substituenten", () => {
  it.each([
    ["2-Chlorpropan", "C3H7Cl"], ["1-Chlor-3-Iodpropan", "C3H6ClI"],
    ["2,3-Dimethylbutan", "C6H14"], ["3-Ethylpentan", "C7H16"],
    ["3,4-Diethyl-5,5-Dimethyloctan", "C14H30"],
    ["Nitromethan", "CH3NO2"],
  ])("%s → %s", (name, soll) => expect(formel(name)).toBe(soll));

  it("beschwert sich, wenn Stellen und Anzahl nicht zusammenpassen", () => {
    const r = ausName("2-Dimethylbutan");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fehler).toMatch(/Stellen/);
  });

  it("beschwert sich über eine Stelle, die es nicht gibt", () => {
    const r = ausName("5-Methylpropan");
    expect(r.ok).toBe(false);
  });
});

describe("Funktionelle Gruppen", () => {
  it.each([
    ["Methanol", "CH4O"], ["Ethanol", "C2H6O"], ["2-Butanol", "C4H10O"],
    ["1-Butanol", "C4H10O"], ["Propan-1,2,3-triol", "C3H8O3"],
    ["Pentanal", "C5H10O"], ["Methanal", "CH2O"],
    ["Propan-2-on", "C3H6O"], ["Butan-2-on", "C4H8O"],
    ["Ethansäure", "C2H4O2"], ["Methansäure", "CH2O2"],
    ["Methanamin", "CH5N"],
    ["Butansäurepropylester", "C7H14O2"],
  ])("%s → %s", (name, soll) => expect(formel(name)).toBe(soll));

  it("setzt die Säuregruppe immer an C1", () => {
    const r = ausName("Butansäure");
    if (!r.ok) throw new Error(r.fehler);
    const amC1 = r.m.bindungen.filter(b => (b.a === 0 || b.b === 0) && r.m.atome[b.a === 0 ? b.b : b.a].el === "O");
    expect(amC1.map(b => b.grad).sort()).toEqual([1, 2]);
  });
});

describe("Trivialnamen", () => {
  it.each([
    ["Benzol", "C6H6"], ["Phenol", "C6H6O"], ["Toluol", "C7H8"],
    ["Essigsäure", "C2H4O2"], ["Ameisensäure", "CH2O2"], ["Aceton", "C3H6O"],
    ["Glycerin", "C3H8O3"], ["Isopropanol", "C3H8O"],
  ])("%s → %s", (name, soll) => expect(formel(name)).toBe(soll));

  it("macht aus Benzol einen Ring mit abwechselnden Bindungen", () => {
    const r = ausName("Benzol");
    if (!r.ok) throw new Error(r.fehler);
    expect(r.m.ring).toHaveLength(6);
    expect(r.m.bindungen.filter(b => b.grad === 2)).toHaveLength(3);
  });
});

describe("Molare Masse", () => {
  it("rechnet die Masse mit den Wasserstoffatomen", () => {
    const r = ausName("Ethanol");
    if (!r.ok) throw new Error(r.fehler);
    expect(molareMasse(r.m)).toBeCloseTo(46.07, 1);
  });
});

describe("Fehler", () => {
  it.each(["", "Blubban", "Xylophon"])("»%s« gibt eine Meldung statt eines Moleküls", name => {
    const r = ausName(name);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fehler.length).toBeGreaterThan(5);
  });
});
