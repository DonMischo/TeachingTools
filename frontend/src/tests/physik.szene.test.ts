/**
 * Die Szene ist der »Aufbau« auf der Werkbank: welche Geräte stehen wo, was ist
 * womit verbunden, und wie genau wird gerechnet. Sie ist reine Datenhaltung —
 * kein Solver, kein Canvas. Alle Längen in Metern, y zeigt nach oben.
 */
import { describe, it, expect } from "vitest";
import {
  neueSzene, stelle, entferne, bewege, verbinde, trenne,
  treueVon, alsJSON, ausJSON, zumBild, zurWelt, portOrt, freierPlatz,
} from "@/lib/physik/szene";

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
