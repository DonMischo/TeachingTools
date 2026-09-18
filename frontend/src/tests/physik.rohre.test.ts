/**
 * Röhren und Versuchswagen.
 *
 * Eine Röhre ist kein Klotz, sondern zwei Wände mit Luft dazwischen: eine
 * Murmel muss hindurchlaufen, nicht abprallen. Und ein Wagen soll rollen —
 * der Unterschied zu einem Klotz ist, dass er dabei nicht stehenbleibt.
 *
 * Der Gurtversuch steht hier als eigener Fall: festgezurrte Ladung fährt mit
 * und wiegt mit, lose Ladung liegt nur obendrauf.
 */
import { describe, it, expect } from "vitest";
import { Welt } from "@/lib/physik/welt";
import { rohrWaende, umriss, wagenMasse } from "@/lib/physik/geometrie";
import { wagenLast } from "@/lib/physik/rechenwerke";
import { aufgeloest, neueSzene, portOrt, rasteEin, stelle, verbinde } from "@/lib/physik/szene";
import { bogen } from "@/lib/physik/einheiten";
import { geraetTyp } from "@/lib/physik/katalog";
import type { Szene } from "@/lib/physik/typen";

const DT = 1 / 240;

/** Legt ein Bauteil mit eigenen Werten und eigener Drehung hin. */
function bauteil(
  s: Szene,
  typ: string,
  pos: { x: number; y: number },
  werte: Record<string, number> = {},
  winkel = 0,
) {
  const neu = stelle(s, typ, pos);
  const g = neu.geraete[neu.geraete.length - 1];
  return {
    szene: {
      ...neu,
      geraete: neu.geraete.map(x =>
        (x.id === g.id ? { ...x, pos, winkel, werte: { ...x.werte, ...werte } } : x)),
    },
    id: g.id,
  };
}

describe("Röhren", () => {
  it("hält die beiden Wände eine lichte Weite auseinander", () => {
    const { szene, id } = bauteil(neueSzene(), "rohr", { x: 0, y: 1 }, { laenge: 0.4, weite: 0.06 });
    const [unten, oben] = rohrWaende(szene.geraete.find(x => x.id === id)!).waende;
    expect(oben[0].y - unten[0].y).toBeCloseTo(0.06, 9);
    expect(unten[1].x - unten[0].x).toBeCloseTo(0.4, 9);
  });

  it("führt den Krümmer um seinen Biegeradius herum", () => {
    const { szene, id } = bauteil(neueSzene(), "kruemmer", { x: 0, y: 1 },
      { radius: 0.25, bogen: bogen(90) });
    const achse = rohrWaende(szene.geraete.find(x => x.id === id)!).achse;

    // Der Eingang liegt im Ursprung, der Ausgang eine Vierteldrehung weiter.
    expect(achse[0].x).toBeCloseTo(0, 9);
    expect(achse[0].y).toBeCloseTo(0, 9);
    expect(achse[achse.length - 1].x).toBeCloseTo(0.25, 6);
    expect(achse[achse.length - 1].y).toBeCloseTo(0.25, 6);

    // Alle Stützstellen liegen wirklich auf dem Kreis um den Biegemittelpunkt.
    for (const p of achse) expect(Math.hypot(p.x, p.y - 0.25)).toBeCloseTo(0.25, 9);
  });

  it("setzt Ein- und Ausgang an die Enden der Achse", () => {
    const { szene, id } = bauteil(neueSzene(), "rohr", { x: 2, y: 1 }, { laenge: 0.8 });
    const g = szene.geraete.find(x => x.id === id)!;
    expect(portOrt(g, "ein")!.x).toBeCloseTo(1.6, 9);
    expect(portOrt(g, "aus")!.x).toBeCloseTo(2.4, 9);
  });

  it("lässt eine Murmel im Rohr liegen, statt sie durchfallen zu lassen", () => {
    let s = neueSzene();
    const rohr = bauteil(s, "rohr", { x: 0, y: 1 }, { laenge: 0.6, weite: 0.06 });
    s = rohr.szene;
    const kugel = bauteil(s, "kugel", { x: 0, y: 1.01 }, { durchmesser: 0.02, stoff: 2 });
    s = kugel.szene;

    const welt = new Welt();
    welt.synchronisiere(s, {});
    for (let i = 0; i < 240 * 2; i++) welt.schritt(s, {}, DT);

    // Sie liegt auf der unteren Wand — nicht auf dem Boden einen Meter tiefer.
    const k = welt.zustand()[kugel.id];
    expect(k.y).toBeGreaterThan(0.95);
    expect(k.y).toBeLessThan(1.01);
  });

  it("lässt die Murmel durch ein geneigtes Rohr hinausrollen", () => {
    let s = neueSzene();
    const rohr = bauteil(s, "rohr", { x: 0, y: 1 }, { laenge: 1, weite: 0.08 }, -bogen(25));
    s = rohr.szene;
    const kugel = bauteil(s, "kugel", { x: -0.4, y: 1.19 }, { durchmesser: 0.02, stoff: 2 });
    s = kugel.szene;

    const welt = new Welt();
    welt.synchronisiere(s, {});
    for (let i = 0; i < 240 * 3; i++) welt.schritt(s, {}, DT);

    // Sie ist hangabwärts gelaufen und am unteren Ende herausgekommen.
    expect(welt.zustand()[kugel.id].x).toBeGreaterThan(0.4);
  });
});

describe("Umriss und Drehung", () => {
  it("beschreibt das ungedrehte Gerät, damit Zeichnung und Griff gleich rechnen", () => {
    let s = neueSzene();
    const flach = bauteil(s, "brett", { x: 0, y: 1 }, { laenge: 0.5, dicke: 0.02 });
    s = flach.szene;
    const schraeg = bauteil(s, "brett", { x: 1, y: 1 }, { laenge: 0.5, dicke: 0.02 }, bogen(30));

    const norm = geraetTyp("brett")!.groesse;
    const a = umriss(schraeg.szene.geraete.find(x => x.id === flach.id)!, norm);
    const b = umriss(schraeg.szene.geraete.find(x => x.id === schraeg.id)!, norm);
    expect(b.b).toBeCloseTo(a.b, 9);
    expect(b.h).toBeCloseTo(a.h, 9);
  });

  it("rechnet den Umriss eines Krümmers dagegen schon in Weltlage", () => {
    const { szene, id } = bauteil(neueSzene(), "kruemmer", { x: 0, y: 1 },
      { radius: 0.25, bogen: bogen(90), weite: 0.05 });
    const u = umriss(szene.geraete.find(x => x.id === id)!, geraetTyp("kruemmer")!.groesse);
    expect(u.schonGedreht).toBe(true);
    // Ein Viertelkreis mit 25 cm Radius und 5 cm Weite misst rund 27,5 cm.
    expect(u.b).toBeCloseTo(0.275, 2);
    expect(u.h).toBeCloseTo(0.275, 2);
  });

  it("verschiebt auch den Körper einer festgeschraubten Rampe mit", () => {
    const { szene, id } = bauteil(neueSzene(), "brett", { x: 0, y: 1 }, { laenge: 0.5, fest: 1 });
    const welt = new Welt();
    welt.synchronisiere(szene, {});
    expect(welt.zustand()[id].x).toBeCloseTo(0, 9);

    const woanders = {
      ...szene,
      geraete: szene.geraete.map(g => (g.id === id ? { ...g, pos: { x: 1.5, y: 1 } } : g)),
    };
    welt.synchronisiere(woanders, {});
    expect(welt.zustand()[id].x).toBeCloseTo(1.5, 9);
  });
});

describe("Versuchswagen", () => {
  it("stellt die Wanne auf Radhöhe über den Boden", () => {
    const { szene, id } = bauteil(neueSzene(), "wagen", { x: 0, y: 0.1 },
      { laenge: 0.2, radgroesse: 0.08 });
    const w = wagenMasse(szene.geraete.find(x => x.id === id)!);
    expect(w.stand).toBeCloseTo(0.08 / 2 + w.hoehe / 2, 9);
    expect(w.achsen).toHaveLength(2);
  });

  it("rollt weiter, als ein gleich großer Klotz rutscht", () => {
    const bahn = (typ: string) => {
      const { szene, id } = bauteil(neueSzene(), typ, { x: 0, y: 0.1 },
        typ === "wagen"
          ? { masse: 0.5, laenge: 0.16, radgroesse: 0.06, rollreibung: 0 }
          : { breite: 0.16, hoehe: 0.05, stoff: 0, fest: 0 });
      const welt = new Welt();
      welt.synchronisiere(szene, {});
      // Erst absetzen lassen, dann anschieben.
      for (let i = 0; i < 120; i++) welt.schritt(szene, {}, DT);
      welt.gibTempo(id, 1.5, 0);
      const start = welt.zustand()[id].x;
      for (let i = 0; i < 240 * 2; i++) welt.schritt(szene, {}, DT);
      return welt.zustand()[id].x - start;
    };
    expect(bahn("wagen")).toBeGreaterThan(bahn("klotz") + 0.3);
  });

  it("zählt festgezurrte Ladung zur Masse, lose Ladung nicht", () => {
    let s = neueSzene();
    const wagen = bauteil(s, "wagen", { x: 0, y: 0.1 });
    s = wagen.szene;
    const gewicht = bauteil(s, "massestueck", { x: 0, y: 0.3 }, { masse: 2 });
    s = gewicht.szene;

    // Nur obendrauf gelegt: der Wagen weiß nichts davon.
    expect(wagenLast(s, wagen.id)).toBeCloseTo(0, 9);

    // Festgezurrt: die Ladung fährt mit.
    const gezurrt = verbinde(s, { geraet: wagen.id, port: "oben" }, { geraet: gewicht.id, port: "oese" });
    expect(wagenLast(gezurrt, wagen.id)).toBeCloseTo(2, 9);
  });

  it("schiebt beladen mehr aus dem Weg als leer", () => {
    const schub = (beladen: boolean) => {
      let s = neueSzene();
      const wagen = bauteil(s, "wagen", { x: 0, y: 0.1 }, { masse: 0.3, rollreibung: 0 });
      s = wagen.szene;
      const gewicht = bauteil(s, "massestueck", { x: 0, y: 0.3 }, { masse: 5 });
      s = beladen
        ? verbinde(gewicht.szene, { geraet: wagen.id, port: "oben" }, { geraet: gewicht.id, port: "oese" })
        : s;
      // Ein leichter Klotz im Weg: was ihn weiter schiebt, hatte mehr Impuls.
      const klotz = bauteil(s, "klotz", { x: 0.5, y: 0.05 },
        { breite: 0.06, hoehe: 0.1, stoff: 5, fest: 0 });
      s = klotz.szene;

      const welt = new Welt();
      welt.synchronisiere(s, {});
      for (let i = 0; i < 120; i++) welt.schritt(s, {}, DT);
      welt.gibTempo(wagen.id, 2, 0);
      for (let i = 0; i < 240 * 2; i++) welt.schritt(s, {}, DT);
      return welt.zustand()[klotz.id].x;
    };
    // p = m·v: bei gleichem Tempo trägt die beladene Wanne mehr Impuls hinein.
    expect(schub(true)).toBeGreaterThan(schub(false));
  });
});

describe("Trichter und Einrasten", () => {
  /** Trichter bei (0 | 1), ein Rohr am Auslauf. */
  function trichterMitRohr(werteRohr: Record<string, number> = {}, trichterWinkel = 0) {
    let s = neueSzene();
    const trichter = bauteil(s, "trichter", { x: 0, y: 1 }, { oeffnung: 0.2, weite: 0.05, tiefe: 0.15 }, trichterWinkel);
    s = trichter.szene;
    const rohr = bauteil(s, "rohr", { x: 3, y: 3 }, { laenge: 0.4, weite: 0.05, ...werteRohr });
    s = verbinde(rohr.szene, { geraet: trichter.id, port: "aus" }, { geraet: rohr.id, port: "ein" });
    return { szene: s, trichter: trichter.id, rohr: rohr.id };
  }
  const lage = (s: Szene, id: string) => aufgeloest(s).geraete.find(g => g.id === id)!;

  it("ist oben so weit wie die Öffnung und unten so weit wie der Auslauf", () => {
    const { szene, trichter } = trichterMitRohr();
    const [links, rechts] = rohrWaende(szene.geraete.find(g => g.id === trichter)!).waende;
    expect(rechts[0].x - links[0].x).toBeCloseTo(0.2, 9);
    expect(rechts[rechts.length - 1].x - links[links.length - 1].x).toBeCloseTo(0.05, 9);
  });

  it("richtet ein angesetztes Rohr nach dem Auslauf aus — senkrecht nach unten", () => {
    const { szene, rohr, trichter } = trichterMitRohr();
    const r = lage(szene, rohr);
    expect(r.winkel).toBeCloseTo(-Math.PI / 2, 9);
    // Sein Eingang sitzt genau am Auslauf.
    const ein = portOrt(r, "ein")!, aus = portOrt(lage(szene, trichter), "aus")!;
    expect(ein.x).toBeCloseTo(aus.x, 9);
    expect(ein.y).toBeCloseTo(aus.y, 9);
  });

  it("dreht die ganze Bahn mit, wenn man den Trichter dreht", () => {
    const { szene, rohr, trichter } = trichterMitRohr({}, bogen(20));
    const r = lage(szene, rohr);
    expect(r.winkel).toBeCloseTo(-Math.PI / 2 + bogen(20), 9);
    const ein = portOrt(r, "ein")!, aus = portOrt(lage(szene, trichter), "aus")!;
    expect(Math.hypot(ein.x - aus.x, ein.y - aus.y)).toBeLessThan(1e-9);
  });

  it("nimmt den Knick am Eingang dazu", () => {
    const { szene, rohr } = trichterMitRohr({ knick: bogen(15) });
    expect(lage(szene, rohr).winkel).toBeCloseTo(-Math.PI / 2 + bogen(15), 9);
  });

  it("setzt ein Rohr hinter einem Krümmer in dessen Ausgangsrichtung fort", () => {
    let s = neueSzene();
    const k = bauteil(s, "kruemmer", { x: 0, y: 1 }, { radius: 0.25, bogen: bogen(60) });
    s = k.szene;
    const r = bauteil(s, "rohr", { x: 3, y: 3 });
    s = verbinde(r.szene, { geraet: k.id, port: "aus" }, { geraet: r.id, port: "ein" });
    expect(lage(s, r.id).winkel).toBeCloseTo(bogen(60), 9);
  });

  it("behält beim Einrasten einen kleinen Knick und richtet große Abweichungen gerade", () => {
    const { szene, rohr } = trichterMitRohr();
    // Leicht schräg angesetzt: 12° daneben ergibt 10° Knick.
    const leicht = rasteEin(szene, rohr, -Math.PI / 2 + bogen(12));
    expect(leicht.geraete.find(g => g.id === rohr)!.werte.knick).toBeCloseTo(bogen(10), 9);
    // Waagerecht aus dem Schrank: das war keine Absicht, es rastet gerade ein.
    const quer = rasteEin(szene, rohr, 0);
    expect(quer.geraete.find(g => g.id === rohr)!.werte.knick).toBe(0);
  });

  it("fängt eine Murmel auf und führt sie durchs Rohr nach unten", () => {
    const { szene } = trichterMitRohr();
    // Neben der Mitte, aber noch über der Öffnung fallen lassen.
    const kugel = bauteil(szene, "kugel", { x: 0.07, y: 1.3 }, { durchmesser: 0.02, stoff: 0 });
    const welt = new Welt();
    welt.synchronisiere(kugel.szene, {});
    let austritt: number | null = null;
    for (let i = 0; i < 240 * 2 && austritt === null; i++) {
      welt.schritt(kugel.szene, {}, DT);
      const k = welt.zustand()[kugel.id];
      // Das Rohr endet bei y = 1 − 0,075 − 0,4 = 0,525.
      if (k.y < 0.5) austritt = k.x;
    }
    expect(austritt).not.toBeNull();
    // Herausgekommen ist sie in der Mitte, nicht dort, wo sie losfiel.
    expect(Math.abs(austritt!)).toBeLessThan(0.03);
  });
});
