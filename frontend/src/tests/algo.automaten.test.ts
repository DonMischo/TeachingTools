import { describe, expect, it } from "vitest";
import { AUTOMATEN, fuehreAutomatAus } from "@/lib/algo/automaten";

/** je Automat: allgemein gültige Lösung + die Karte, die nur an Automat A passt (und ihr Ersatz) */
const LOESUNG: Record<string, { allgemein: string[]; speziell: [string, string] }> = {
  kaugummi: { allgemein: ["k-preis", "k-einwerfen", "k-drehen", "k-klappe", "k-nehmen"], speziell: ["k-preis", "k-muenze"] },
  pfand: { allgemein: ["p-nehmen", "p-einlegen", "p-wiederhole", "p-fertig", "p-bon"], speziell: ["p-fertig", "p-taste"] },
  fahrkarte: { allgemein: ["f-waehlen", "f-preis", "f-zahlen", "f-nehmen", "f-entwerten"], speziell: ["f-zahlen", "f-genau"] },
  kakao: { allgemein: ["c-becher", "c-taste", "c-zahlen", "c-warten", "c-nehmen"], speziell: ["c-zahlen", "c-karte"] },
};

describe("Münzen am Kaugummiautomaten", () => {
  const a = AUTOMATEN.find(x => x.id === "kaugummi")!;
  const mit = (m: string) => [m, "k-einwerfen", "k-drehen", "k-klappe", "k-nehmen"];
  it("50 Cent passt an B, ist an A nicht allgemein gültig", () => {
    expect(fuehreAutomatAus(a, "b", mit("k-m50")).ok).toBe(true);
    expect(fuehreAutomatAus(a, "a", mit("k-m50")).schritte.at(-1)).toMatchObject({ fehler: { art: "allgemein" } });
  });
  it("Ablenker-Münzen sind nirgends ausführbar", () => {
    for (const m of ["k-m10", "k-m100", "k-m200"]) for (const v of ["a", "b"]) {
      expect(fuehreAutomatAus(a, v, mit(m)).schritte.at(-1)).toMatchObject({ fehler: { art: "ausfuehrbar" } });
    }
  });
});

describe("Automaten", () => {
  for (const a of AUTOMATEN) {
    const l = LOESUNG[a.id];
    it(`${a.id}: allgemeine Lösung klappt an jedem Automaten`, () => {
      for (const v of a.varianten) expect(fuehreAutomatAus(a, v.id, l.allgemein).ok).toBe(true);
    });
    it(`${a.id}: spezielle Karte klappt an A, ist an B nicht allgemein gültig`, () => {
      const spez = l.allgemein.map(id => (id === l.speziell[0] ? l.speziell[1] : id));
      expect(fuehreAutomatAus(a, "a", spez).ok).toBe(true);
      const b = fuehreAutomatAus(a, "b", spez);
      expect(b.ok).toBe(false);
      expect(b.schritte.at(-1)).toMatchObject({ art: "fehler", fehler: { art: "allgemein" } });
    });
    it(`${a.id}: hat Fallen für eindeutig, ausführbar und endlich`, () => {
      const arten = new Set(a.handlungen.map(h => h.fehler?.art ?? Object.values(h.ohne ?? {}).map(f => f.art)).flat());
      for (const x of ["eindeutig", "ausfuehrbar", "endlich"]) expect(arten).toContain(x);
    });
    it(`${a.id}: falsche Reihenfolge scheitert`, () => {
      expect(fuehreAutomatAus(a, "a", [...l.allgemein].reverse()).ok).toBe(false);
    });
  }
});
