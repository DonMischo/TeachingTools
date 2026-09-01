/**
 * Kernteilchen auf der Chemie-Waage: Proton, Neutron, Elektron.
 *
 * Gedacht für Redox-Halbgleichungen (Fe²⁺ → Fe³⁺ + e⁻) und Kernumwandlungen.
 * Ausgeglichen ist dort vor allem die Ladung — die Waage rechnet sie ohnehin
 * schon mit, die Teilchen mussten nur dazu.
 */
import { describe, it, expect } from "vitest";
import { element, isParticle } from "@/lib/elemente";
import {
  CHEM_PRESETS, chargeBalance, elementBalance, isBalanced, parseReaction,
  sideCharge, unknownElements,
} from "@/lib/chemie";

const parse = (src: string) => {
  const r = parseReaction(src);
  if (!r.ok) throw new Error(`${src}: ${r.error}`);
  return r.r;
};

describe("Teilchen im Elementverzeichnis", () => {
  it("kennt p, n und e mit Masse und Eigenladung", () => {
    expect(element("p")?.particleCharge).toBe(1);
    expect(element("n")?.particleCharge).toBe(0);
    expect(element("e")?.particleCharge).toBe(-1);
    // Ein Elektron wiegt fast nichts — das Proton rund ein u.
    expect(element("e")!.mass).toBeLessThan(0.01);
    expect(element("p")!.mass).toBeCloseTo(1.007, 2);
  });

  it("verwechselt sie nicht mit Phosphor und Stickstoff", () => {
    expect(element("P")?.name).toBe("Phosphor");
    expect(element("N")?.name).toBe("Stickstoff");
    expect(isParticle("p")).toBe(true);
    expect(isParticle("P")).toBe(false);
  });

  it("hält sie aus der Oktett- und Oxidationslogik heraus", () => {
    // group/outer null ⇒ die Regeln für Atome greifen hier nicht.
    for (const sym of ["p", "n", "e"]) expect(element(sym)!.group).toBeNull();
  });
});

describe("Schreibweise", () => {
  it("liest e- als Elektron mit Ladung −1", () => {
    const r = parse("Fe2+ -> Fe3+ + e-");
    expect(sideCharge(r.right)).toBe(2);
    expect(chargeBalance(r).ok).toBe(true);
  });

  it("nimmt auch »e« ohne Vorzeichen als Elektron", () => {
    // Ohne geschriebene Ladung zählt die Eigenladung des Teilchens.
    expect(sideCharge(parse("Cu2+ + 2e -> Cu").left)).toBe(0);
    expect(sideCharge(parse("Cu2+ + 2e- -> Cu").left)).toBe(0);
  });

  it("lässt eine geschriebene Ladung gewinnen", () => {
    // Wer ausdrücklich etwas anderes hinschreibt, bekommt das auch.
    expect(sideCharge(parse("p+ -> p+").left)).toBe(1);
  });

  it("zählt mehrere Elektronen einzeln", () => {
    const r = parse("Cl2 + 2e- -> 2Cl-");
    expect(sideCharge(r.left)).toBe(-2);
    expect(sideCharge(r.right)).toBe(-2);
    expect(chargeBalance(r).ok).toBe(true);
  });

  it("kennt die Teilchen als bekannt — kein Warnhinweis", () => {
    expect(unknownElements(parse("n -> p+ + e-"))).toEqual([]);
  });
});

describe("Ausgleichen", () => {
  it("Kupfer nimmt zwei Elektronen auf — Ladung und Teilchen stimmen", () => {
    const r = parse("Cu2+ + 2e- -> Cu");
    expect(chargeBalance(r).ok).toBe(true);
    expect(elementBalance(r).every(b => b.ok)).toBe(true);
    expect(isBalanced(r)).toBe(true);
  });

  it("merkt, wenn die Elektronen fehlen", () => {
    const r = parse("Cu2+ -> Cu");
    expect(chargeBalance(r).ok).toBe(false);
    expect(isBalanced(r)).toBe(false);
  });

  it("Neutronenzerfall: die Ladung geht auf", () => {
    const r = parse("n -> p+ + e-");
    expect(sideCharge(r.left)).toBe(0);
    expect(sideCharge(r.right)).toBe(0);
    expect(chargeBalance(r).ok).toBe(true);
  });

  it("kleine Buchstaben bleiben sonst ein Fehler", () => {
    const r = parseReaction("h2o -> H2O");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/beginnt groß/);
  });
});

describe("Vorlagen", () => {
  it("bietet Beispiele mit Teilchen an, und alle lassen sich lesen", () => {
    const mitTeilchen = CHEM_PRESETS.filter(p => /(^|[\s+])\d*[pne][-+ ]|e-/.test(p.src));
    expect(mitTeilchen.length).toBeGreaterThanOrEqual(3);
    for (const p of CHEM_PRESETS) expect(parseReaction(p.src).ok).toBe(true);
  });
});
