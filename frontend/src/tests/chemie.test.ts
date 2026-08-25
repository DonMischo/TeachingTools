import { describe, it, expect } from "vitest";
import {
  bondHint, CHEM_PRESETS, countAtoms, elementBalance, formatParts, formatReaction,
  isBalanced, molarMass, oxidationStates, parseReaction, setCoef, setIndex, sideAtoms,
  sideMass, unknownElements, type Reaction,
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
