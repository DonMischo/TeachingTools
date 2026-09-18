/**
 * Die Welt — das, was bisher fehlte: Dinge, die einander wahrnehmen.
 *
 * Geprüft wird nicht die Genauigkeit des Lösers (dafür sind die analytischen
 * Modelle da), sondern dass sich Körper so verhalten, wie man es auf einem
 * Tisch erwartet: sie fallen, sie bleiben liegen, sie stapeln sich, und im
 * realen Modell stoßen sie einander an.
 */
import { describe, it, expect } from "vitest";
import { Welt } from "@/lib/physik/welt";
import { neueSzene, stelle, verbinde } from "@/lib/physik/szene";
import type { Szene } from "@/lib/physik/typen";

const DT = 1 / 240;

function masse(s: Szene, pos: { x: number; y: number }, m = 0.2): Szene {
  const neu = stelle(s, "massestueck", pos);
  const g = neu.geraete[neu.geraete.length - 1];
  return { ...neu, geraete: neu.geraete.map(x => (x.id === g.id ? { ...x, werte: { masse: m } } : x)) };
}

/** Lässt die Welt eine Weile laufen. */
function laufen(szene: Szene, sekunden: number, welt = new Welt()) {
  welt.synchronisiere(szene, {});
  const stoesse = [];
  for (let i = 0; i * DT < sekunden; i++) {
    welt.schritt(szene, {}, DT);
    stoesse.push(...welt.ereignisse());
  }
  return { welt, zustand: welt.zustand(), stoesse };
}

describe("Boden", () => {
  it("lässt ein Massestück fallen und liegenbleiben", () => {
    const szene = masse(neueSzene(), { x: 0, y: 1.5 });
    const id = szene.geraete[0].id;
    const { zustand } = laufen(szene, 2);

    // Es liegt auf dem Boden, nicht darunter und nicht mehr in der Luft.
    expect(zustand[id].y).toBeGreaterThan(0);
    expect(zustand[id].y).toBeLessThan(0.1);
    // Und es kommt zur Ruhe, statt zu zappeln.
    expect(Math.abs(zustand[id].vy)).toBeLessThan(0.05);
  });

  it("fällt nicht durch den Boden, auch aus großer Höhe", () => {
    const szene = masse(neueSzene(), { x: 0, y: 8 });
    const id = szene.geraete[0].id;
    const { zustand } = laufen(szene, 3);
    expect(zustand[id].y).toBeGreaterThan(0);
  });
});

describe("Stapeln", () => {
  it("legt zwei Massestücke übereinander, statt sie zu verschmelzen", () => {
    let szene = masse(neueSzene(), { x: 0, y: 0.05 });
    szene = masse(szene, { x: 0.005, y: 0.6 });
    const [unten, oben] = szene.geraete.map(g => g.id);
    const { zustand } = laufen(szene, 3);

    expect(zustand[oben].y).toBeGreaterThan(zustand[unten].y);
    // Sie liegen aufeinander, nicht ineinander.
    expect(zustand[oben].y - zustand[unten].y).toBeGreaterThan(0.03);
  });
});

describe("Eingehängtes", () => {
  /** Ein Gewicht am Haken eines Stativs. */
  function amHaken() {
    let szene = stelle(neueSzene(), "stativ", { x: 0, y: 0.6 });
    szene = masse(szene, { x: 0, y: 0.5 });
    const [stativ, gewicht] = szene.geraete.map(g => g.id);
    szene = verbinde(szene, { geraet: stativ, port: "haken" }, { geraet: gewicht, port: "oese" });
    return { szene, gewicht };
  }

  it("ist ein eigener Körper — und fällt trotzdem nicht, es hängt", () => {
    const { szene, gewicht } = amHaken();
    const { zustand } = laufen(szene, 1);
    expect(zustand[gewicht]).toBeDefined();
    // Der Haken sitzt 1,2 m hoch; das Gewicht hängt knapp darunter.
    expect(zustand[gewicht].y).toBeGreaterThan(1.05);
  });

  it("pendelt am Haken, wenn man es anstößt", () => {
    const { szene, gewicht } = amHaken();
    const welt = new Welt();
    welt.synchronisiere(szene, {});
    const ruhe = welt.zustand()[gewicht].x;
    welt.gibTempo(gewicht, 1, 0);
    let weitester = ruhe;
    for (let i = 0; i < 240; i++) {
      welt.schritt(szene, {}, DT);
      weitester = Math.max(weitester, welt.zustand()[gewicht].x);
    }
    // Es schwingt aus — und kommt zurück, statt davonzufliegen.
    expect(weitester - ruhe).toBeGreaterThan(0.005);
    expect(Math.abs(welt.zustand()[gewicht].x - ruhe)).toBeLessThan(weitester - ruhe + 1e-9);
  });
});

describe("Modelltreue", () => {
  /** Pendel am Stativ, daneben ein Massestück in Reichweite. */
  function pendelUndKlotz(treue: "ideal" | "real"): Szene {
    let s = stelle(neueSzene(), "stativ", { x: 0, y: 0.6 });
    s = stelle(s, "fadenpendel", { x: 9, y: 9 });
    const pendel = s.geraete[1].id;
    s = verbinde(s, { geraet: s.geraete[0].id, port: "haken" }, { geraet: pendel, port: "aufhaengung" });
    s = { ...s, geraete: s.geraete.map(g => (g.id === pendel
      ? { ...g, werte: { ...g.werte, laenge: 0.5, masse: 1, startwinkel: 0 } } : g)) };
    s = masse(s, { x: 0.35, y: 0.05 }, 0.2);
    return { ...s, treue };
  }

  it("lässt im Schulbuchmodell das Gerät hindurchgehen", () => {
    const szene = pendelUndKlotz("ideal");
    const { stoesse } = laufen(szene, 1);
    // Das Pendel ist ideal und stoert niemanden.
    const mitPendel = stoesse.filter(s => s.a === szene.geraete[1].id || s.b === szene.geraete[1].id);
    expect(mitPendel).toHaveLength(0);
  });

  it("gibt dem Gerät im realen Modell einen Körper", () => {
    const welt = new Welt();
    welt.synchronisiere(pendelUndKlotz("real"), {});
    // Der Pendelkoerper ist jetzt in der Welt und kann anstossen.
    expect(Object.keys(welt.zustand())).toContain(pendelUndKlotz("real").geraete[1].id);
  });
});

describe("zuruecksetzen", () => {
  it("stellt die Körper wieder an ihren Platz in der Szene", () => {
    const szene = masse(neueSzene(), { x: 0, y: 2 });
    const id = szene.geraete[0].id;
    const { welt } = laufen(szene, 1.5);
    expect(welt.zustand()[id].y).toBeLessThan(1);

    welt.zuruecksetzen(szene, {});
    expect(welt.zustand()[id].y).toBeCloseTo(2, 6);
  });
});

describe("Pendel im realen Modell", () => {
  /**
   * Pendel mit einem Klotz genau in seiner Bahn.
   *
   * Ohne Stativ, damit die Stange nicht selbst im Weg steht: der Drehpunkt
   * liegt 1,20 m hoch, der 1,15 m lange Faden führt den Körper dicht über den
   * Boden, und dort steht der Klotz.
   */
  function aufbau(): Szene {
    let s = stelle(neueSzene(), "fadenpendel", { x: 0, y: 1.2 });
    const pendel = s.geraete[0].id;
    s = { ...s, geraete: s.geraete.map(g => (g.id === pendel
      ? { ...g, werte: { laenge: 1.1, masse: 3, startwinkel: -1, daempfung: 0 } }
      : g)) };
    // Der Klotz ist schwer und damit hoch genug, dass ihn die Bahn trifft —
    // und das Pendel bleibt unten frei vom Boden, sonst bremst dessen Reibung
    // die Schwingung ab, bevor sie je hinkommt.
    s = masse(s, { x: 0.4, y: 0.09 }, 20);
    return { ...s, treue: "real" };
  }

  it("stösst den Klotz mehrfach an, nicht nur einmal", () => {
    // Der gemeldete Fehler: der Pendelkörper war kinematisch, also unendlich
    // schwer. Der erste Treffer schleuderte den Klotz aus der Reichweite, und
    // danach passierte nie wieder etwas.
    const szene = aufbau();
    const klotz = szene.geraete[1].id;
    const { stoesse } = laufen(szene, 8);

    const treffer = stoesse.filter(s => s.a === klotz || s.b === klotz);
    expect(treffer.length).toBeGreaterThan(1);
  });

  it("wird durch den Stoss selbst langsamer", () => {
    const szene = aufbau();
    const pendel = szene.geraete[0].id;
    const welt = new Welt();
    welt.synchronisiere(szene, {});

    // Ausschlag vor dem ersten Treffer …
    let vorher = 0;
    for (let i = 0; i < 240 * 0.4; i++) {
      welt.schritt(szene, {}, DT);
      vorher = Math.max(vorher, Math.abs(welt.abgeleitet(szene, {})[pendel].q));
    }
    // … und nach mehreren Durchgängen mit Stoessen.
    for (let i = 0; i < 240 * 6; i++) welt.schritt(szene, {}, DT);
    let nachher = 0;
    for (let i = 0; i < 240 * 2; i++) {
      welt.schritt(szene, {}, DT);
      nachher = Math.max(nachher, Math.abs(welt.abgeleitet(szene, {})[pendel].q));
    }

    // Energie ist an den Klotz gegangen — ohne Reibung kann sie nur dorthin.
    expect(nachher).toBeLessThan(vorher);
  });

  it("rechnet aus der Körperlage wieder einen Winkel zurück", () => {
    const szene = aufbau();
    const pendel = szene.geraete[0].id;
    const welt = new Welt();
    welt.synchronisiere(szene, {});
    // Direkt nach dem Aufbauen steht es auf seinem Startwinkel.
    expect(welt.abgeleitet(szene, {})[pendel].q).toBeCloseTo(-1, 2);
  });
});

describe("setzeOrt", () => {
  it("versetzt einen Körper und lässt ihn dort", () => {
    // Der gemeldete Fehler: angehalten liess sich ein Gewicht zwar greifen,
    // sprang aber sichtbar zurück.
    const szene = masse(neueSzene(), { x: 0, y: 1 });
    const id = szene.geraete[0].id;
    const welt = new Welt();
    welt.synchronisiere(szene, {});

    welt.setzeOrt(id, { x: 0.8, y: 1.4 });
    expect(welt.zustand()[id].x).toBeCloseTo(0.8, 9);
    expect(welt.zustand()[id].y).toBeCloseTo(1.4, 9);

    // Ein erneutes Nachführen darf ihn nicht zurückholen.
    welt.synchronisiere(szene, {});
    expect(welt.zustand()[id].x).toBeCloseTo(0.8, 9);
  });
});

describe("Pendel am Stativ", () => {
  /** So, wie man es aufbaut: Stativ, Pendel daran, Klotz daneben. */
  function amStativ(mitKlotz = true): Szene {
    let s = stelle(neueSzene(), "stativ", { x: 0, y: 0.6 });
    s = { ...s, geraete: s.geraete.map(g => ({ ...g, werte: { hoehe: 2, armLaenge: 0.3 } })) };
    s = stelle(s, "fadenpendel", { x: 9, y: 9 });
    const pendel = s.geraete[1].id;
    s = verbinde(s, { geraet: s.geraete[0].id, port: "haken" }, { geraet: pendel, port: "aufhaengung" });
    s = { ...s, geraete: s.geraete.map(g => (g.id === pendel
      ? { ...g, werte: { laenge: 1.8, masse: 3, startwinkel: -1, daempfung: 0 } } : g)) };
    if (mitKlotz) s = masse(s, { x: 0.7, y: 0.09 }, 20);
    return { ...s, treue: "real" };
  }

  it("schwingt frei durch — das eigene Stativ steht ihm nicht im Weg", () => {
    // Der gemeldete Rückfall: seit der Pendelkörper ein echter Körper ist,
    // stiess er gegen die Stange seines eigenen Stativs und kam nie herum.
    // Ohne Klotz: allein die Stange dürfte nichts aufhalten. (Mit Klotz wäre
    // ein kleinerer Ausschlag richtig — der frisst ja Energie.)
    const szene = amStativ(false);
    const pendel = szene.geraete[1].id;
    const welt = new Welt();
    welt.synchronisiere(szene, {});

    let groessterWinkel = -99;
    for (let i = 0; i < 240 * 4; i++) {
      welt.schritt(szene, {}, DT);
      groessterWinkel = Math.max(groessterWinkel, welt.abgeleitet(szene, {})[pendel].q);
    }
    // Von −1 rad losgelassen muss es auf die andere Seite durchschwingen.
    expect(groessterWinkel).toBeGreaterThan(0.6);
  });

  it("wirft den Klotz daneben um", () => {
    const szene = amStativ();
    const klotz = szene.geraete[2].id;
    const { stoesse } = laufen(szene, 8);
    expect(stoesse.filter(s => s.a === klotz || s.b === klotz).length).toBeGreaterThan(1);
  });
});

describe("Pendel ohne Eigenmasse", () => {
  /** Stativ, Pendel daran, Gewicht am Pendel, Klotz in der Bahn. */
  function mitGewicht(gewicht: number | null): Szene {
    let s = stelle(neueSzene(), "stativ", { x: 0, y: 0.6 });
    s = { ...s, geraete: s.geraete.map(g => ({ ...g, werte: { hoehe: 2, armLaenge: 0.3 } })) };
    s = stelle(s, "fadenpendel", { x: 9, y: 9 });
    const pendel = s.geraete[1].id;
    s = verbinde(s, { geraet: s.geraete[0].id, port: "haken" }, { geraet: pendel, port: "aufhaengung" });
    s = { ...s, geraete: s.geraete.map(g => (g.id === pendel
      ? { ...g, werte: { laenge: 1.85, startwinkel: -1, daempfung: 0 } } : g)) };

    if (gewicht !== null) {
      s = stelle(s, "massestueck", { x: 8, y: 8 });
      const last = s.geraete[s.geraete.length - 1];
      s = { ...s, geraete: s.geraete.map(g => (g.id === last.id ? { ...g, werte: { masse: gewicht } } : g)) };
      s = verbinde(s, { geraet: pendel, port: "koerper" }, { geraet: last.id, port: "oese" });
    }

    // Dicht am tiefsten Punkt der Bahn, damit der Koerper ihn auch trifft —
    // und schwer genug, dass er hoch genug steht.
    s = masse(s, { x: 0.45, y: 0.06 }, 4);
    return { ...s, treue: "real" };
  }

  it("wirft mit angehängtem Gewicht den Klotz um", () => {
    const szene = mitGewicht(4);
    const klotz = szene.geraete[szene.geraete.length - 1].id;
    const pendel = szene.geraete[1].id;
    const { stoesse, zustand } = laufen(szene, 6);

    // Nur Treffer vom Pendel zaehlen — der Klotz beruehrt auch den Boden.
    const vomPendel = stoesse.filter(s =>
      (s.a === klotz && s.b === pendel) || (s.b === klotz && s.a === pendel));
    expect(vomPendel.length).toBeGreaterThan(0);
    // Und der Klotz ist danach nicht mehr dort, wo er stand.
    expect(Math.abs(zustand[klotz].x - 0.45)).toBeGreaterThan(0.02);
  });

  it("wirft ohne Gewicht nichts um — ein blosser Faden hat keine Wucht", () => {
    const szene = mitGewicht(null);
    const klotz = szene.geraete[szene.geraete.length - 1].id;
    const { zustand } = laufen(szene, 6);
    expect(Math.abs(zustand[klotz].x - 0.45)).toBeLessThan(0.02);
  });
});

describe("Aufschlag auf dem Boden", () => {
  it("wird dort vermerkt, wo der Körper aufkommt — nicht im Ursprung", () => {
    // Der gemeldete Fehler: als Ort stand der Mittelpunkt eines der beiden
    // Körper. Beim Aufschlag ist einer davon der Boden, und dessen Mittelpunkt
    // liegt bei (0,0) — der Marker landete weit weg vom Geschehen.
    const szene = masse(neueSzene(), { x: 2.4, y: 1.5 }, 1);
    const { stoesse } = laufen(szene, 2);

    const aufschlag = stoesse.find(s => s.a === "boden" || s.b === "boden");
    expect(aufschlag).toBeDefined();
    expect(aufschlag!.ort.x).toBeCloseTo(2.4, 1);
    expect(aufschlag!.ort.y).toBeCloseTo(0, 1);
  });
});

describe("Voreinstellungen taugen für den Versuch", () => {
  it("trifft mit Stativ und Pendel aus dem Schrank ein Gewicht am Boden", () => {
    // Der gemeldete Fehler war keiner der Physik: mit den Voreinstellungen lag
    // der tiefste Punkt der Bahn bei 15 cm, ein Stapel aus drei Gewichten ist
    // 14 cm hoch — das Pendel schwang schlicht darüber hinweg.
    let s = stelle(neueSzene(), "stativ", { x: 0, y: 0.6 });
    s = stelle(s, "fadenpendel", { x: 9, y: 9 });
    const pendel = s.geraete[1].id;
    s = verbinde(s, { geraet: s.geraete[0].id, port: "haken" }, { geraet: pendel, port: "aufhaengung" });
    // Nur der Startwinkel wird verstellt, alles andere bleibt, wie es kommt.
    s = { ...s, geraete: s.geraete.map(g => (g.id === pendel
      ? { ...g, werte: { ...g.werte, startwinkel: -1 } } : g)) };

    // Ein Gewicht ans Pendel …
    s = stelle(s, "massestueck", { x: 8, y: 8 });
    s = verbinde(s, { geraet: pendel, port: "koerper" }, { geraet: s.geraete[2].id, port: "oese" });

    // … und eines unter den tiefsten Punkt der Bahn.
    const tiefsterPunkt = s.geraete[0].pos.x + 0.35;
    s = stelle(s, "massestueck", { x: tiefsterPunkt, y: 0.03 });
    const klotz = s.geraete[3].id;

    const { stoesse } = laufen({ ...s, treue: "real" }, 6);
    expect(stoesse.filter(x => (x.a === klotz && x.b === pendel) || (x.b === klotz && x.a === pendel)).length)
      .toBeGreaterThan(0);
  });
});

describe("Die Hand im Versuch", () => {
  it("zieht einen gegriffenen Körper zum Zeiger", () => {
    const s = masse(neueSzene(), { x: 0, y: 0.05 });
    const id = s.geraete[0].id;
    const welt = new Welt();
    welt.synchronisiere(s, {});
    expect(welt.greife(id, { x: 0, y: 0.05 })).toBe(true);

    welt.ziehe({ x: 0.3, y: 0.5 });
    for (let i = 0; i < 240; i++) welt.schritt(s, {}, DT);

    const k = welt.zustand()[id];
    expect(k.x).toBeCloseTo(0.3, 1);
    expect(k.y).toBeCloseTo(0.5, 1);
  });

  it("lässt ihn beim Loslassen mit Schwung weiterfliegen", () => {
    const s = masse(neueSzene(), { x: 0, y: 0.5 });
    const id = s.geraete[0].id;
    const welt = new Welt();
    welt.synchronisiere(s, {});
    welt.greife(id, { x: 0, y: 0.5 });
    // Ein schneller Wurf nach rechts.
    for (let i = 1; i <= 24; i++) {
      welt.ziehe({ x: i * 0.02, y: 0.5 });
      welt.schritt(s, {}, DT);
    }
    welt.lasse();
    expect(welt.zustand()[id].vx).toBeGreaterThan(0.5);
  });

  it("greift nichts, was fest steht", () => {
    const s = stelle(neueSzene(), "schiefeebene", { x: 0, y: 0.3 });
    const welt = new Welt();
    welt.synchronisiere(s, {});
    expect(welt.greifbar(s.geraete[0].id)).toBe(false);
    expect(welt.greife(s.geraete[0].id, { x: 0, y: 0.3 })).toBe(false);
  });
});
