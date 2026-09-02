/**
 * Die Rechenregeln ohne Oberfläche. Hier fällt auf, wenn die Reihenfolge
 * kippt — nicht erst an der Tafel vor 28 Kindern.
 */
import { describe, it, expect } from "vitest";
import {
  parse, render, wert, wertVonLinks, naechster, kandidaten, anwenden, alleSchritte,
  begruendung, istKindgerecht, wuerfelnTerm, wuerfelnZug, wuerfelnStufen,
  type StufenModus,
  zugAusTerm, zugTerm, zugWert, gruppen, tauscheZahlen, tauscheGruppen,
  zerlegeStufen, stellenwerte, fmt, RechenError,
} from "@/lib/rechenregeln";

const schritte = (src: string) => alleSchritte(parse(src)).map(s => s.nachher);
const naechsteRechnung = (src: string) => {
  const k = naechster(parse(src))!;
  return `${k.a} ${k.op} ${k.b}`;
};

describe("Lesen und Schreiben", () => {
  it("liest Punkt vor Strich in den Baum", () => {
    expect(wert(parse("2 + 3 · 4"))).toBe(14);
    expect(wert(parse("2 · 3 + 4 · 5"))).toBe(26);
    expect(wert(parse("20 − 3 · 4"))).toBe(8);
  });

  it("nimmt alle Schreibweisen der Rechenzeichen", () => {
    expect(wert(parse("12 / 4"))).toBe(3);
    expect(wert(parse("12 : 4"))).toBe(3);
    expect(wert(parse("3 * 4"))).toBe(12);
    expect(wert(parse("3 × 4"))).toBe(12);
    expect(wert(parse("9 – 4"))).toBe(5);
  });

  it("schreibt den Term mit Schulzeichen zurück", () => {
    expect(render(parse("2+3*4"))).toBe("2 + 3 · 4");
    expect(render(parse("12/4"))).toBe("12 : 4");
    expect(render(parse("7-2"))).toBe("7 − 2");
  });

  it("setzt beim Zurückschreiben genau die Klammern, die der Baum braucht", () => {
    expect(render(parse("(2 + 3) · 4"))).toBe("(2 + 3) · 4");
    expect(render(parse("2 + (3 + 4)"))).toBe("2 + (3 + 4)");
    expect(render(parse("(2 + 3) + 4"))).toBe("2 + 3 + 4");   // überflüssig
    expect(render(parse("10 − (4 − 1)"))).toBe("10 − (4 − 1)"); // nötig
    expect(render(parse("2 · (3 + 4)"))).toBe("2 · (3 + 4)");
    expect(render(parse("(2 · 3) + 4"))).toBe("2 · 3 + 4");     // überflüssig
  });

  it("erklärt Tippfehler auf Deutsch statt zu stolpern", () => {
    expect(() => parse("2 + ")).toThrow(RechenError);
    expect(() => parse("(2 + 3")).toThrow(/Klammer/);
    expect(() => parse("2 + 3)")).toThrow(/Klammer/);
    expect(() => parse("2 § 3")).toThrow(/§/);
    expect(() => parse("· 3")).toThrow(/fehlt eine Zahl/);
    expect(() => wert(parse("3 : 0"))).toThrow(/durch 0/i);
  });
});

describe("Reihenfolge der Schritte", () => {
  it("rechnet Punkt vor Strich", () => {
    expect(naechsteRechnung("2 + 3 · 4")).toBe("3 * 4");
    expect(schritte("2 + 3 · 4")).toEqual(["2 + 12", "14"]);
  });

  it("nimmt bei gleichem Rang den linken zuerst", () => {
    expect(naechsteRechnung("2 · 3 + 4 · 5")).toBe("2 * 3");
    expect(schritte("2 · 3 + 4 · 5")).toEqual(["6 + 4 · 5", "6 + 20", "26"]);
    expect(schritte("10 − 4 + 2")).toEqual(["6 + 2", "8"]);
  });

  it("macht die Klammer zuerst — auch wenn draußen ein Malpunkt wartet", () => {
    expect(naechsteRechnung("2 · 3 + (4 + 1)")).toBe("4 + 1");
    expect(schritte("(2 + 3) · 4")).toEqual(["5 · 4", "20"]);
    expect(schritte("2 + (3 + 4) · 5")).toEqual(["2 + 7 · 5", "2 + 35", "37"]);
  });

  it("arbeitet sich von der innersten Klammer nach außen", () => {
    expect(naechsteRechnung("2 · ((3 + 4) · 2)")).toBe("3 + 4");
    expect(wert(parse("2 · ((3 + 4) · 2)"))).toBe(28);
  });

  it("nennt den Grund für den nächsten Schritt", () => {
    const g = (src: string) => { const b = parse(src); return begruendung(b, naechster(b)!); };
    expect(g("2 + 3 · 4")).toBe("Punkt vor Strich");
    expect(g("2 · 3 + (4 + 1)")).toBe("Klammer zuerst");
    expect(g("2 · 3 + 4 · 5")).toBe("von links nach rechts");
    expect(g("2 + 3")).toBe("letzter Schritt");
  });

  it("führt genau eine Rechnung aus, nicht den ganzen Term", () => {
    const baum = parse("2 + 3 · 4");
    expect(render(anwenden(baum, naechster(baum)!.pfad))).toBe("2 + 12");
    expect(render(baum)).toBe("2 + 3 · 4"); // der alte Stand bleibt stehen
  });

  it("weigert sich, eine Rechnung ohne feste Zahlen auszuführen", () => {
    expect(() => anwenden(parse("2 + 3 · 4"), "")).toThrow(RechenError);
  });

  it("hat am Ende keinen Kandidaten mehr", () => {
    expect(kandidaten(parse("7"))).toEqual([]);
    expect(naechster(parse("7"))).toBeNull();
  });
});

describe("Von links nach rechts — der typische Fehler", () => {
  it("rechnet ohne Punkt vor Strich anders", () => {
    expect(wertVonLinks("2 + 3 · 4")).toBe(20);
    expect(wert(parse("2 + 3 · 4"))).toBe(14);
  });

  it("achtet trotzdem auf Klammern", () => {
    expect(wertVonLinks("2 · (3 + 4)")).toBe(14);
  });

  it("kommt aufs Gleiche, wenn die Regel nichts ändert", () => {
    expect(wertVonLinks("2 · 3 · 4")).toBe(24);
    expect(wertVonLinks("2 + 3 + 4")).toBe(9);
  });
});

describe("Aufgaben würfeln", () => {
  it("liefert je Stufe rechenbare Terme mit ganzen Zwischenergebnissen", () => {
    for (const stufe of [1, 2, 3, 4]) {
      for (let i = 0; i < 40; i++) {
        const src = wuerfelnTerm(stufe);
        const baum = parse(src);
        expect(istKindgerecht(baum, 60), src).toBe(true);
        expect(Number.isInteger(wert(baum)), src).toBe(true);
      }
    }
  });

  it("würfelt auf den unteren Stufen nur Terme, bei denen die Regel etwas ändert", () => {
    for (const stufe of [1, 2]) {
      for (let i = 0; i < 40; i++) {
        const src = wuerfelnTerm(stufe);
        expect(wertVonLinks(src), src).not.toBe(wert(parse(src)));
      }
    }
  });

  it("würfelt Züge ohne Klammern", () => {
    for (const stufe of [1, 2, 3, 4]) {
      for (let i = 0; i < 20; i++) {
        const src = wuerfelnZug(stufe);
        expect(src).not.toMatch(/[()]/);
        expect(() => zugAusTerm(src)).not.toThrow();
        expect(istKindgerecht(parse(src), 99), src).toBe(true);
      }
    }
  });

  it("hängt die Nullen der Stufenaufgabe immer an den zweiten Faktor", () => {
    for (const modus of ["frei", "10", "100", "1000"] as StufenModus[]) {
      for (let i = 0; i < 20; i++) {
        const [a, b] = wuerfelnStufen(modus);
        expect(b % 10, `${a} · ${b}`).toBe(0);
        expect(zerlegeStufen(a, b).nullenB).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("legt den zweiten Faktor in den festen Stufen auf genau 10, 100 oder 1000", () => {
    for (const modus of ["10", "100", "1000"] as StufenModus[]) {
      for (let i = 0; i < 20; i++) {
        const [, b] = wuerfelnStufen(modus);
        expect(b).toBe(Number(modus));
      }
    }
  });

  it("würfelt »frei« Zehner-, Hunderter- und Tausenderzahlen, aber keine reine Stufenzahl", () => {
    const zweite = new Set<number>();
    for (let i = 0; i < 60; i++) zweite.add(wuerfelnStufen("frei")[1]);
    expect([...zweite].every(b => b % 10 === 0 && ![10, 100, 1000].includes(b))).toBe(true);
    expect(zweite.size).toBeGreaterThan(3);
  });

  it("würfelt nie dieselbe Aufgabe noch einmal", () => {
    for (let i = 0; i < 30; i++) {
      const term = wuerfelnTerm(2);
      expect(wuerfelnTerm(2, term)).not.toBe(term);
      const zug = wuerfelnZug(4);
      expect(wuerfelnZug(4, zug)).not.toBe(zug);
      const paar = wuerfelnStufen("frei");
      expect(wuerfelnStufen("frei", paar)).not.toEqual(paar);
    }
  });
});

describe("Der Zug", () => {
  it("zerlegt einen Term in Waggons und Kupplungen", () => {
    expect(zugAusTerm("3 · 4 + 5")).toEqual({ zahlen: [3, 4, 5], ops: ["*", "+"] });
    expect(zugTerm({ zahlen: [3, 4, 5], ops: ["*", "+"] })).toBe("3 · 4 + 5");
    expect(zugWert({ zahlen: [3, 4, 5], ops: ["*", "+"] })).toBe(17);
  });

  it("nimmt keine Klammern und keine halben Terme", () => {
    expect(() => zugAusTerm("(3 + 4) · 5")).toThrow(/Klammer/);
    expect(() => zugAusTerm("3 + + 4")).toThrow(RechenError);
    expect(() => zugAusTerm("7")).toThrow(/mindestens zwei/);
  });

  it("kuppelt Punktrechnungen zu einem Block zusammen", () => {
    expect(gruppen(zugAusTerm("3 · 4 + 5"))).toEqual([[0, 1], [2]]);
    expect(gruppen(zugAusTerm("2 + 3 · 4 · 5 − 6"))).toEqual([[0], [1, 2, 3], [4]]);
    expect(gruppen(zugAusTerm("8 : 2 + 1"))).toEqual([[0, 1], [2]]);
  });

  it("lässt Summanden und Faktoren die Plätze tauschen — das Ergebnis bleibt", () => {
    const summe = zugAusTerm("3 + 4 + 5");
    expect(zugWert(tauscheZahlen(summe, 0, 2))).toBe(zugWert(summe));
    const produkt = zugAusTerm("3 · 4 · 5");
    expect(zugWert(tauscheZahlen(produkt, 0, 1))).toBe(zugWert(produkt));
  });

  it("zeigt bei − und : , dass Vertauschen das Ergebnis kaputt macht", () => {
    const differenz = zugAusTerm("8 − 3");
    expect(zugWert(differenz)).toBe(5);
    expect(zugWert(tauscheZahlen(differenz, 0, 1))).toBe(-5);
    const quotient = zugAusTerm("12 : 4");
    expect(zugWert(tauscheZahlen(quotient, 0, 1))).toBeCloseTo(1 / 3);
  });

  it("tauscht ganze Blöcke, ohne die lose Kupplung mitzunehmen", () => {
    const z = zugAusTerm("3 · 4 + 5");
    const getauscht = tauscheGruppen(z, 0, 1);
    expect(zugTerm(getauscht)).toBe("5 + 3 · 4");
    expect(zugWert(getauscht)).toBe(zugWert(z));
  });

  it("tauscht Blöcke auch mitten im Zug und mit ungleicher Länge", () => {
    const z = zugAusTerm("2 + 3 · 4 · 5 − 6");
    expect(zugTerm(tauscheGruppen(z, 1, 2))).toBe("2 + 6 − 3 · 4 · 5");
    expect(zugTerm(tauscheGruppen(z, 0, 1))).toBe("3 · 4 · 5 + 2 − 6");
    expect(zugWert(tauscheGruppen(z, 0, 1))).toBe(zugWert(z));
  });

  it("tauscht nur Nachbarblöcke", () => {
    expect(() => tauscheGruppen(zugAusTerm("2 + 3 + 4"), 0, 2)).toThrow(/Nachbarn/);
  });
});

describe("Stufenzahlen", () => {
  it("trennt die Nullen ab und gibt sie zurück", () => {
    expect(zerlegeStufen(3, 40)).toMatchObject({ kernA: 3, kernB: 4, nullenA: 0, nullenB: 1, nullen: 1, kern: 12, ergebnis: 120 });
    expect(zerlegeStufen(20, 50)).toMatchObject({ kern: 10, nullen: 2, ergebnis: 1000 });
    expect(zerlegeStufen(4, 300)).toMatchObject({ kern: 12, nullen: 2, ergebnis: 1200 });
    expect(zerlegeStufen(700, 8)).toMatchObject({ kern: 56, nullen: 2, ergebnis: 5600 });
  });

  it("kommt mit Kernen klar, die selbst auf Null enden", () => {
    expect(zerlegeStufen(50, 40)).toMatchObject({ kern: 20, nullen: 2, ergebnis: 2000 });
  });

  it("rechnet ohne Nullen genauso richtig", () => {
    expect(zerlegeStufen(3, 4)).toMatchObject({ nullen: 0, ergebnis: 12 });
    expect(zerlegeStufen(0, 40)).toMatchObject({ ergebnis: 0 });
  });

  it("nimmt keine krummen oder negativen Zahlen", () => {
    expect(() => zerlegeStufen(2.5, 4)).toThrow(RechenError);
    expect(() => zerlegeStufen(-3, 4)).toThrow(RechenError);
  });

  it("legt Ziffern rechtsbündig auf die Stellenwerttafel", () => {
    expect(stellenwerte(120, 5)).toEqual(["", "", "1", "2", "0"]);
    expect(stellenwerte(7, 3)).toEqual(["", "", "7"]);
  });
});

describe("fmt", () => {
  it("schreibt ganze Zahlen ganz und sonst mit Komma", () => {
    expect(fmt(12)).toBe("12");
    expect(fmt(2.5)).toBe("2,5");
    expect(fmt(1 / 3)).toBe("0,333");
  });
});
