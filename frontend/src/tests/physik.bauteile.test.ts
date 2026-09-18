/**
 * Bauteile und Abschuss.
 *
 * Werkstoff heißt hier nicht Festigkeit, sondern was man beim Zusehen merkt:
 * eine Stahlmurmel ist über zweihundertmal so schwer wie eine gleich große aus
 * Styropor, Gummi springt und Glas rutscht. Und beim Abschuss zählt die Arbeit
 * F·s — dieselbe Spannung schießt Leichtes schneller fort als Schweres.
 */
import { describe, it, expect } from "vitest";
import { abschuss, bauteilMasse } from "@/lib/physik/rechenwerke";
import { FESTSTOFFE, feststoff, masseKasten, masseKugel } from "@/lib/physik/material";
import { Welt } from "@/lib/physik/welt";
import { neueSzene, stelle, trenneAn, verbinde } from "@/lib/physik/szene";
import { bogen, G } from "@/lib/physik/einheiten";
import type { Szene } from "@/lib/physik/typen";

const DT = 1 / 240;
const nummer = (name: string) => FESTSTOFFE.findIndex(f => f.name === name);

/** Legt ein Bauteil mit eigenen Werten hin. */
function bauteil(s: Szene, typ: string, pos: { x: number; y: number }, werte: Record<string, number>) {
  const neu = stelle(s, typ, pos);
  const g = neu.geraete[neu.geraete.length - 1];
  return {
    szene: { ...neu, geraete: neu.geraete.map(x => (x.id === g.id ? { ...x, werte: { ...x.werte, ...werte } } : x)) },
    id: g.id,
  };
}

describe("Werkstoffe", () => {
  it("macht aus gleicher Größe sehr verschiedene Massen", () => {
    const stahl = masseKugel(feststoff(nummer("Stahl")), 0.02);
    const styro = masseKugel(feststoff(nummer("Styropor")), 0.02);
    expect(stahl / styro).toBeCloseTo(7850 / 30, 3);
    // Eine 2-cm-Stahlmurmel wiegt rund 33 Gramm.
    expect(stahl).toBeCloseTo(0.0329, 3);
  });

  it("rechnet Bretter über ihre Fläche und eine gedachte Tiefe", () => {
    // 50 cm x 2 cm Holz: rund 300 Gramm.
    expect(masseKasten(feststoff(nummer("Holz")), 0.5, 0.02)).toBeCloseTo(0.3, 3);
  });

  it("gibt Gummi mehr Sprung als Styropor", () => {
    expect(feststoff(nummer("Gummi")).sprung).toBeGreaterThan(feststoff(nummer("Styropor")).sprung);
  });
});

describe("Bauteile in der Welt", () => {
  it("lässt eine Murmel rollen und liegenbleiben", () => {
    const { szene, id } = bauteil(neueSzene(), "kugel", { x: 0, y: 0.8 }, { durchmesser: 0.02, stoff: nummer("Glas") });
    const welt = new Welt();
    welt.synchronisiere(szene, {});
    for (let i = 0; i < 240 * 2; i++) welt.schritt(szene, {}, DT);

    const k = welt.zustand()[id];
    expect(k.y).toBeGreaterThan(0);
    expect(k.y).toBeLessThan(0.05);
  });

  it("lässt ein festgeschraubtes Brett liegen, ein loses fallen", () => {
    const fest = bauteil(neueSzene(), "brett", { x: 0, y: 1 }, { laenge: 0.5, dicke: 0.02, fest: 1 });
    const lose = bauteil(neueSzene(), "brett", { x: 0, y: 1 }, { laenge: 0.5, dicke: 0.02, fest: 0 });

    for (const { szene, id, erwartetOben } of [
      { ...fest, erwartetOben: true },
      { ...lose, erwartetOben: false },
    ]) {
      const welt = new Welt();
      welt.synchronisiere(szene, {});
      for (let i = 0; i < 240 * 2; i++) welt.schritt(szene, {}, DT);
      const y = welt.zustand()[id].y;
      if (erwartetOben) expect(y).toBeCloseTo(1, 6);
      else expect(y).toBeLessThan(0.2);
    }
  });

  it("lässt eine schwere Murmel einen Klotz umstoßen", () => {
    let s = neueSzene();
    const kugel = bauteil(s, "kugel", { x: -0.5, y: 0.05 }, { durchmesser: 0.05, stoff: nummer("Stahl") });
    s = kugel.szene;
    const klotz = bauteil(s, "klotz", { x: 0.2, y: 0.06 }, { breite: 0.06, hoehe: 0.12, stoff: nummer("Styropor"), fest: 0 });
    s = klotz.szene;

    const welt = new Welt();
    welt.synchronisiere(s, {});
    welt.gibTempo(kugel.id, 3, 0);
    for (let i = 0; i < 240 * 2; i++) welt.schritt(s, {}, DT);

    // Der leichte Klotz ist nicht mehr dort, wo er stand.
    expect(Math.abs(welt.zustand()[klotz.id].x - 0.2)).toBeGreaterThan(0.03);
  });
});

describe("Abschuss", () => {
  /** Abschussgerät mit einer Murmel auf dem Lager. */
  function geladen(stoffName: string, durchmesser: number, kraft: number, winkelGrad: number) {
    let s: Szene = neueSzene();
    const geraet = bauteil(s, "abschuss", { x: 0, y: 0.06 },
      { kraft, spannweg: 0.3, winkel: bogen(winkelGrad) });
    s = geraet.szene;
    const kugel = bauteil(s, "kugel", { x: 5, y: 5 }, { durchmesser, stoff: nummer(stoffName) });
    s = verbinde(kugel.szene, { geraet: geraet.id, port: "lager" }, { geraet: kugel.id, port: "oese" });
    return { szene: s, geraet: geraet.id, kugel: kugel.id };
  }

  it("verwandelt Spannarbeit in Bewegungsenergie", () => {
    const { szene, geraet } = geladen("Glas", 0.02, 40, 45);
    const a = abschuss(szene, szene.geraete.find(g => g.id === geraet)!);

    expect(a.arbeit).toBeCloseTo(40 * 0.3, 9);
    // ½·m·v² muss die Spannarbeit sein.
    expect(0.5 * a.masse * a.tempo * a.tempo).toBeCloseTo(a.arbeit, 6);
  });

  it("schießt Leichtes schneller fort als Schweres", () => {
    const leicht = geladen("Styropor", 0.02, 40, 45);
    const schwer = geladen("Stahl", 0.02, 40, 45);
    const a = abschuss(leicht.szene, leicht.szene.geraete[0]);
    const b = abschuss(schwer.szene, schwer.szene.geraete[0]);

    expect(a.tempo).toBeGreaterThan(b.tempo);
    // v ist umgekehrt proportional zur Wurzel der Masse.
    expect(a.tempo / b.tempo).toBeCloseTo(Math.sqrt(b.masse / a.masse), 6);
  });

  it("wirft bei 45 Grad am weitesten", () => {
    const weiten = [15, 30, 45, 60, 75].map(grad =>
      abschuss(geladen("Glas", 0.02, 40, grad).szene, geladen("Glas", 0.02, 40, grad).szene.geraete[0]).weite);
    const groesste = Math.max(...weiten);
    expect(weiten[2]).toBeCloseTo(groesste, 9);
  });

  it("rechnet die Wurfweite nach v²·sin(2α)/g", () => {
    const { szene } = geladen("Glas", 0.02, 40, 30);
    const a = abschuss(szene, szene.geraete[0]);
    expect(a.weite).toBeCloseTo((a.tempo ** 2 * Math.sin(bogen(60))) / G, 9);
  });

  it("hält das Geschoss auf dem Lager fest, bis ausgelöst wird", () => {
    const { szene, geraet, kugel } = geladen("Glas", 0.02, 40, 45);
    const welt = new Welt();
    welt.synchronisiere(szene, {});
    // Auf dem Lager ist die Murmel ein Körper, aber festgehalten: sie fällt
    // nicht herunter und rollt nicht weg.
    const vorher = welt.zustand()[kugel];
    for (let i = 0; i < 120; i++) welt.schritt(szene, {}, DT);
    expect(Math.hypot(welt.zustand()[kugel].x - vorher.x, welt.zustand()[kugel].y - vorher.y)).toBeLessThan(0.005);

    const a = abschuss(szene, szene.geraete.find(g => g.id === geraet)!);
    const geloest = trenneAn(szene, { geraet, port: "lager" });
    welt.synchronisiere(geloest, {});
    welt.gibTempo(kugel, a.vx, a.vy);
    expect(welt.zustand()[kugel].vx).toBeCloseTo(a.vx, 6);

    for (let i = 0; i < 240; i++) welt.schritt(geloest, {}, DT);
    // Sie ist wirklich fortgeflogen, nicht nur angestoßen worden.
    expect(welt.zustand()[kugel].x).toBeGreaterThan(1);
  });

  it("tut nichts ohne Geschoss", () => {
    const leer = bauteil(neueSzene(), "abschuss", { x: 0, y: 0.06 }, { kraft: 40 });
    const a = abschuss(leer.szene, leer.szene.geraete[0]);
    expect(a.geschoss).toBeUndefined();
    expect(a.tempo).toBe(0);
  });

  it("nennt die Masse des Geschosses aus seinem Werkstoff", () => {
    const { szene, kugel } = geladen("Stahl", 0.03, 40, 45);
    const g = szene.geraete.find(x => x.id === kugel)!;
    expect(bauteilMasse(g)).toBeCloseTo(masseKugel(feststoff(nummer("Stahl")), 0.03), 12);
  });
});
