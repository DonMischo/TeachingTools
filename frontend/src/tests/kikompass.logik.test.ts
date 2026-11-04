import { describe, it, expect } from "vitest";
import {
  BEREICHE, GUELTIGE_SATZ_IDS, KANN_SAETZE, STUFEN, bereichsWert, erreichteStufe, mittelwerte, saetze, werte,
} from "@/lib/kikompass/raster";
import {
  MODUL_REIHENFOLGE, REFLEXION_MIN, STATIONEN, fuehrerscheinFertig, modulFertig, quizBestanden, stationFertig,
  stationenVon,
} from "@/lib/kikompass/stationen";

const ids = (bereich: (typeof BEREICHE)[number]["id"], stufe: (typeof STUFEN)[number]["id"]) =>
  saetze(bereich, stufe).map(k => k.id);

describe("Raster", () => {
  it("hat in jeder Zelle mindestens zwei Sätze", () => {
    for (const b of BEREICHE) for (const s of STUFEN) expect(saetze(b.id, s.id).length).toBeGreaterThanOrEqual(2);
  });

  it("vergibt eindeutige Ids", () => {
    expect(GUELTIGE_SATZ_IDS.size).toBe(KANN_SAETZE.length);
  });

  it("wertet ohne Häkchen als 0", () => {
    expect(bereichsWert("verstehen", [])).toBe(0);
    expect(erreichteStufe("verstehen", [])).toBeNull();
  });

  it("zählt eine Stufe ab zwei Dritteln als erreicht", () => {
    const zwei = ids("verstehen", "0").slice(0, 2);
    expect(bereichsWert("verstehen", zwei)).toBeCloseTo(1);
    expect(erreichteStufe("verstehen", zwei)?.id).toBe("0");
  });

  it("zählt die nächste Stufe anteilig", () => {
    const h = [...ids("anwenden", "0"), ids("anwenden", "Ia")[0]];
    const w = bereichsWert("anwenden", h);
    expect(w).toBeGreaterThan(1);
    expect(w).toBeLessThan(2);
  });

  it("überspringt keine Stufe: Häkchen auf II zählen nicht ohne Basis", () => {
    expect(bereichsWert("reflektieren", ids("reflektieren", "II"))).toBe(0);
  });

  it("erreicht 5 mit allen Häkchen", () => {
    const alle = KANN_SAETZE.map(k => k.id);
    for (const b of BEREICHE) expect(werte(alle)[b.id]).toBe(5);
  });

  it("mittelt mehrere Spinnen", () => {
    const m = mittelwerte([
      { verstehen: 1, anwenden: 2, reflektieren: 0, mitgestalten: 4 },
      { verstehen: 3, anwenden: 2, reflektieren: 1, mitgestalten: 0 },
    ]);
    expect(m).toEqual({ verstehen: 2, anwenden: 2, reflektieren: 0.5, mitgestalten: 2 });
    expect(mittelwerte([]).verstehen).toBe(0);
  });
});

describe("Stationen", () => {
  it("hat in jedem Modul Stationen auf Stufe 0 und I", () => {
    for (const m of MODUL_REIHENFOLGE) {
      const liste = stationenVon(m);
      expect(liste.some(s => s.stufe === "0")).toBe(true);
      expect(liste.some(s => s.stufe === "I")).toBe(true);
    }
  });

  it("verweist nur auf vorhandene Kann-Sätze und hat Quiz und Reflexion", () => {
    const gesehen = new Set<string>();
    for (const s of STATIONEN) {
      expect(gesehen.has(s.id)).toBe(false);
      gesehen.add(s.id);
      for (const k of s.kann) expect(GUELTIGE_SATZ_IDS.has(k)).toBe(true);
      expect(s.quiz.length).toBeGreaterThanOrEqual(3);
      for (const f of s.quiz) expect(f.richtig).toBeLessThan(f.antworten.length);
      expect(s.reflexion.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("weist bei jeder AIS.chat-Station auf den Datenschutz hin", () => {
    for (const s of STATIONEN.filter(x => x.ais)) {
      expect(s.ais!.schritte[0]).toMatch(/persönliche Daten/);
    }
  });

  it("braucht bestandenes Quiz und ausreichende Reflexion", () => {
    const s = STATIONEN[0];
    const lang = "x".repeat(REFLEXION_MIN);
    expect(quizBestanden(s, 2)).toBe(true);
    expect(quizBestanden(s, 1)).toBe(false);
    expect(stationFertig(s, { quiz: 3, reflexion: s.reflexion.map(() => lang) })).toBe(true);
    expect(stationFertig(s, { quiz: 3, reflexion: s.reflexion.map(() => "kurz") })).toBe(false);
    expect(stationFertig(s, { quiz: 1, reflexion: s.reflexion.map(() => lang) })).toBe(false);
    expect(stationFertig(s, undefined)).toBe(false);
  });

  it("ist fertig, wenn alle Module fertig sind", () => {
    const lang = "x".repeat(REFLEXION_MIN);
    const alle = Object.fromEntries(STATIONEN.map(s => [s.id, { quiz: s.quiz.length, reflexion: s.reflexion.map(() => lang) }]));
    expect(fuehrerscheinFertig(alle)).toBe(true);
    const ohne = { ...alle };
    delete ohne[stationenVon("mitgestalten")[0].id];
    expect(modulFertig("verstehen", ohne)).toBe(true);
    expect(modulFertig("mitgestalten", ohne)).toBe(false);
    expect(fuehrerscheinFertig(ohne)).toBe(false);
  });
});
