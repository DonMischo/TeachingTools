import { beforeEach, describe, expect, it } from "vitest";
import { haeufigkeiten, kenngroessen, median, modalwerte, quartile, urlisteAus } from "@/lib/stochastik/kenngroessen";
import { bruch, bt, leseAnteil, plus, mal, zufall, wert } from "@/lib/stochastik/zahlen";
import { ausgaenge, baum, blaetter, pEreignis, simuliere, verlauf } from "@/lib/stochastik/zufall";
import { ausBaum, ergaenze, unabhaengig, voll, zuBaumA, zuBaumB, FELDER } from "@/lib/stochastik/vierfelder";
import { anzahl, aufzaehlen, augensumme, erwartungswert, istFair } from "@/lib/stochastik/kombinatorik";
import { ausUmfrage, ausErhebung, alleZahlen } from "@/lib/stochastik/umfrage";
import { ERZEUGER, UEB_LEKTIONEN, erzeuge, stimmt, type Stufe } from "@/lib/stochastik/aufgaben";
import { blitzRunde, diagrammRunde, schaetzRunde, schaetzPunkte, baumRunde, astWert, tafelRunde } from "@/lib/stochastik/spiele";
import { ERFOLGE, SPEICHER, lade, melde, sauber } from "@/lib/stochastik/erfolge";
import { LEKTIONEN, lage } from "@/lib/stochastik/lektionen";
import kurric from "../../public/curriculum/mathematik_thueringen.json";

describe("Kenngrößen", () => {
  it("rechnet Median, Modalwert, Mittel, Spannweite", () => {
    const k = kenngroessen([3, 7, 1, 7, 2]);
    expect(k).toMatchObject({ min: 1, max: 7, spannweite: 6, median: 3, mittel: 4, modal: [7] });
    expect(median([4, 1, 3, 2])).toBe(2.5);
    expect(modalwerte([1, 1, 2, 2, 3])).toEqual([1, 2]);
  });
  it("Quartile nach Schulbuch: Median gehört bei ungerader Anzahl zu keiner Hälfte", () => {
    expect(quartile([1, 2, 3, 4, 5, 6, 7])).toEqual({ q1: 2, q3: 6 });
    expect(quartile([1, 2, 3, 4, 5, 6, 7, 8])).toEqual({ q1: 2.5, q3: 6.5 });
  });
  it("Häufigkeitstabelle in fester Reihenfolge, auch mit Nullen", () => {
    expect(haeufigkeiten(["a", "b", "a"], ["b", "a", "c"])).toEqual([{ wert: "b", anzahl: 1 }, { wert: "a", anzahl: 2 }, { wert: "c", anzahl: 0 }]);
    expect(urlisteAus({ "3": 2, "1": 1 })).toEqual([1, 3, 3]);
  });
});

describe("Brüche und Eingaben", () => {
  it("kürzt und rechnet", () => {
    expect(bt(plus(bruch(1, 6), bruch(1, 3)))).toBe("1/2");
    expect(bt(mal(bruch(2, 3), bruch(3, 4)))).toBe("1/2");
  });
  it("liest Bruch, Komma und Prozent", () => {
    expect(leseAnteil("3/8")).toBe(0.375);
    expect(leseAnteil("0,375")).toBe(0.375);
    expect(leseAnteil("37,5 %")).toBeCloseTo(0.375);
    expect(leseAnteil("Quatsch")).toBeNull();
  });
});

describe("Zufallsexperimente und Baum", () => {
  it("Urne ohne Zurücklegen: zweite Stufe hat eine Kugel weniger", () => {
    const e = { art: "urne" as const, kugeln: { rot: 3, blau: 2 }, zuruecklegen: false };
    expect(ausgaenge(e, ["rot"]).map(a => bt(a.p))).toEqual(["1/2", "1/2"]);
    const b = baum(e, 2);
    expect(bt(pEreignis(b, p => p.every(x => x === "rot")))).toBe("3/10");
    expect(wert(pEreignis(b, () => true))).toBe(1);
  });
  it("Würfel zweimal: 36 Pfade, Summe 1", () => {
    const b = baum({ art: "wuerfel", seiten: 6 }, 2);
    expect(blaetter(b)).toHaveLength(36);
  });
  it("Glücksrad fasst gleich benannte Felder zusammen", () => {
    const a = ausgaenge({ art: "rad", felder: [{ label: "rot", farbe: "rot", anteil: 1 }, { label: "blau", farbe: "blau", anteil: 2 }, { label: "rot", farbe: "rot", anteil: 1 }] });
    expect(a.map(x => [x.label, bt(x.p)])).toEqual([["rot", "1/2"], ["blau", "1/2"]]);
  });
  it("Simulation nähert sich der Wahrscheinlichkeit (Gesetz der großen Zahlen)", () => {
    const l = simuliere({ art: "wuerfel", seiten: 6 }, 1, 20000, zufall(7));
    const v = verlauf(l.map(x => x[0] === "6"));
    expect(Math.abs(v[v.length - 1].h - 1 / 6)).toBeLessThan(0.01);
    expect(v[v.length - 1].n).toBe(20000);
  });
});

describe("Vierfeldertafel", () => {
  const t = { ab: 12, aNb: 18, nAb: 28, nAnB: 42 };
  it("Randsummen, Baum in beide Richtungen, Unabhängigkeit", () => {
    expect(voll(t)).toMatchObject({ a: 30, b: 40, ges: 100 });
    expect(zuBaumA(t)).toEqual({ p1: 0.3, p2: 0.4, p2n: 0.4 });
    expect(zuBaumB(t).p2).toBeCloseTo(0.3);
    expect(unabhaengig(t)).toBe(true);
    expect(unabhaengig({ ...t, ab: 13 })).toBe(false);
    const z = ausBaum(0.3, 0.4, 0.4);
    expect(z.ab).toBeCloseTo(0.12);
  });
  it("füllt Lücken aus vier passenden Feldern", () => {
    const w = ergaenze({ ab: 12, a: 30, b: 40, ges: 100 });
    expect(FELDER.map(k => w[k])).toEqual([12, 18, 30, 28, 42, 70, 40, 60, 100]);
  });
});

describe("Kombinatorik und Zufallsgrößen", () => {
  it("drei Abzählprinzipien", () => {
    expect(anzahl(10, 4, "mitZ")).toBe(10000);
    expect(anzahl(8, 3, "ohneZ")).toBe(336);
    expect(anzahl(10, 3, "griff")).toBe(120);
    expect(aufzaehlen(["a", "b", "c"], 2, "griff")).toHaveLength(3);
    expect(aufzaehlen(["a", "b", "c"], 2, "ohneZ")).toHaveLength(6);
    expect(aufzaehlen(["a", "b"], 2, "mitZ")).toHaveLength(4);
  });
  it("Erwartungswert der Augensumme ist 7", () => {
    expect(bt(erwartungswert(augensumme()))).toBe("7");
    expect(istFair([{ x: 1, p: bruch(1, 2) }, { x: -1, p: bruch(1, 2) }])).toBe(true);
  });
});

describe("Umfrage übernehmen", () => {
  it("public-results: Indizes werden zu Antworten, Freitext fällt weg, Zahlen werden Urliste", () => {
    const d = ausUmfrage({ questions: [
      { kind: "choice", text: "Lieblingsfach?", options: ["Mathe", "Kunst"], distribution: { "0": 3, "1": 2 } },
      { kind: "text", text: "Was noch?", distribution: {} },
      { kind: "number", text: "Geschwister?", distribution: { "0": 2, "2": 1 } },
    ] });
    expect(d).toHaveLength(2);
    expect(d[0].zeilen).toEqual([{ wert: "Mathe", anzahl: 3 }, { wert: "Kunst", anzahl: 2 }]);
    expect(d[1]).toMatchObject({ art: "zahl", zahlen: [0, 0, 2] });
  });
  it("export der Lehrkraft: Schlüssel sind Antworttexte, Freitext wird nie übernommen", () => {
    const d = ausUmfrage({ format: "hauspokal-umfrage-ergebnisse", questions: [
      { kind: "choice", text: "Weg?", options: ["Bus", "Rad"], distribution: { Bus: 4, Rad: 1 } },
      { kind: "text", text: "Kommentar", answers: ["geheim"] },
    ] });
    expect(d).toHaveLength(1);
    expect(JSON.stringify(d)).not.toContain("geheim");
  });
  it("eigene Erhebung mit Zahlantworten gibt eine Urliste", () => {
    expect(alleZahlen(["1", "2,5"])).toBe(true);
    expect(ausErhebung({ frage: "?", optionen: ["1", "3"], striche: [2, 1], zahlen: true }).zahlen).toEqual([1, 1, 3]);
  });
});

describe("Übungen", () => {
  it("jeder Erzeuger liefert lösbare Aufgaben, deren Lösung als richtig erkannt wird", () => {
    const r = zufall(42);
    for (const l of UEB_LEKTIONEN) for (const s of [1, 2, 3] as Stufe[]) for (let i = 0; i < 15; i++) {
      const a = erzeuge(l, s, r);
      expect(a.felder.length, l).toBeGreaterThan(0);
      expect(a.weg.length, l).toBeGreaterThan(0);
      for (const f of a.felder) {
        const loesung = f.art === "wahl" ? String(f.richtig) : String(f.wert).replace(".", ",");
        expect(stimmt(f, loesung), `${l}/${s}/${f.label}: ${loesung}`).toBe(true);
        if (f.art === "zahl" && f.wert !== null) expect(Number.isFinite(f.wert), `${l} ${f.label}`).toBe(true);
      }
    }
    expect(Object.keys(ERZEUGER)).toHaveLength(LEKTIONEN.length);
  });
  it("Wahrscheinlichkeiten als Bruch oder Prozent", () => {
    const f = { key: "p", label: "P", art: "zahl" as const, wert: 0.375, tol: 0.0005, anteil: true };
    expect(stimmt(f, "3/8")).toBe(true);
    expect(stimmt(f, "37,5 %")).toBe(true);
    expect(stimmt(f, "0,4")).toBe(false);
  });
});

describe("Spiele", () => {
  it("Runden sind stimmig", () => {
    const r = zufall(3);
    for (let i = 0; i < 50; i++) {
      const b = blitzRunde(r);
      expect(new Set(b.optionen).size).toBe(4);
      const d = diagrammRunde(r, true);
      expect(d.optionen).not.toContain("boxplot");
      const s = schaetzRunde(r);
      const sim = simuliere(s.experiment, s.stufen, 4000, r).filter(s.treffer).length / 4000;
      expect(Math.abs(sim - wert(s.p)), s.text).toBeLessThan(0.05);
      const br = baumRunde(r);
      expect(astWert(br, "A") + astWert(br, "nA")).toBeCloseTo(1);
      const tr = tafelRunde(r, i % 2 === 0);
      expect(tr.bekannt).toHaveLength(4);
    }
    expect(schaetzPunkte(0.5, 0.5)).toBe(100);
    expect(schaetzPunkte(0.8, 0.5)).toBe(0);
  });
});

describe("Erfolge", () => {
  beforeEach(() => localStorage.removeItem(SPEICHER));
  it("melde speichert und nennt neue Erfolge", () => {
    const neu = melde(s => ({ ...s, geloest: { erfassen: 1 } }));
    expect(neu.map(e => e.id)).toContain("erste-aufgabe");
    expect(lade().geloest.erfassen).toBe(1);
    expect(melde(s => s).length).toBe(0);
  });
  it("kaputter Stand wird aufgefüllt", () => {
    expect(sauber({ versuche: "x", besucht: [1, "baum"] })).toMatchObject({ versuche: 0, besucht: ["baum"] });
    expect(new Set(ERFOLGE.map(e => e.id)).size).toBe(ERFOLGE.length);
  });
});

describe("Lektionen und Lehrplan", () => {
  it("jede Lektion verweist auf vorhandene Stochastik-Karten von m2026, jede Karte ist abgedeckt", () => {
    const m = (kurric as { lehrplaene: { id: string; karten: { id: string; bereich: string }[] }[] }).lehrplaene.find(l => l.id === "m2026")!;
    const st = m.karten.filter(k => k.bereich === "Stochastik").map(k => k.id);
    const genutzt = new Set(LEKTIONEN.flatMap(l => l.karten));
    for (const id of genutzt) expect(st, id).toContain(id);
    for (const id of st) expect(genutzt.has(id), id).toBe(true);
  });
  it("Lage zur gewählten Stufe", () => {
    const venn = LEKTIONEN.find(l => l.id === "venn")!;
    expect(lage(venn, "7/8", "H")).toBe("anderes");
    expect(lage(venn, "9/10", "G")).toBe("frueher");
    expect(lage(venn, "5/6", null)).toBe("spaeter");
  });
});
