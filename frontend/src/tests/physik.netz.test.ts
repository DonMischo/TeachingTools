/**
 * Das Netz aus Knoten und Zweigen — gegen die Schulformeln geprüft.
 *
 * Derselbe Löser trägt später das Wärmenetz, deshalb steht hier nichts über
 * Bauteile: nur Leitwerte, Spannungsquellen und Stromquellen. Was davon
 * richtig ist, entscheidet sich an Reihen- und Parallelschaltung, am
 * Spannungsteiler und daran, dass die Knotenregel aufgeht.
 */
import { describe, it, expect } from "vitest";
import { Knotenzaehler, loeseLGS, loeseNetz, type Zweig } from "@/lib/physik/kern/netz";

const R = (a: number, b: number, ohm: number): Zweig => ({ art: "leitwert", a, b, wert: 1 / ohm });
const U = (a: number, b: number, volt: number, id = "q"): Zweig => ({ art: "quelle", a, b, wert: volt, id });

describe("Das Gleichungssystem", () => {
  it("löst ein kleines System", () => {
    // 2x + y = 5, x − y = 1  →  x = 2, y = 1
    const x = loeseLGS([[2, 1], [1, -1]], [5, 1])!;
    expect(x[0]).toBeCloseTo(2, 9);
    expect(x[1]).toBeCloseTo(1, 9);
  });

  it("gibt null zurück, wenn es nichts zu lösen gibt", () => {
    expect(loeseLGS([[1, 1], [2, 2]], [1, 2])).toBeNull();
  });
});

describe("Der Stromkreis als Netz", () => {
  it("rechnet die Reihenschaltung: ein Strom, aufgeteilte Spannung", () => {
    // 12 V an 100 Ω + 200 Ω. I = 40 mA, über dem zweiten liegen 8 V.
    const netz = { knoten: 3, zweige: [U(1, 0, 12, "batterie"), R(1, 2, 100), R(2, 0, 200)] };
    const l = loeseNetz(netz);

    expect(l.potenzial[1]).toBeCloseTo(12, 6);
    expect(l.potenzial[2]).toBeCloseTo(8, 6);
    // Gemeldet wird der Strom *durch den Zweig*, von a nach b. In einer Batterie
    // fließt er innen von Minus nach Plus, also hier von b nach a — das Zeichen
    // ist negativ, solange sie liefert. Wer den abgegebenen Strom anzeigen will,
    // dreht es um; das tut die Schicht darüber.
    expect(l.strom.get("batterie")!).toBeCloseTo(-12 / 300, 6);
  });

  it("rechnet die Parallelschaltung: eine Spannung, aufgeteilter Strom", () => {
    // 12 V an 100 Ω ∥ 300 Ω → Ersatzwiderstand 75 Ω, also 160 mA.
    const netz = { knoten: 2, zweige: [U(1, 0, 12, "batterie"), R(1, 0, 100), R(1, 0, 300)] };
    const l = loeseNetz(netz);
    expect(l.strom.get("batterie")!).toBeCloseTo(-12 / 75, 6);
  });

  it("lässt die Knotenregel aufgehen", () => {
    const netz = { knoten: 3, zweige: [U(1, 0, 9, "q"), R(1, 2, 50), R(2, 0, 100), R(2, 0, 100)] };
    const l = loeseNetz(netz);
    const zu = (l.potenzial[1] - l.potenzial[2]) / 50;
    const ab = (l.potenzial[2] - l.potenzial[0]) / 100 + (l.potenzial[2] - l.potenzial[0]) / 100;
    expect(zu).toBeCloseTo(ab, 6);
  });

  it("misst den Strom durch einen Draht — eine Quelle mit null Volt", () => {
    // Der Trick für Amperemeter und geschlossenen Schalter.
    const netz = { knoten: 3, zweige: [U(1, 0, 6, "batterie"), U(1, 2, 0, "draht"), R(2, 0, 200)] };
    const l = loeseNetz(netz);
    expect(l.potenzial[2]).toBeCloseTo(6, 6);
    expect(l.strom.get("draht")!).toBeCloseTo(6 / 200, 6);
  });

  it("treibt mit einer Stromquelle die Spannung über den Widerstand", () => {
    // 2 A in einen 5-Ω-Widerstand: 10 V. So wird später Wärme eingespeist.
    const netz: { knoten: number; zweige: Zweig[] } =
      { knoten: 2, zweige: [{ art: "strom", a: 0, b: 1, wert: 2 }, R(1, 0, 5)] };
    expect(loeseNetz(netz).potenzial[1]).toBeCloseTo(10, 6);
  });

  it("steht still, wenn nichts angeschlossen ist", () => {
    expect(loeseNetz({ knoten: 0, zweige: [] }).potenzial).toEqual([]);
    const offen = loeseNetz({ knoten: 2, zweige: [R(1, 0, 100)] });
    expect(offen.potenzial[1]).toBeCloseTo(0, 6);
  });
});

describe("Der Knotenzähler", () => {
  it("macht aus verbundenen Anschlüssen einen Knoten", () => {
    const z = new Knotenzaehler();
    for (const k of ["a.0", "a.1", "b.0", "b.1"]) z.melde(k);
    z.verbinde("a.1", "b.0");
    const n = z.nummern("a.0");

    expect(n.get("a.0")).toBe(0);
    expect(n.get("a.1")).toBe(n.get("b.0"));
    expect(new Set(n.values()).size).toBe(3);
  });

  it("legt die Masse auf null, auch wenn sie später gemeldet wurde", () => {
    const z = new Knotenzaehler();
    z.melde("x");
    z.melde("m");
    expect(z.nummern("m").get("m")).toBe(0);
  });
});
