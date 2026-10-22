import { describe, expect, it } from "vitest";
import { BEISPIELE } from "@/lib/stromkreis/beispiele";
import { alsDatei, ausKompakt, kompakt, liesSchaltung } from "@/lib/stromkreis/datei";
import { schrittweite } from "@/lib/stromkreis/lauf";
import type { Schaltung } from "@/lib/stromkreis/modell";
import { Simulation } from "@/lib/stromkreis/simulation";

const beispiel = (id: string) => BEISPIELE.find(b => b.id === id)!.schaltung;
const geschaltet = (s: Schaltung, id: string, name: string, wert: number): Schaltung =>
  ({ ...s, bauteile: s.bauteile.map(t => (t.id === id ? { ...t, werte: { ...t.werte, [name]: wert } } : t)) });
const idVon = (s: Schaltung, art: string, k = 0) => s.bauteile.filter(t => t.art === art)[k].id;

function rechne(s: Schaltung, sekunden = 0.3) {
  const sim = new Simulation(s);
  sim.laufe(sekunden, schrittweite(s));
  return sim;
}

describe("Datei", () => {
  it("Export und Import ergeben dieselbe Schaltung", () => {
    for (const b of BEISPIELE) {
      const r = liesSchaltung(JSON.parse(alsDatei(b.schaltung)));
      expect("schaltung" in r && r.schaltung).toEqual(b.schaltung);
    }
  });

  it("die kompakte Vorgabe ebenso — und passt in die Sitzung (4 kB)", () => {
    for (const b of BEISPIELE) {
      const k = kompakt(b.schaltung);
      expect(JSON.stringify({ schaltung: k, aufgabe: "x".repeat(300) }).length).toBeLessThan(4000);
      const r = ausKompakt(JSON.parse(JSON.stringify(k)));
      if (!("schaltung" in r)) throw new Error(r.fehler);
      expect(r.schaltung.bauteile.map(t => [t.art, t.a, t.b, t.werte])).toEqual(b.schaltung.bauteile.map(t => [t.art, t.a, t.b, t.werte]));
      expect(r.schaltung.draehte.map(d => [d.a, d.b])).toEqual(b.schaltung.draehte.map(d => [d.a, d.b]));
    }
  });

  it("wirft weg, was nicht hineingehört, und begrenzt Werte", () => {
    const r = liesSchaltung({
      version: 1,
      bauteile: [
        { id: "x", art: "batterie", a: { x: 0, y: 0 }, b: { x: 0, y: 4 }, werte: { spannung: 99999, gift: 1, innenwiderstand: "viel" } },
        { id: "x", art: "widerstand", a: { x: 0, y: 4 }, b: { x: 4, y: 4 } },
        { art: "atomkraftwerk", a: { x: 0, y: 0 }, b: { x: 1, y: 0 } },
        { art: "lampe", a: { x: 1, y: 1 }, b: { x: 1, y: 1 } },
        { art: "trafo", a: { x: 0, y: 0 }, b: { x: 3, y: 3 } },
      ],
      draehte: [{ a: { x: 4, y: 4 }, b: { x: 0, y: 0 } }, { a: { x: "a", y: 0 }, b: { x: 1, y: 1 } }],
    });
    if (!("schaltung" in r)) throw new Error(r.fehler);
    expect(r.schaltung.bauteile.map(t => t.art)).toEqual(["batterie", "widerstand"]);
    expect(r.schaltung.bauteile[0].werte).toEqual({ spannung: 400 });
    expect(new Set(r.schaltung.bauteile.map(t => t.id)).size).toBe(2);
    expect(r.schaltung.draehte).toHaveLength(1);
  });

  it("sagt, warum etwas keine Schaltung ist", () => {
    expect(liesSchaltung("hallo")).toHaveProperty("fehler");
    expect(liesSchaltung({ version: 2, bauteile: [], draehte: [] })).toHaveProperty("fehler");
    expect(liesSchaltung({ bauteile: [] })).toHaveProperty("fehler");
    expect(ausKompakt({ t: 1 })).toHaveProperty("fehler");
  });
});

describe("Beispiele", () => {
  it("rechnen alle ohne Fehler", () => {
    for (const b of BEISPIELE) {
      const sim = rechne(b.schaltung, 0.2);
      for (const t of b.schaltung.bauteile) {
        const m = sim.messung(t.id);
        expect(Number.isFinite(m.spannung) && Number.isFinite(m.strom), `${b.id}/${t.id}`).toBe(true);
      }
      for (const d of b.schaltung.draehte) expect(Number.isFinite(sim.drahtStrom(d.id)), `${b.id}/${d.id}`).toBe(true);
    }
  });

  it("einfacher Stromkreis: das Lämpchen leuchtet", () => {
    const s = beispiel("einfach");
    expect(rechne(s).messung(idVon(s, "lampe")).helligkeit!).toBeGreaterThan(0.8);
  });

  it("Reihenschaltung: dieselbe Stromstärke überall", () => {
    const s = beispiel("reihe");
    const sim = rechne(s);
    const i1 = sim.messung(idVon(s, "lampe", 0)).strom, i2 = sim.messung(idVon(s, "lampe", 1)).strom;
    expect(i1).toBeGreaterThan(0.05);
    expect(i2).toBeCloseTo(i1, 6);
    expect(sim.messung(idVon(s, "amperemeter")).strom).toBeCloseTo(i1, 4);
  });

  it("Parallelschaltung: Hauptstrom = Summe", () => {
    const s = beispiel("parallel");
    const sim = rechne(s);
    const summe = sim.messung(idVon(s, "lampe", 0)).strom + sim.messung(idVon(s, "lampe", 1)).strom;
    expect(sim.messung(idVon(s, "amperemeter")).strom).toBeCloseTo(summe, 4);
  });

  it("UND und ODER", () => {
    const und = beispiel("und"), oder = beispiel("oder");
    const lampe = (s: Schaltung) => Math.abs(rechne(s).messung(idVon(s, "lampe")).strom) > 0.05;
    const [u1, u2] = [idVon(und, "schalter", 0), idVon(und, "schalter", 1)];
    expect(lampe(und)).toBe(false);
    expect(lampe(geschaltet(und, u1, "geschlossen", 1))).toBe(false);
    expect(lampe(geschaltet(geschaltet(und, u1, "geschlossen", 1), u2, "geschlossen", 1))).toBe(true);
    const o1 = idVon(oder, "schalter", 0), o2 = idVon(oder, "schalter", 1);
    expect(lampe(oder)).toBe(false);
    expect(lampe(geschaltet(oder, o1, "geschlossen", 1))).toBe(true);
    expect(lampe(geschaltet(oder, o2, "geschlossen", 1))).toBe(true);
  });

  it("Wechselschaltung: jeder Umschalter schaltet um", () => {
    const s = beispiel("wechsel");
    const [a, b] = [idVon(s, "umschalter", 0), idVon(s, "umschalter", 1)];
    const an = (x: Schaltung) => Math.abs(rechne(x).messung(idVon(s, "lampe")).strom) > 0.05;
    expect(an(s)).toBe(true);
    expect(an(geschaltet(s, a, "stellung", 1))).toBe(false);
    expect(an(geschaltet(s, b, "stellung", 1))).toBe(false);
    expect(an(geschaltet(geschaltet(s, a, "stellung", 1), b, "stellung", 1))).toBe(true);
  });

  it("Spannungsteiler: 6 V am 2-kΩ-Widerstand", () => {
    const s = beispiel("teiler");
    expect(rechne(s).messung(idVon(s, "voltmeter")).spannung).toBeCloseTo(6, 1);
  });

  it("Kurzschluss löst die Sicherung aus", () => {
    const s = beispiel("kurzschluss");
    expect(rechne(s).messung(idVon(s, "sicherung")).kaputt).toBe(false);
    expect(rechne(geschaltet(s, idVon(s, "schalter"), "geschlossen", 1)).messung(idVon(s, "sicherung")).kaputt).toBe(true);
  });

  it("Kondensator: nach 1 s rund 63 % von 9 V", () => {
    const s = beispiel("kondensator");
    const u = rechne(s, 1).messung(idVon(s, "voltmeter")).spannung;
    expect(u).toBeGreaterThan(5.4);
    expect(u).toBeLessThan(5.9);
  });

  it("Brückengleichrichter: Strom im Widerstand immer in eine Richtung", () => {
    const s = beispiel("bruecke");
    const sim = new Simulation(s);
    const r = idVon(s, "widerstand");
    let min = Infinity, max = -Infinity;
    for (let k = 0; k < 2000; k++) {
      sim.schritt(2e-5);
      const i = sim.messung(r).strom;
      min = Math.min(min, i); max = Math.max(max, i);
    }
    expect(max).toBeGreaterThan(0.05);
    expect(min).toBeGreaterThan(-1e-6);
  });

  it("Trafo: 6 V auf der Sekundärseite", () => {
    const s = beispiel("trafo");
    const sim = new Simulation(s);
    sim.laufe(0.1, 1e-4);
    let q = 0, n = 0;
    for (let k = 0; k < 1000; k++) { sim.schritt(1e-4); q += sim.messung(idVon(s, "voltmeter")).spannung ** 2; n++; }
    expect(Math.sqrt(q / n)).toBeGreaterThan(5.6);
    expect(Math.sqrt(q / n)).toBeLessThan(6.1);
  });
});
