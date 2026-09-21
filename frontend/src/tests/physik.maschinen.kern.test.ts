/**
 * Maschinen aus Grundteilen: Winde und Auslöser.
 *
 * Die Winde ist der Fall, an dem sich zeigt, ob der Baukasten trägt: ein Seil
 * am *Rand* einer Scheibe hebt mit genau deren Halbmesser als Hebelarm, und
 * die freie Seillänge folgt dem Drehwinkel. Das Trebuchet am Ende ist die
 * Probe aufs Ganze — nichts daran ist eingebaut, alles zusammengesteckt.
 */
import { afterEach, describe, it, expect } from "vitest";
import { amTeil, fuegeTeilHinzu, neuerAufbau, verbinde, wand, type Aufbau, type TeilArt } from "@/lib/physik/kern/modell";
import { standardWerteTeil } from "@/lib/physik/kern/teile";
import { Welt } from "@/lib/physik/kern/welt";
import { bogen } from "@/lib/physik/einheiten";

const G = 9.81;
const welten: Welt[] = [];
afterEach(() => { while (welten.length) welten.pop()!.zerstoere(); });

function teil(a: Aufbau, art: TeilArt, pos: { x: number; y: number }, werte: Record<string, number> = {}, winkel = 0) {
  return fuegeTeilHinzu(a, art, pos, { ...standardWerteTeil(art), ...werte }, winkel);
}
function starte(a: Aufbau) {
  const w = new Welt(a);
  welten.push(w);
  return w;
}
const laufe = (w: Welt, sekunden: number, jeSchritt?: () => void) => {
  for (let i = 0; i < Math.round(sekunden * 60); i++) { w.schritt(); jeSchritt?.(); }
};

/** Scheibe an der Wand mit Motor, Seil vom Rand zur Last. */
function winde({ radius = 0.1, drehzahl = 2, last = 2, richtung = 1 } = {}) {
  let a = neuerAufbau();
  const trommel = teil(a, "scheibe", { x: 0, y: 2 }, { durchmesser: radius * 2, dicke: 0.03 });
  a = trommel.aufbau;
  const achse = verbinde(a, "achse", amTeil(trommel.id), wand({ x: 0, y: 2 }), { motorMoment: 200, drehzahl, reibung: 0 });
  a = achse.aufbau;
  const gewicht = teil(a, "massestueck", { x: radius, y: 1 }, { masse: last });
  a = gewicht.aufbau;
  // Das Seil sitzt am rechten Rand der Trommel — dort greift die Last an.
  const seil = verbinde(a, "seil", amTeil(trommel.id, { x: radius, y: 0 }), amTeil(gewicht.id), {
    laenge: 0, wickelt: 1, wickelrichtung: richtung,
  });
  return { aufbau: seil.aufbau, trommel: trommel.id, gewicht: gewicht.id, seil: seil.id, achse: achse.id };
}

describe("Die Winde", () => {
  it("hebt die Last um Halbmesser mal Drehwinkel", () => {
    const { aufbau, trommel, gewicht } = winde({ radius: 0.1, drehzahl: 2 });
    const w = starte(aufbau);
    const start = w.zustand(gewicht)!.y;
    const winkelStart = w.zustand(trommel)!.umdrehung;
    laufe(w, 2);

    const gedreht = w.zustand(trommel)!.umdrehung - winkelStart;
    const hub = w.zustand(gewicht)!.y - start;
    expect(gedreht).toBeCloseTo(4, 1); // 2 rad/s über 2 s
    expect(hub).toBeCloseTo(0.1 * gedreht, 1);
  });

  it("trägt dabei die Gewichtskraft im Seil", () => {
    const { aufbau, seil } = winde({ last: 3 });
    const w = starte(aufbau);
    laufe(w, 1.5);
    expect(w.kraft(seil)!.betrag).toBeCloseTo(3 * G, 0);
  });

  it("lässt die Last wieder herunter, wenn die Trommel andersherum dreht", () => {
    const { aufbau, gewicht } = winde({ drehzahl: -2 });
    const w = starte(aufbau);
    const start = w.zustand(gewicht)!.y;
    laufe(w, 1.5);
    expect(w.zustand(gewicht)!.y).toBeLessThan(start - 0.1);
  });

  it("meldet die freie Seillänge, damit die Zeichnung sie kennt", () => {
    const { aufbau, seil } = winde({ radius: 0.1, drehzahl: 2 });
    const w = starte(aufbau);
    const vorher = w.seillaenge(seil)!;
    laufe(w, 1);
    expect(w.seillaenge(seil)!).toBeLessThan(vorher - 0.1);
  });
});

describe("Auslöser", () => {
  /** Ein Gewicht, das an einem Seil an der Wand hängt. */
  function haengend(werte: Record<string, number>) {
    let a = neuerAufbau();
    const m = teil(a, "massestueck", { x: 0, y: 1.5 }, { masse: 1 });
    a = m.aufbau;
    const seil = verbinde(a, "seil", wand({ x: 0, y: 2 }), amTeil(m.id), { laenge: 0, ...werte });
    return { aufbau: seil.aufbau, gewicht: m.id, seil: seil.id };
  }

  it("löst nach der eingestellten Zeit", () => {
    const { aufbau, seil, gewicht } = haengend({ loestNach: 0.5 });
    const w = starte(aufbau);
    laufe(w, 0.4);
    expect(w.haelt(seil)).toBe(true);
    laufe(w, 0.3);
    expect(w.haelt(seil)).toBe(false);
    laufe(w, 0.6);
    expect(w.zustand(gewicht)!.y).toBeLessThan(1.4);
  });

  it("löst, wenn sich das Teil am Anfang weit genug gedreht hat", () => {
    let a = neuerAufbau();
    const arm = teil(a, "brett", { x: 0, y: 1 }, { laenge: 0.8 });
    a = verbinde(arm.aufbau, "achse", amTeil(arm.id), wand({ x: 0, y: 1 }), { motorMoment: 50, drehzahl: 2 }).aufbau;
    const last = teil(a, "massestueck", { x: 0.4, y: 0.7 }, { masse: 0.2 });
    a = last.aufbau;
    const seil = verbinde(a, "seil", amTeil(arm.id, { x: 0.4, y: 0 }), amTeil(last.id), {
      laenge: 0, loestBeiWinkel: bogen(90),
    });
    const w = starte(seil.aufbau);
    laufe(w, 0.5);
    expect(w.haelt(seil.id)).toBe(true);
    // Nach einer Vierteldrehung des Arms gibt die Schlinge frei.
    laufe(w, 0.6);
    expect(w.zustand(arm.id)!.umdrehung).toBeGreaterThan(bogen(90));
    expect(w.haelt(seil.id)).toBe(false);
  });

  it("meldet das Lösen als Ereignis", () => {
    const { aufbau, seil } = haengend({ loestNach: 0.2 });
    const w = starte(aufbau);
    const gemeldet: string[] = [];
    laufe(w, 0.5, () => gemeldet.push(...w.holeEreignisse().filter(e => e.art === "geloest").map(e => e.verbinder)));
    expect(gemeldet).toContain(seil);
  });
});

describe("Trebuchet", () => {
  /**
   * Ganz aus Grundteilen: eine Stange auf einer Achse an der Wand, kurzer Arm
   * mit dem Gegengewicht, langer Arm mit der Schlinge, in der der Stein am
   * Boden liegt. Die Schlinge gibt frei, wenn der Arm weit genug herum ist —
   * nichts daran ist eingebaut.
   */
  function trebuchet({ loesen = 90, schlinge = 1.2 } = {}) {
    const kurz = 0.8, lang = 2.4, hoehe = 2.6, neigung = -0.35;
    const mitte = (lang - kurz) / 2;
    let a = neuerAufbau();
    const arm = teil(a, "stange", { x: 0, y: hoehe },
      { laenge: kurz + lang, durchmesser: 0.04, stoff: 0 }, neigung);
    a = arm.aufbau;
    a = verbinde(a, "achse", amTeil(arm.id, { x: -mitte, y: 0 }), wand({ x: 0, y: hoehe })).aufbau;

    // Gegengewicht, gelenkig am kurzen Ende — 200 kg gegen 0,9 kg Stein.
    const kurzEnde = { x: -kurz * Math.cos(neigung), y: hoehe - kurz * Math.sin(neigung) };
    const gg = teil(a, "massestueck", { x: kurzEnde.x, y: kurzEnde.y - 0.3 }, { masse: 200 });
    a = verbinde(gg.aufbau, "achse", amTeil(arm.id, { x: -mitte - kurz, y: 0 }), amTeil(gg.id, { x: 0, y: 0.3 })).aufbau;

    // Der Stein liegt am Boden, die Schlinge führt zum langen Ende.
    const langEnde = { x: lang * Math.cos(neigung), y: hoehe + lang * Math.sin(neigung) };
    const stein = teil(a, "kugel", { x: langEnde.x + schlinge * 0.9, y: 0.03 }, { durchmesser: 0.06, stoff: 1 });
    a = stein.aufbau;
    const sling = verbinde(a, "seil", amTeil(arm.id, { x: -mitte + lang, y: 0 }), amTeil(stein.id),
      { laenge: schlinge, loestBeiWinkel: bogen(loesen) });
    return { aufbau: sling.aufbau, arm: arm.id, stein: stein.id, sling: sling.id };
  }

  /** Lässt den Wurf ablaufen und meldet, wie schnell und wie weit. */
  function wirf(p?: { loesen?: number; schlinge?: number }) {
    const { aufbau, stein, sling } = trebuchet(p);
    const w = starte(aufbau);
    let schnellste = 0;
    laufe(w, 8, () => {
      const z = w.zustand(stein)!;
      schnellste = Math.max(schnellste, Math.hypot(z.vx, z.vy));
    });
    return { schnellste, weite: Math.abs(w.zustand(stein)!.x), geloest: !w.haelt(sling) };
  }

  it("schleudert den Stein fort — 200 kg Gegengewicht auf 0,9 kg Stein", () => {
    const wurf = wirf({ loesen: 90 });
    expect(wurf.geloest).toBe(true);
    // Rund 11 m/s und fast zehn Meter weit; das Gegengewicht fällt dafür gut 2 m.
    expect(wurf.schnellste).toBeGreaterThan(8);
    expect(wurf.weite).toBeGreaterThan(5);
  });

  it("wirft nichts, wenn die Schlinge zu spät freigibt", () => {
    const wurf = wirf({ loesen: 150 });
    // So weit dreht der Arm nicht mehr: die Schlinge hält, der Stein bleibt.
    expect(wurf.geloest).toBe(false);
    expect(wurf.weite).toBeLessThan(2);
  });
});
