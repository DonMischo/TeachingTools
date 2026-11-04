import { describe, it, expect } from "vitest";
import {
  woandersAls, freieAlteKarten, index, karteText, loesen, neueId, offeneKarten, statusVon, themaSicht, wochenSumme,
  wortDiff, zuordnen, type Vorlage,
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
      { id: "gyneu", rolle: "neu", schulart: "GY", karten: [
        { id: "g1", block: "5/6", titel: "Teilbarkeit GY", niveaus: { G: "Teilbarkeitsregeln 2, 3, 4, 5" } },
      ] },
    ],
    abgleich: [
      { id: "p1", alt: ["a1"], neu: ["n1"], status: "geändert", unterschied: "9 und 100 entfallen" },
      { id: "p2", alt: ["a2"], neu: [], status: "entfallen" },
      { id: "p3", alt: ["a3"], neu: ["n3"], status: "verschoben", von: "5/6", nach: "7/8" },
      { id: "p4", alt: [], neu: ["n4"], status: "neu" },
      { id: "p5", alt: [], neu: ["g1"], status: "neu" },
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
  it("schlägt die neuen Partner der alten Karten vor und meldet Entfallenes", () => {
    const v = vorlage(); const i = index(v);
    const s = themaSicht(i, v.curriculum.klassen[0].themen[0], 5);
    expect(s.alt.map(k => k.id)).toEqual(["a1", "a2"]);
    expect(s.vorschlaege.map(n => [n.karte.id, n.woanders])).toEqual([["n1", false]]);
    expect(s.konflikte).toHaveLength(1);
    expect(s.konflikte[0]).toContain("entfällt");
  });

  it("markiert einen Vorschlag, der neu in einem anderen Block liegt", () => {
    const v = vorlage(); const i = index(v);
    const s = themaSicht(i, v.curriculum.klassen[0].themen[1], 5);
    expect(s.vorschlaege[0]).toMatchObject({ woanders: true });
    expect(s.konflikte[0]).toContain("7/8");
  });

  it("zeigt Zugeordnetes je Niveau und nicht mehr als Vorschlag", () => {
    const v = vorlage(); const i = index(v);
    const t = { ...v.curriculum.klassen[0].themen[0], zuordnung: { R: ["n1"], H: ["n1"] } };
    const s = themaSicht(i, t, 5);
    expect(s.niveau.R?.map(k => k.id)).toEqual(["n1"]);
    expect(s.vorschlaege).toHaveLength(0);
  });
});

describe("zuordnen", () => {
  it("verteilt eine RS-Karte auf R und H, eine GY-Karte auf G", () => {
    const v = vorlage(); const i = index(v);
    let t = v.curriculum.klassen[0].themen[0];
    t = zuordnen(i, t, "n1", 5).thema;
    t = zuordnen(i, t, "g1", 5).thema;
    expect(t.zuordnung).toEqual({ R: ["n1"], H: ["n1"], G: ["g1"] });
  });

  it("kopiert R nach H, wenn die Karte keinen H-Text hat", () => {
    const v = vorlage(); const i = index(v);
    const r = zuordnen(i, v.curriculum.klassen[0].themen[0], "n4", 5);
    expect(r.thema.zuordnung).toEqual({ R: ["n4"], H: ["n4"] });
    expect(r.karte).toEqual({ lehrplan: "neu", karte: expect.objectContaining({ id: "n4", niveaus: { R: "Zufallsexperimente", H: "Zufallsexperimente" } }) });
  });

  it("legt in Klasse 10 kein Hauptschulniveau an", () => {
    const v = vorlage(); const i = index(v);
    const r = zuordnen(i, { id: "x", titel: "", wochen: null, inhalte: {}, karten: [] }, "n4", 10);
    expect(r.thema.zuordnung).toEqual({ R: ["n4"] });
    expect(r.karte).toBeUndefined();
  });

  it("auf eine Zeile gezogen nur dorthin; alte Karten nach oben; lösen", () => {
    const v = vorlage(); const i = index(v);
    let t = zuordnen(i, v.curriculum.klassen[0].themen[1], "g1", 5, "LB").thema;
    expect(t.zuordnung).toEqual({ LB: ["g1"] });
    t = zuordnen(i, t, "a4", 5).thema;
    expect(t.karten).toEqual(["a3", "a4"]);
    expect(loesen(t, "g1", "LB").zuordnung).toEqual({ LB: [] });
    expect(loesen(t, "a4").karten).toEqual(["a3"]);
  });

  it("Text je Niveau fällt auf das nächste Niveau zurück", () => {
    const k = { id: "k", block: "5/6" as const, niveaus: { R: "r-Text" } };
    expect(karteText(k, "H")).toBe("r-Text");
    expect(karteText(k, "LB")).toBe("r-Text");
    expect(karteText(k, "G")).toBeUndefined();
  });
});

describe("offene und freie Karten", () => {
  it("zeigt je Block die neuen Karten ohne Einheit, verschobene im Zielblock", () => {
    const v = vorlage(); const i = index(v);
    expect(offeneKarten(v, i, "5/6").map(o => o.karte.id)).toEqual(["n4", "g1"]);
    expect(offeneKarten(v, i, "7/8").map(o => o.karte.id)).toEqual(["n3"]);
  });

  it("zugeordnete Karten sind nicht mehr offen", () => {
    const v = vorlage();
    v.curriculum.klassen[0].themen[1].zuordnung = { G: ["g1"] };
    expect(offeneKarten(v, index(v), "5/6").map(o => o.karte.id)).toEqual(["n4"]);
  });

  it("findet alte Karten ohne Einheit", () => {
    expect(freieAlteKarten(vorlage(), "5/6").map(k => k.id)).toEqual(["a4"]);
  });

  it("leitet Status ohne Paar ab", () => {
    const v = vorlage(); v.abgleich = []; const i = index(v);
    expect(statusVon(i, "a1")).toBe("entfallen");
    expect(statusVon(i, "n1")).toBe("neu");
  });
});

describe("Hilfen", () => {
  it("summiert Wochen und vergibt freie ids", () => {
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

describe("woandersAls", () => {
  it("unterscheidet in 9/10 die Klassenstufe, in Doppeljahrgängen nur den Block", () => {
    expect(woandersAls({ id: "x", block: "9/10", klasse: 10, niveaus: {} }, 9)).toBe("Kl. 10");
    expect(woandersAls({ id: "x", block: "9/10", klasse: 9, niveaus: {} }, 9)).toBeNull();
    expect(woandersAls({ id: "x", block: "5/6", klasse: 6, niveaus: {} }, 5)).toBeNull();
    expect(woandersAls({ id: "x", block: "7/8", klasse: 8, niveaus: {} }, 6)).toBe("Kl. 7/8");
  });
});

describe("Hochladen und KI", () => {
  it("liest JSON aus einer Chat-Antwort", () => {
    expect(antwortLesen("Hier:\n```json\n{\"a\": 1}\n```\nViel Erfolg")).toEqual({ a: 1 });
    expect(antwortLesen("bitte { \"b\": [2] } danke")).toEqual({ b: [2] });
  });

  it("macht aus einer Zuordnung Änderungen: alte nach oben, neue je Niveau, H-Kopie", () => {
    const v = vorlage();
    const { ops, text } = importOps({ zuordnung: [{ thema: "k5-t1", karten: ["a1", "a4", "n4"] }, { thema: "gibtsnicht", karten: ["x"] }] }, v, index(v));
    expect(ops.map(o => o.op)).toEqual(["karte", "thema"]);
    expect((ops[1].thema as any).karten).toEqual(["a1", "a2", "a4"]);
    expect((ops[1].thema as any).zuordnung).toEqual({ R: ["n4"], H: ["n4"] });
    expect(text).toBe("1 Unterrichtseinheiten bekommen zusammen 2 weitere Karten.");
  });

  it("lehnt JSON ohne bekannte Teile ab", () => {
    const v = vorlage();
    expect(() => importOps({ foo: 1 }, v, index(v))).toThrow();
  });

  it("Vergleichs-Prompt nennt die Hauptschul-Regeln und schickt alte Karten mit", () => {
    const p = vergleichPrompt(vorlage(), { schulart: "RS", altId: "alt", neuId: "neu", alteKartenMit: true });
    expect(p).toContain("Anspruchsebene I");
    expect(p).toContain("\"a1\"");
  });
});

describe("nur neue Karten (ohne alten Plan und Abgleich)", () => {
  it("zeigt alles als offen, ohne Vorschläge und Konflikte", () => {
    const v = vorlage();
    v.lehrplaene = v.lehrplaene.filter(l => l.rolle === "neu");
    v.abgleich = [];
    const i = index(v);
    const s = themaSicht(i, v.curriculum.klassen[0].themen[0], 5);
    expect(s.alt).toEqual([]);
    expect(s.vorschlaege).toEqual([]);
    expect(s.konflikte).toEqual([]);
    expect(offeneKarten(v, i, "5/6").map(o => o.karte.id)).toEqual(["n1", "n4", "g1"]);
    expect(statusVon(i, "n1")).toBe("neu");
    const t = zuordnen(i, v.curriculum.klassen[0].themen[0], "n1", 5).thema;
    expect(t.zuordnung).toEqual({ R: ["n1"], H: ["n1"] });
  });
});
