/**
 * Main-Character-Zeugnis: nennt die stärksten Werte, geschaffte und offene
 * Baustellen, gibt für die schwächsten Werte einen Tipp — auf einer Seite.
 */
import { describe, expect, it } from "vitest";
import { KLASSEN, lauf, werte, type Profil } from "@/lib/mainCharacter";
import { baueZeugnisPdf, zeugnisText, type ZeugnisDaten } from "@/lib/mainCharacterZeugnis";

const profil: Profil = {
  talente: { W: 1.3, Z: 1.1, S: .8, M: 1, E: 1 },
  staerken: ["neugierig", "hartnaeckig"],
  baustellen: ["lernfrust", "unsicher"],
};
const ich = lauf(KLASSEN.nerd, profil);
const daten: ZeugnisDaten = {
  spitzname: "Pixelfuchs", klasse: "nerd", profil, werte: werte(ich), npc: werte(lauf(KLASSEN.npc)),
  rest: ich.rest, woche: 85, datum: new Date(2028, 5, 30),
};

describe("Zeugnistext", () => {
  it("nennt drei Stärken, das Talent und zwei Fokus-Werte, ohne Überschneidung", () => {
    const t = zeugnisText(daten);
    expect(t.kannst).toHaveLength(3);
    expect(t.fokus).toHaveLength(2);
    expect(t.talent).toBe("W");
    const oben = t.kannst.map(k => k.wert);
    for (const f of t.fokus) expect(oben).not.toContain(f.wert);
  });

  it("trennt geschaffte und offene Baustellen", () => {
    const t = zeugnisText({ ...daten, rest: { lernfrust: 0, unsicher: 40 } });
    expect(t.geschafft).toEqual(["lernfrust"]);
    expect(t.offen).toEqual([{ id: "unsicher", rest: 40 }]);
  });

  it("ohne Talent über 1 gibt es keinen Talent-Satz", () => {
    const t = zeugnisText({ ...daten, profil: { ...profil, talente: { W: 1, Z: 1, S: 1, M: 1, E: 1 } } });
    expect(t.talent).toBeNull();
  });
});

describe("Zeugnis als PDF", () => {
  it("passt auf eine Seite und enthält Name, Klasse, Stärken und Tipps", async () => {
    const doc = await baueZeugnisPdf(daten);
    expect(doc.getNumberOfPages()).toBe(1);
    const roh = doc.output();
    for (const s of ["Charakter-Zeugnis", "Pixelfuchs", "Nerd", "30.06.2028", "Neugierig", "Hier lohnt sich mehr Fokus", "kein Urteil"]) {
      expect(roh, s).toContain(s);
    }
  });
});
