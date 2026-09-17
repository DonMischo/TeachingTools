/**
 * Die einfachen Maschinen — Hebel, Flaschenzug, schiefe Ebene.
 *
 * Wieder gilt der Maßstab des Labors: die Messung muss die Formel bestätigen,
 * die die Klasse gerade herleitet. Also steht hier F₁·a₁ = F₂·a₂, die goldene
 * Regel (Kraft durch n, Weg mal n) und F_H = G·sin α — nicht „läuft durch".
 */
import { describe, it, expect } from "vitest";
import { beschleunigung, haltekraft, hebelGehalten, hebelMomente, lastAn, mechanikSchritt, wirdGehalten, HEBEL_ANSCHLAG, type MechanikZustand } from "@/lib/physik/mechanik";
import { haengendeKraft, lastAmFlaschenzug, leererZustand, schritt, tragendeSeile } from "@/lib/physik/rechenwerke";
import { signalId } from "@/lib/physik/messbus";
import { aufgeloest, freierHaken, neueSzene, portOrt, stelle, verbinde } from "@/lib/physik/szene";
import { bogen, G } from "@/lib/physik/einheiten";
import type { Szene } from "@/lib/physik/typen";

const DT = 1 / 240;

function mit(typ: string, werte: Record<string, number>): Szene {
  const s = stelle(neueSzene(), typ, { x: 0, y: 1 });
  return { ...s, geraete: s.geraete.map(g => ({ ...g, werte: { ...g.werte, ...werte } })) };
}

/** Hängt ein Massestück an einen Anschluss des ersten Geräts. */
function anhaengen(szene: Szene, port: string, masse: number): Szene {
  let s = stelle(szene, "massestueck", { x: 0.5, y: 0.5 });
  const neu = s.geraete[s.geraete.length - 1];
  s = { ...s, geraete: s.geraete.map(g => (g.id === neu.id ? { ...g, werte: { masse } } : g)) };
  return verbinde(s, { geraet: s.geraete[0].id, port }, { geraet: neu.id, port: "oese" });
}

/** Lässt den Aufbau laufen und gibt den Zustand des ersten Geräts zurück. */
function laufen(szene: Szene, sekunden: number) {
  let zustand: MechanikZustand = {};
  for (let i = 1; i * DT <= sekunden; i++) zustand = mechanikSchritt(szene, zustand, DT);
  return zustand[szene.geraete[0].id];
}

describe("Hebel", () => {
  const hebel = (aL: number, aR: number) =>
    mit("hebel", { armLinks: aL, armRechts: aR, balkenMasse: 0.4, startneigung: 0, daempfung: 1.5 });

  it("zählt die Last je Arm getrennt", () => {
    let s = hebel(0.3, 0.3);
    s = anhaengen(s, "links", 0.2);
    s = anhaengen(s, "rechts", 0.5);
    expect(lastAn(s, s.geraete[0].id, "links")).toBeCloseTo(0.2, 9);
    expect(lastAn(s, s.geraete[0].id, "rechts")).toBeCloseTo(0.5, 9);
  });

  it("rechnet das Drehmoment als Kraft mal Arm", () => {
    let s = hebel(0.4, 0.2);
    s = anhaengen(s, "links", 0.1);
    const { links } = hebelMomente(s, s.geraete[0], 0);
    expect(links).toBeCloseTo(0.1 * G * 0.4, 9);
  });

  it("bleibt stehen, wenn F₁·a₁ = F₂·a₂", () => {
    // 200 g am kurzen Arm (20 cm) gegen 100 g am langen (40 cm).
    let s = hebel(0.4, 0.2);
    s = anhaengen(s, "links", 0.1);
    s = anhaengen(s, "rechts", 0.2);

    const momente = hebelMomente(s, s.geraete[0], 0);
    expect(momente.links).toBeCloseTo(momente.rechts, 9);

    // Und er bleibt auch nach zehn Sekunden waagerecht.
    expect(Math.abs(laufen(s, 10).q)).toBeLessThan(bogen(0.5));
  });

  it("kippt zur schwereren Seite und legt sich an den Anschlag", () => {
    let s = hebel(0.3, 0.3);
    s = anhaengen(s, "links", 0.1);
    s = anhaengen(s, "rechts", 0.4);
    // Rechts schwerer heißt: rechte Seite nach unten, also q positiv.
    expect(laufen(s, 10).q).toBeCloseTo(HEBEL_ANSCHLAG, 6);
  });

  it("kippt bei gleichen Massen zum längeren Arm", () => {
    let s = hebel(0.5, 0.2);
    s = anhaengen(s, "links", 0.2);
    s = anhaengen(s, "rechts", 0.2);
    expect(laufen(s, 10).q).toBeCloseTo(-HEBEL_ANSCHLAG, 6);
  });

  it("legt Neigung und beide Momente auf den Messbus", () => {
    let s = hebel(0.4, 0.2);
    s = anhaengen(s, "links", 0.1);
    s = anhaengen(s, "rechts", 0.2);
    const id = s.geraete[0].id;
    const { werte } = schritt(s, leererZustand(), DT);
    expect(werte.get(signalId(id, "momentLinks"))).toBeCloseTo(0.1 * G * 0.4, 6);
    expect(werte.get(signalId(id, "momentRechts"))).toBeCloseTo(0.2 * G * 0.2, 6);
    expect(werte.get(signalId(id, "winkel"))).toBeCloseTo(0, 6);
  });
});

describe("Flaschenzug", () => {
  const zug = (rollen: number, last: number) => {
    let s = mit("flaschenzug", { rollen });
    s = anhaengen(s, "last", last);
    return s;
  };

  it("kennt die Zahl der tragenden Seile", () => {
    expect(tragendeSeile(mit("flaschenzug", { rollen: 4 }).geraete[0])).toBe(4);
    // Krumme Werte runden, unter eins gibt es nicht.
    expect(tragendeSeile(mit("flaschenzug", { rollen: 0 }).geraete[0])).toBe(1);
  });

  it("wiegt die angehängte Last", () => {
    const s = zug(2, 3);
    expect(lastAmFlaschenzug(s, s.geraete[0], {})).toBeCloseTo(3 * G, 9);
  });

  it("teilt die Kraft durch die Zahl der tragenden Seile", () => {
    for (const n of [1, 2, 3, 4, 6]) {
      const s = zug(n, 6);
      const id = s.geraete[0].id;
      const { werte } = schritt(s, leererZustand(), DT);
      expect(werte.get(signalId(id, "last"))).toBeCloseTo(6 * G, 6);
      expect(werte.get(signalId(id, "zugkraft"))).toBeCloseTo((6 * G) / n, 6);
    }
  });

  it("die feste Rolle ändert nur die Richtung, nicht die Kraft", () => {
    const s = zug(1, 2.5);
    const { werte } = schritt(s, leererZustand(), DT);
    expect(werte.get(signalId(s.geraete[0].id, "zugkraft"))).toBeCloseTo(2.5 * G, 6);
  });

  it("der Kraftmesser am Zugseil zeigt die verringerte Kraft", () => {
    // Genau der Schulversuch: Kraftmesser oben, Flaschenzug darunter, Last dran.
    let s = stelle(neueSzene(), "kraftmesser", { x: 0, y: 1.4 });
    s = stelle(s, "flaschenzug", { x: 0, y: 1 });
    const fz = s.geraete[1];
    s = { ...s, geraete: s.geraete.map(g => (g.id === fz.id ? { ...g, werte: { rollen: 4 } } : g)) };
    s = verbinde(s, { geraet: s.geraete[0].id, port: "unten" }, { geraet: fz.id, port: "zug" });

    s = stelle(s, "massestueck", { x: 0, y: 0.5 });
    const masse = s.geraete[2];
    s = { ...s, geraete: s.geraete.map(g => (g.id === masse.id ? { ...g, werte: { masse: 8 } } : g)) };
    s = verbinde(s, { geraet: fz.id, port: "last" }, { geraet: masse.id, port: "oese" });

    // 8 kg an vier tragenden Seilen: der Kraftmesser zeigt ein Viertel.
    expect(haengendeKraft(s, s.geraete[0].id, {})).toBeCloseTo((8 * G) / 4, 6);
  });
});

describe("Schiefe Ebene", () => {
  const ebene = (winkelGrad: number, masse: number, extra: Record<string, number> = {}) =>
    mit("schiefeebene", { winkel: bogen(winkelGrad), masse, laenge: 1, startweg: 0, reibungszahl: 0, ...extra });

  it("legt Hangabtrieb und Normalkraft auf den Messbus", () => {
    const s = ebene(30, 2);
    const id = s.geraete[0].id;
    const { werte } = schritt(s, leererZustand(), DT);
    // F_H = G·sin α, bei 30 Grad genau die Haelfte der Gewichtskraft.
    expect(werte.get(signalId(id, "hangabtrieb"))).toBeCloseTo(2 * G * 0.5, 6);
    expect(werte.get(signalId(id, "normalkraft"))).toBeCloseTo(2 * G * Math.cos(bogen(30)), 6);
  });

  it("hat bei 0 Grad keinen Hangabtrieb und bei 90 Grad das volle Gewicht", () => {
    const flach = schritt(ebene(0, 1), leererZustand(), DT).werte;
    expect(flach.get(signalId("g1", "hangabtrieb"))).toBeCloseTo(0, 9);
    const steil = schritt(ebene(90, 1), leererZustand(), DT).werte;
    expect(steil.get(signalId("g1", "hangabtrieb"))).toBeCloseTo(G, 6);
  });

  it("beschleunigt im Schulbuchmodell mit g·sin α", () => {
    const s = ebene(30, 2, { reibungszahl: 0.4 });
    // Ideal ist reibungsfrei — die Reibungszahl bleibt unberuecksichtigt.
    expect(beschleunigung(s, s.geraete[0], 0, 0)).toBeCloseTo(G * Math.sin(bogen(30)), 9);
  });

  it("wird im realen Modell von der Reibung gebremst", () => {
    const werte = { winkel: bogen(30), masse: 2, laenge: 1, startweg: 0, reibungszahl: 0.3 };
    const real: Szene = { ...mit("schiefeebene", werte), treue: "real" };
    const erwartet = G * (Math.sin(bogen(30)) - 0.3 * Math.cos(bogen(30)));
    expect(beschleunigung(real, real.geraete[0], 0, 0)).toBeCloseTo(erwartet, 9);
  });

  it("bleibt liegen, wenn die Reibung den Hangabtrieb übersteigt", () => {
    const werte = { winkel: bogen(10), masse: 2, laenge: 1, startweg: 0, reibungszahl: 0.9 };
    const real: Szene = { ...mit("schiefeebene", werte), treue: "real" };
    // Reibung kann bremsen, aber nicht bergauf schieben.
    expect(beschleunigung(real, real.geraete[0], 0, 0)).toBe(0);
  });

  it("rutscht bis zum unteren Ende und bleibt dort", () => {
    const s = ebene(30, 2, { laenge: 0.8 });
    const nach = laufen(s, 5);
    expect(nach.q).toBeCloseTo(0.8, 9);
    expect(nach.v).toBe(0);
  });

  it("wird vom Kraftmesser festgehalten — dann misst er die Hangabtriebskraft", () => {
    let s = ebene(30, 2);
    s = stelle(s, "kraftmesser", { x: -0.6, y: 1.4 });
    const km = s.geraete[1];
    s = verbinde(s, { geraet: km.id, port: "unten" }, { geraet: s.geraete[0].id, port: "koerper" });

    expect(wirdGehalten(s, s.geraete[0])).toBe(true);
    // Festgehalten rutscht nichts.
    expect(beschleunigung(s, s.geraete[0], 0, 0)).toBe(0);
    expect(laufen(s, 3).q).toBeCloseTo(0, 9);
    // Und der Kraftmesser zeigt F_H = G·sin α.
    expect(haengendeKraft(s, km.id, {})).toBeCloseTo(2 * G * Math.sin(bogen(30)), 6);
  });
});

describe("Balkenwaage", () => {
  const waage = () => mit("waage", { armLinks: 0.3, armRechts: 0.3, balkenMasse: 0.4, startneigung: 0, daempfung: 2.5 });

  /** Stellt ein Massestück auf eine Schale (oder auf das, was dort schon steht). */
  function stelleAuf(s: Szene, schale: string, masse: number) {
    const neu = stelle(s, "massestueck", { x: 5, y: 5 });
    const g = neu.geraete[neu.geraete.length - 1];
    const mitWert = { ...neu, geraete: neu.geraete.map(x => (x.id === g.id ? { ...x, werte: { masse } } : x)) };
    const ziel = freierHaken(mitWert, { geraet: mitWert.geraete[0].id, port: schale });
    return { szene: verbinde(mitWert, ziel, { geraet: g.id, port: "oese" }), id: g.id };
  }

  it("bleibt waagerecht, wenn links so viel steht wie rechts", () => {
    let s = waage();
    s = stelleAuf(s, "links", 0.5).szene;
    s = stelleAuf(s, "rechts", 0.5).szene;
    expect(Math.abs(laufen(s, 8).q)).toBeLessThan(bogen(0.5));
  });

  it("neigt sich zur schwereren Seite", () => {
    let s = waage();
    s = stelleAuf(s, "links", 0.2).szene;
    s = stelleAuf(s, "rechts", 0.8).szene;
    // Rechts schwerer heisst: rechte Schale nach unten, q positiv.
    expect(laufen(s, 8).q).toBeCloseTo(HEBEL_ANSCHLAG, 6);
  });

  it("meldet beide Schalenmassen", () => {
    let s = waage();
    s = stelleAuf(s, "links", 0.25).szene;
    s = stelleAuf(s, "rechts", 0.75).szene;
    const id = s.geraete[0].id;
    const { werte } = schritt(s, leererZustand(), DT);
    expect(werte.get(signalId(id, "masseLinks"))).toBeCloseTo(0.25, 9);
    expect(werte.get(signalId(id, "masseRechts"))).toBeCloseTo(0.75, 9);
  });

  it("stellt das Gewicht auf die Schale, nicht darunter", () => {
    const { szene, id } = stelleAuf(waage(), "links", 0.5);
    const fertig = aufgeloest(szene);
    const schale = portOrt(fertig.geraete[0], "links")!;
    const gewicht = fertig.geraete.find(g => g.id === id)!;
    // Die Unterkante liegt auf der Schale — der Mittelpunkt also darüber.
    expect(gewicht.pos.y).toBeCloseTo(schale.y + 0.04, 9);
  });

  it("stapelt auf der Schale nach oben, nicht nach unten", () => {
    let s = waage();
    const erstes = stelleAuf(s, "links", 0.3);
    s = erstes.szene;
    // Der naechste freie Platz ist oben auf dem ersten Gewicht.
    expect(freierHaken(s, { geraet: s.geraete[0].id, port: "links" }))
      .toEqual({ geraet: erstes.id, port: "oese" });

    const zweites = stelleAuf(s, "links", 0.3);
    const fertig = aufgeloest(zweites.szene);
    const unten = fertig.geraete.find(g => g.id === erstes.id)!;
    const oben = fertig.geraete.find(g => g.id === zweites.id)!;
    expect(oben.pos.y - unten.pos.y).toBeCloseTo(0.08, 6);
  });
});

describe("Kraftmesser am Hebel", () => {
  /** Hebel mit Last am einen Arm und einem Kraftmesser am anderen. */
  function mitMesser(aL: number, aR: number, masseLinks: number, seite: "links" | "rechts") {
    let s = mit("hebel", { armLinks: aL, armRechts: aR, balkenMasse: 0.4, startneigung: 0, daempfung: 1.5 });
    if (masseLinks > 0) s = anhaengen(s, "links", masseLinks);
    s = stelle(s, "kraftmesser", { x: 1, y: 1 });
    const messer = s.geraete[s.geraete.length - 1].id;
    s = verbinde(s, { geraet: messer, port: "unten" }, { geraet: s.geraete[0].id, port: seite });
    return { szene: s, messer, hebel: s.geraete[0].id };
  }

  it("zeigt die Kraft, die den Balken waagerecht hält", () => {
    // 1 kg am 40-cm-Arm, der Messer am 20-cm-Arm der anderen Seite.
    let s = mit("hebel", { armLinks: 0.4, armRechts: 0.2, balkenMasse: 0.4, startneigung: 0, daempfung: 1.5 });
    s = anhaengen(s, "links", 1);
    s = stelle(s, "kraftmesser", { x: 1, y: 1 });
    const messer = s.geraete[s.geraete.length - 1].id;
    s = verbinde(s, { geraet: messer, port: "unten" }, { geraet: s.geraete[0].id, port: "links" });

    // Der Messer haengt an der schweren Seite: er traegt deren ganzes Moment.
    expect(haltekraft(s, s.geraete[0], "links")).toBeCloseTo((1 * G * 0.4) / 0.4, 9);
    expect(haengendeKraft(s, messer, {})).toBeCloseTo(1 * G, 6);
  });

  it("hält den Hebel waagerecht, statt ihn kippen zu lassen", () => {
    const { szene, hebel } = mitMesser(0.3, 0.3, 2, "links");
    expect(hebelGehalten(szene, szene.geraete[0])).toBe("links");
    // Ohne Messer wuerde er nach links kippen; mit ihm bleibt er stehen.
    const nach = laufen(szene, 8);
    expect(Math.abs(nach.q)).toBeCloseTo(0, 6);
    expect(hebel).toBeTruthy();
  });

  it("kann nur ziehen, nicht drücken", () => {
    // Der Messer haengt an der *leichten* Seite — dort kann er nichts halten.
    const { szene } = mitMesser(0.3, 0.3, 2, "rechts");
    expect(haltekraft(szene, szene.geraete[0], "rechts")).toBe(0);
    expect(hebelGehalten(szene, szene.geraete[0])).toBeNull();
    // Also kippt der Hebel wie ohne ihn zur schweren Seite.
    expect(laufen(szene, 8).q).toBeCloseTo(-HEBEL_ANSCHLAG, 6);
  });

  it("zeigt weniger an, wenn die andere Seite gegenhält", () => {
    // Der Messer haengt ueber der schweren Seite und traegt deren Moment. Ein
    // Gegengewicht drueben nimmt ihm genau dessen Moment ab.
    let s = mit("hebel", { armLinks: 0.3, armRechts: 0.3, balkenMasse: 0.4, startneigung: 0, daempfung: 1.5 });
    s = anhaengen(s, "links", 2);
    s = stelle(s, "kraftmesser", { x: 1, y: 1 });
    const messer = s.geraete[s.geraete.length - 1].id;
    s = verbinde(s, { geraet: messer, port: "unten" }, { geraet: s.geraete[0].id, port: "links" });

    expect(haengendeKraft(s, messer, {})).toBeCloseTo(2 * G, 6);

    // Ein Kilogramm drueben: der Messer traegt nur noch den Unterschied.
    const mitGegen = anhaengen(s, "rechts", 1);
    expect(haengendeKraft(mitGegen, messer, {})).toBeCloseTo(1 * G, 6);
  });;
});

describe("Federpendel ohne Eigenmasse", () => {
  it("steht still, solange nichts daran hängt", () => {
    const s = mit("federpendel", { federkonstante: 20, startauslenkung: 0.05, daempfung: 0 });
    // Keine Masse, nichts zu beschleunigen — es bleibt, wo es losgelassen wurde.
    expect(beschleunigung(s, s.geraete[0], 0.05, 0)).toBe(0);
    expect(laufen(s, 5).q).toBeCloseTo(0.05, 9);
  });

  it("schwingt, sobald ein Gewicht daran hängt", () => {
    let s = mit("federpendel", { federkonstante: 20, startauslenkung: 0.05, daempfung: 0 });
    s = anhaengen(s, "koerper", 0.5);
    expect(beschleunigung(s, s.geraete[0], 0.05, 0)).toBeCloseTo(-(20 / 0.5) * 0.05, 9);
  });
});

describe("Hebel auf einem Drehpunkt", () => {
  it("legt den Balken mit seiner Achse auf die Spitze", () => {
    let s = stelle(neueSzene(), "drehpunkt", { x: 0.4, y: 2 });
    const keil = s.geraete[0].id;
    s = stelle(s, "hebel", { x: 5, y: 5 });
    const balken = s.geraete[1].id;
    s = verbinde(s, { geraet: keil, port: "spitze" }, { geraet: balken, port: "achse" });

    const fertig = aufgeloest(s);
    // Der Keil steht auf dem Boden, der Balken sitzt auf seiner Spitze.
    const spitze = portOrt(fertig.geraete[0], "spitze")!;
    expect(fertig.geraete[0].pos.y).toBeCloseTo(0.05, 9);
    expect(fertig.geraete[1].pos.x).toBeCloseTo(spitze.x, 9);
    expect(fertig.geraete[1].pos.y).toBeCloseTo(spitze.y, 9);
  });

  it("kippt ab, wenn es ungleich beladen ist", () => {
    let s = stelle(neueSzene(), "drehpunkt", { x: 0, y: 0.05 });
    s = stelle(s, "hebel", { x: 5, y: 5 });
    const balken = s.geraete[1];
    s = { ...s, geraete: s.geraete.map(g => (g.id === balken.id
      ? { ...g, werte: { armLinks: 0.3, armRechts: 0.3, balkenMasse: 0.4, startneigung: 0, daempfung: 1.5 } } : g)) };
    s = verbinde(s, { geraet: s.geraete[0].id, port: "spitze" }, { geraet: balken.id, port: "achse" });

    // Ein Gewicht rechts — der Balken legt sich nach rechts.
    s = stelle(s, "massestueck", { x: 5, y: 5 });
    const gewicht = s.geraete[2].id;
    s = { ...s, geraete: s.geraete.map(g => (g.id === gewicht ? { ...g, werte: { masse: 0.5 } } : g)) };
    s = verbinde(s, { geraet: balken.id, port: "rechts" }, { geraet: gewicht, port: "oese" });

    let zustand: MechanikZustand = {};
    for (let i = 1; i * DT <= 8; i++) zustand = mechanikSchritt(s, zustand, DT);
    expect(zustand[balken.id].q).toBeCloseTo(HEBEL_ANSCHLAG, 6);
  });
});

describe("Federkraftmesser von unten", () => {
  /** Balken, Last links, Messer unter dem rechten Arm. */
  function vonUnten() {
    let s = mit("hebel", { armLinks: 0.3, armRechts: 0.3, balkenMasse: 0.4, startneigung: 0, daempfung: 1.5 });
    s = anhaengen(s, "links", 2);
    s = stelle(s, "kraftmesser", { x: 1, y: 0.3 });
    const messer = s.geraete[s.geraete.length - 1].id;
    // Mit seiner *Aufhängung* am Arm: er steht darunter und wird nach unten gezogen.
    s = verbinde(s, { geraet: messer, port: "oben" }, { geraet: s.geraete[0].id, port: "rechts" });
    return { szene: s, messer };
  }

  it("hält die leichtere Seite unten, wo der Messer von oben nichts könnte", () => {
    const { szene, messer } = vonUnten();
    // Von unten am leichten Arm: er zieht ihn herunter und gleicht aus.
    expect(haltekraft(szene, szene.geraete[0], "rechts", "runter")).toBeCloseTo(2 * G, 6);
    expect(haengendeKraft(szene, messer, {})).toBeCloseTo(2 * G, 6);
    expect(hebelGehalten(szene, szene.geraete[0])).toBe("rechts");
  });

  it("zeigt nichts an, wenn seine Seite ohnehin die schwerere ist", () => {
    // Derselbe Aufbau, aber der Messer haengt unter der *schweren* Seite.
    let s = mit("hebel", { armLinks: 0.3, armRechts: 0.3, balkenMasse: 0.4, startneigung: 0, daempfung: 1.5 });
    s = anhaengen(s, "links", 2);
    s = stelle(s, "kraftmesser", { x: 1, y: 0.3 });
    const messer = s.geraete[s.geraete.length - 1].id;
    s = verbinde(s, { geraet: messer, port: "oben" }, { geraet: s.geraete[0].id, port: "links" });
    expect(haengendeKraft(s, messer, {})).toBe(0);
  });
});
