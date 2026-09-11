import { describe, it, expect } from "vitest";
import {
  DOPPELKLICK, KLICK, einzelklickGrund, hoechstPunkte, median, stufenWechsel, trefferPunkte, zeitFuer,
} from "@/lib/maus/klickspiele";
import { SPUREN, abtasten, bewege, geschafft, rastpunkt, spurPunkte } from "@/lib/maus/spur";
import { LEBENSRAUM, TIER_ZONEN, rundenPunkte, tierRunde, zoneBei } from "@/lib/maus/aufraeumen";
import { ABSAETZE, GANZER_TEXT, KOPIER_AUFGABEN, MARKIER_AUFGABEN, passt } from "@/lib/maus/text";
import {
  GRENZEN, HOECHST, TEILE, gesamt, nichtssagenderName, pruefsumme, sterne, teilBestanden, teilSumme,
} from "@/lib/maus/ergebnis";
import { AVATARS } from "@/components/AvatarPicker";

const schnell = { treffer: true, ms: 500 };
const langsam = { treffer: true, ms: 3900 };
const daneben = { treffer: false, ms: 1000 };

describe("Klickspiele: Stufenwechsel", () => {
  it("steigt nach fünf schnellen Treffern auf", () => {
    expect(stufenWechsel([schnell, schnell, schnell, schnell], 4000)).toBe(0);
    expect(stufenWechsel([schnell, schnell, schnell, schnell, schnell], 4000)).toBe(1);
  });

  it("verzeiht einen Fehlgriff, zwei nicht", () => {
    expect(stufenWechsel([schnell, daneben, schnell, schnell, schnell], 4000)).toBe(1);
    expect(stufenWechsel([schnell, daneben, schnell, daneben], 4000)).toBe(-1);
  });

  it("bleibt, wenn die Treffer langsam sind", () => {
    expect(stufenWechsel([langsam, langsam, langsam, schnell, schnell], 4000)).toBe(0);
  });

  it("schaut nur auf die letzten fünf", () => {
    expect(stufenWechsel([daneben, daneben, schnell, schnell, schnell, schnell, schnell], 4000)).toBe(1);
  });

  it("rechnet den Median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBe(0);
  });
});

describe("Klickspiele: Punkte", () => {
  it("belohnt schnelle Klicks deutlich, mal der Stufe", () => {
    expect(trefferPunkte(0, 0, 6000)).toBe(300);
    expect(trefferPunkte(0, 6000, 6000)).toBe(50);
    expect(trefferPunkte(0, 9999, 6000)).toBe(50);
    expect(trefferPunkte(3, 0, 6000)).toBe(1200);
    expect(trefferPunkte(0, 500, 6000)).toBeGreaterThan(3 * trefferPunkte(0, 4000, 6000));
  });

  it("macht die Zeit je Tier mit jedem Treffer etwas knapper", () => {
    expect(zeitFuer(KLICK, 0)).toBe(6000);
    expect(zeitFuer(KLICK, 1)).toBeLessThan(zeitFuer(KLICK, 0));
    expect(zeitFuer(KLICK, 1)).toBeGreaterThan(5000);
    expect(zeitFuer(KLICK, KLICK.ziele)).toBe(KLICK.mindestMs);
    expect(zeitFuer(DOPPELKLICK, 0)).toBe(7000);
    expect(zeitFuer(DOPPELKLICK, DOPPELKLICK.ziele - 1)).toBeGreaterThanOrEqual(DOPPELKLICK.mindestMs);
  });

  it("endet beim Raster der Tierauswahl", () => {
    const letzte = KLICK.stufen[KLICK.stufen.length - 1];
    expect(letzte.spalten * letzte.zeilen).toBe(AVATARS.length);
  });

  it("bleibt unter den Grenzen, die der Server prüft", () => {
    expect(hoechstPunkte(KLICK)).toBeLessThanOrEqual(GRENZEN.klick);
    expect(hoechstPunkte(DOPPELKLICK)).toBeLessThanOrEqual(GRENZEN.doppelklick);
    expect(HOECHST.ziehen).toBeLessThanOrEqual(GRENZEN.ziehen);
    const summe = Object.values(HOECHST).reduce((s, n) => s + n, 0);
    expect(summe).toBeLessThanOrEqual(GRENZEN.gesamt);
  });

  it("erklärt einen misslungenen Doppelklick", () => {
    expect(einzelklickGrund(800)).toBe("zu-langsam");
    expect(einzelklickGrund(200)).toBe("verwackelt");
  });
});

describe("Spur", () => {
  const gerade = SPUREN[0];
  const zickzack = SPUREN.find(s => s.id === "zickzack")!;

  it("tastet in gleichen Abständen ab", () => {
    const p = abtasten([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    expect(p).toHaveLength(21);
    expect(p[1].x).toBeCloseTo(5);
  });

  it("kommt voran, wer dem Weg folgt — auch mit einer schnellen Bewegung", () => {
    const start = gerade.punkte[0];
    const ende = gerade.punkte[gerade.punkte.length - 1];
    const r = bewege(gerade.punkte, gerade.halbbreite, 0, start, ende);
    expect(r.draussen).toBe(false);
    expect(geschafft(gerade.punkte, r.index)).toBe(true);
  });

  it("fliegt raus, wer den Weg verlässt", () => {
    const start = gerade.punkte[0];
    const r = bewege(gerade.punkte, gerade.halbbreite, 0, start, { x: start.x + 20, y: start.y + 120 });
    expect(r.draussen).toBe(true);
    // Die ersten Schritte lagen noch am Weg; zurückgesetzt wird erst auf den Rastpunkt.
    expect(rastpunkt(gerade.punkte, r.index)).toBe(0);
  });

  it("lässt keine Abkürzung zu", () => {
    const start = zickzack.punkte[0];
    const r = bewege(zickzack.punkte, zickzack.halbbreite, 0, start, { x: 400, y: 320 });
    expect(r.draussen).toBe(true);
  });

  it("setzt nach dem Rausfliegen auf den letzten Rastpunkt", () => {
    const n = gerade.punkte.length - 1;
    const viertel = Math.floor(n / 4);
    expect(rastpunkt(gerade.punkte, viertel + 3)).toBe(viertel);
    expect(rastpunkt(gerade.punkte, 2)).toBe(0);
  });

  it("zieht fürs Rausfliegen und Loslassen ab, aber nie unter 200", () => {
    expect(spurPunkte(0, 0)).toBe(1000);
    expect(spurPunkte(1, 1)).toBe(750);
    expect(spurPunkte(20, 20)).toBe(200);
  });
});

describe("Aufräumen", () => {
  it("nimmt zwei Tiere je Lebensraum", () => {
    const runde = tierRunde();
    expect(runde).toHaveLength(6);
    for (const zone of TIER_ZONEN) {
      expect(runde.filter(d => d.ziel === zone.id)).toHaveLength(2);
    }
  });

  it("kennt nur Tiere, die es als Avatar gibt", () => {
    const ids = new Set<string>(AVATARS.map(a => a.id));
    for (const id of Object.keys(LEBENSRAUM)) expect(ids.has(id)).toBe(true);
  });

  it("findet die Ablagefläche unter dem Zeiger", () => {
    const flaechen = [
      { id: "a", left: 0, top: 0, right: 100, bottom: 100 },
      { id: "b", left: 200, top: 0, right: 300, bottom: 100 },
    ];
    expect(zoneBei(flaechen, 250, 50)).toBe("b");
    expect(zoneBei(flaechen, 150, 50)).toBeNull();
  });

  it("verteilt 1000 Punkte je Runde", () => {
    expect(rundenPunkte(6, 6)).toBe(1000);
    expect(rundenPunkte(3, 6)).toBe(500);
  });
});

describe("Markieren und Kopieren", () => {
  it("verzeiht Leerzeichen und Satzzeichen am Rand", () => {
    expect(passt("Sonne ", "Sonne")).toBe(true);
    expect(passt("Sonne.", "Sonne")).toBe(true);
    expect(passt(`${ABSAETZE[1]}\n`, ABSAETZE[1])).toBe(true);
    expect(passt(ABSAETZE.join("\n"), GANZER_TEXT)).toBe(true);
    // Range.toString() klebt Absätze ohne Trenner aneinander.
    expect(passt(ABSAETZE.join(""), GANZER_TEXT)).toBe(true);
  });

  it("nimmt nicht mehr oder weniger als verlangt", () => {
    expect(passt("die Sonne", "Sonne")).toBe(false);
    expect(passt("Sonn", "Sonne")).toBe(false);
    expect(passt("   ", "Sonne")).toBe(false);
  });

  it("jede Aufgabe steht wirklich im Text", () => {
    for (const a of [...MARKIER_AUFGABEN, ...KOPIER_AUFGABEN]) {
      if (a.art === "alles") continue;
      expect(ABSAETZE[a.absatz]).toContain(a.ziel);
    }
  });
});

describe("Ergebnis", () => {
  it("zählt die Punkte aller Stufen zusammen", () => {
    expect(gesamt({ klick: { punkte: 100, dauerMs: 0, details: [] }, ziehen: { punkte: 50, dauerMs: 0, details: [] } })).toBe(150);
  });

  it("vergibt Sterne nach Anteil — bei den Klickspielen gemessen an einem sehr guten Lauf", () => {
    expect(sterne("markieren", 0)).toBe(0);
    expect(sterne("markieren", HOECHST.markieren)).toBe(3);
    expect(sterne("markieren", HOECHST.markieren * 0.5)).toBe(2);
    expect(sterne("markieren", 1)).toBe(1);
    // 12 000 im Klicken sind drei Sterne, obwohl das Höchstmaß 24 000 wäre.
    expect(sterne("klick", 10000)).toBe(3);
  });

  it("zählt je Teil und besteht nur ohne Lücke", () => {
    const voll = (id: string) => ({ [id]: { punkte: 100, dauerMs: 0, details: [] } });
    const teil1 = Object.assign({}, ...TEILE[1].map(voll));
    expect(teilBestanden(teil1, 1)).toBe(true);
    expect(teilBestanden(teil1, 2)).toBe(false);
    expect(teilSumme(teil1, 1)).toBe(600);
    expect(teilSumme(teil1, 2)).toBe(0);
    const luecke = { ...teil1, rechtsklick: { punkte: 0, dauerMs: 0, details: [] } };
    expect(teilBestanden(luecke, 1)).toBe(false);
  });

  it("erkennt eine Datei an ihrer Prüfsumme wieder", () => {
    const a = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
    const b = new Uint8Array(a);
    b[6] = 4;
    expect(pruefsumme(a.buffer)).toBe(pruefsumme(new Uint8Array(a).buffer));
    expect(pruefsumme(a.buffer)).not.toBe(pruefsumme(b.buffer));
    expect(pruefsumme(a.buffer)).not.toBe(pruefsumme(a.slice(0, 6).buffer));
  });

  it("erkennt Dateinamen, die niemand vergeben hat", () => {
    expect(nichtssagenderName("download.png")).toBe(true);
    expect(nichtssagenderName("download (2).png")).toBe(true);
    expect(nichtssagenderName("3f2a9c1e-1b2c-4d5e-8f90-123456789abc.png")).toBe(true);
    expect(nichtssagenderName("Maus-Führerschein Mia.png")).toBe(false);
  });
});
