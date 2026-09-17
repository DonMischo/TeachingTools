/**
 * Die Mechanik — und die Frage, an der sich entscheidet, ob das Labor
 * unterrichtstauglich ist: **stimmt die Messung mit der Formel überein?**
 *
 * Deshalb steht hier nicht „läuft durch", sondern gemessene Perioden gegen
 * 2π√(L/g) und 2π√(m/D). Und gleich daneben die Gegenprobe: bei großem
 * Ausschlag darf das Fadenpendel *nicht* mehr zur Formel passen, denn
 * gerechnet wird die echte Gleichung θ″ = −(g/L)·sin θ und nicht ihre
 * Näherung für kleine Winkel. Genau diese Abweichung ist Unterrichtsstoff.
 */
import { describe, it, expect } from "vitest";
import { anfang, beschleunigung, gesamtMasse, mechanikSchritt, rk4, type MechanikZustand } from "@/lib/physik/mechanik";
import { neueSzene, stelle, verbinde } from "@/lib/physik/szene";
import { bogen, G } from "@/lib/physik/einheiten";
import { FEDER_RUHE, koerperOrt, startWertAus } from "@/lib/physik/geometrie";
import type { Szene } from "@/lib/physik/typen";

const DT = 1 / 240;

/** Stellt ein Gerät mit eigenen Werten hin. */
function mit(typ: string, werte: Record<string, number>): Szene {
  const s = stelle(neueSzene(), typ, { x: 0, y: 1 });
  return { ...s, geraete: s.geraete.map(g => ({ ...g, werte: { ...g.werte, ...werte } })) };
}

/**
 * Lässt einen Aufbau laufen und misst die Schwingungsdauer über die
 * steigenden Nulldurchgänge — so, wie man es mit der Stoppuhr auch täte,
 * nur genauer.
 */
function schwingungsdauer(szene: Szene, sekunden: number): { T: number; ausschlaege: number[] } {
  const id = szene.geraete[0].id;
  let zustand: MechanikZustand = {};
  let vorher = 0;
  const durchgaenge: number[] = [];
  const ausschlaege: number[] = [];

  for (let i = 1; i * DT <= sekunden; i++) {
    zustand = mechanikSchritt(szene, zustand, DT);
    const q = zustand[id].q;
    if (vorher < 0 && q >= 0) {
      // Zwischen den beiden Abtastpunkten linear interpolieren.
      durchgaenge.push((i - 1) * DT + (DT * -vorher) / (q - vorher));
    }
    ausschlaege.push(Math.abs(q));
    vorher = q;
  }

  expect(durchgaenge.length).toBeGreaterThan(3);
  const T = (durchgaenge[durchgaenge.length - 1] - durchgaenge[0]) / (durchgaenge.length - 1);
  return { T, ausschlaege };
}

describe("rk4", () => {
  it("hält die Energie eines harmonischen Schwingers über viele Perioden", () => {
    // q″ = −q, also ω = 1: Energie ∝ q² + v².
    const a = (q: number) => -q;
    let s = { q: 1, v: 0, start: 1 };
    const energie = (x: typeof s) => x.q * x.q + x.v * x.v;
    const anfangsEnergie = energie(s);
    for (let i = 0; i < 240 * 60; i++) s = { ...rk4(s, DT, a), start: s.start };
    // Nach 60 s (rund zehn Perioden) darf kaum etwas fehlen.
    expect(Math.abs(energie(s) - anfangsEnergie) / anfangsEnergie).toBeLessThan(1e-6);
  });
});

describe("beschleunigung", () => {
  /** Die Beschleunigung des einzigen Geräts der Szene. */
  const a = (s: Szene, q: number, v: number) => beschleunigung(s, s.geraete[0], q, v);

  it("zieht das Fadenpendel zur Ruhelage zurück", () => {
    const s = mit("fadenpendel", { laenge: 1, masse: 0.2, daempfung: 0.1 });
    expect(a(s, 0.1, 0)).toBeLessThan(0);
    expect(a(s, -0.1, 0)).toBeGreaterThan(0);
    expect(a(s, 0, 0)).toBeCloseTo(0, 12);
  });

  it("rechnet mit dem Sinus, nicht mit der Näherung", () => {
    const s = mit("fadenpendel", { laenge: 1, masse: 0.2, daempfung: 0 });
    const q = bogen(60);
    expect(a(s, q, 0)).toBeCloseTo(-G * Math.sin(q), 9);
    expect(a(s, q, 0)).not.toBeCloseTo(-G * q, 2);
  });

  it("bremst nur im realen Modell", () => {
    const werte = { laenge: 1, masse: 0.2, daempfung: 0.5 };
    expect(a(mit("fadenpendel", werte), 0, 1)).toBeCloseTo(0, 12);
    const real: Szene = { ...mit("fadenpendel", werte), treue: "real" };
    expect(a(real, 0, 1)).toBeCloseTo(-0.5, 12);
  });

  it("folgt beim Federpendel dem Hookeschen Gesetz", () => {
    const s = mit("federpendel", { federkonstante: 20, masse: 0.5, daempfung: 0 });
    expect(a(s, 0.1, 0)).toBeCloseTo(-(20 / 0.5) * 0.1, 9);
  });
});

describe("Fadenpendel", () => {
  it("schwingt bei kleinem Ausschlag mit 2π√(L/g)", () => {
    for (const laenge of [0.25, 1, 2.5]) {
      const { T } = schwingungsdauer(
        mit("fadenpendel", { laenge, masse: 0.2, startwinkel: bogen(5), daempfung: 0 }),
        30,
      );
      const formel = 2 * Math.PI * Math.sqrt(laenge / G);
      expect(Math.abs(T - formel) / formel).toBeLessThan(0.005);
    }
  });

  it("hängt nicht von der Masse ab", () => {
    const leicht = schwingungsdauer(mit("fadenpendel", { laenge: 1, masse: 0.05, startwinkel: bogen(5), daempfung: 0 }), 30);
    const schwer = schwingungsdauer(mit("fadenpendel", { laenge: 1, masse: 5, startwinkel: bogen(5), daempfung: 0 }), 30);
    expect(leicht.T).toBeCloseTo(schwer.T, 6);
  });

  it("braucht bei großem Ausschlag messbar länger — die Formel gilt nur für kleine Winkel", () => {
    const klein = schwingungsdauer(mit("fadenpendel", { laenge: 1, masse: 0.2, startwinkel: bogen(5), daempfung: 0 }), 30);
    const gross = schwingungsdauer(mit("fadenpendel", { laenge: 1, masse: 0.2, startwinkel: bogen(60), daempfung: 0 }), 30);
    // Für 60° liegt die echte Periode rund 7 % über der Näherung.
    expect(gross.T / klein.T).toBeGreaterThan(1.05);
    expect(gross.T / klein.T).toBeLessThan(1.09);
  });

  it("schwingt im Schulbuchmodell unvermindert weiter", () => {
    const { ausschlaege } = schwingungsdauer(
      mit("fadenpendel", { laenge: 1, masse: 0.2, startwinkel: bogen(10), daempfung: 0.2 }),
      60,
    );
    const frueh = Math.max(...ausschlaege.slice(0, 2400));
    const spaet = Math.max(...ausschlaege.slice(-2400));
    expect(spaet / frueh).toBeGreaterThan(0.99);
  });

  it("kommt im realen Modell zur Ruhe", () => {
    const szene = mit("fadenpendel", { laenge: 1, masse: 0.2, startwinkel: bogen(10), daempfung: 0.2 });
    const { ausschlaege } = schwingungsdauer({ ...szene, treue: "real" }, 60);
    const frueh = Math.max(...ausschlaege.slice(0, 2400));
    const spaet = Math.max(...ausschlaege.slice(-2400));
    expect(spaet / frueh).toBeLessThan(0.1);
  });
});

describe("Federpendel", () => {
  it("schwingt mit 2π√(m/D)", () => {
    for (const [masse, federkonstante] of [[0.1, 10], [0.5, 20], [1, 5]]) {
      const { T } = schwingungsdauer(
        mit("federpendel", { masse, federkonstante, startauslenkung: 0.05, daempfung: 0 }),
        30,
      );
      const formel = 2 * Math.PI * Math.sqrt(masse / federkonstante);
      expect(Math.abs(T - formel) / formel).toBeLessThan(0.005);
    }
  });

  it("schwingt anders als das Fadenpendel unabhängig vom Ausschlag", () => {
    const klein = schwingungsdauer(mit("federpendel", { masse: 0.5, federkonstante: 20, startauslenkung: 0.01, daempfung: 0 }), 20);
    const gross = schwingungsdauer(mit("federpendel", { masse: 0.5, federkonstante: 20, startauslenkung: 0.2, daempfung: 0 }), 20);
    expect(klein.T).toBeCloseTo(gross.T, 6);
  });
});

describe("mechanikSchritt", () => {
  it("setzt ein neues Gerät auf seine Anfangsauslenkung", () => {
    const szene = mit("fadenpendel", { laenge: 1, masse: 0.2, startwinkel: bogen(12), daempfung: 0 });
    const zustand = mechanikSchritt(szene, {}, DT);
    expect(zustand[szene.geraete[0].id].q).toBeCloseTo(bogen(12), 2);
  });

  it("lässt ein Gerät los, sobald man den Startwert verstellt", () => {
    const szene = mit("fadenpendel", { laenge: 1, masse: 0.2, startwinkel: bogen(5), daempfung: 0 });
    const id = szene.geraete[0].id;
    let zustand: MechanikZustand = {};
    for (let i = 0; i < 60; i++) zustand = mechanikSchritt(szene, zustand, DT);
    expect(zustand[id].v).not.toBeCloseTo(0, 6);

    const verstellt = mit("fadenpendel", { laenge: 1, masse: 0.2, startwinkel: bogen(30), daempfung: 0 });
    const neu = mechanikSchritt({ ...verstellt, geraete: verstellt.geraete.map(g => ({ ...g, id })) }, zustand, DT);
    expect(neu[id].q).toBeCloseTo(bogen(30), 2);
    expect(neu[id].v).toBeCloseTo(0, 2);
  });

  it("vergisst Geräte, die nicht mehr auf dem Tisch stehen", () => {
    const szene = mit("fadenpendel", { laenge: 1, masse: 0.2, startwinkel: 0.1, daempfung: 0 });
    const zustand = mechanikSchritt(szene, { weggeraeumt: { q: 1, v: 1, start: 1 } }, DT);
    expect(zustand.weggeraeumt).toBeUndefined();
  });

  it("lässt Geräte ohne Mechanik in Ruhe", () => {
    const szene = stelle(neueSzene(), "stativ", { x: 0, y: 0 });
    expect(Object.keys(mechanikSchritt(szene, {}, DT))).toEqual([]);
  });
});

describe("anfang", () => {
  it("startet in Ruhe bei der eingestellten Auslenkung", () => {
    expect(anfang("fadenpendel", { startwinkel: 0.3 })).toEqual({ q: 0.3, v: 0, start: 0.3 });
    expect(anfang("federpendel", { startauslenkung: 0.04 })).toEqual({ q: 0.04, v: 0, start: 0.04 });
  });
});

describe("Körper greifen", () => {
  it("setzt den Körper an seine Startauslenkung, solange nichts läuft", () => {
    const feder = mit("federpendel", { startauslenkung: 0.08 });
    const ort = koerperOrt(feder.geraete[0], undefined)!;
    // Der Aufhängepunkt liegt bei y = 1; darunter Ruhelänge plus Auslenkung.
    expect(ort.y).toBeCloseTo(1 - (FEDER_RUHE + 0.08), 9);

    const pendel = mit("fadenpendel", { laenge: 1, startwinkel: bogen(30) });
    const p = koerperOrt(pendel.geraete[0], undefined)!;
    expect(p.x).toBeCloseTo(Math.sin(bogen(30)), 9);
    expect(p.y).toBeCloseTo(1 - Math.cos(bogen(30)), 9);
  });

  it("folgt dem laufenden Zustand, nicht mehr dem Startwert", () => {
    const feder = mit("federpendel", { startauslenkung: 0.08 });
    const ort = koerperOrt(feder.geraete[0], { q: -0.02 })!;
    expect(ort.y).toBeCloseTo(1 - (FEDER_RUHE - 0.02), 9);
  });

  it("rechnet aus dem Griffpunkt den Startwert zurück", () => {
    // Ziehen und Loslassen ist genau das: den Startwert setzen.
    const feder = mit("federpendel", {});
    expect(startWertAus(feder.geraete[0], { x: 0, y: 1 - FEDER_RUHE - 0.12 })).toBeCloseTo(0.12, 9);

    const pendel = mit("fadenpendel", { laenge: 1 });
    const winkel = bogen(40);
    const gezogen = { x: Math.sin(winkel), y: 1 - Math.cos(winkel) };
    expect(startWertAus(pendel.geraete[0], gezogen)).toBeCloseTo(winkel, 9);
  });

  it("greift nur, wo es etwas zu greifen gibt", () => {
    const stativ = stelle(neueSzene(), "stativ", { x: 0, y: 0 });
    expect(koerperOrt(stativ.geraete[0], undefined)).toBeNull();
    expect(startWertAus(stativ.geraete[0], { x: 1, y: 1 })).toBeNull();
  });
});

describe("Gewichte am Schwingkörper", () => {
  /** Hängt Massestücke an den Körper des Geräts. */
  function mitGewichten(typ: string, werte: Record<string, number>, ...gewichte: number[]): Szene {
    let s = mit(typ, werte);
    for (const masse of gewichte) {
      s = stelle(s, "massestueck", { x: 0.3, y: 0.3 });
      const neu = s.geraete[s.geraete.length - 1];
      s = { ...s, geraete: s.geraete.map(g => (g.id === neu.id ? { ...g, werte: { masse } } : g)) };
      s = verbinde(s, { geraet: s.geraete[0].id, port: "koerper" }, { geraet: neu.id, port: "oese" });
    }
    return s;
  }

  it("zählt angehängte Massen zur schwingenden Masse", () => {
    const s = mitGewichten("federpendel", { masse: 0.1 }, 0.2, 0.3);
    expect(gesamtMasse(s, s.geraete[0])).toBeCloseTo(0.6, 9);
  });

  it("macht das Federpendel langsamer — 2π√(m/D) mit der Gesamtmasse", () => {
    const grund = { masse: 0.1, federkonstante: 20, startauslenkung: 0.05, daempfung: 0 };
    const ohne = schwingungsdauer(mit("federpendel", grund), 20);
    const dran = schwingungsdauer(mitGewichten("federpendel", grund, 0.3), 20);

    // 0,1 kg + 0,3 kg an der Feder: T = 2π√(0,4/20).
    expect(dran.T).toBeCloseTo(2 * Math.PI * Math.sqrt(0.4 / 20), 2);
    // Viermal die Masse heißt doppelte Schwingungsdauer.
    expect(dran.T / ohne.T).toBeCloseTo(2, 2);
  });

  it("lässt das Fadenpendel unbeeindruckt — die Masse kürzt sich heraus", () => {
    const grund = { laenge: 1, masse: 0.1, startwinkel: bogen(5), daempfung: 0 };
    const ohne = schwingungsdauer(mit("fadenpendel", grund), 20);
    const dran = schwingungsdauer(mitGewichten("fadenpendel", grund, 1.5), 20);
    expect(dran.T).toBeCloseTo(ohne.T, 6);
  });

  it("zählt nur, was am Körper hängt — nicht, was an der Aufhängung steckt", () => {
    let s = mit("federpendel", { masse: 0.1 });
    s = stelle(s, "stativ", { x: 0, y: 1.5 });
    s = verbinde(s, { geraet: s.geraete[0].id, port: "aufhaengung" }, { geraet: s.geraete[1].id, port: "haken" });
    expect(gesamtMasse(s, s.geraete[0])).toBeCloseTo(0.1, 9);
  });
});
