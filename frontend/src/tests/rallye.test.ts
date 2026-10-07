/**
 * Prüft die PSE-Rallye: dass jede Aufgabe lösbar ist, dass die Lösung
 * wirklich stimmt und dass die Bereiche halten, was sie versprechen.
 */
import { describe, expect, it } from "vitest";
import { pseNummer } from "@/lib/pse/elemente";
import {
  BEREICHE, elementeIm, istRichtig, masseText, naechsteAufgabe, punkteFuer, urteil,
  type Aufgabe, type Bereich,
} from "@/lib/pse/rallye";

/** Ein wiederholbarer Zufall, damit ein Fehlschlag reproduzierbar bleibt. */
function zufall(saat: number): () => number {
  let z = saat >>> 0;
  return () => {
    z = (z * 1664525 + 1013904223) >>> 0;
    return z / 4294967296;
  };
}

/** Viele Aufgaben eines Bereichs — damit alle Arten vorkommen. */
const viele = (bereich: Bereich, anzahl = 400): Aufgabe[] => {
  const r = zufall(7);
  const aus: Aufgabe[] = [];
  let letzte: Aufgabe | undefined;
  for (let i = 0; i < anzahl; i++) {
    letzte = naechsteAufgabe(bereich, r, letzte?.art);
    aus.push(letzte);
  }
  return aus;
};

describe("Bereiche", () => {
  it("nimmt in »Schulelemente« die ersten 20 und die bekannten Metalle", () => {
    const liste = elementeIm("schule");
    expect(liste.some(e => e.symbol === "Fe")).toBe(true);
    expect(liste.some(e => e.symbol === "Au")).toBe(true);
    expect(liste.some(e => e.symbol === "Es")).toBe(false);
    expect(liste.length).toBeLessThan(40);
  });

  it("lässt in »Hauptgruppen« die Nebengruppen weg", () => {
    const liste = elementeIm("hauptgruppen");
    expect(liste.every(e => e.hauptgruppe !== null)).toBe(true);
    expect(liste.some(e => e.symbol === "Fe")).toBe(false);
    expect(liste.some(e => e.symbol === "Cl")).toBe(true);
  });

  it("nimmt in »Alle 118« wirklich alle", () => {
    expect(elementeIm("alle")).toHaveLength(118);
  });
});

describe("Aufgaben", () => {
  it.each(Object.keys(BEREICHE) as Bereich[])("stellt in »%s« nur lösbare Aufgaben", bereich => {
    const pool = new Set(elementeIm(bereich).map(e => e.z));
    for (const a of viele(bereich)) {
      expect(a.loesung.length, a.frage).toBeGreaterThan(0);
      // »Finde Bor.« ist die kürzeste mögliche Frage.
      expect(a.frage.length).toBeGreaterThanOrEqual(10);
      expect(a.erklaerung.length).toBeGreaterThan(10);
      // Jede Lösung muss im Bereich liegen — sonst ist sie nicht anklickbar.
      for (const z of a.loesung) expect(pool.has(z), `${a.frage} → ${z}`).toBe(true);
    }
  });

  it("bringt mit der Zeit alle sechs Arten", () => {
    const arten = new Set(viele("alle").map(a => a.art));
    expect([...arten].sort()).toEqual(
      ["gruppePeriode", "gruppenname", "masse", "name", "ordnungszahl", "symbol"]);
  });

  it("stellt nie zweimal hintereinander dieselbe Art", () => {
    const liste = viele("schule");
    for (let i = 1; i < liste.length; i++) {
      expect(liste[i].art, `Aufgabe ${i}`).not.toBe(liste[i - 1].art);
    }
  });

  it("fragt nach einer Ordnungszahl und meint auch dieses Element", () => {
    for (const a of viele("alle").filter(x => x.art === "ordnungszahl")) {
      const zahl = Number(/Ordnungszahl (\d+)/.exec(a.frage)![1]);
      expect(a.loesung).toEqual([zahl]);
    }
  });

  it("fragt nach einem Namen und meint auch dieses Element", () => {
    for (const a of viele("alle").filter(x => x.art === "name")) {
      const name = /Finde (.+)\./.exec(a.frage)![1];
      expect(pseNummer(a.loesung[0])!.name).toBe(name);
    }
  });

  it("fragt nach einem Symbol und meint auch dieses Element", () => {
    for (const a of viele("alle").filter(x => x.art === "symbol")) {
      const symbol = /Symbol (\S+)\?/.exec(a.frage)![1];
      expect(pseNummer(a.loesung[0])!.symbol).toBe(symbol);
    }
  });

  it("fragt nach einer Masse und meint auch dieses Element", () => {
    for (const a of viele("alle").filter(x => x.art === "masse")) {
      const masse = /Atommasse (\S+) u/.exec(a.frage)![1];
      expect(masseText(pseNummer(a.loesung[0])!)).toBe(masse);
    }
  });

  it("nennt bei Gruppenfragen alle Elemente der Gruppe als Lösung", () => {
    for (const a of viele("alle").filter(x => x.art === "gruppenname")) {
      const treffer = a.loesung.map(z => pseNummer(z)!);
      const gruppe = treffer[0].hauptgruppe;
      expect(treffer.length).toBeGreaterThan(1);
      expect(treffer.every(e => e.hauptgruppe === gruppe)).toBe(true);
      // Wasserstoff steht in der ersten Spalte, ist aber kein Alkalimetall.
      expect(treffer.some(e => e.z === 1)).toBe(false);
    }
  });

  it("trifft bei Gruppe und Periode genau ein Element", () => {
    for (const a of viele("alle").filter(x => x.art === "gruppePeriode")) {
      const t = /der (\d+)\. Periode und in der (\S+)\. Hauptgruppe/.exec(a.frage)!;
      const e = pseNummer(a.loesung[0])!;
      expect(a.loesung).toHaveLength(1);
      expect(e.periode).toBe(Number(t[1]));
      expect(e.hauptgruppe).not.toBeNull();
    }
  });
});

describe("Antworten und Punkte", () => {
  it("nimmt jede Lösung der Gruppe an, andere nicht", () => {
    const a = viele("alle").find(x => x.art === "gruppenname")!;
    for (const z of a.loesung) expect(istRichtig(a, z)).toBe(true);
    const falsch = [...Array(118).keys()].map(i => i + 1).find(z => !a.loesung.includes(z))!;
    expect(istRichtig(a, falsch)).toBe(false);
  });

  it("gibt beim ersten Versuch die volle Punktzahl und danach weniger", () => {
    expect(punkteFuer(1)).toBe(3);
    expect(punkteFuer(2)).toBe(2);
    expect(punkteFuer(3)).toBe(1);
    expect(punkteFuer(9)).toBe(1);
  });

  it("lobt eine schwache Runde nicht", () => {
    expect(urteil(30, 30)).toMatch(/Anhieb/);
    const schwach = urteil(4, 30);
    expect(schwach).not.toMatch(/gut|super|prima|toll/i);
    expect(schwach.length).toBeGreaterThan(20);
  });
});
