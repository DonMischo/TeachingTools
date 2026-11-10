/**
 * Das Lewis-Labor: Punkte verteilen, und zusammengeschobene Symbole binden
 * sich über ihre einzelnen Elektronen.
 */
import { describe, expect, it } from "vitest";
import {
  BINDE, elektronenUm, entferne, fuegeHinzu, fuegeMolekuelEin, grad, molekuele, MOLEKUELE, neuesLabor, schritt,
  seitenBelegung, teilladungen, type LewisLabor,
} from "@/lib/atome/lewis";

/** Fester Zufall, damit jeder Lauf gleich ausgeht. */
const zufall = (() => { let s = 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
const laufe = (lab: LewisLabor, sekunden: number) => {
  for (let i = 0; i < sekunden * 120; i++) schritt(lab, 1 / 120, zufall);
};

describe("Punkte ums Symbol", () => {
  it.each([
    ["C", 4, 8, [1, 1, 1, 1]], ["N", 5, 8, [2, 1, 1, 1]], ["O", 6, 8, [2, 2, 1, 1]],
    ["Cl", 7, 8, [2, 2, 2, 1]], ["B", 3, 8, [1, 1, 1, 0]], ["H", 1, 2, [1]], ["He", 2, 2, [2]],
  ] as const)("%s", (_s, valenz, ziel, soll) => {
    expect(seitenBelegung(valenz, ziel)).toEqual(soll);
  });
});

describe("Binden", () => {
  it("zwei H nah beieinander werden zu H₂ mit je einem Duett", () => {
    const lab = neuesLabor(600, 400);
    fuegeHinzu(lab, "H", 250, 200);
    fuegeHinzu(lab, "H", 250 + BINDE + 30, 200);
    laufe(lab, 3);
    const [m] = molekuele(lab);
    expect(lab.bindungen).toHaveLength(1);
    expect(m.formel).toBe("H2");
    expect(m.offen).toEqual([]);
  });

  it("weit auseinander passiert nichts", () => {
    const lab = neuesLabor(600, 400);
    fuegeHinzu(lab, "H", 100, 200);
    fuegeHinzu(lab, "H", 500, 200);
    laufe(lab, 2);
    expect(lab.bindungen).toHaveLength(0);
  });

  it("Stickstoff bildet eine Dreifachbindung", () => {
    const lab = neuesLabor(600, 400);
    const a = fuegeHinzu(lab, "N", 260, 200)!;
    const b = fuegeHinzu(lab, "N", 340, 200)!;
    laufe(lab, 4);
    expect(grad(lab, a.id, b.id)).toBe(3);
    expect(elektronenUm(lab, a)).toBe(8);
  });

  it("Wasser: O mit zwei H, alle voll", () => {
    const lab = neuesLabor(600, 400);
    fuegeHinzu(lab, "O", 300, 200);
    fuegeHinzu(lab, "H", 300, 120);
    fuegeHinzu(lab, "H", 380, 200);
    laufe(lab, 4);
    const m = molekuele(lab);
    expect(m).toHaveLength(1);
    expect(m[0].formel).toBe("H2O");
    expect(m[0].name).toBe("Wasser");
    expect(m[0].offen).toEqual([]);
  });

  it("Edelgase binden nicht", () => {
    const lab = neuesLabor(600, 400);
    fuegeHinzu(lab, "He", 260, 200);
    fuegeHinzu(lab, "H", 320, 200);
    laufe(lab, 2);
    expect(lab.bindungen).toHaveLength(0);
  });

  it("auseinandergezogen reißt die Bindung, die Elektronen gehen zurück", () => {
    const lab = neuesLabor(600, 400);
    const a = fuegeHinzu(lab, "H", 260, 200)!;
    fuegeHinzu(lab, "H", 320, 200);
    laufe(lab, 2);
    expect(lab.bindungen).toHaveLength(1);
    a.gehalten = true;
    a.x = 40;
    schritt(lab, 1 / 120, zufall);
    expect(lab.bindungen).toHaveLength(0);
    expect(lab.gruppen).toHaveLength(2);
  });

  it("Entfernen gibt dem Partner sein Elektron zurück", () => {
    const lab = neuesLabor(600, 400);
    const a = fuegeHinzu(lab, "H", 260, 200)!;
    const b = fuegeHinzu(lab, "Cl", 320, 200)!;
    laufe(lab, 2);
    entferne(lab, a.id);
    expect(lab.bindungen).toHaveLength(0);
    expect(elektronenUm(lab, b)).toBe(7);
    expect(lab.el.filter(e => e.atom === b.id)).toHaveLength(7);
  });
});

const vorlage = (label: string) => MOLEKUELE.find(m => m.label === label)!;

describe("Fertige Moleküle", () => {
  it.each(MOLEKUELE.map(m => [m.label, m] as const))("%s ist vollständig gebunden", (_l, m) => {
    const lab = neuesLabor(800, 500);
    fuegeMolekuelEin(lab, m, 400, 250, 0.3);
    const ms = molekuele(lab);
    expect(ms).toHaveLength(1);
    expect(ms[0].offen).toEqual([]);
    expect(lab.gruppen.filter(g => g.el.length === 1)).toEqual([]);
    laufe(lab, 1);
    expect(molekuele(lab)).toHaveLength(1);
  });
});

describe("Teilladungen", () => {
  it("Wasser: O δ−, H δ+; Methan unpolar", () => {
    const lab = neuesLabor(800, 500);
    const [o, h] = fuegeMolekuelEin(lab, vorlage("H₂O"), 200, 250);
    const [c] = fuegeMolekuelEin(lab, vorlage("CH₄"), 600, 250);
    const q = teilladungen(lab);
    expect(q.get(o.id)!).toBeLessThan(0);
    expect(q.get(h.id)!).toBeGreaterThan(0);
    expect(q.get(c.id)).toBeUndefined();
  });
});

describe("Kräfte zwischen Molekülen", () => {
  it("zwei Wassermoleküle bilden eine Wasserstoffbrücke", () => {
    const lab = neuesLabor(800, 500);
    lab.optionen.zwischen = true;
    fuegeMolekuelEin(lab, vorlage("H₂O"), 330, 250);
    fuegeMolekuelEin(lab, vorlage("H₂O"), 450, 250, Math.PI);
    laufe(lab, 3);
    expect(lab.kontakte.some(k => k.art === "bruecke")).toBe(true);
    expect(molekuele(lab)).toHaveLength(2);
  });

  it("Methan hat nur Van-der-Waals-Kräfte", () => {
    const lab = neuesLabor(800, 500);
    lab.optionen.zwischen = true;
    fuegeMolekuelEin(lab, vorlage("CH₄"), 340, 250);
    fuegeMolekuelEin(lab, vorlage("CH₄"), 460, 250);
    laufe(lab, 2);
    expect(lab.kontakte.length).toBeGreaterThan(0);
    expect(lab.kontakte.every(k => k.art === "london")).toBe(true);
  });

  it("Wärmebewegung reißt keine Atombindung", () => {
    const lab = neuesLabor(800, 500);
    lab.optionen.waerme = 1;
    fuegeMolekuelEin(lab, vorlage("C₂H₅OH"), 400, 250);
    laufe(lab, 3);
    expect(molekuele(lab)).toHaveLength(1);
  });
});
