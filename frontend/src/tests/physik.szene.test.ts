/**
 * Die Szene ist der »Aufbau« auf der Werkbank: welche Geräte stehen wo, was ist
 * womit verbunden, und wie genau wird gerechnet. Sie ist reine Datenhaltung —
 * kein Solver, kein Canvas. Alle Längen in Metern, y zeigt nach oben.
 */
import { describe, it, expect } from "vitest";
import {
  neueSzene, stelle, entferne, bewege, verbinde, trenne,
  treueVon, alsJSON, ausJSON, zumBild, zurWelt, portOrt, freierPlatz,
  aufgeloest, aushaengen, haengtIrgendwo, andockStelle,
} from "@/lib/physik/szene";
import type { Szene } from "@/lib/physik/typen";

describe("neueSzene", () => {
  it("ist leer und rechnet voreingestellt mit dem Schulbuchmodell", () => {
    const s = neueSzene();
    expect(s.version).toBe(1);
    expect(s.geraete).toEqual([]);
    expect(s.verbindungen).toEqual([]);
    expect(s.treue).toBe("ideal");
  });
});

describe("stelle", () => {
  it("setzt ein Gerät mit den Voreinstellungen aus dem Katalog", () => {
    const s = stelle(neueSzene(), "massestueck", { x: 0, y: 1 });
    expect(s.geraete).toHaveLength(1);
    expect(s.geraete[0].typ).toBe("massestueck");
    expect(s.geraete[0].pos).toEqual({ x: 0, y: 1 });
    // Masse in Kilogramm — SI, nicht Gramm.
    expect(s.geraete[0].werte.masse).toBeGreaterThan(0);
  });

  it("vergibt fortlaufende, eindeutige Ids", () => {
    let s = neueSzene();
    s = stelle(s, "stativ", { x: 0, y: 0 });
    s = stelle(s, "stativ", { x: 1, y: 0 });
    const ids = s.geraete.map(g => g.id);
    expect(new Set(ids).size).toBe(2);
  });

  it("weist einen unbekannten Typ ab", () => {
    expect(() => stelle(neueSzene(), "warpkern", { x: 0, y: 0 })).toThrow();
  });

  it("lässt die alte Szene unverändert", () => {
    const alt = neueSzene();
    stelle(alt, "stativ", { x: 0, y: 0 });
    expect(alt.geraete).toHaveLength(0);
  });
});

describe("verbinde", () => {
  const aufbau = () => {
    let s = neueSzene();
    s = stelle(s, "stativ", { x: 0, y: 0 });
    s = stelle(s, "massestueck", { x: 0, y: 1 });
    s = stelle(s, "kraftmesser", { x: 1, y: 1 });
    return s;
  };

  it("verbindet zwei Ports gleicher Art", () => {
    const s = aufbau();
    const [stativ, masse] = s.geraete;
    const v = verbinde(s, { geraet: stativ.id, port: "haken" }, { geraet: masse.id, port: "oese" });
    expect(v.verbindungen).toHaveLength(1);
  });

  it("weist Ports verschiedener Art ab", () => {
    let s = aufbau();
    s = stelle(s, "lampe", { x: 2, y: 0 });
    const masse = s.geraete[1], lampe = s.geraete[3];
    expect(() => verbinde(s, { geraet: masse.id, port: "oese" }, { geraet: lampe.id, port: "plus" })).toThrow();
  });

  it("weist unbekannte Geräte und Ports ab", () => {
    const s = aufbau();
    const stativ = s.geraete[0];
    expect(() => verbinde(s, { geraet: "gibtsnicht", port: "haken" }, { geraet: stativ.id, port: "haken" })).toThrow();
    expect(() => verbinde(s, { geraet: stativ.id, port: "flansch" }, { geraet: stativ.id, port: "haken" })).toThrow();
  });

  it("verbindet nicht zweimal dasselbe Paar", () => {
    const s = aufbau();
    const [stativ, masse] = s.geraete;
    const a = { geraet: stativ.id, port: "haken" }, b = { geraet: masse.id, port: "oese" };
    const eins = verbinde(s, a, b);
    expect(() => verbinde(eins, b, a)).toThrow();
  });

  it("trennt wieder", () => {
    const s = aufbau();
    const [stativ, masse] = s.geraete;
    const v = verbinde(s, { geraet: stativ.id, port: "haken" }, { geraet: masse.id, port: "oese" });
    expect(trenne(v, v.verbindungen[0].id).verbindungen).toHaveLength(0);
  });
});

describe("entferne", () => {
  it("nimmt das Gerät samt seiner Verbindungen mit", () => {
    let s = neueSzene();
    s = stelle(s, "stativ", { x: 0, y: 0 });
    s = stelle(s, "massestueck", { x: 0, y: 1 });
    const [stativ, masse] = s.geraete;
    s = verbinde(s, { geraet: stativ.id, port: "haken" }, { geraet: masse.id, port: "oese" });
    const ohne = entferne(s, masse.id);
    expect(ohne.geraete).toHaveLength(1);
    expect(ohne.verbindungen).toHaveLength(0);
  });
});

describe("bewege", () => {
  it("verschiebt nur das gemeinte Gerät", () => {
    let s = stelle(neueSzene(), "stativ", { x: 0, y: 0 });
    s = stelle(s, "stativ", { x: 5, y: 0 });
    const bewegt = bewege(s, s.geraete[0].id, { x: 2, y: 3 });
    expect(bewegt.geraete[0].pos).toEqual({ x: 2, y: 3 });
    expect(bewegt.geraete[1].pos).toEqual({ x: 5, y: 0 });
  });
});

describe("treueVon", () => {
  it("nimmt die Einstellung der Szene", () => {
    const s = stelle({ ...neueSzene(), treue: "real" }, "stativ", { x: 0, y: 0 });
    expect(treueVon(s, s.geraete[0])).toBe("real");
  });

  it("lässt das einzelne Gerät die Szene überstimmen", () => {
    const s = stelle({ ...neueSzene(), treue: "real" }, "stativ", { x: 0, y: 0 });
    const g = { ...s.geraete[0], treue: "ideal" as const };
    expect(treueVon(s, g)).toBe("ideal");
  });
});

describe("alsJSON / ausJSON", () => {
  it("überlebt die Runde", () => {
    let s = neueSzene();
    s = stelle(s, "stativ", { x: 0, y: 0 });
    s = stelle(s, "massestueck", { x: 0, y: 1.25 });
    s = verbinde(s, { geraet: s.geraete[0].id, port: "haken" }, { geraet: s.geraete[1].id, port: "oese" });
    expect(ausJSON(alsJSON(s))).toEqual(s);
  });

  it("gibt bei Unsinn eine leere Szene zurück statt zu werfen", () => {
    expect(ausJSON("{kaputt")).toEqual(neueSzene());
    expect(ausJSON("null")).toEqual(neueSzene());
    expect(ausJSON('{"version":99}')).toEqual(neueSzene());
  });

  it("wirft Verbindungen weg, deren Gerät fehlt", () => {
    const roh = JSON.stringify({
      version: 1, titel: "Test", treue: "ideal",
      geraete: [{ id: "g1", typ: "stativ", pos: { x: 0, y: 0 }, winkel: 0, werte: {} }],
      verbindungen: [{ id: "v1", von: { geraet: "g1", port: "haken" }, nach: { geraet: "weg", port: "oese" } }],
    });
    expect(ausJSON(roh).verbindungen).toEqual([]);
  });

  it("überspringt Geräte, die der Katalog nicht kennt", () => {
    const roh = JSON.stringify({
      version: 1, titel: "Test", treue: "ideal",
      geraete: [{ id: "g1", typ: "warpkern", pos: { x: 0, y: 0 }, winkel: 0, werte: {} }],
      verbindungen: [],
    });
    expect(ausJSON(roh).geraete).toEqual([]);
  });
});

describe("zumBild / zurWelt", () => {
  // Die einzige Stelle, an der Meter auf Pixel treffen.
  const blick = { mitte: { x: 0, y: 0 }, skala: 100, breite: 800, hoehe: 600 };

  it("legt den Ursprung in die Mitte der Leinwand", () => {
    expect(zumBild({ x: 0, y: 0 }, blick)).toEqual({ x: 400, y: 300 });
  });

  it("lässt y nach oben zeigen", () => {
    expect(zumBild({ x: 0, y: 1 }, blick)).toEqual({ x: 400, y: 200 });
  });

  it("rechnet zurück", () => {
    const welt = { x: 1.37, y: -0.5 };
    const zurueck = zurWelt(zumBild(welt, blick), blick);
    expect(zurueck.x).toBeCloseTo(welt.x, 9);
    expect(zurueck.y).toBeCloseTo(welt.y, 9);
  });
});

describe("portOrt", () => {
  it("legt den Port neben sein Gerät", () => {
    const s = stelle(neueSzene(), "massestueck", { x: 2, y: 3 });
    const p = portOrt(s.geraete[0], "oese")!;
    expect(p.x).toBeCloseTo(2, 9);
    expect(p.y).toBeCloseTo(3.04, 9);
  });

  it("dreht ihn mit dem Gerät mit", () => {
    const s = stelle(neueSzene(), "massestueck", { x: 0, y: 0 });
    const gedreht = { ...s.geraete[0], winkel: Math.PI / 2 };
    const p = portOrt(gedreht, "oese")!;
    // Die Öse sitzt 4 cm über der Mitte — nach einer Vierteldrehung links davon.
    expect(p.x).toBeCloseTo(-0.04, 9);
    expect(p.y).toBeCloseTo(0, 9);
  });

  it("kennt keinen erfundenen Port", () => {
    const s = stelle(neueSzene(), "massestueck", { x: 0, y: 0 });
    expect(portOrt(s.geraete[0], "flansch")).toBeUndefined();
  });
});

describe("freierPlatz", () => {
  it("gibt auf dem leeren Tisch einen Platz zurück", () => {
    const p = freierPlatz(neueSzene());
    expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
  });

  it("legt kein Gerät auf ein anderes", () => {
    let s = neueSzene();
    for (let i = 0; i < 12; i++) s = stelle(s, "massestueck", freierPlatz(s));
    const orte = s.geraete.map(g => g.pos);
    for (let i = 0; i < orte.length; i++) {
      for (let j = i + 1; j < orte.length; j++) {
        expect(Math.hypot(orte[i].x - orte[j].x, orte[i].y - orte[j].y)).toBeGreaterThan(0.05);
      }
    }
  });
});

describe("portOrt bei beweglichen Anschlüssen", () => {
  it("lässt den Anschluss am Pendelkörper mitwandern", () => {
    const s = stelle(neueSzene(), "fadenpendel", { x: 0, y: 1 });
    const g = { ...s.geraete[0], werte: { ...s.geraete[0].werte, laenge: 1 } };

    // In Ruhe hängt der Körper einen Meter unter dem Drehpunkt.
    const ruhe = portOrt(g, "koerper", { q: 0 })!;
    expect(ruhe.x).toBeCloseTo(0, 9);
    expect(ruhe.y).toBeCloseTo(0, 9);

    // Eine Vierteldrehung weiter steht er waagerecht daneben.
    const aus = portOrt(g, "koerper", { q: Math.PI / 2 })!;
    expect(aus.x).toBeCloseTo(1, 9);
    expect(aus.y).toBeCloseTo(1, 9);
  });

  it("lässt feste Anschlüsse fest", () => {
    const s = stelle(neueSzene(), "fadenpendel", { x: 0, y: 1 });
    const a = portOrt(s.geraete[0], "aufhaengung", { q: 0 })!;
    const b = portOrt(s.geraete[0], "aufhaengung", { q: Math.PI / 2 })!;
    expect(a).toEqual(b);
  });
});

describe("aufgeloest", () => {
  /** Hängt ein neues Gerät mit seinem eigenen Haken an einen Anschluss. */
  function haenge(s: Szene, typ: string, wirt: number, port: string, werte: Record<string, number> = {}) {
    const eigener = { massestueck: "oese", fadenpendel: "aufhaengung", federpendel: "aufhaengung" }[typ]!;
    let neu = stelle(s, typ, { x: 9, y: 9 }); // absichtlich weit weg abgelegt
    const g = neu.geraete[neu.geraete.length - 1];
    neu = { ...neu, geraete: neu.geraete.map(x => (x.id === g.id ? { ...x, werte: { ...x.werte, ...werte } } : x)) };
    return verbinde(neu, { geraet: neu.geraete[wirt].id, port }, { geraet: g.id, port: eigener });
  }

  it("stellt ein Stativ auf den Boden, wo immer man es ablegt", () => {
    const s = stelle(neueSzene(), "stativ", { x: 2, y: 7.5 });
    const fertig = aufgeloest(s);
    // Halbe Höhe über null heißt: der Fuß steht auf der Linie.
    expect(fertig.geraete[0].pos.y).toBeCloseTo(1.2 / 2, 9);
    expect(fertig.geraete[0].pos.x).toBeCloseTo(2, 9);
  });

  it("stellt auch die schiefe Ebene auf den Boden", () => {
    const s = stelle(neueSzene(), "schiefeebene", { x: 0, y: 4 });
    const g = aufgeloest(s).geraete[0];
    const laenge = g.werte.laenge, winkel = g.werte.winkel;
    expect(g.pos.y).toBeCloseTo((laenge / 2) * Math.sin(winkel), 9);
  });

  it("hängt ein Massestück an den Haken, statt es liegen zu lassen", () => {
    let s = stelle(neueSzene(), "stativ", { x: 0, y: 0.6 });
    s = haenge(s, "massestueck", 0, "haken");
    const fertig = aufgeloest(s);
    const haken = portOrt(fertig.geraete[0], "haken")!;
    const masse = fertig.geraete[1];

    // Es liegt nicht mehr bei (9, 9), sondern hängt mit seiner Öse am Haken.
    expect(masse.pos.x).toBeCloseTo(haken.x, 9);
    expect(masse.pos.y).toBeCloseTo(haken.y - 0.04, 9);
  });

  it("stapelt eine Kette von Massestücken untereinander", () => {
    let s = stelle(neueSzene(), "stativ", { x: 0, y: 0.6 });
    s = haenge(s, "massestueck", 0, "haken");
    s = haenge(s, "massestueck", 1, "unten");
    const fertig = aufgeloest(s);
    const [, oben, unten] = fertig.geraete;

    expect(unten.pos.x).toBeCloseTo(oben.pos.x, 9);
    // Genau eine Gerätehöhe tiefer — sie berühren sich, ohne sich zu überlappen.
    expect(oben.pos.y - unten.pos.y).toBeCloseTo(0.08, 9);
  });

  it("hängt das Pendel an den Stativarm, sodass es dort dreht", () => {
    let s = stelle(neueSzene(), "stativ", { x: 1, y: 0.6 });
    s = haenge(s, "fadenpendel", 0, "haken");
    const fertig = aufgeloest(s);
    const haken = portOrt(fertig.geraete[0], "haken")!;
    const pendel = fertig.geraete[1];

    // Der Drehpunkt sitzt am Haken (die Aufhängung liegt 3 cm darüber).
    expect(pendel.pos.x).toBeCloseTo(haken.x, 9);
    expect(pendel.pos.y).toBeCloseTo(haken.y - 0.03, 9);
  });

  it("lässt frei stehende Geräte, wo sie sind", () => {
    const s = stelle(neueSzene(), "massestueck", { x: 1.5, y: 0.7 });
    expect(aufgeloest(s).geraete[0].pos).toEqual({ x: 1.5, y: 0.7 });
  });

  it("verläuft sich nicht in einem Ring", () => {
    let s = stelle(neueSzene(), "massestueck", { x: 0, y: 1 });
    s = stelle(s, "massestueck", { x: 0, y: 0.5 });
    const [a, b] = s.geraete;
    s = verbinde(s, { geraet: a.id, port: "unten" }, { geraet: b.id, port: "oese" });
    s = verbinde(s, { geraet: b.id, port: "unten" }, { geraet: a.id, port: "oese" });
    // Darf nicht endlos kreisen und muss endliche Orte liefern.
    const fertig = aufgeloest(s);
    expect(fertig.geraete.every(g => Number.isFinite(g.pos.x) && Number.isFinite(g.pos.y))).toBe(true);
  });
});

describe("aushaengen", () => {
  it("erkennt und kappt die Verbindung, mit der etwas hängt", () => {
    let s = stelle(neueSzene(), "stativ", { x: 0, y: 0.6 });
    s = stelle(s, "massestueck", { x: 0, y: 0.5 });
    const [stativ, masse] = s.geraete;
    s = verbinde(s, { geraet: stativ.id, port: "haken" }, { geraet: masse.id, port: "oese" });

    expect(haengtIrgendwo(s, masse)).toBe(true);
    const ab = aushaengen(s, masse.id);
    expect(ab.verbindungen).toHaveLength(0);
    expect(haengtIrgendwo(ab, masse)).toBe(false);
  });

  it("lässt ein Gerät in Ruhe, das gar nicht hängt", () => {
    const s = stelle(neueSzene(), "stativ", { x: 0, y: 0.6 });
    expect(aushaengen(s, s.geraete[0].id)).toEqual(s);
  });
});

describe("Anhängen durch Ziehen", () => {
  /** Stativ mit Pendel daran — der Haken am Pendelkörper ist noch frei. */
  function pendelAufbau() {
    let s = stelle(neueSzene(), "stativ", { x: 0, y: 0.6 });
    s = stelle(s, "fadenpendel", { x: 5, y: 5 });
    s = verbinde(s, { geraet: s.geraete[0].id, port: "haken" }, { geraet: s.geraete[1].id, port: "aufhaengung" });
    return s;
  }

  /** Legt ein Massestück irgendwo hin und gibt seine Id zurück. */
  function gewicht(s: Szene, pos: { x: number; y: number }) {
    const neu = stelle(s, "massestueck", pos);
    return { szene: neu, id: neu.geraete[neu.geraete.length - 1].id };
  }

  it("findet den Haken, über dem man loslässt", () => {
    const basis = pendelAufbau();
    const pendel = basis.geraete[1].id;
    const koerper = portOrt(aufgeloest(basis).geraete[1], "koerper")!;

    const { szene, id } = gewicht(basis, { x: 3, y: 3 });
    const ziel = andockStelle(szene, id, koerper);
    expect(ziel).toEqual({ geraet: pendel, port: "koerper" });
  });

  it("greift nicht ins Leere", () => {
    const { szene, id } = gewicht(pendelAufbau(), { x: 3, y: 3 });
    // Weit weg von allem: nichts zum Andocken.
    expect(andockStelle(szene, id, { x: 4, y: 4 })).toBeNull();
  });

  it("hängt das zweite Gewicht unter das erste, statt abzuweisen", () => {
    const basis = pendelAufbau();
    const pendel = basis.geraete[1].id;
    const koerper = portOrt(aufgeloest(basis).geraete[1], "koerper")!;

    // Erstes Gewicht an den Pendelhaken.
    const eins = gewicht(basis, { x: 3, y: 3 });
    let szene = verbinde(eins.szene, { geraet: pendel, port: "koerper" }, { geraet: eins.id, port: "oese" });

    // Zweites an dieselbe Stelle gezogen — es gehört darunter.
    const zwei = gewicht(szene, { x: 3, y: 3 });
    szene = zwei.szene;
    expect(andockStelle(szene, zwei.id, koerper)).toEqual({ geraet: eins.id, port: "unten" });
  });

  it("stapelt beliebig weiter nach unten", () => {
    let szene = pendelAufbau();
    const pendel = szene.geraete[1].id;
    const koerper = portOrt(aufgeloest(szene).geraete[1], "koerper")!;

    let letzte = "";
    for (let i = 0; i < 4; i++) {
      const neu = gewicht(szene, { x: 3, y: 3 });
      szene = neu.szene;
      const ziel = andockStelle(szene, neu.id, koerper)!;
      expect(ziel).toBeTruthy();
      szene = verbinde(szene, ziel, { geraet: neu.id, port: "oese" });
      letzte = neu.id;
    }

    // Vier Gewichte hängen als Kette — das letzte ganz unten.
    expect(szene.verbindungen).toHaveLength(5);
    const orte = aufgeloest(szene).geraete;
    const unterstes = orte.find(g => g.id === letzte)!;
    const pendelKoerper = portOrt(orte.find(g => g.id === pendel)!, "koerper")!;
    expect(pendelKoerper.y - unterstes.pos.y).toBeCloseTo(4 * 0.08 - 0.04, 6);
  });

  it("hängt nichts an sich selbst", () => {
    const basis = pendelAufbau();
    const { szene, id } = gewicht(basis, { x: 0, y: 0.5 });
    const eigenerOrt = aufgeloest(szene).geraete.find(g => g.id === id)!.pos;
    expect(andockStelle(szene, id, eigenerOrt)?.geraet).not.toBe(id);
  });
});
