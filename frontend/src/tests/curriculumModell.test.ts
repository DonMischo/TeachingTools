import { describe, it, expect } from "vitest";
import {
  bereicheVon, einheitenAusLehrplan, entfernen, gleichWie, mitEinheiten, neuVerteilen, schulartenVon, umkehrOps, nachBereich, nurLeereEinheiten, woandersAls, freieAlteKarten, index, karteText, loesen, neueId, offeneKarten, statusVon, themaSicht, wochenSumme,
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

  it("schlägt keine Karte vor, die schon in einer anderen Klasse zugeordnet ist", () => {
    const v = vorlage();
    v.curriculum.klassen.push({ klasse: 6, wochen_verfuegbar: 36, themen: [
      { id: "k6-t1", titel: "Teiler", wochen: 2, inhalte: {}, karten: [], zuordnung: { H: ["n1"] } },
    ] });
    const i = index(v);
    expect(themaSicht(i, v.curriculum.klassen[0].themen[0], 5).vorschlaege).toEqual([]);
    expect(offeneKarten(v, i, "5/6").map(o => o.karte.id)).not.toContain("n1");
  });

  it("legt die Vorschläge einer eingeklappten Klasse zurück in die Kartenbank", () => {
    const v = vorlage(); const i = index(v);
    expect(offeneKarten(v, i, "5/6").map(o => o.karte.id)).not.toContain("n1");
    expect(offeneKarten(v, i, "5/6", new Set([5])).map(o => o.karte.id)).toContain("n1");
  });
});

describe("zuordnen", () => {
  it("nur was obendrauf kommt: gleicher R-Text bleibt bei H, GY-Karte in G", () => {
    const v = vorlage(); const i = index(v);
    let t = v.curriculum.klassen[0].themen[0];
    t = zuordnen(i, t, "n1", 5).thema;   // R und H wortgleich → nur H
    t = zuordnen(i, t, "g1", 5).thema;   // reine GY-Karte → G
    expect(t.zuordnung).toEqual({ H: ["n1"], G: ["g1"] });
  });

  it("verschiedene R- und H-Texte landen in beiden", () => {
    const v = vorlage();
    v.lehrplaene[1].karten[0].niveaus = { H: "Teilbarkeit durch 2", R: "Teilbarkeit durch 2, 3, 5" };
    const t = zuordnen(index(v), v.curriculum.klassen[0].themen[0], "n1", 5).thema;
    expect(t.zuordnung).toEqual({ H: ["n1"], R: ["n1"] });
  });

  it("kopiert R nach H, wenn die Karte keinen H-Text hat — R kommt dann nicht dazu", () => {
    const v = vorlage(); const i = index(v);
    const r = zuordnen(i, v.curriculum.klassen[0].themen[0], "n4", 5);
    expect(r.thema.zuordnung).toEqual({ H: ["n4"] });
    expect(r.karte).toEqual({ lehrplan: "neu", karte: expect.objectContaining({ id: "n4", niveaus: { R: "Zufallsexperimente", H: "Zufallsexperimente" } }) });
  });

  it("zusammengeführte Karte: H Basis, R und G nur mit Zusatz, keine H-Kopie", () => {
    const v = vorlage();
    v.lehrplaene.push({ id: "m", rolle: "neu", schulart: "RS+GY", karten: [
      { id: "m1", block: "5/6", niveaus: { H: "Brüche addieren", R: "auch ungleichnamige", G: "auch Doppelbrüche" }, voll: { H: "a", R: "b", G: "c" } },
      { id: "m2", block: "5/6", niveaus: { H: "Daten erfassen" }, voll: { H: "Daten erfassen", R: "Daten erfassen", G: "Daten erfassen" } },
      { id: "m3", block: "5/6", niveaus: { R: "Quartile" }, voll: { R: "Quartile" } },
    ] });
    const i = index(v);
    const leer = { id: "x", titel: "", wochen: null, inhalte: {}, karten: [] };
    expect(zuordnen(i, leer, "m1", 5).thema.zuordnung).toEqual({ H: ["m1"], R: ["m1"], G: ["m1"] });
    expect(zuordnen(i, leer, "m2", 5).thema.zuordnung).toEqual({ H: ["m2"] });
    const m3 = zuordnen(i, leer, "m3", 5);
    expect(m3.thema.zuordnung).toEqual({ R: ["m3"] });
    expect(m3.karte).toBeUndefined();
    expect([...schulartenVon(i.karten.get("m1")!)].sort()).toEqual(["GY", "RS"]);
    expect([...schulartenVon(i.karten.get("m3")!)]).toEqual(["RS"]);
  });

  it("legt in Klasse 10 kein Hauptschulniveau an", () => {
    const v = vorlage(); const i = index(v);
    const r = zuordnen(i, { id: "x", titel: "", wochen: null, inhalte: {}, karten: [] }, "n4", 10);
    expect(r.thema.zuordnung).toEqual({ R: ["n4"] });
    expect(r.karte).toBeUndefined();
  });

  it("alte Karten nach oben; lösen und ganz entfernen (Strg+X)", () => {
    const v = vorlage(); const i = index(v);
    let t = zuordnen(i, v.curriculum.klassen[0].themen[1], "g1", 5).thema;
    t = zuordnen(i, t, "a4", 5).thema;
    expect(t.karten).toEqual(["a3", "a4"]);
    expect(loesen(t, "g1", "G").zuordnung).toEqual({ G: [] });
    expect(loesen(t, "a4").karten).toEqual(["a3"]);
    const weg = entfernen(entfernen(t, "g1"), "a3");
    expect(weg.zuordnung).toEqual({ G: [] });
    expect(weg.karten).toEqual(["a4"]);
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
    expect((ops[1].thema as any).zuordnung).toEqual({ H: ["n4"] });
    expect(text).toBe("1 Unterrichtseinheiten bekommen zusammen 2 weitere Karten.");
  });

  it("lehnt JSON ohne bekannte Teile ab", () => {
    const v = vorlage();
    expect(() => importOps({ foo: 1 }, v, index(v))).toThrow();
  });

  it("Vergleichs-Prompt: Hauptschul-Regeln, erfasster alter Plan bleibt draußen", () => {
    const p = vergleichPrompt(vorlage(), { schularten: ["RS"], mitAlt: true, alteKartenMit: true });
    expect(p).toContain("Anspruchsebene I");
    expect(p).toContain("\"a1\"");
    expect(p).toContain("Im Anhang (PDF): RS neu.");
    // der alte Plan steht nicht im Aufbau — sonst würde ihn der Upload mit leeren Karten ersetzen
    expect(p).not.toContain("\"rolle\": \"alt\"");
    expect(p).toContain("\"abgleich\"");
  });

  it("Prompt für beide Schularten ohne alten Plan: nur neue Pläne, kein Abgleich", () => {
    const v = vorlage();
    v.fach = "Physik";
    v.lehrplaene = v.lehrplaene.filter(l => l.rolle === "neu");
    const p = vergleichPrompt(v, { schularten: ["RS", "GY"], mitAlt: false, alteKartenMit: true });
    expect(p).toContain("Im Anhang (PDF): RS neu, GY neu.");
    expect(p).toContain("\"id\": \"neu\", \"rolle\": \"neu\", \"schulart\": \"RS\"");
    expect(p).toContain("\"id\": \"gyneu\", \"rolle\": \"neu\", \"schulart\": \"GY\"");
    expect(p).toContain("\"fach\": \"Physik\"");
    expect(p).not.toContain("abgleich");
    expect(p).toContain("Gymnasium: nur");
    expect(p).toContain("Anspruchsebene I");
  });

  it("Prompt für eine neue Schulart vergibt eine id", () => {
    const v = vorlage();
    v.lehrplaene = [];
    const p = vergleichPrompt(v, { schularten: ["GY"], mitAlt: true, alteKartenMit: true });
    expect(p).toContain("Im Anhang (PDF): GY alt, GY neu.");
    expect(p).toContain("\"id\": \"gy_alt\"");
    expect(p).not.toContain("Anspruchsebene");
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
    expect(t.zuordnung).toEqual({ H: ["n1"] });
  });
});

describe("Bereiche", () => {
  it("listet Bereiche in Lehrplan-Reihenfolge und gruppiert danach", () => {
    const v = vorlage();
    v.lehrplaene[0].karten[0].bereich = "Optik";
    v.lehrplaene[1].karten[0].bereich = "Mechanik";
    v.lehrplaene[1].karten[1].bereich = "Optik";
    expect(bereicheVon(v)).toEqual(["Optik", "ohne Bereich", "Mechanik"]);
    const g = nachBereich(v.lehrplaene[1].karten, k => k, bereicheVon(v));
    expect(g.map(x => [x.bereich, x.eintraege.map(k => k.id)])).toEqual([
      ["Optik", ["n3"]], ["ohne Bereich", ["n4"]], ["Mechanik", ["n1"]],
    ]);
  });
});

describe("einheitenAusLehrplan", () => {
  function physik(): Vorlage {
    return {
      format: "tt-curriculum/1", fach: "Physik", niveaus: ["G", "R", "H", "LB", "GE"], bloecke: ["7/8", "9/10"],
      lehrplaene: [
        { id: "rs", rolle: "neu", schulart: "RS", karten: [
          { id: "r1", block: "7/8", klasse: 8, lernbereich: "Wärmelehre", niveaus: { R: "Temperatur messen" } },
          { id: "r2", block: "9/10", klasse: 9, lernbereich: "Elektrizitätslehre", niveaus: { R: "Ohm", H: "Ohm einfach" } },
          { id: "r3", block: "9/10", klasse: 10, lernbereich: "Das Universum – Galaxien", niveaus: { R: "Galaxien" } },
        ] },
        { id: "gy", rolle: "neu", schulart: "GY", karten: [
          { id: "g1", block: "7/8", klasse: 8, lernbereich: "Wärmelehre", niveaus: { G: "Wärme" } },
          { id: "g2", block: "7/8", klasse: 8, lernbereich: "Elektrizitätslehre", niveaus: { G: "Stromkreis" } },
        ] },
      ],
      abgleich: [],
      curriculum: { stand: "", klassen: [{ klasse: 7, wochen_verfuegbar: 36, themen: [] }, { klasse: 8, wochen_verfuegbar: 36, themen: [] }] },
    };
  }

  it("legt je Lernbereich eine leere Einheit an, 7/8 in beide Klassen, 9/10 nach Klasse", () => {
    const v = physik();
    const r = einheitenAusLehrplan(v);
    expect(r.map(a => [a.klasse, a.thema.titel])).toEqual([
      [7, "Wärmelehre"], [7, "Elektrizitätslehre"],
      [8, "Wärmelehre"], [8, "Elektrizitätslehre"],
      [9, "Elektrizitätslehre"], [10, "Das Universum"],
    ]);
    // Karten bleiben im Deck
    expect(r.every(a => a.thema.karten.length === 0 && !a.thema.zuordnung)).toBe(true);
    expect(new Set(r.map(a => a.thema.id)).size).toBe(6);
  });

  it("legt keine zweite Einheit gleichen Namens an — erneutes Anlegen ergänzt nur", () => {
    const v = physik();
    v.curriculum.klassen[0].themen = [{ id: "k7-t1", titel: "wärmelehre ", wochen: 3, inhalte: {}, karten: [] }];
    const r = einheitenAusLehrplan(v);
    expect(r.map(a => [a.klasse, a.thema.titel])).not.toContainEqual([7, "Wärmelehre"]);
    expect(r.find(a => a.klasse === 7)!.thema.id).toBe("k7-t2");
    for (const a of r) {
      const kl = v.curriculum.klassen.find(k => k.klasse === a.klasse);
      if (kl) kl.themen.push(a.thema); else v.curriculum.klassen.push({ klasse: a.klasse, wochen_verfuegbar: 36, themen: [a.thema] });
    }
    expect(einheitenAusLehrplan(v)).toEqual([]);
  });
});

describe("mitEinheiten (neuer Plan)", () => {
  const lehrplaene = [{ id: "rs", rolle: "neu" as const, schulart: "RS", karten: [
    { id: "r1", block: "7/8" as const, klasse: 8, lernbereich: "Optik", niveaus: { R: "Licht" } },
    { id: "r2", block: "9/10" as const, klasse: 10, lernbereich: "Kernphysik", niveaus: { R: "Zerfall" } },
  ] }];

  it("legt Einheiten an, wenn die Vorlage kein Curriculum mitbringt — Karten bleiben im Deck", () => {
    const d = mitEinheiten({ format: "tt-curriculum/1", bloecke: ["7/8", "9/10"], lehrplaene }, "Physik");
    expect(d.curriculum!.klassen.map(k => [k.klasse, k.themen.map(t => t.titel)])).toEqual([
      [7, ["Optik"]], [8, ["Optik"]], [10, ["Kernphysik"]],
    ]);
    expect(d.curriculum!.klassen.every(k => k.themen.every(t => !t.zuordnung && t.karten.length === 0))).toBe(true);
    expect(d.lehrplaene).toBe(lehrplaene);
  });

  it("behält leere Klassen mit ihren Wochen und lässt ein mitgebrachtes Curriculum in Ruhe", () => {
    const leer = mitEinheiten({ bloecke: ["7/8"], lehrplaene, curriculum: { stand: "", klassen: [{ klasse: 7, wochen_verfuegbar: 30, themen: [] }] } }, "Physik");
    expect(leer.curriculum!.klassen[0]).toMatchObject({ klasse: 7, wochen_verfuegbar: 30 });
    const eigenes = { stand: "2025", klassen: [{ klasse: 7, wochen_verfuegbar: 36, themen: [{ id: "k7-t1", titel: "Eigen", wochen: 2, inhalte: {}, karten: [] }] }] };
    expect(mitEinheiten({ lehrplaene, curriculum: eigenes }, "Physik").curriculum).toBe(eigenes);
  });
});

describe("Hochladen mit Unterrichtseinheiten", () => {
  const neuerPlan = { id: "phy", rolle: "neu" as const, schulart: "RS", karten: [
    { id: "p1", block: "5/6" as const, klasse: 6, lernbereich: "Optik", niveaus: { R: "Licht" } },
  ] };

  it("Lehrplan ohne Curriculum: fehlende Einheiten kommen dazu, vorhandene bleiben", () => {
    const v = vorlage();
    const { ops, text } = importOps({ lehrplaene: [neuerPlan] }, v, index(v));
    expect(ops[0]).toEqual({ op: "import", daten: { lehrplaene: [neuerPlan] } });
    const neu = ops.slice(1).map(o => [o.klasse, (o.thema as any).titel]);
    expect(neu).toContainEqual([5, "Optik"]);
    expect(neu).toContainEqual([6, "Optik"]);
    expect(text).toContain("neue Unterrichtseinheiten");
  });

  it("leere Einheiten aus der Datei überschreiben kein Curriculum mit Inhalt", () => {
    const v = vorlage();
    const leer = { stand: "", klassen: [{ klasse: 5, wochen_verfuegbar: 36, themen: [{ id: "k5-t1", titel: "Optik", wochen: null, inhalte: {}, karten: [] }] }] };
    const { ops, text } = importOps({ lehrplaene: [neuerPlan], curriculum: leer }, v, index(v));
    expect((ops[0].daten as any).curriculum).toBeUndefined();
    expect(text).not.toContain("ersetzt das bisherige");
  });

  it("ein Curriculum mit Inhalt ersetzt das bisherige wie gehabt", () => {
    const v = vorlage();
    const eigenes = { stand: "2026", klassen: [{ klasse: 5, wochen_verfuegbar: 36, themen: [{ id: "k5-t1", titel: "Optik", wochen: 4, inhalte: {}, karten: [] }] }] };
    const { ops, text } = importOps({ curriculum: eigenes }, v, index(v));
    expect(ops).toEqual([{ op: "import", daten: { curriculum: eigenes } }]);
    expect(text).toContain("ersetzt das bisherige");
  });

  it("nurLeereEinheiten erkennt Inhalt, Karten, Wochen und Zuordnung", () => {
    const t = { id: "x", titel: "A", wochen: null, inhalte: {}, karten: [] };
    const c = (x: object) => ({ klassen: [{ klasse: 7, wochen_verfuegbar: 36, themen: [{ ...t, ...x }] }] });
    expect(nurLeereEinheiten(c({}))).toBe(true);
    expect(nurLeereEinheiten(c({ inhalte: { R: " " } }))).toBe(true);
    expect(nurLeereEinheiten(c({ inhalte: { R: "Licht" } }))).toBe(false);
    expect(nurLeereEinheiten(c({ wochen: 2 }))).toBe(false);
    expect(nurLeereEinheiten(c({ zuordnung: { G: ["g1"] } }))).toBe(false);
  });

  it("neuer Plan aus KI-Antwort mit leeren Einheiten: Einheiten kommen aus den Lernbereichen", () => {
    const d = mitEinheiten({ bloecke: ["5/6"], lehrplaene: [neuerPlan], curriculum: { stand: "", klassen: [
      { klasse: 5, wochen_verfuegbar: 36, themen: [{ id: "k5-t1", titel: "optik (KI)", wochen: null, inhalte: {}, karten: [] }] }] } }, "Physik");
    expect(d.curriculum!.klassen.map(k => [k.klasse, k.themen.map(t => t.titel)])).toEqual([[5, ["Optik"]], [6, ["Optik"]]]);
  });

  it("der Prompt verlangt ein curriculum mit leeren Einheiten", () => {
    const p = vergleichPrompt(vorlage(), { schularten: ["RS", "GY"], mitAlt: false, alteKartenMit: false });
    expect(p).toContain("\"curriculum\": { \"stand\": \"\", \"klassen\": [Klasse, …] }");
    expect(p).toContain("Je Lernbereich des NEUEN Lehrplans eine Einheit");
  });
});

describe("Strg+Z: umkehrOps", () => {
  it("stellt Einheiten, Karten und Wochen wieder her und löscht Neues", () => {
    const v = vorlage();
    const t1 = v.curriculum.klassen[0].themen[0];
    const neu = { id: "k5-t9", titel: "Neu", wochen: null, inhalte: {}, karten: [] };
    const karte = { ...v.lehrplaene[1].karten[2], niveaus: { R: "x", H: "x" } };
    const ops = [
      { op: "karte", lehrplan: "neu", karte },
      { op: "thema", klasse: 6, pos: 0, thema: { ...t1, titel: "verschoben" } },
      { op: "thema", klasse: 5, thema: neu },
      { op: "klasse", klasse: 5, wochen_verfuegbar: 20 },
    ];
    const z = umkehrOps(v, ops)!;
    expect(z).toContainEqual({ op: "karte", lehrplan: "neu", karte: v.lehrplaene[1].karten[2] });
    expect(z).toContainEqual({ op: "klasse", klasse: 5, wochen_verfuegbar: 36 });
    expect(z).toContainEqual({ op: "thema_loeschen", id: "k5-t9" });
    expect(z).toContainEqual({ op: "thema", klasse: 5, pos: 0, thema: t1 });
  });

  it("Hochladen lässt sich nicht umkehren", () => {
    expect(umkehrOps(vorlage(), [{ op: "import", daten: {} }])).toBeNull();
  });
});


describe("gleichWie (Hinweis »= wie H«)", () => {
  const k = (niveaus: object, voll?: object) => ({ id: "x", block: "7/8" as const, niveaus, voll } as any);
  it("R gleich H, G gleich R oder H", () => {
    expect(gleichWie(k({ H: "Brüche", R: "Brüche" }), "R")).toBe("H");
    expect(gleichWie(k({ H: "Brüche", R: "auch gemischte" }), "R")).toBeNull();
    // zusammengeführt: R und G ausgelassen, weil gleich
    expect(gleichWie(k({ H: "Brüche" }, { H: "a", R: "a", G: "a" }), "R")).toBe("H");
    expect(gleichWie(k({ H: "Brüche" }, { H: "a", R: "a", G: "a" }), "G")).toBe("H");
    expect(gleichWie(k({ H: "Brüche", R: "auch gemischte" }, { H: "a", R: "b", G: "b" }), "G")).toBe("R");
    expect(gleichWie(k({ H: "Brüche", G: "Doppelbrüche" }, { H: "a", G: "c" }), "G")).toBeNull();
  });
  it("kein Hinweis, wo die Karte nicht gilt", () => {
    expect(gleichWie(k({ H: "Ohm", R: "Ohm" }), "G")).toBeNull();      // Regelschul-Karte
    expect(gleichWie(k({ G: "Ohm" }), "R")).toBeNull();                 // Gymnasial-Karte
    expect(gleichWie(k({ R: "nur R" }), "R")).toBeNull();               // ohne H
  });
});

describe("neuVerteilen nach Kartenänderung", () => {
  const t = (zuordnung: object) => ({ id: "u", titel: "U", wochen: null, inhalte: {}, karten: [], zuordnung } as any);
  it("H vereinfacht, R bekommt den alten Text: Karte kommt zusätzlich in R", () => {
    const k = { id: "m1", block: "5/6" as const, niveaus: { H: "einfache Brüche", R: "Brüche addieren" } };
    expect(neuVerteilen(t({ H: ["m1"], LB: ["m1"] }), k, 5).zuordnung).toEqual({ H: ["m1"], R: ["m1"], LB: ["m1"] });
  });
  it("R wieder gleich H: Karte verlässt R; nicht eingeordnete Einheiten bleiben gleich", () => {
    const k = { id: "m1", block: "5/6" as const, niveaus: { H: "Brüche", R: "Brüche" } };
    expect(neuVerteilen(t({ H: ["m1"], R: ["m1", "x"] }), k, 5).zuordnung).toEqual({ H: ["m1"], R: ["x"] });
    const ohne = t({ H: ["x"] });
    expect(neuVerteilen(ohne, k, 5)).toBe(ohne);
  });
});
