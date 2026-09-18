/**
 * Jedes Gerät nimmt Raum ein.
 *
 * Was hier geprüft wird, ist das Versprechen des Versuchs-Modus: man kann
 * einen Parcours bauen. Ein Gewicht fällt auf eine Wippe, und was auf dem
 * anderen Ende liegt, fliegt. Eine Murmel rollt gegen ein Stativ und bleibt
 * davor liegen, statt hindurchzurollen.
 */
import { describe, it, expect } from "vitest";
import { Welt } from "@/lib/physik/welt";
import { aufgeloest, neueSzene, stelle, verbinde } from "@/lib/physik/szene";
import type { Szene } from "@/lib/physik/typen";

const DT = 1 / 240;

function bauteil(s: Szene, typ: string, pos: { x: number; y: number }, werte: Record<string, number> = {}) {
  const neu = stelle(s, typ, pos);
  const g = neu.geraete[neu.geraete.length - 1];
  return {
    szene: { ...neu, geraete: neu.geraete.map(x => (x.id === g.id ? { ...x, pos, werte: { ...x.werte, ...werte } } : x)) },
    id: g.id,
  };
}

/** Lässt die Welt laufen und merkt sich, wie hoch etwas höchstens kam. */
function laufen(szene: Szene, sekunden: number, beobachtet?: string) {
  const welt = new Welt();
  welt.synchronisiere(szene, {});
  let hoechstens = -Infinity;
  for (let i = 0; i * DT < sekunden; i++) {
    welt.synchronisiere(szene, {});
    welt.schritt(szene, {}, DT);
    if (beobachtet) hoechstens = Math.max(hoechstens, welt.zustand()[beobachtet]?.y ?? -Infinity);
  }
  return { welt, zustand: welt.zustand(), hoechstens };
}

describe("Die Wippe", () => {
  /** Keil, Brett darauf, ein Klotz auf dem linken Ende, ein Gewicht hoch über dem rechten. */
  function wippe(mitGewicht: boolean) {
    let s = neueSzene();
    const keil = bauteil(s, "drehpunkt", { x: 0, y: 0.05 }, { hoehe: 0.1 });
    s = keil.szene;
    const brett = bauteil(s, "brett", { x: 0, y: 0.11 }, { laenge: 0.6, dicke: 0.02, stoff: 0 });
    s = verbinde(brett.szene, { geraet: keil.id, port: "spitze" }, { geraet: brett.id, port: "oese" });
    const klotz = bauteil(s, "klotz", { x: -0.25, y: 0.145 }, { breite: 0.05, hoehe: 0.05, stoff: 0 });
    s = klotz.szene;
    if (mitGewicht) s = bauteil(s, "massestueck", { x: 0.25, y: 1.0 }, { masse: 2 }).szene;
    return { szene: s, brett: brett.id, klotz: klotz.id };
  }

  it("kippt zur schwereren Seite und legt sich dort ab", () => {
    const { szene, brett } = wippe(false);
    const { zustand } = laufen(szene, 1.5);
    // Der Klotz drückt das linke Ende hinunter: das Brett dreht sich gegen
    // den Uhrzeigersinn nicht, sondern mit — sein Winkel wird positiv.
    expect(zustand[brett].winkel).toBeGreaterThan(0.15);
  });

  it("schleudert, was auf dem einen Ende liegt, wenn auf das andere ein Gewicht fällt", () => {
    const ohne = laufen(wippe(false).szene, 2, wippe(false).klotz).hoechstens;
    const { szene, klotz } = wippe(true);
    const mit = laufen(szene, 2, klotz).hoechstens;
    // Ohne Gewicht bleibt der Klotz unten liegen; mit fliegt er hoch.
    expect(ohne).toBeLessThan(0.2);
    expect(mit).toBeGreaterThan(0.4);
  });
});

describe("Geräte als Hindernis", () => {
  it("lässt eine Murmel nicht durch die Stange eines Stativs rollen", () => {
    let s = neueSzene();
    s = bauteil(s, "stativ", { x: 0.5, y: 0.6 }).szene;
    const kugel = bauteil(s, "kugel", { x: 0, y: 0.3 }, { durchmesser: 0.03, stoff: 2 });
    const welt = new Welt();
    welt.synchronisiere(kugel.szene, {});
    welt.gibTempo(kugel.id, 2, 0);
    for (let i = 0; i < 240; i++) welt.schritt(kugel.szene, {}, DT);
    expect(welt.zustand()[kugel.id].x).toBeLessThan(0.5);
  });

  it("lässt eine Murmel auf einem Gerät liegen, statt hindurchzufallen", () => {
    let s = neueSzene();
    s = bauteil(s, "lampe", { x: 0, y: 0.2 }).szene;
    const kugel = bauteil(s, "kugel", { x: 0, y: 0.6 }, { durchmesser: 0.03, stoff: 0 });
    const { zustand } = laufen(kugel.szene, 1.5);
    expect(zustand[kugel.id].y).toBeGreaterThan(0.2);
  });

  it("lässt eine Murmel die schiefe Ebene hinunterrollen", () => {
    let s = neueSzene();
    s = bauteil(s, "schiefeebene", { x: 0, y: 0.25 }, { laenge: 1, winkel: 0.5 }).szene;
    // Oben links auf die Rampe setzen.
    const kugel = bauteil(s, "kugel", { x: -0.35, y: 0.46 }, { durchmesser: 0.03, stoff: 2 });
    const { zustand } = laufen(kugel.szene, 2);
    expect(zustand[kugel.id].x).toBeGreaterThan(0.4);
  });

  it("hält ein Pendel nicht an seinem eigenen Stativ fest", () => {
    let s = stelle(neueSzene(), "stativ", { x: 0, y: 0.6 });
    s = stelle(s, "fadenpendel", { x: 9, y: 9 });
    const pendel = s.geraete[1].id;
    s = verbinde(s, { geraet: s.geraete[0].id, port: "haken" }, { geraet: pendel, port: "aufhaengung" });
    s = { ...s, treue: "real", geraete: s.geraete.map(g => (g.id === pendel
      ? { ...g, werte: { ...g.werte, laenge: 0.8, masse: 0.5, startwinkel: -1.2, daempfung: 0 } } : g)) };
    const welt = new Welt();
    welt.synchronisiere(s, {});
    let rechts = -Infinity;
    for (let i = 0; i < 480; i++) {
      welt.schritt(s, {}, DT);
      rechts = Math.max(rechts, welt.zustand()[pendel].x);
    }
    // Der Haken sitzt bei x = 0,35; das Pendel schwingt über die Stange weit
    // auf die andere Seite.
    expect(rechts).toBeGreaterThan(0.35 + 0.5);
  });
});

describe("Modelle mit Oberfläche", () => {
  function hebelMitMurmel(treue: "ideal" | "real") {
    let s = neueSzene();
    s = bauteil(s, "hebel", { x: 0, y: 0.3 }).szene;
    const kugel = bauteil(s, "kugel", { x: 0.1, y: 0.6 }, { durchmesser: 0.03, stoff: 0 });
    return { szene: { ...kugel.szene, treue }, kugel: kugel.id };
  }

  it("gibt dem Hebelbalken im realen Modell eine Oberfläche", () => {
    const { szene, kugel } = hebelMitMurmel("real");
    const { zustand } = laufen(szene, 1.5);
    expect(zustand[kugel].y).toBeGreaterThan(0.25);
  });

  it("lässt im Schulbuch alles durch den Balken hindurch", () => {
    const { szene, kugel } = hebelMitMurmel("ideal");
    const { zustand } = laufen(szene, 1.5);
    expect(zustand[kugel].y).toBeLessThan(0.05);
  });
});

describe("Anzeige freier Körper", () => {
  it("zeigt ein angestoßenes Gewicht dort, wo der Löser es hat — auch am Haken", () => {
    let s = stelle(neueSzene(), "stativ", { x: 0, y: 0.6 });
    s = stelle(s, "massestueck", { x: 0, y: 0.5 });
    const [stativ, gewicht] = s.geraete.map(g => g.id);
    s = verbinde(s, { geraet: stativ, port: "haken" }, { geraet: gewicht, port: "oese" });

    const sicht = aufgeloest(s, {}, { [gewicht]: { x: 0.5, y: 1, winkel: 0.3, frei: true } });
    const g = sicht.geraete.find(x => x.id === gewicht)!;
    expect(g.pos).toEqual({ x: 0.5, y: 1 });
    expect(g.winkel).toBe(0.3);
  });

  it("lässt eine Murmel nicht an ein Brett schnappen, in dessen Nähe man sie zieht", async () => {
    const { andockStelle } = await import("@/lib/physik/szene");
    let s = neueSzene();
    s = bauteil(s, "brett", { x: 0, y: 0.1 }).szene;
    const kugel = bauteil(s, "kugel", { x: 0, y: 0.13 });
    expect(andockStelle(kugel.szene, kugel.id, { x: 0, y: 0.13 })).toBeNull();
  });
});
