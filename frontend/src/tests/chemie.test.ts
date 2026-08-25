import { describe, it, expect } from "vitest";
import {
  bondHint, chargeBalance, CHEM_PRESETS, countAtoms, elementBalance, formatParts,
  formatReaction, formatSpecies, hasIons, isBalanced, molarMass, oxidationStates,
  parseReaction, setCharge, setCoef, setIndex, sideAtoms, sideCharge, sideMass,
  unknownElements, type Reaction,
} from "@/lib/chemie";
import { element } from "@/lib/elemente";

const parse = (s: string): Reaction => {
  const r = parseReaction(s);
  if (!r.ok) throw new Error(`${s}: ${r.error}`);
  return r.r;
};

describe("parseReaction", () => {
  it("liest Stoffe, Faktoren und Indizes", () => {
    const r = parse("2 H2 + O2 -> 2 H2O");
    expect(r.left).toHaveLength(2);
    expect(r.left[0].coef).toBe(2);
    expect(countAtoms(r.left[0].parts)).toEqual({ H: 2 });
    expect(r.right[0].coef).toBe(2);
  });

  it("behält Klammergruppen als Struktur", () => {
    const r = parse("Ca(OH)2 + CO2 -> CaCO3 + H2O");
    expect(r.left[0].parts).toHaveLength(2);
    expect(countAtoms(r.left[0].parts)).toEqual({ Ca: 1, O: 2, H: 2 });
    expect(formatParts(r.left[0].parts)).toBe("Ca(OH)₂");
  });

  it("versteht Pfeil, Gleichheitszeichen und tiefgestellte Ziffern", () => {
    expect(formatReaction(parse("H₂ + O₂ = H₂O"))).toBe("H₂ + O₂ → H₂O");
    expect(formatReaction(parse("H2 + O2 → H2O"))).toBe("H₂ + O₂ → H₂O");
  });

  it("meldet Fehler statt zu raten", () => {
    expect(parseReaction("H2 + O2")).toMatchObject({ ok: false });
    expect(parseReaction("h2 -> H2")).toMatchObject({ ok: false });
    expect(parseReaction("Ca(OH2 -> X")).toMatchObject({ ok: false });
  });

  it("erkennt unbekannte Elementsymbole", () => {
    expect(unknownElements(parse("Xy + O2 -> XyO2"))).toEqual(["Xy"]);
    expect(unknownElements(parse("H2 + O2 -> H2O"))).toEqual([]);
  });
});

describe("Ausgleichen", () => {
  it("zählt die Atome je Seite", () => {
    const r = parse("H2 + O2 -> H2O");
    expect(sideAtoms(r.left)).toEqual({ H: 2, O: 2 });
    expect(sideAtoms(r.right)).toEqual({ H: 2, O: 1 });
    expect(isBalanced(r)).toBe(false);
  });

  it("wird durch die richtigen Faktoren ausgeglichen", () => {
    let r = parse("H2 + O2 -> H2O");
    r = setCoef(r, "left", 0, 2);
    r = setCoef(r, "right", 0, 2);
    expect(isBalanced(r)).toBe(true);
    expect(elementBalance(r)).toEqual([
      { el: "H", left: 4, right: 4, ok: true },
      { el: "O", left: 2, right: 2, ok: true },
    ]);
  });

  it("kippt wieder, wenn ein Index verstellt wird", () => {
    let r = parse("2 H2 + O2 -> 2 H2O");
    expect(isBalanced(r)).toBe(true);
    r = setIndex(r, "right", 0, [1], 2); // H2O → H2O2
    expect(formatParts(r.right[0].parts)).toBe("H₂O₂");
    expect(isBalanced(r)).toBe(false);
  });

  it("ändert einen Index in einer Klammergruppe", () => {
    let r = parse("Ca(OH)2 -> CaO + H2O");
    r = setIndex(r, "left", 0, [1], 3); // Ca(OH)3
    expect(formatParts(r.left[0].parts)).toBe("Ca(OH)₃");
    expect(countAtoms(r.left[0].parts)).toEqual({ Ca: 1, O: 3, H: 3 });
  });

  it("hält Faktoren und Indizes in sinnvollen Grenzen", () => {
    let r = parse("H2 -> H2");
    r = setCoef(r, "left", 0, 0);
    expect(r.left[0].coef).toBe(1);
    r = setIndex(r, "left", 0, [0], 99);
    expect(r.left[0].parts[0].kind === "el" && r.left[0].parts[0].n).toBe(12);
  });

  it("lässt sich jede Vorlage ausgleichen (Masse bleibt erhalten)", () => {
    for (const p of CHEM_PRESETS) {
      const r = parse(p.src);
      expect(unknownElements(r)).toEqual([]);
      expect(sideMass(r.left)).not.toBeNull();
      expect(sideMass(r.right)).not.toBeNull();
    }
  });
});

describe("molare Masse", () => {
  it("rechnet aus der Formel", () => {
    expect(molarMass(parse("H2O -> H2O").left[0].parts)).toBeCloseTo(18.015, 3);
    expect(molarMass(parse("CaCO3 -> X").left[0].parts)).toBeCloseTo(100.086, 2);
  });

  it("wiegt beide Seiten gleich, wenn ausgeglichen", () => {
    const r = parse("2 H2 + O2 -> 2 H2O");
    expect(sideMass(r.left)).toBeCloseTo(sideMass(r.right) as number, 3);
  });
});

describe("Oxidationszahlen", () => {
  const ox = (formula: string) => oxidationStates(parse(`${formula} -> X`).left[0].parts);

  it("gibt Elementen in Reinform 0", () => {
    expect(ox("O2")).toEqual({ O: 0 });
    expect(ox("Fe")).toEqual({ Fe: 0 });
  });

  it("rechnet die Schulfälle", () => {
    expect(ox("H2O")).toEqual({ H: 1, O: -2 });
    expect(ox("CO2")).toEqual({ C: 4, O: -2 });
    expect(ox("H2SO4")).toEqual({ H: 1, S: 6, O: -2 });
    expect(ox("NaCl")).toEqual({ Na: 1, Cl: -1 });
    expect(ox("CH4")).toEqual({ C: -4, H: 1 });
    expect(ox("Fe2O3")).toEqual({ Fe: 3, O: -2 });
    expect(ox("KMnO4")).toEqual({ K: 1, Mn: 7, O: -2 });
  });

  it("erkennt das Peroxid, weil Sauerstoff zuletzt drankommt", () => {
    expect(ox("H2O2")).toEqual({ H: 1, O: -1 });
  });

  it("rechnet Salze über die Oktettregel", () => {
    expect(ox("FeS")).toEqual({ Fe: 2, S: -2 });
    expect(ox("CuCl2")).toEqual({ Cu: 2, Cl: -1 });
  });

  it("mittelt, wenn ein Element mehrfach verschieden gebunden ist", () => {
    expect(ox("NaCH3COO")).toMatchObject({ Na: 1, H: 1, O: -2, C: 0 });
  });

  it("gibt null zurück, wenn es nicht eindeutig ist", () => {
    const r = ox("CS2"); // weder Metall noch Regel greift
    expect(Object.values(r).every(v => v === null)).toBe(true);
  });
});

describe("Oktett-Hinweis", () => {
  const hint = (formula: string) => bondHint(parse(`${formula} -> X`).left[0].parts);

  it("schweigt bei stimmigen Verbindungen", () => {
    for (const f of ["H2O", "NaCl", "CO2", "CH4", "NH3", "Fe2O3", "AlCl3"]) expect(hint(f)).toBeNull();
  });

  it("warnt bei H3O und erklärt es", () => {
    const h = hint("H3O");
    expect(h?.level).toBe("warn");
    expect(h?.text).toContain("Bindungen");
    expect(h?.text).toContain("Sauerstoff");
  });

  it("verspricht Wasserstoff kein Oktett — er füllt die 2er-Schale", () => {
    const h = hint("H3O");
    expect(h?.text).toContain("1 Außenelektron und");
    expect(h?.text).toContain("zur vollen Schale");
    expect(h?.text).toContain("zum Oktett"); // … der Sauerstoff schon
  });

  it("kennt Ausnahmen von der Oktettregel", () => {
    expect(hint("CO")).toBeNull();
    expect(hint("H2O2")).toBeNull();
  });

  it("hält sich bei mehr als zwei Elementen zurück", () => {
    expect(hint("H2SO4")).toBeNull();
  });

  it("meldet ein unbekanntes Symbol", () => {
    expect(hint("Xy2O")?.level).toBe("unknown");
  });
});

describe("Elementdaten", () => {
  it("kennt die Schulelemente mit Masse und Farbe", () => {
    for (const s of ["H", "C", "N", "O", "Na", "Cl", "Fe", "Ca", "S", "Al"]) {
      const e = element(s);
      expect(e, s).toBeDefined();
      expect(e!.mass).toBeGreaterThan(0);
      expect(e!.color).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("Ionen", () => {
  it("liest die Ladung in der Schreibweise (H)+ und (CO2)2-", () => {
    const r = parse("(H)+ + (CO3)2- -> X");
    expect(r.left[0].charge).toBe(1);
    expect(countAtoms(r.left[0].parts)).toEqual({ H: 1 });
    expect(r.left[1].charge).toBe(-2);
    expect(countAtoms(r.left[1].parts)).toEqual({ C: 1, O: 3 });
  });

  it("packt die überflüssige Klammer aus", () => {
    // (H)+ meint das Ion, nicht »die Gruppe H einmal«.
    expect(parse("(H)+ -> X").left[0].parts).toEqual([{ kind: "el", el: "H", n: 1 }]);
    // Ca(OH)2 bleibt dagegen eine echte Gruppe.
    expect(parse("Ca(OH)2 -> X").left[0].parts).toHaveLength(2);
  });

  it("versteht auch Na+, Cl- und SO4^2-", () => {
    expect(parse("Na+ -> X").left[0].charge).toBe(1);
    expect(parse("Cl- -> X").left[0].charge).toBe(-1);
    expect(parse("SO4^2- -> X").left[0].charge).toBe(-2);
    expect(parse("Ca2+ -> X").left[0].charge).toBe(2);
  });

  it("verwechselt das trennende Plus nicht mit einer Ladung", () => {
    const r = parse("(H)+ + (OH)- -> H2O");
    expect(r.left).toHaveLength(2);
    expect(r.left.map(s => s.charge)).toEqual([1, -1]);
    // Und ohne Ionen bleibt alles wie gehabt, auch ohne Leerzeichen.
    expect(parse("H2+O2 -> H2O").left).toHaveLength(2);
  });

  it("schreibt die Ladung hochgestellt", () => {
    expect(formatSpecies(parse("(H)+ -> X").left[0])).toBe("H⁺");
    expect(formatSpecies(parse("(CO3)2- -> X").left[0])).toBe("CO₃²⁻");
    expect(formatSpecies(parse("2 Cl- -> X").left[0])).toBe("2 Cl⁻");
    expect(formatReaction(parse("(H)+ + (OH)- -> H2O"))).toBe("H⁺ + OH⁻ → H₂O");
  });

  it("zählt die Ladung als eigene Bilanz", () => {
    const gut = parse("(H)+ + (OH)- -> H2O");
    expect(sideCharge(gut.left)).toBe(0);
    expect(chargeBalance(gut)).toEqual({ left: 0, right: 0, ok: true });
    expect(isBalanced(gut)).toBe(true);
    expect(hasIons(gut)).toBe(true);
    expect(hasIons(parse("H2 + O2 -> H2O"))).toBe(false);
  });

  it("meldet eine Gleichung mit schiefer Ladung als nicht ausgeglichen", () => {
    // Atome stimmen, die Ladung nicht.
    const schief = parse("Ag+ + Cl- -> AgCl+");
    expect(elementBalance(schief).every(b => b.ok)).toBe(true);
    expect(chargeBalance(schief)).toEqual({ left: 0, right: 1, ok: false });
    expect(isBalanced(schief)).toBe(false);
  });

  it("rechnet die Faktoren in die Ladung ein", () => {
    const r = parse("Ca2+ + 2 Cl- -> CaCl2");
    expect(sideCharge(r.left)).toBe(0);
    expect(isBalanced(r)).toBe(true);
  });

  it("lässt die Ladung verstellen", () => {
    let r = parse("Ag+ + Cl- -> AgCl");
    expect(isBalanced(r)).toBe(true);
    r = setCharge(r, "left", 0, 2);
    expect(chargeBalance(r).ok).toBe(false);
    expect(formatSpecies(r.left[0])).toBe("Ag²⁺");
  });

  it("bezieht die Oxidationszahlen auf die Ladung", () => {
    const ox = (f: string) => {
      const s = parse(`${f} -> X`).left[0];
      return oxidationStates(s.parts, s.charge);
    };
    expect(ox("Na+")).toEqual({ Na: 1 });            // einatomiges Ion
    expect(ox("Cl-")).toEqual({ Cl: -1 });
    expect(ox("(SO4)2-")).toEqual({ S: 6, O: -2 });  // Summe = −2
    expect(ox("(NO3)-")).toEqual({ N: 5, O: -2 });
    expect(ox("(NH4)+")).toEqual({ N: -3, H: 1 });
  });

  it("schweigt beim Oktett-Hinweis, sobald eine Ladung im Spiel ist", () => {
    // H₃O⁺ gibt es wirklich — H₃O ohne Ladung nicht. Die Ladung entscheidet.
    const ion = parse("(H3O)+ -> X").left[0];
    expect(bondHint(ion.parts, ion.charge)).toBeNull();
    expect(bondHint(ion.parts, 0)?.level).toBe("warn");
  });
});
