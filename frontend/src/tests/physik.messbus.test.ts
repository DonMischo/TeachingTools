/**
 * Der Messbus ist die Stelle, an der die sonst getrennten Rechenwerke
 * zusammenkommen: alles Zeitabhängige meldet sich als benanntes Signal an,
 * und die Messgeräte lesen nur diese Meldungen — ohne zu wissen, wer den Wert
 * ausgerechnet hat. Diese Datei hält beides fest: den Bus und die beiden
 * ersten Quellen (Funktionsgenerator und Kraftmesser).
 */
import { describe, it, expect } from "vitest";
import { Messbus, signalId } from "@/lib/physik/messbus";
import { RECHTECK, SINUS, DREIECK, generatorWert, haengendeLast, schritt } from "@/lib/physik/rechenwerke";
import { ausschnitt, flankenIndex, spanne } from "@/lib/physik/oszilloskop";
import { neueSzene, stelle, verbinde } from "@/lib/physik/szene";
import { G } from "@/lib/physik/einheiten";

const DT_TEST = 1 / 240;

describe("Messbus", () => {
  it("schreibt und liest einen Verlauf", () => {
    const bus = new Messbus();
    bus.schreibe(0, [["g1.spannung", 1]]);
    bus.schreibe(0.1, [["g1.spannung", 2]]);
    expect(bus.verlauf("g1.spannung")).toEqual({ t: [0, 0.1], v: [1, 2] });
  });

  it("kennt den jüngsten Wert", () => {
    const bus = new Messbus();
    bus.schreibe(0, [["g1.kraft", 5]]);
    bus.schreibe(1, [["g1.kraft", 7]]);
    expect(bus.letzter("g1.kraft")).toBe(7);
    expect(bus.letzter("gibtsnicht")).toBeUndefined();
  });

  it("wirft die ältesten Werte weg, statt endlos zu wachsen", () => {
    const bus = new Messbus(100);
    for (let i = 0; i < 500; i++) bus.schreibe(i, [["g1.spannung", i]]);
    const v = bus.verlauf("g1.spannung")!;
    expect(v.v.length).toBeLessThanOrEqual(100);
    // Der jüngste Wert bleibt in jedem Fall stehen.
    expect(v.v[v.v.length - 1]).toBe(499);
  });

  it("listet die Signale, die geschrieben wurden", () => {
    const bus = new Messbus();
    bus.schreibe(0, [["g1.spannung", 1], ["g2.kraft", 2]]);
    expect(bus.ids().sort()).toEqual(["g1.spannung", "g2.kraft"]);
  });

  it("lässt sich leeren", () => {
    const bus = new Messbus();
    bus.schreibe(0, [["g1.spannung", 1]]);
    bus.leere();
    expect(bus.ids()).toEqual([]);
  });
});

describe("signalId", () => {
  it("setzt sich aus Gerät und Größe zusammen", () => {
    expect(signalId("g3", "kraft")).toBe("g3.kraft");
  });
});

describe("generatorWert", () => {
  it("schwingt mit der eingestellten Frequenz", () => {
    // Bei 2 Hz ist nach einer halben Periode (0,25 s) wieder ein Nulldurchgang.
    expect(generatorWert(SINUS, 2, 5, 0)).toBeCloseTo(0, 9);
    expect(generatorWert(SINUS, 2, 5, 0.25)).toBeCloseTo(0, 9);
    expect(generatorWert(SINUS, 2, 5, 0.125)).toBeCloseTo(5, 9);
  });

  it("hält die Amplitude ein", () => {
    for (const form of [SINUS, RECHTECK, DREIECK]) {
      for (let t = 0; t < 2; t += 0.013) {
        expect(Math.abs(generatorWert(form, 1, 3, t))).toBeLessThanOrEqual(3.000001);
      }
    }
  });

  it("macht aus dem Rechteck nur zwei Werte", () => {
    const werte = new Set<number>();
    for (let t = 0.01; t < 2; t += 0.01) werte.add(Math.round(generatorWert(RECHTECK, 1, 4, t)));
    expect([...werte].sort((a, b) => a - b)).toEqual([-4, 4]);
  });

  it("führt das Dreieck ohne Sprung bis an die Spitzen", () => {
    expect(generatorWert(DREIECK, 1, 6, 0.25)).toBeCloseTo(6, 6);
    expect(generatorWert(DREIECK, 1, 6, 0.75)).toBeCloseTo(-6, 6);
    // Stetig: zwei dicht beieinander liegende Zeitpunkte liegen dicht beieinander.
    expect(Math.abs(generatorWert(DREIECK, 1, 6, 0.5) - generatorWert(DREIECK, 1, 6, 0.501))).toBeLessThan(0.2);
  });
});

describe("haengendeLast", () => {
  const mitMasse = (masse: number) => {
    let s = stelle(neueSzene(), "kraftmesser", { x: 0, y: 1 });
    s = stelle(s, "massestueck", { x: 0, y: 0.5 });
    s = { ...s, geraete: s.geraete.map(g => (g.typ === "massestueck" ? { ...g, werte: { masse } } : g)) };
    return verbinde(s, { geraet: s.geraete[0].id, port: "unten" }, { geraet: s.geraete[1].id, port: "oese" });
  };

  it("ist ohne Last null", () => {
    const s = stelle(neueSzene(), "kraftmesser", { x: 0, y: 1 });
    expect(haengendeLast(s, s.geraete[0].id)).toBe(0);
  });

  it("wiegt ein angehängtes Massestück", () => {
    const s = mitMasse(0.1);
    expect(haengendeLast(s, s.geraete[0].id)).toBeCloseTo(0.1, 12);
  });

  it("zählt mehrere angehängte Massen zusammen", () => {
    let s = mitMasse(0.1);
    s = stelle(s, "massestueck", { x: 0.2, y: 0.5 });
    s = verbinde(s, { geraet: s.geraete[0].id, port: "unten" }, { geraet: s.geraete[2].id, port: "oese" });
    expect(haengendeLast(s, s.geraete[0].id)).toBeCloseTo(0.2, 12);
  });
});

describe("schritt", () => {
  it("legt die Kraft des Kraftmessers in Newton auf den Bus", () => {
    let s = stelle(neueSzene(), "kraftmesser", { x: 0, y: 1 });
    s = stelle(s, "massestueck", { x: 0, y: 0.5 });
    s = verbinde(s, { geraet: s.geraete[0].id, port: "unten" }, { geraet: s.geraete[1].id, port: "oese" });
    const werte = schritt(s, 0, 1 / 240);
    // 100 g hängen mit 0,981 N.
    expect(werte.get(signalId(s.geraete[0].id, "kraft"))).toBeCloseTo(0.1 * G, 9);
  });

  it("legt die Spannung des Generators auf den Bus", () => {
    const s = stelle(neueSzene(), "signalgeber", { x: 0, y: 0.5 });
    const id = signalId(s.geraete[0].id, "spannung");
    expect(schritt(s, 0, 1 / 240).get(id)).toBeCloseTo(0, 9);
  });

  it("meldet nichts für Geräte ohne Signale", () => {
    const s = stelle(neueSzene(), "stativ", { x: 0, y: 0 });
    expect([...schritt(s, 0, 1 / 240).keys()]).toEqual([]);
  });
});

describe("flankenIndex", () => {
  it("findet die letzte steigende Flanke durch den Pegel", () => {
    //            0   1   2   3   4   5
    const v = [-1, 1, -1, 1, 2, 3];
    expect(flankenIndex(v, 0)).toBe(3);
  });

  it("gibt 0 zurück, wenn es keine Flanke gibt", () => {
    expect(flankenIndex([1, 2, 3], 10)).toBe(0);
    expect(flankenIndex([], 0)).toBe(0);
  });
});

describe("spanne", () => {
  it("umfasst alle Werte", () => {
    const { min, max } = spanne([-2, 5, 1]);
    expect(min).toBeLessThanOrEqual(-2);
    expect(max).toBeGreaterThanOrEqual(5);
  });

  it("fällt bei lauter gleichen Werten nicht auf null zusammen", () => {
    const { min, max } = spanne([3, 3, 3]);
    expect(max).toBeGreaterThan(min);
  });

  it("kommt mit einer leeren Messung zurecht", () => {
    const { min, max } = spanne([]);
    expect(Number.isFinite(min) && Number.isFinite(max)).toBe(true);
    expect(max).toBeGreaterThan(min);
  });
});

describe("Messkette", () => {
  /** Fährt die Simulation so, wie die Uhr es tut: feste Schritte in den Bus. */
  function miss(frequenz: number, amplitude: number, sekunden: number) {
    let s = stelle(neueSzene(), "signalgeber", { x: 0, y: 0.5 });
    s = { ...s, geraete: s.geraete.map(g => ({ ...g, werte: { ...g.werte, frequenz, amplitude, form: SINUS } })) };
    const bus = new Messbus(1 << 20);
    const DT = 1 / 240;
    for (let i = 1; i * DT <= sekunden; i++) bus.schreibe(i * DT, schritt(s, i * DT, DT));
    return { bus, id: signalId(s.geraete[0].id, "spannung") };
  }

  it("gibt die eingestellte Frequenz wieder her", () => {
    const { bus, id } = miss(2, 5, 5);
    const { t, v } = bus.verlauf(id)!;

    // Steigende Nulldurchgaenge zaehlen — der Abstand zweier ist die Periode.
    const durchgaenge: number[] = [];
    for (let i = 1; i < v.length; i++) {
      if (v[i - 1] < 0 && v[i] >= 0) {
        // Linear zwischen den beiden Abtastpunkten interpolieren.
        durchgaenge.push(t[i - 1] + (DT_TEST * -v[i - 1]) / (v[i] - v[i - 1]));
      }
    }
    expect(durchgaenge.length).toBeGreaterThan(5);
    const periode = (durchgaenge[durchgaenge.length - 1] - durchgaenge[0]) / (durchgaenge.length - 1);
    expect(1 / periode).toBeCloseTo(2, 2);
  });

  it("gibt die eingestellte Amplitude wieder her", () => {
    const { bus, id } = miss(1, 5, 3);
    const v = bus.verlauf(id)!.v;
    expect(Math.max(...v)).toBeGreaterThan(4.99);
    expect(Math.max(...v)).toBeLessThanOrEqual(5.0001);
    expect(Math.min(...v)).toBeLessThan(-4.99);
  });

  it("stellt die Schwingung mit dem Ausloeser still", () => {
    const { bus, id } = miss(2, 5, 5);
    const teil = ausschnitt(bus.verlauf(id), 1, 0);
    // Der Ausschnitt beginnt an einer steigenden Flanke durch null. Genauer
    // als ein Abtastschritt geht nicht: bei 2 Hz und 5 V springt der Sinus
    // je Schritt um bis zu A*2*pi*f*dt, hier rund 0,26 V.
    const schrittHoehe = 5 * 2 * Math.PI * 2 * DT_TEST;
    expect(Math.abs(teil.v[0])).toBeLessThanOrEqual(schrittHoehe);
    expect(teil.v[1]).toBeGreaterThan(teil.v[0]);
  });

  it("laeuft ohne Ausloeser bis ans Ende der Messung", () => {
    const { bus, id } = miss(2, 5, 5);
    const teil = ausschnitt(bus.verlauf(id), 1, null);
    const alles = bus.verlauf(id)!;
    expect(teil.t[teil.t.length - 1]).toBeCloseTo(alles.t[alles.t.length - 1], 9);
    expect(teil.t[0]).toBeGreaterThan(alles.t[alles.t.length - 1] - 1.01);
  });
});
