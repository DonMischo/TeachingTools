/**
 * Der Messbus ist die Stelle, an der die sonst getrennten Rechenwerke
 * zusammenkommen: alles Zeitabhängige meldet sich als benanntes Signal an,
 * und die Messgeräte lesen nur diese Meldungen — ohne zu wissen, wer den Wert
 * ausgerechnet hat. Diese Datei hält beides fest: den Bus und die beiden
 * ersten Quellen (Funktionsgenerator und Kraftmesser).
 */
import { describe, it, expect } from "vitest";
import { Messbus, signalId } from "@/lib/physik/messbus";
import { RECHTECK, SINUS, DREIECK, generatorWert, haengendeKraft, leererZustand, schritt } from "@/lib/physik/rechenwerke";
import { imFenster, zeitfenster } from "@/lib/physik/oszilloskop";
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

describe("haengendeKraft", () => {
  /** Kraftmesser, darunter eine Kette von Massestuecken. */
  function kette(...massen: number[]) {
    let s = stelle(neueSzene(), "kraftmesser", { x: 0, y: 1 });
    massen.forEach((masse, i) => {
      s = stelle(s, "massestueck", { x: 0, y: 0.8 - i * 0.2 });
      const neu = s.geraete[s.geraete.length - 1];
      s = { ...s, geraete: s.geraete.map(g => (g.id === neu.id ? { ...g, werte: { masse } } : g)) };
      // Das erste haengt am Haken, jedes weitere am Stueck darueber.
      const oben = i === 0
        ? { geraet: s.geraete[0].id, port: "unten" }
        : { geraet: s.geraete[i].id, port: "unten" };
      s = verbinde(s, oben, { geraet: neu.id, port: "oese" });
    });
    return s;
  }

  it("ist ohne Last null", () => {
    const s = stelle(neueSzene(), "kraftmesser", { x: 0, y: 1 });
    expect(haengendeKraft(s, s.geraete[0].id, {})).toBe(0);
  });

  it("wiegt ein angehaengtes Massestueck", () => {
    const s = kette(0.1);
    expect(haengendeKraft(s, s.geraete[0].id, {})).toBeCloseTo(0.1 * G, 9);
  });

  it("zaehlt eine ganze Kette zusammen", () => {
    // Der gemeldete Fehler: haengte ein Stueck am anderen, zeigte der
    // Kraftmesser nur das oberste an.
    const s = kette(2.9, 0.5, 0.1);
    expect(haengendeKraft(s, s.geraete[0].id, {})).toBeCloseTo(3.5 * G, 9);
  });

  it("zaehlt auch nebeneinander haengende Stuecke", () => {
    let s = kette(0.1);
    s = stelle(s, "massestueck", { x: 0.2, y: 0.8 });
    const zweites = s.geraete[s.geraete.length - 1];
    s = { ...s, geraete: s.geraete.map(g => (g.id === zweites.id ? { ...g, werte: { masse: 0.4 } } : g)) };
    s = verbinde(s, { geraet: s.geraete[0].id, port: "unten" }, { geraet: zweites.id, port: "oese" });
    expect(haengendeKraft(s, s.geraete[0].id, {})).toBeCloseTo(0.5 * G, 9);
  });

  it("zaehlt nichts, was oben am Kraftmesser haengt", () => {
    let s = stelle(neueSzene(), "kraftmesser", { x: 0, y: 1 });
    s = stelle(s, "stativ", { x: 0, y: 1.5 });
    s = verbinde(s, { geraet: s.geraete[0].id, port: "oben" }, { geraet: s.geraete[1].id, port: "haken" });
    expect(haengendeKraft(s, s.geraete[0].id, {})).toBe(0);
  });

  it("spuert das Federpendel — im Gleichgewicht sein Gewicht", () => {
    let s = stelle(neueSzene(), "kraftmesser", { x: 0, y: 1 });
    s = stelle(s, "federpendel", { x: 0, y: 0.7 });
    const feder = s.geraete[1];
    s = { ...s, geraete: s.geraete.map(g => (g.id === feder.id ? { ...g, werte: { masse: 0.2, federkonstante: 20 } } : g)) };
    s = verbinde(s, { geraet: s.geraete[0].id, port: "unten" }, { geraet: feder.id, port: "aufhaengung" });

    expect(haengendeKraft(s, s.geraete[0].id, {})).toBeCloseTo(0.2 * G, 9);
    // Ausgelenkt zieht die gespannte Feder staerker: m*g + D*q.
    const ausgelenkt = { [feder.id]: { q: 0.05, v: 0, start: 0.05 } };
    expect(haengendeKraft(s, s.geraete[0].id, ausgelenkt)).toBeCloseTo(0.2 * G + 20 * 0.05, 9);
  });

  it("spuert die Fadenspannung eines Pendels", () => {
    let s = stelle(neueSzene(), "kraftmesser", { x: 0, y: 1 });
    s = stelle(s, "fadenpendel", { x: 0, y: 0.7 });
    const pendel = s.geraete[1];
    s = { ...s, geraete: s.geraete.map(g => (g.id === pendel.id ? { ...g, werte: { masse: 0.2, laenge: 1 } } : g)) };
    s = verbinde(s, { geraet: s.geraete[0].id, port: "unten" }, { geraet: pendel.id, port: "aufhaengung" });

    // Ganz unten und in Ruhe: genau das Gewicht.
    const ruhe = { [pendel.id]: { q: 0, v: 0, start: 0 } };
    expect(haengendeKraft(s, s.geraete[0].id, ruhe)).toBeCloseTo(0.2 * G, 9);
    // Am Umkehrpunkt bei 60 Grad zieht nur noch der Anteil cos(60) = 0,5.
    const umkehr = { [pendel.id]: { q: Math.PI / 3, v: 0, start: Math.PI / 3 } };
    expect(haengendeKraft(s, s.geraete[0].id, umkehr)).toBeCloseTo(0.2 * G * 0.5, 9);
  });

  it("verlaeuft sich nicht in einem Ring", () => {
    let s = kette(0.1, 0.2);
    // Das untere Stueck zurueck an den Haken: ein geschlossener Ring.
    s = verbinde(s, { geraet: s.geraete[2].id, port: "oese" }, { geraet: s.geraete[0].id, port: "unten" });
    expect(haengendeKraft(s, s.geraete[0].id, {})).toBeCloseTo(0.3 * G, 9);
  });
});

describe("schritt", () => {
  it("legt die Kraft des Kraftmessers in Newton auf den Bus", () => {
    let s = stelle(neueSzene(), "kraftmesser", { x: 0, y: 1 });
    s = stelle(s, "massestueck", { x: 0, y: 0.5 });
    s = verbinde(s, { geraet: s.geraete[0].id, port: "unten" }, { geraet: s.geraete[1].id, port: "oese" });
    const { werte } = schritt(s, leererZustand(), DT_TEST);
    // 100 g hängen mit 0,981 N.
    expect(werte.get(signalId(s.geraete[0].id, "kraft"))).toBeCloseTo(0.1 * G, 9);
  });

  it("legt die Spannung des Generators auf den Bus", () => {
    const s = stelle(neueSzene(), "signalgeber", { x: 0, y: 0.5 });
    const id = signalId(s.geraete[0].id, "spannung");
    // Die Messwerte gelten fuer den Zeitpunkt *nach* dem Schritt.
    const erwartet = 5 * Math.sin(2 * Math.PI * 1 * DT_TEST);
    expect(schritt(s, leererZustand(), DT_TEST).werte.get(id)).toBeCloseTo(erwartet, 9);
  });

  it("meldet nichts für Geräte ohne Signale", () => {
    const s = stelle(neueSzene(), "stativ", { x: 0, y: 0 });
    expect([...schritt(s, leererZustand(), DT_TEST).werte.keys()]).toEqual([]);
  });
});

describe("Messkette", () => {
  /** Fährt die Simulation so, wie die Uhr es tut: feste Schritte in den Bus. */
  function miss(frequenz: number, amplitude: number, sekunden: number) {
    let s = stelle(neueSzene(), "signalgeber", { x: 0, y: 0.5 });
    s = { ...s, geraete: s.geraete.map(g => ({ ...g, werte: { ...g.werte, frequenz, amplitude, form: SINUS } })) };
    const bus = new Messbus(1 << 20);
    let z = leererZustand();
    for (let i = 1; i * DT_TEST <= sekunden; i++) {
      const r = schritt(s, z, DT_TEST);
      z = r.zustand;
      bus.schreibe(z.t, r.werte);
    }
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

  it("verankert das Bild an einer steigenden Flanke", () => {
    const { bus, id } = miss(2, 5, 5);
    const bild = imFenster(bus.verlauf(id), zeitfenster(bus.verlauf(id), 1, 0));
    // Genauer als ein Abtastschritt geht nicht: bei 2 Hz und 5 V springt der
    // Sinus je Schritt um bis zu A*2*pi*f*dt, hier rund 0,26 V.
    const schrittHoehe = 5 * 2 * Math.PI * 2 * DT_TEST;
    expect(Math.abs(bild.v[0])).toBeLessThanOrEqual(schrittHoehe);
    expect(bild.v[1]).toBeGreaterThan(bild.v[0]);
  });

  it("fuellt den Schirm ueber die ganze eingestellte Zeit", () => {
    const { bus, id } = miss(2, 5, 5);
    const f = zeitfenster(bus.verlauf(id), 1, 0);
    expect(f.t1 - f.t0).toBeCloseTo(1, 9);
    expect(imFenster(bus.verlauf(id), f).t.length).toBeGreaterThan(200);
  });

  it("zeigt ohne Ausloeser das Neueste am rechten Rand", () => {
    const { bus, id } = miss(2, 5, 5);
    const alles = bus.verlauf(id)!;
    expect(zeitfenster(alles, 1, null).t1).toBeCloseTo(alles.t[alles.t.length - 1], 9);
  });
});
