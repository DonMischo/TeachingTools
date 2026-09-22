/**
 * Licht: Strahlen, Linse, Spiegel — und das Brennglas als Probe aufs Ganze.
 *
 * Geprüft wird gegen die Optik des Schulbuchs: parallele Strahlen treffen sich
 * im Brennpunkt, die Abbildungsgleichung 1/g + 1/b = 1/f stimmt, der
 * Einfallswinkel ist der Ausfallswinkel. Und am Ende der Fall, für den der
 * ganze Baukasten gebaut ist: gebündeltes Licht wärmt ein Brett an, ohne dass
 * dafür irgendwo ein Sonderfall steht — die Optik gibt ihre Leistung ab, und
 * das Wärmenetz nimmt sie auf.
 */
import { afterEach, describe, it, expect } from "vitest";
import { bogen } from "@/lib/physik/einheiten";
import { Optik } from "@/lib/physik/kern/optik";
import { amTeil, fuegeTeilHinzu, neuerAufbau, verbinde, wand, type Aufbau, type TeilArt } from "@/lib/physik/kern/modell";
import { standardWerteTeil } from "@/lib/physik/kern/teile";
import { UMGEBUNG } from "@/lib/physik/kern/waerme";
import { Welt } from "@/lib/physik/kern/welt";

const welten: Welt[] = [];
afterEach(() => { while (welten.length) welten.pop()!.zerstoere(); });

function teil(a: Aufbau, art: TeilArt, pos: { x: number; y: number }, werte: Record<string, number> = {}, winkel = 0) {
  return fuegeTeilHinzu(a, art, pos, { ...standardWerteTeil(art), ...werte }, winkel);
}
const starte = (a: Aufbau) => { const w = new Welt(a); welten.push(w); return w; };
const laufe = (w: Welt, s: number) => { for (let i = 0; i < Math.round(s * 60); i++) w.schritt(); };
const links = (id: string) => amTeil(id, { x: -0.03, y: 0 });
const rechts = (id: string) => amTeil(id, { x: 0.03, y: 0 });

/** Verfolgt die Strahlen eines Aufbaus, ohne Mechanik und ohne Strom. */
function verfolge(a: Aufbau, leistung = 1) {
  const o = new Optik(a);
  const lage = (id: string) => {
    const t = a.teile.find(x => x.id === id)!;
    return { pos: t.pos, winkel: t.winkel };
  };
  o.rechne(lage, () => leistung);
  return o;
}

describe("Die Linse", () => {
  it("sammelt parallele Strahlen im Brennpunkt", () => {
    const f = 0.3;
    let a = neuerAufbau();
    // Ein Strahler mit fünf parallelen Strahlen, dahinter die Linse.
    const s = teil(a, "strahler", { x: 0, y: 1 }, { breite: 0.1, oeffnung: 0, strahlen: 5 }); a = s.aufbau;
    const linse = teil(a, "linse", { x: 0.4, y: 1 }, { durchmesser: 0.16, brennweite: f }); a = linse.aufbau;
    // Ein Brett als Schirm, genau im Brennpunkt.
    const schirm = teil(a, "brett", { x: 0.4 + f, y: 1 }, { laenge: 0.4, dicke: 0.01 }, Math.PI / 2);
    a = schirm.aufbau;

    const o = verfolge(a);
    // Alle Strahlen enden auf dem Schirm, und zwar an derselben Stelle.
    const enden = o.strahlen().filter(st => Math.abs(st.nach.x - (0.4 + f)) < 0.02).map(st => st.nach.y);
    expect(enden.length).toBe(5);
    for (const y of enden) expect(y).toBeCloseTo(1, 2);
    expect(o.aufgenommen(schirm.id)).toBeCloseTo(1, 6);
  });

  it("bildet nach 1/g + 1/b = 1/f ab", () => {
    // Punktquelle (ein Lämpchen) in 0,6 m Abstand vor einer Linse mit f = 0,2:
    // b = 1/(1/0,2 − 1/0,6) = 0,3 m.
    const f = 0.2, g = 0.6, b = 1 / (1 / f - 1 / g);
    let a = neuerAufbau();
    // Eine Punktquelle: ein Strahler ohne Bündelbreite, der fächert.
    const lampe = teil(a, "strahler", { x: 0, y: 1 },
      { breite: 0.001, oeffnung: bogen(24), strahlen: 5, wirkungsgrad: 1 }); a = lampe.aufbau;
    const linse = teil(a, "linse", { x: g, y: 1 }, { durchmesser: 0.3, brennweite: f }); a = linse.aufbau;
    const schirm = teil(a, "brett", { x: g + b, y: 1 }, { laenge: 0.6, dicke: 0.01 }, Math.PI / 2);
    a = schirm.aufbau;

    const o = verfolge(a);
    // Was durch die Linse ging, trifft den Schirm wieder in einem Punkt.
    const treffer = o.strahlen().filter(st => st.von.x > g - 0.01 && Math.abs(st.nach.x - (g + b)) < 0.02);
    expect(treffer.length).toBeGreaterThan(2);
    for (const st of treffer) expect(st.nach.y).toBeCloseTo(1, 1);
  });

  it("lässt eine Zerstreuungslinse die Strahlen auseinanderlaufen", () => {
    let a = neuerAufbau();
    const s = teil(a, "strahler", { x: 0, y: 1 }, { breite: 0.1, oeffnung: 0, strahlen: 2 }); a = s.aufbau;
    const linse = teil(a, "linse", { x: 0.3, y: 1 }, { durchmesser: 0.2, brennweite: -0.3 }); a = linse.aufbau;
    const schirm = teil(a, "brett", { x: 0.9, y: 1 }, { laenge: 1.2, dicke: 0.01 }, Math.PI / 2);
    a = schirm.aufbau;

    const enden = verfolge(a).strahlen().filter(st => Math.abs(st.nach.x - 0.9) < 0.02).map(st => st.nach.y);
    expect(enden.length).toBe(2);
    // Vor der Linse 10 cm auseinander, dahinter deutlich mehr.
    expect(Math.abs(enden[0] - enden[1])).toBeGreaterThan(0.25);
  });
});

describe("Der Spiegel", () => {
  it("wirft den Strahl im gleichen Winkel zurück", () => {
    let a = neuerAufbau();
    const s = teil(a, "strahler", { x: 0, y: 1 }, { breite: 0.001, oeffnung: 0, strahlen: 1 }); a = s.aufbau;
    // Um 45° gedreht: waagerecht hinein, senkrecht hinaus.
    const spiegel = teil(a, "spiegel", { x: 0.5, y: 1 }, { durchmesser: 0.3 }, bogen(45)); a = spiegel.aufbau;
    const schirm = teil(a, "brett", { x: 0.5, y: 0.6 }, { laenge: 0.6, dicke: 0.01 }); a = schirm.aufbau;

    const o = verfolge(a);
    expect(o.aufgenommen(schirm.id)).toBeCloseTo(1, 6);
    const nachSpiegel = o.strahlen().find(st => Math.abs(st.von.x - 0.5) < 0.02 && st.nach.y < st.von.y);
    expect(nachSpiegel).toBeDefined();
    // Senkrecht nach unten: x bleibt stehen, y fällt.
    expect(nachSpiegel!.nach.x).toBeCloseTo(0.5, 2);
  });
});

describe("Licht hängt am Strom und endet in der Wärme", () => {
  it("bleibt dunkel ohne Strom und leuchtet mit", () => {
    let a = neuerAufbau();
    const bat = teil(a, "batterie", { x: 0, y: 2 }, { spannung: 12, innenwiderstand: 0 }); a = bat.aufbau;
    a = verbinde(a, "schraube", amTeil(bat.id), wand({ x: 0, y: 2 })).aufbau;
    const s = teil(a, "strahler", { x: 0, y: 1 }, { widerstand: 4, wirkungsgrad: 0.5, strahlen: 3 }); a = s.aufbau;
    a = verbinde(a, "schraube", amTeil(s.id), wand({ x: 0, y: 1 })).aufbau;
    const schalter = teil(a, "schalter", { x: 0.4, y: 2 }, { geschlossen: 0 }); a = schalter.aufbau;
    a = verbinde(a, "schraube", amTeil(schalter.id), wand({ x: 0.4, y: 2 })).aufbau;
    const brett = teil(a, "brett", { x: 0.7, y: 1 }, { laenge: 0.6, dicke: 0.02 }, Math.PI / 2); a = brett.aufbau;
    a = verbinde(a, "schraube", amTeil(brett.id), wand({ x: 0.7, y: 1 })).aufbau;

    a = verbinde(a, "kabel", rechts(bat.id), links(schalter.id)).aufbau;
    a = verbinde(a, "kabel", rechts(schalter.id), rechts(s.id)).aufbau;
    a = verbinde(a, "kabel", links(s.id), links(bat.id)).aufbau;

    const w = starte(a);
    laufe(w, 0.2);
    expect(w.strahlen()).toHaveLength(0);
    expect(w.strahlung(brett.id)).toBeCloseTo(0, 9);

    w.setzeTeilWert(schalter.id, { geschlossen: 1 });
    laufe(w, 1);
    // P = 12²/4 = 36 W, davon die Hälfte als Licht.
    expect(w.stromMessung(s.id).leistung).toBeCloseTo(36, 1);
    expect(w.strahlung(brett.id)).toBeCloseTo(18, 0);
    // Die andere Hälfte bleibt im Strahler: 18 J auf 150 J/K sind 0,12 K.
    expect(w.uebertemperatur(s.id)).toBeCloseTo(18 / 150, 2);
  });

  it("wärmt mit dem Brennglas ein Brett an", () => {
    const f = 0.3;
    let a = neuerAufbau();
    const bat = teil(a, "batterie", { x: -0.3, y: 2 }, { spannung: 24, innenwiderstand: 0 }); a = bat.aufbau;
    a = verbinde(a, "schraube", amTeil(bat.id), wand({ x: -0.3, y: 2 })).aufbau;
    const sonne = teil(a, "strahler", { x: 0, y: 1 }, { widerstand: 4, wirkungsgrad: 1, breite: 0.14, strahlen: 7 });
    a = sonne.aufbau;
    a = verbinde(a, "schraube", amTeil(sonne.id), wand({ x: 0, y: 1 })).aufbau;
    const linse = teil(a, "linse", { x: 0.4, y: 1 }, { durchmesser: 0.2, brennweite: f }); a = linse.aufbau;
    a = verbinde(a, "schraube", amTeil(linse.id), wand({ x: 0.4, y: 1 })).aufbau;
    // Ein kleines Stück Holz genau im Brennpunkt.
    const span = teil(a, "klotz", { x: 0.4 + f, y: 1 }, { breite: 0.02, hoehe: 0.02, tiefe: 0.02, stoff: 0 });
    a = span.aufbau;
    a = verbinde(a, "schraube", amTeil(span.id), wand({ x: 0.4 + f, y: 1 })).aufbau;

    a = verbinde(a, "kabel", rechts(bat.id), rechts(sonne.id)).aufbau;
    a = verbinde(a, "kabel", links(sonne.id), links(bat.id)).aufbau;

    const w = starte(a);
    laufe(w, 3);

    // 144 W treffen den Span: 20 mm Holz sind 4,8 g mit 8,2 J/K — das geht schnell.
    expect(w.strahlung(span.id)).toBeCloseTo(144, 0);
    expect(w.temperatur(span.id)).toBeGreaterThan(UMGEBUNG + 30);
    // Die Linse selbst bleibt kühl: sie lässt das Licht durch.
    expect(w.uebertemperatur(linse.id)).toBeCloseTo(0, 6);
  });
});
