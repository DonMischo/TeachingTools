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
  it("bekommt keinen eigenen Körper — es ist Teil seines Wirts", () => {
    let szene = stelle(neueSzene(), "stativ", { x: 0, y: 0.6 });
    szene = masse(szene, { x: 0, y: 0.5 });
    const [stativ, gewicht] = szene.geraete.map(g => g.id);
    szene = verbinde(szene, { geraet: stativ, port: "haken" }, { geraet: gewicht, port: "oese" });

    const { zustand } = laufen(szene, 1);
    // Es fällt nicht: es hängt.
    expect(zustand[gewicht]).toBeUndefined();
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
