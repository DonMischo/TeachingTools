import { describe, expect, it } from "vitest";
import type { Bauteil, BauteilArt, Draht, Schaltung } from "@/lib/stromkreis/modell";
import { anschluesse } from "@/lib/stromkreis/modell";
import { Simulation } from "@/lib/stromkreis/simulation";

let nr = 0;
const teil = (id: string, art: BauteilArt, ax: number, ay: number, bx: number, by: number, werte: Record<string, number> = {}): Bauteil =>
  ({ id, art, a: { x: ax, y: ay }, b: { x: bx, y: by }, werte });
const draht = (ax: number, ay: number, bx: number, by: number, id = `d${nr++}`): Draht =>
  ({ id, a: { x: ax, y: ay }, b: { x: bx, y: by } });
const schaltung = (bauteile: Bauteil[], draehte: Draht[]): Schaltung => ({ version: 1, bauteile, draehte });

/**
 * Eine Reihenschaltung: die Quelle senkrecht links (Minus unten bei 0,0, Plus
 * oben bei 0,2), die Bauteile oben nebeneinander in Stromrichtung, und ein
 * Draht zurück. Die Bauteile bekommen ihre Lage hier, `a`/`b` werden überschrieben.
 */
function reihe(quelle: Bauteil, ...teile: Bauteil[]): Schaltung {
  quelle.a = { x: 0, y: 0 }; quelle.b = { x: 0, y: 2 };
  teile.forEach((t, i) => { t.a = { x: 2 * i, y: 2 }; t.b = { x: 2 * i + 2, y: 2 }; });
  const ende = 2 * teile.length;
  return schaltung([quelle, ...teile], [draht(ende, 2, ende, 0, "rueck1"), draht(ende, 0, 0, 0, "rueck2")]);
}

const batterie = (spannung = 4.5, innenwiderstand = 0.5) => teil("bat", "batterie", 0, 0, 0, 0, { spannung, innenwiderstand });
const R = (id: string, ohm: number) => teil(id, "widerstand", 0, 0, 0, 0, { widerstand: ohm });

/** Effektivwert einer Größe über `sekunden`. */
function effektiv(sim: Simulation, sekunden: number, dt: number, lies: () => number) {
  let summe = 0, n = 0;
  for (let t = 0; t < sekunden; t += dt) { sim.schritt(dt); summe += lies() ** 2; n++; }
  return Math.sqrt(summe / n);
}

describe("Gleichstrom", () => {
  it("Ohmsches Gesetz mit Innenwiderstand", () => {
    const sim = new Simulation(reihe(batterie(), R("r", 100)));
    sim.schritt(1e-3);
    expect(sim.messung("r").strom).toBeCloseTo(4.5 / 100.5, 5);
    expect(sim.messung("r").spannung).toBeCloseTo(100 * 4.5 / 100.5, 3);
    // Die Batterie liefert: Strom läuft innen von Minus nach Plus, Leistung negativ.
    expect(sim.messung("bat").strom).toBeCloseTo(4.5 / 100.5, 5);
    expect(sim.messung("bat").leistung).toBeLessThan(0);
  });

  it("Reihenschaltung teilt die Spannung", () => {
    const sim = new Simulation(reihe(batterie(9, 0.001), R("r1", 100), R("r2", 200)));
    sim.schritt(1e-3);
    expect(sim.messung("r1").spannung).toBeCloseTo(3, 2);
    expect(sim.messung("r2").spannung).toBeCloseTo(6, 2);
  });

  it("Parallelschaltung: Ströme addieren sich, der Stammdraht trägt die Summe", () => {
    // Batterie links, oben ein Stammdraht zu x=2, dort zwei Widerstände senkrecht nach unten (x=2 und x=4)
    const s = schaltung(
      [teil("bat", "batterie", 0, 0, 0, 2, { spannung: 6, innenwiderstand: 0.001 }),
        teil("r1", "widerstand", 2, 2, 2, 0, { widerstand: 100 }),
        teil("r2", "widerstand", 4, 2, 4, 0, { widerstand: 300 })],
      [draht(0, 2, 2, 2, "stamm"), draht(2, 2, 4, 2, "ast"), draht(4, 0, 2, 0, "unten2"), draht(2, 0, 0, 0, "unten1")],
    );
    const sim = new Simulation(s);
    sim.schritt(1e-3);
    expect(sim.messung("r1").strom).toBeCloseTo(0.06, 3);
    expect(sim.messung("r2").strom).toBeCloseTo(0.02, 3);
    expect(sim.drahtStrom("stamm")).toBeCloseTo(0.08, 3);
    expect(sim.drahtStrom("ast")).toBeCloseTo(0.02, 3);
    expect(sim.drahtStrom("unten1")).toBeCloseTo(0.08, 3);
  });

  it("zwei parallele Drähte teilen sich den Strom", () => {
    const s = reihe(batterie(), R("r", 100));
    s.draehte.push(draht(2, 0, 0, 0, "zweit"));
    // rueck2 läuft von (2,0) nach (0,0), "zweit" ebenso
    const sim = new Simulation(s);
    sim.schritt(1e-3);
    const i = sim.messung("r").strom;
    expect(sim.drahtStrom("rueck2")).toBeCloseTo(i / 2, 6);
    expect(sim.drahtStrom("zweit")).toBeCloseTo(i / 2, 6);
  });

  it("Schalter: offen fließt nichts, geschlossen der volle Strom", () => {
    const sim = new Simulation(reihe(batterie(), teil("s", "schalter", 0, 0, 0, 0), R("r", 100)));
    sim.schritt(1e-3);
    expect(Math.abs(sim.messung("r").strom)).toBeLessThan(1e-6);
    sim.setzeWert("s", "geschlossen", 1);
    sim.schritt(1e-3);
    expect(sim.messung("r").strom).toBeCloseTo(4.5 / 100.5, 4);
  });

  it("Umschalter legt um, welcher Zweig Strom bekommt", () => {
    // Mittelkontakt bei (0,2), Ausgang 0 bei (2,2), Ausgang 1 bei (2,0) (zwei Raster links von a→b nach rechts = oben, also y−2)
    const u = teil("u", "umschalter", 0, 4, 2, 4);
    expect(anschluesse(u)[2]).toEqual({ x: 2, y: 2 });
    const s = schaltung(
      [teil("bat", "batterie", 0, 0, 0, 4, { spannung: 6, innenwiderstand: 0.001 }), u,
        teil("r0", "widerstand", 2, 4, 4, 4, { widerstand: 100 }),
        teil("r1", "widerstand", 2, 2, 4, 2, { widerstand: 100 })],
      [draht(4, 4, 4, 2), draht(4, 2, 4, 0), draht(4, 0, 0, 0)],
    );
    const sim = new Simulation(s);
    sim.schritt(1e-3);
    expect(sim.messung("r0").strom).toBeCloseTo(0.06, 3);
    expect(Math.abs(sim.messung("r1").strom)).toBeLessThan(1e-6);
    sim.setzeWert("u", "stellung", 1);
    sim.schritt(1e-3);
    expect(Math.abs(sim.messung("r0").strom)).toBeLessThan(1e-6);
    expect(sim.messung("r1").strom).toBeCloseTo(0.06, 3);
  });

  it("Messgeräte stören den Kreis nicht", () => {
    const s = reihe(batterie(6, 0.001), teil("am", "amperemeter", 0, 0, 0, 0), R("r", 200));
    // Spannungsmesser parallel zum Widerstand (2,2)→(4,2)
    s.bauteile.push(teil("vm", "voltmeter", 2, 2, 4, 2));
    const sim = new Simulation(s);
    sim.schritt(1e-3);
    expect(sim.messung("am").strom).toBeCloseTo(0.03, 4);
    expect(sim.messung("vm").spannung).toBeCloseTo(6, 2);
  });

  it("Lämpchen leuchtet bei Nennspannung voll und brennt bei 12 V durch", () => {
    const lampe = () => teil("l", "lampe", 0, 0, 0, 0);
    const sim = new Simulation(reihe(batterie(3.5, 0.001), lampe()));
    sim.laufe(0.5, 1e-3);
    expect(sim.messung("l").helligkeit).toBeCloseTo(1, 2);
    expect(sim.messung("l").kaputt).toBe(false);

    const zuviel = new Simulation(reihe(batterie(12, 0.001), lampe()));
    zuviel.laufe(0.5, 1e-3);
    expect(zuviel.messung("l").kaputt).toBe(true);
    expect(Math.abs(zuviel.messung("l").strom)).toBeLessThan(1e-6);
    zuviel.repariere("l");
    zuviel.schritt(1e-3);
    expect(zuviel.messung("l").kaputt).toBe(false);
  });

  it("Sicherung hält den Nennbetrieb aus und fliegt beim Kurzschluss", () => {
    const ok = new Simulation(reihe(batterie(4.5, 0.5), teil("f", "sicherung", 0, 0, 0, 0, { nennstrom: 1 }), R("r", 10)));
    ok.laufe(1, 1e-3);
    expect(ok.messung("f").kaputt).toBe(false);

    const kurz = new Simulation(reihe(batterie(4.5, 0.5), teil("f", "sicherung", 0, 0, 0, 0, { nennstrom: 1 })));
    kurz.laufe(0.1, 1e-3);
    expect(kurz.messung("f").kaputt).toBe(true);
  });

  it("Motor läuft hoch bis zur Leerlaufdrehzahl", () => {
    const sim = new Simulation(reihe(batterie(), teil("m", "motor", 0, 0, 0, 0)));
    sim.schritt(1e-3);
    const anlauf = sim.messung("m").strom;
    sim.laufe(4, 1e-3);
    // ω = kU / (k² + d·(Ra+Ri)) = 0.0095·4.5 / (0.0095² + 3e-6·3.5)
    const soll = 0.0095 * 4.5 / (0.0095 ** 2 + 3e-6 * 3.5);
    expect(sim.messung("m").drehzahl!).toBeGreaterThan(soll * 0.97);
    expect(sim.messung("m").drehzahl!).toBeLessThan(soll * 1.03);
    // Gegenspannung: im Lauf zieht er viel weniger als beim Anlauf
    expect(sim.messung("m").strom).toBeLessThan(anlauf / 5);
  });
});

describe("Kondensator und Spule", () => {
  it("RC: nach einer Zeitkonstante 63 % geladen", () => {
    const sim = new Simulation(reihe(batterie(10, 0.001), R("r", 1000), teil("c", "kondensator", 0, 0, 0, 0, { kapazitaet: 1e-3 })));
    sim.laufe(1, 1e-3);
    expect(sim.messung("c").spannung).toBeCloseTo(10 * (1 - Math.exp(-1)), 1);
    expect(Math.abs(sim.messung("c").spannung - 10 * (1 - Math.exp(-1)))).toBeLessThan(0.03);
  });

  it("RL: Strom steigt mit τ = L/R", () => {
    const sim = new Simulation(reihe(batterie(10, 0.001), R("r", 10), teil("l", "spule", 0, 0, 0, 0, { induktivitaet: 1, widerstand: 0 })));
    sim.laufe(0.1, 1e-4);
    expect(Math.abs(sim.messung("l").strom - (1 - Math.exp(-1)))).toBeLessThan(0.005);
    sim.laufe(1, 1e-4);
    expect(sim.messung("l").strom).toBeCloseTo(1, 3);
  });

  it("Spule mit Wicklungswiderstand: im Gleichstrom zählt nur der", () => {
    const sim = new Simulation(reihe(batterie(5, 0.001), teil("l", "spule", 0, 0, 0, 0, { induktivitaet: 0.5, widerstand: 2.5 })));
    sim.laufe(3, 1e-3);
    expect(sim.messung("l").strom).toBeCloseTo(2, 2);
  });

  it("LC-Schwingkreis schwingt mit 1/(2π√LC)", () => {
    const L = 0.1, C = 1e-4;
    const sim = new Simulation(reihe(batterie(10, 0.001),
      teil("l", "spule", 0, 0, 0, 0, { induktivitaet: L, widerstand: 0 }),
      teil("c", "kondensator", 0, 0, 0, 0, { kapazitaet: C })));
    const dt = 1e-5;
    const maxima: number[] = [];
    let vor2 = 0, vor = 0, spitze = 0;
    for (let s = 0; s < 6000; s++) {
      sim.schritt(dt);
      const u = sim.messung("c").spannung;
      if (s > 1 && vor > vor2 && vor >= u) maxima.push(sim.zeit - dt);
      vor2 = vor; vor = u;
      if (s > 5000) spitze = Math.max(spitze, u);
    }
    expect(maxima.length).toBeGreaterThan(2);
    const periode = (maxima[maxima.length - 1] - maxima[0]) / (maxima.length - 1);
    const soll = 2 * Math.PI * Math.sqrt(L * C);
    expect(Math.abs(periode / soll - 1)).toBeLessThan(0.01);
    // Kaum gedämpft: auch nach 60 ms schwingt der Kondensator noch bis fast 2·E
    expect(spitze).toBeGreaterThan(19.5);
    expect(spitze).toBeLessThan(20.1);
  });
});

describe("Wechselstrom", () => {
  const wechsel = (spannung = 6, frequenz = 50) => teil("ac", "wechselquelle", 0, 0, 0, 0, { spannung, frequenz, innenwiderstand: 0.001 });

  it("Effektivwert am Widerstand", () => {
    const sim = new Simulation(reihe(wechsel(), R("r", 100)));
    const ieff = effektiv(sim, 1, 1e-4, () => sim.messung("r").strom);
    expect(ieff).toBeCloseTo(0.06, 3);
  });

  it("Kondensator: Blindwiderstand 1/(ωC)", () => {
    const C = 1e-4;
    const sim = new Simulation(reihe(wechsel(), R("r", 1), teil("c", "kondensator", 0, 0, 0, 0, { kapazitaet: C })));
    sim.laufe(0.2, 1e-5);
    const ieff = effektiv(sim, 0.2, 1e-5, () => sim.messung("c").strom);
    const z = Math.hypot(1, 1 / (2 * Math.PI * 50 * C));
    expect(Math.abs(ieff / (6 / z) - 1)).toBeLessThan(0.01);
  });

  it("Trafo 600:300 halbiert die Spannung", () => {
    // Primär von (2,2) nach (2,0) — anschluesse: a=(2,2), a+quer; Laufrichtung a→b nach rechts, quer = oben (y−2)
    const trafo = teil("t", "trafo", 2, 4, 6, 4, { windungen1: 600, windungen2: 300, kopplung: 0.999 });
    const [p1, p2, s1, s2] = anschluesse(trafo);
    expect([p1, p2, s1, s2]).toEqual([{ x: 2, y: 4 }, { x: 2, y: 2 }, { x: 6, y: 4 }, { x: 6, y: 2 }]);
    const s = schaltung(
      [teil("ac", "wechselquelle", 0, 2, 0, 4, { spannung: 6, frequenz: 50, innenwiderstand: 0.001 }), trafo,
        teil("vm", "voltmeter", 8, 4, 8, 2)],
      [draht(0, 4, 2, 4), draht(0, 2, 2, 2), draht(6, 4, 8, 4), draht(6, 2, 8, 2)],
    );
    const sim = new Simulation(s);
    sim.laufe(0.2, 1e-5);
    const ueff = effektiv(sim, 0.2, 1e-5, () => sim.messung("vm").spannung);
    expect(Math.abs(ueff / 3 - 1)).toBeLessThan(0.01);
  });

  it("Trafo unter Last: Ströme stehen umgekehrt wie die Windungszahlen", () => {
    const trafo = teil("t", "trafo", 2, 4, 6, 4, { windungen1: 600, windungen2: 300, kopplung: 0.999 });
    const s = schaltung(
      [teil("ac", "wechselquelle", 0, 2, 0, 4, { spannung: 6, frequenz: 50, innenwiderstand: 0.001 }), trafo,
        teil("r", "widerstand", 8, 4, 8, 2, { widerstand: 10 })],
      [draht(0, 4, 2, 4), draht(0, 2, 2, 2), draht(6, 4, 8, 4), draht(6, 2, 8, 2)],
    );
    const sim = new Simulation(s);
    sim.laufe(0.2, 1e-5);
    let i1 = 0, i2 = 0, n = 0;
    for (let k = 0; k < 20000; k++) {
      sim.schritt(1e-5);
      i1 += sim.messung("t").strom ** 2; i2 += sim.messung("t").strom2! ** 2; n++;
    }
    const ratio = Math.sqrt(i2 / n) / Math.sqrt(i1 / n);
    expect(ratio).toBeGreaterThan(1.9);
    expect(ratio).toBeLessThan(2.05);
    expect(Math.sqrt(i2 / n)).toBeGreaterThan(0.28);
  });
});

describe("Dioden", () => {
  it("Si-Diode in Durchlassrichtung: etwa 0,7 V", () => {
    const sim = new Simulation(reihe(batterie(4.5, 0.001), R("r", 1000), teil("d", "diode", 0, 0, 0, 0)));
    sim.schritt(1e-3);
    const u = sim.messung("d").spannung;
    expect(u).toBeGreaterThan(0.6);
    expect(u).toBeLessThan(0.72);
    expect(sim.messung("r").strom).toBeCloseTo((4.5 - u) / 1000, 5);
  });

  it("Diode in Sperrrichtung lässt nichts durch", () => {
    const d = teil("d", "diode", 0, 0, 0, 0);
    const s = reihe(batterie(4.5, 0.001), R("r", 1000), d);
    [d.a, d.b] = [d.b, d.a];
    const sim = new Simulation(s);
    sim.schritt(1e-3);
    expect(Math.abs(sim.messung("r").strom)).toBeLessThan(1e-6);
    expect(sim.messung("d").spannung).toBeCloseTo(-4.5, 2);
  });

  it("rote LED mit Vorwiderstand leuchtet, ohne brennt sie durch", () => {
    const led = () => teil("led", "led", 0, 0, 0, 0, { farbe: 0, durchlass: 1.8 });
    const sim = new Simulation(reihe(batterie(4.5, 0.001), R("r", 150), led()));
    sim.laufe(0.2, 1e-3);
    expect(sim.messung("led").spannung).toBeGreaterThan(1.7);
    expect(sim.messung("led").spannung).toBeLessThan(1.9);
    expect(sim.messung("led").helligkeit!).toBeGreaterThan(0.8);
    expect(sim.messung("led").kaputt).toBe(false);

    const ohne = new Simulation(reihe(batterie(4.5, 0.5), led()));
    ohne.laufe(0.2, 1e-3);
    expect(ohne.messung("led").kaputt).toBe(true);
  });

  it("Einweggleichrichter: nur eine Halbwelle", () => {
    const sim = new Simulation(reihe(teil("ac", "wechselquelle", 0, 0, 0, 0, { spannung: 6, frequenz: 50, innenwiderstand: 0.001 }),
      teil("d", "diode", 0, 0, 0, 0), R("r", 100)));
    let kleinster = 0, groesster = 0;
    for (let k = 0; k < 4000; k++) {
      sim.schritt(1e-5);
      const i = sim.messung("r").strom;
      kleinster = Math.min(kleinster, i); groesster = Math.max(groesster, i);
    }
    expect(kleinster).toBeGreaterThan(-1e-6);
    expect(groesster).toBeGreaterThan((6 * Math.SQRT2 - 0.9) / 100);
  });
});
