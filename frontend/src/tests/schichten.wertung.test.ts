import { describe, expect, it } from "vitest";
import { ZIELE } from "@/lib/schichten/netz";
import {
  LEER, ausSpeicher, missionWertung, stufenWertung, verbucheFehlersuche, verbucheMission, type MissionErgebnis,
} from "@/lib/schichten/wertung";

const nullen = { ascii: 0, bits: 0, dns: 0, packen: 0, routing: 0 };
const ohne = { ascii: false, bits: false, dns: false, packen: false, routing: false };
const perfekt = (ziel = "tokio", niveau: MissionErgebnis["niveau"] = "einsteiger"): MissionErgebnis => ({ ziel, niveau, fehler: { ...nullen }, hilfe: { ...ohne } });

describe("Wertung", () => {
  it("Stufe: 1000 ohne Fehler, −100 je Fehlversuch, Hilfsmittel kostet den dritten Stern", () => {
    expect(stufenWertung(0, false, "einsteiger")).toEqual({ sterne: 3, punkte: 1000 });
    expect(stufenWertung(2, false, "einsteiger")).toEqual({ sterne: 2, punkte: 800 });
    expect(stufenWertung(0, true, "einsteiger")).toEqual({ sterne: 2, punkte: 900 });
    expect(stufenWertung(9, false, "einsteiger")).toEqual({ sterne: 1, punkte: 600 });
    expect(stufenWertung(0, false, "experte").punkte).toBe(1500);
  });

  it("Mission: fünf Stufen, höchstens 15 Sterne", () => {
    expect(missionWertung(perfekt())).toMatchObject({ punkte: 5000, sterne: 15 });
  });
});

describe("Erfolge", () => {
  it("erste perfekte Mission schaltet mehrere frei, eine zweite nicht dieselben", () => {
    const a = verbucheMission(LEER, perfekt());
    expect(a.neu.map(e => e.id)).toEqual(expect.arrayContaining(["erste", "fehlerfrei", "sterne", "kopfrechner", "navi"]));
    expect(a.stand.punkte).toBe(5000);
    const b = verbucheMission(a.stand, perfekt());
    expect(b.neu.map(e => e.id)).not.toContain("erste");
    expect(b.stand.missionen).toBe(2);
  });

  it("Kopfrechner nur ohne Binär-Rechner", () => {
    const e = perfekt();
    e.hilfe.bits = true;
    expect(verbucheMission(LEER, e).neu.map(x => x.id)).not.toContain("kopfrechner");
  });

  it("Um die Welt erst mit allen Zielen, Netzmeister ab 10 000 Punkten", () => {
    let s = LEER;
    const alle = ZIELE.map(z => z.id);
    for (const z of ["tokio", "tokio", ...alle.slice(1, -1)]) s = verbucheMission(s, perfekt(z)).stand;
    expect(s.freigeschaltet).not.toContain("welt");
    expect(s.freigeschaltet).toContain("netzmeister");
    expect(verbucheMission(s, perfekt(alle.at(-1))).neu.map(x => x.id)).toContain("welt");
  });

  it("Fehlerjäger nach fünf richtigen Fällen", () => {
    let s = LEER;
    for (let i = 0; i < 4; i++) s = verbucheFehlersuche(s, true).stand;
    s = verbucheFehlersuche(s, false).stand;
    expect(s.freigeschaltet).not.toContain("fehlerjaeger");
    expect(verbucheFehlersuche(s, true).neu.map(x => x.id)).toEqual(["fehlerjaeger"]);
  });

  it("verträgt kaputten Speicher", () => {
    expect(ausSpeicher(null)).toEqual(LEER);
    expect(ausSpeicher({ punkte: "viel", ziele: ["tokio", 3] })).toMatchObject({ punkte: 0, ziele: ["tokio"] });
  });
});
