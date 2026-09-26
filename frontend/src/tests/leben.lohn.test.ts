import { describe, expect, it } from "vitest";
import { abrechnung, einkommensteuer, type Person } from "@/lib/leben/lohn";
import { berechneBescheid, LEERE_ANGABEN } from "@/lib/leben/steuer";
import { annahme, mindestAzubi, werte } from "@/lib/leben/werte";
import { alterAm, datumText, feiertag, istArbeitstag, monatsIndex, tagVon, wochentag } from "@/lib/leben/zeit";

const azubi: Person = { alter: 16, kinderlos: true, kirche: false, kvZusatz: 2.9, azubi: true };
const helfer: Person = { ...azubi, azubi: false };

describe("Einkommensteuer § 32a (2026)", () => {
  it("ist 0 bis zum Grundfreibetrag", () => {
    expect(einkommensteuer(12348)).toBe(0);
    expect(einkommensteuer(5000)).toBe(0);
  });
  it("rechnet die Progressionszonen wie das Gesetz", () => {
    expect(einkommensteuer(17800)).toBe(1035); // Zone 3 beginnt: z = 0,0001
    // z = 1,2201 → (173,10·z + 2397)·z + 1034,87
    expect(einkommensteuer(30000)).toBe(Math.floor((173.1 * 1.2201 + 2397) * 1.2201 + 1034.87));
    expect(einkommensteuer(100000)).toBe(Math.floor(0.42 * 100000 - 11135.63));
  });
});

describe("Lohnabrechnung", () => {
  it("Azubi mit Mindestvergütung zahlt keine Lohnsteuer, aber rund 21 % SV", () => {
    const a = abrechnung(724, 2026, azubi);
    expect(a.lohnsteuer).toBe(0);
    expect(a.sv).toBeCloseTo(724 * 0.2115, 0);
    expect(a.netto).toBeCloseTo(724 - a.sv, 2);
  });
  it("Vollzeit zum Mindestlohn: Lohnsteuer um 160 €, netto um 1.740 €", () => {
    const brutto = Math.round(13.9 * 173.33 * 100) / 100;
    const a = abrechnung(brutto, 2026, helfer);
    expect(a.lohnsteuer).toBeGreaterThan(140);
    expect(a.lohnsteuer).toBeLessThan(180);
    expect(a.netto).toBeGreaterThan(1700);
    expect(a.netto).toBeLessThan(1780);
  });
  it("Kirchensteuer Thüringen = 9 % der Lohnsteuer", () => {
    const a = abrechnung(2800, 2026, { ...helfer, kirche: true });
    expect(a.kirchensteuer).toBeCloseTo(a.lohnsteuer * 0.09, 2);
  });
  it("Azubi bis 325 €: der Betrieb trägt die SV allein", () => {
    const a = abrechnung(300, 2026, azubi);
    expect(a.geringverdiener).toBe(true);
    expect(a.sv).toBe(0);
    expect(a.netto).toBe(300);
  });
  it("Minijob: brutto = netto", () => {
    const a = abrechnung(500, 2026, helfer);
    expect(a.minijob).toBe(true);
    expect(a.netto).toBe(500);
  });
  it("kinderlos ab 23 zahlt den PV-Zuschlag", () => {
    const jung = abrechnung(2500, 2026, { ...helfer, alter: 22 });
    const alt = abrechnung(2500, 2026, { ...helfer, alter: 23 });
    expect(alt.pv - jung.pv).toBeCloseTo(2500 * 0.006, 2);
  });
});

describe("Steuererklärung", () => {
  it("Start im August: die Lohnsteuer kommt komplett zurück", () => {
    const a = abrechnung(2400, 2026, helfer);
    const lb = { jahr: 2026, brutto: 2400 * 5, lohnsteuer: a.lohnsteuer * 5, soli: 0, kirchensteuer: 0,
      rv: a.rv * 5, kv: a.kv * 5, pv: a.pv * 5, av: a.av * 5, monate: 5 };
    const b = berechneBescheid(lb, LEERE_ANGABEN, false);
    expect(b.festgesetzt).toBe(0);
    expect(b.erstattung).toBeCloseTo(a.lohnsteuer * 5, 2);
  });
  it("Fahrtkosten zählen erst über dem Pauschbetrag", () => {
    const lb = { jahr: 2026, brutto: 30000, lohnsteuer: 3000, soli: 0, kirchensteuer: 0,
      rv: 2790, kv: 2625, pv: 540, av: 390, monate: 12 };
    const wenig = berechneBescheid(lb, { ...LEERE_ANGABEN, entfernungKm: 5, arbeitstage: 220 }, false);
    expect(wenig.pauschbetragGenutzt).toBe(true);
    const viel = berechneBescheid(lb, { ...LEERE_ANGABEN, entfernungKm: 25, arbeitstage: 220 }, false);
    expect(viel.werbungskosten).toBeCloseTo(25 * 220 * 0.38, 2);
    expect(viel.erstattung).toBeGreaterThan(wenig.erstattung);
  });
});

describe("Werte je Jahr", () => {
  it("Mindestausbildungsvergütung 2026 nach Ausbildungsjahr", () => {
    expect([1, 2, 3, 4].map((j) => mindestAzubi(2026, j))).toEqual([724, 854, 977, 1014]);
  });
  it("2027: Mindestlohn beschlossen, Grundfreibetrag geschätzt", () => {
    expect(werte(2027).mindestlohn).toBe(14.6);
    expect(annahme(2027, "mindestlohn")).toBe(false);
    expect(annahme(2027, "grundfreibetrag")).toBe(true);
    expect(annahme(2026, "grundfreibetrag")).toBe(false);
  });
});

describe("Kalender", () => {
  it("Start ist Mittwoch, 1. Juli 2026", () => {
    expect(wochentag(0)).toBe(2);
    expect(datumText(0, true)).toBe("Mittwoch, 1. Juli 2026");
    expect(monatsIndex(tagVon(2027, 7, 1))).toBe(12);
  });
  it("kennt Thüringer Feiertage", () => {
    expect(feiertag(tagVon(2026, 9, 20))).toBe("Weltkindertag");
    expect(feiertag(tagVon(2027, 3, 26))).toBe("Karfreitag");
    expect(istArbeitstag(tagVon(2026, 10, 3))).toBe(false);
  });
  it("Alter", () => {
    expect(alterAm("2010-03-15", 0)).toBe(16);
    expect(alterAm("2010-03-15", tagVon(2028, 3, 15))).toBe(18);
    expect(alterAm("2010-03-15", tagVon(2028, 3, 14))).toBe(17);
  });
});
