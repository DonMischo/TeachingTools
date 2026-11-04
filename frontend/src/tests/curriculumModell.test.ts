import { describe, it, expect } from "vitest";
import {
  woandersAls, freieAlteKarten, index, neueId, offeneKarten, statusVon, themaSicht, wochenSumme, wortDiff, type Vorlage,
} from "@/lib/curriculum/modell";
import { importOps } from "@/components/curriculum/Dialoge";
import { antwortLesen, vergleichPrompt } from "@/lib/curriculum/kiPrompt";

function vorlage(): Vorlage {
  return {
    format: "tt-curriculum/1", fach: "Mathematik", niveaus: ["G", "R", "H", "LB", "GE"], bloecke: ["5/6", "7/8", "9/10"],
    lehrplaene: [
      { id: "alt", rolle: "alt", schulart: "RS", karten: [
        { id: "a1", block: "5/6", titel: "Teilbarkeit", niveaus: { R: "Teilbarkeitsregeln 2, 3, 9, 100", H: "Teilbarkeitsregeln 2, 3, 9, 100" } },
        { id: "a2", block: "5/6", titel: "Zahlensysteme", niveaus: { R: "andere Zahlensysteme" } },
        { id: "a3", block: "5/6", titel: "Negative Zahlen", niveaus: { R: "negative Zahlen ordnen" } },
        { id: "a4", block: "5/6", titel: "Ungenutzt", niveaus: { R: "x" } },
      ] },
      { id: "neu", rolle: "neu", schulart: "RS", inkraft: { "5": "2026/27" }, karten: [
        { id: "n1", block: "5/6", titel: "Teilbarkeit", niveaus: { R: "Teilbarkeitsregeln 2, 3", H: "Teilbarkeitsregeln 2, 3" } },
        { id: "n3", block: "7/8", titel: "Rationale Zahlen", niveaus: { R: "rationale Zahlen ordnen" } },
        { id: "n4", block: "5/6", titel: "Zufall", niveaus: { R: "Zufallsexperimente" } },
      ] },
    ],
    abgleich: [
      { id: "p1", alt: ["a1"], neu: ["n1"], status: "geändert", unterschied: "9 und 100 entfallen" },
      { id: "p2", alt: ["a2"], neu: [], status: "entfallen" },
      { id: "p3", alt: ["a3"], neu: ["n3"], status: "verschoben", von: "5/6", nach: "7/8" },
      { id: "p4", alt: [], neu: ["n4"], status: "neu" },
    ],
    curriculum: { stand: "2025-09", klassen: [
      { klasse: 5, wochen_verfuegbar: 36, themen: [
        { id: "k5-t1", titel: "Natürliche Zahlen", wochen: 4.5, inhalte: {}, karten: ["a1", "a2"] },
        { id: "k5-t2", titel: "Ganze Zahlen", wochen: 2, inhalte: {}, karten: ["a3"] },
      ] },
    ] },
  };
}

describe("themaSicht", () => {
  it("holt die neuen Partner der alten Karten und meldet Konflikte", () => {
    const v = vorlage(); const i = index(v);
    const s = themaSicht(i, v.curriculum.klassen[0].themen[0], 5);
    expect(s.alt.map(k => k.id)).toEqual(["a1", "a2"]);
    expect(s.neu.map(n => [n.karte.id, n.woanders])).toEqual([["n1", false]]);
    expect(s.konflikte).toHaveLength(1);
    expect(s.konflikte[0]).toContain("entfällt");
  });

  it("markiert eine Karte, die neu in einem anderen Block liegt", () => {
    const v = vorlage(); const i = index(v);
    const s = themaSicht(i, v.curriculum.klassen[0].themen[1], 5);
    expect(s.neu[0]).toMatchObject({ woanders: true });
    expect(s.konflikte[0]).toContain("7/8");
  });
});

describe("offene und freie Karten", () => {
  it("zeigt je Block die neuen Karten ohne Thema, verschobene im Zielblock", () => {
    const v = vorlage(); const i = index(v);
    expect(offeneKarten(v, i, "5/6").map(o => o.karte.id)).toEqual(["n4"]);
    // n3 deckt nur ein 5/6-Thema ab (woanders) → in 7/8 noch offen
    expect(offeneKarten(v, i, "7/8").map(o => o.karte.id)).toEqual(["n3"]);
  });

  it("findet alte Karten ohne Thema", () => {
    expect(freieAlteKarten(vorlage(), "5/6").map(k => k.id)).toEqual(["a4"]);
  });

  it("leitet Status ohne Paar ab", () => {
    const v = vorlage(); v.abgleich = []; const i = index(v);
    expect(statusVon(i, "a1")).toBe("entfallen");
    expect(statusVon(i, "n1")).toBe("neu");
  });
});

describe("Hilfen", () => {
  it("summiert Wochen und vergibt freie Thema-ids", () => {
    const v = vorlage();
    expect(wochenSumme(v.curriculum.klassen[0])).toBe(6.5);
    expect(neueId(v, 5)).toBe("k5-t3");
  });

  it("wortDiff markiert Weggefallenes und Neues", () => {
    const d = wortDiff("Teilbarkeitsregeln 2, 3, 9, 100", "Teilbarkeitsregeln 2, 3, 5");
    expect(d.filter(t => t.art === "weg").map(t => t.text).join("")).toContain("100");
    expect(d.filter(t => t.art === "dazu").map(t => t.text).join("")).toContain("5");
    expect(d.filter(t => t.art !== "weg").map(t => t.text).join("")).toBe("Teilbarkeitsregeln 2, 3, 5");
  });
});

describe("Hochladen und KI", () => {
  it("liest JSON aus einer Chat-Antwort", () => {
    expect(antwortLesen("Hier:\n```json\n{\"a\": 1}\n```\nViel Erfolg")).toEqual({ a: 1 });
    expect(antwortLesen("bitte { \"b\": [2] } danke")).toEqual({ b: [2] });
  });

  it("macht aus einer Zuordnung Thema-Änderungen ohne Doppelte", () => {
    const { ops, text } = importOps({ zuordnung: [{ thema: "k5-t1", karten: ["a1", "n4"] }, { thema: "gibtsnicht", karten: ["x"] }] }, vorlage());
    expect(ops).toHaveLength(1);
    expect((ops[0].thema as any).karten).toEqual(["a1", "a2", "n4"]);
    expect(text).toContain("1 weitere");
  });

  it("lehnt JSON ohne bekannte Teile ab", () => {
    expect(() => importOps({ foo: 1 }, vorlage())).toThrow();
  });

  it("Vergleichs-Prompt nennt die Hauptschul-Regeln und schickt alte Karten mit", () => {
    const p = vergleichPrompt(vorlage(), { schulart: "RS", altId: "alt", neuId: "neu", alteKartenMit: true });
    expect(p).toContain("Anspruchsebene I");
    expect(p).toContain("\"a1\"");
  });
});

describe("woandersAls", () => {
  it("unterscheidet in 9/10 die Klassenstufe, in Doppeljahrgängen nur den Block", () => {
    expect(woandersAls({ id: "x", block: "9/10", klasse: 10, niveaus: {} }, 9)).toBe("Kl. 10");
    expect(woandersAls({ id: "x", block: "9/10", klasse: 9, niveaus: {} }, 9)).toBeNull();
    expect(woandersAls({ id: "x", block: "5/6", klasse: 6, niveaus: {} }, 5)).toBeNull();
    expect(woandersAls({ id: "x", block: "7/8", klasse: 8, niveaus: {} }, 6)).toBe("Kl. 7/8");
  });
});
