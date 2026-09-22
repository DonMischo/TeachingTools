/**
 * Das Wärmenetz: dieselbe Rechnung wie der Stromkreis, andere Größen.
 *
 * Geprüft wird gegen die Formeln, mit denen man es im Unterricht ausrechnet:
 * ΔT = Q/(m·c) beim Aufheizen, die Beharrungstemperatur P = G·ΔT, die
 * Zeitkonstante τ = C/G beim Auskühlen — und dass Reibungswärme genau die
 * Bewegungsenergie ist, die dabei verlorengeht.
 */
import { afterEach, describe, it, expect } from "vitest";
import { amTeil, fuegeTeilHinzu, neuerAufbau, verbinde, wand, type Aufbau, type TeilArt } from "@/lib/physik/kern/modell";
import { standardWerteTeil } from "@/lib/physik/kern/teile";
import { UMGEBUNG, Waermenetz } from "@/lib/physik/kern/waerme";
import { TAKT, Welt } from "@/lib/physik/kern/welt";

const welten: Welt[] = [];
afterEach(() => { while (welten.length) welten.pop()!.zerstoere(); });

function teil(a: Aufbau, art: TeilArt, pos: { x: number; y: number }, werte: Record<string, number> = {}) {
  return fuegeTeilHinzu(a, art, pos, { ...standardWerteTeil(art), ...werte });
}
const starte = (a: Aufbau) => { const w = new Welt(a); welten.push(w); return w; };
const laufe = (w: Welt, s: number) => { for (let i = 0; i < Math.round(s * 60); i++) w.schritt(); };
const links = (id: string) => amTeil(id, { x: -0.03, y: 0 });
const rechts = (id: string) => amTeil(id, { x: 0.03, y: 0 });

describe("Das Wärmenetz", () => {
  it("heizt mit Q = P·t und ΔT = Q/(m·c)", () => {
    let a = neuerAufbau();
    const klotz = teil(a, "klotz", { x: 0, y: 1 }, { breite: 0.1, hoehe: 0.1, tiefe: 0.1, stoff: 1 });
    a = klotz.aufbau;
    const netz = new Waermenetz(a);
    const c = netz.kapazitaetVon(klotz.id);
    // Stahlwürfel mit 10 cm Kante: 7,85 kg mal 470 J/(kg·K).
    expect(c).toBeCloseTo(7.85 * 470, 0);

    // Eine Sekunde mit 100 W — so kurz, dass die Luft noch nichts wegträgt.
    for (let i = 0; i < 60; i++) netz.rechne(TAKT, () => 100);
    expect(netz.uebertemperatur(klotz.id)).toBeCloseTo(100 / c, 3);
    expect(netz.waermemenge(klotz.id)).toBeCloseTo(100, 1);
    expect(netz.temperatur(klotz.id)).toBeCloseTo(UMGEBUNG + 100 / c, 3);
  });

  it("läuft in die Beharrungstemperatur, bei der die Luft alles abführt", () => {
    let a = neuerAufbau();
    const klotz = teil(a, "klotz", { x: 0, y: 1 }, { breite: 0.05, hoehe: 0.05, tiefe: 0.05, stoff: 1 });
    a = klotz.aufbau;
    const netz = new Waermenetz(a);
    // 10 W/(m²·K) auf 6·(5 cm)² = 150 cm²: G = 0,15 W/K, also 20 K bei 3 W.
    // Der Stahlwürfel braucht dafür Stunden — in großen Schritten gerechnet,
    // was dem impliziten Verfahren nichts ausmacht.
    for (let i = 0; i < 1000; i++) netz.rechne(60, () => 3);
    expect(netz.uebertemperatur(klotz.id)).toBeCloseTo(3 / (10 * 6 * 0.05 ** 2), 1);
  });

  it("kühlt mit der Zeitkonstanten τ = C/G wieder aus", () => {
    let a = neuerAufbau();
    const klotz = teil(a, "klotz", { x: 0, y: 1 }, { breite: 0.05, hoehe: 0.05, tiefe: 0.05, stoff: 1 });
    a = klotz.aufbau;
    const netz = new Waermenetz(a);
    for (let i = 0; i < 1000; i++) netz.rechne(60, () => 3);
    const heiss = netz.uebertemperatur(klotz.id);

    const g = 10 * 6 * 0.05 ** 2;
    const tau = netz.kapazitaetVon(klotz.id) / g;
    // Kleine Schritte beim Auskühlen: die Zeitkonstante soll man ablesen können.
    const schritt = tau / 200;
    for (let i = 0; i < 200; i++) netz.rechne(schritt, () => 0);
    // Nach einer Zeitkonstanten ist noch 1/e der Übertemperatur übrig.
    expect(netz.uebertemperatur(klotz.id) / heiss).toBeCloseTo(Math.E ** -1, 2);
  });

  it("leitet Wärme über eine Schraube weiter", () => {
    let a = neuerAufbau();
    const heiss = teil(a, "klotz", { x: 0, y: 1 }, { breite: 0.05, hoehe: 0.05, tiefe: 0.05, stoff: 1 });
    a = heiss.aufbau;
    const kalt = teil(a, "klotz", { x: 0.05, y: 1 }, { breite: 0.05, hoehe: 0.05, tiefe: 0.05, stoff: 1 });
    a = verbinde(kalt.aufbau, "schraube", amTeil(heiss.id, { x: 0.025, y: 0 }), amTeil(kalt.id, { x: -0.025, y: 0 })).aufbau;

    const netz = new Waermenetz(a);
    for (let i = 0; i < 2000; i++) netz.rechne(60, id => (id === heiss.id ? 5 : 0));

    // Im Beharrungszustand: 0,5 W/K durch die Schraube, 0,15 W/K je Würfel an
    // die Luft. Das gibt 5 = 0,345 · ΔT(kalt) und ΔT(heiß) = 1,3 · ΔT(kalt).
    expect(netz.uebertemperatur(kalt.id)).toBeCloseTo(5 / 0.345, 0);
    expect(netz.uebertemperatur(heiss.id)).toBeCloseTo(1.3 * (5 / 0.345), 0);
  });
});

describe("Wärme im Versuch", () => {
  it("macht aus elektrischer Leistung Wärme im Widerstand", () => {
    let a = neuerAufbau();
    const bat = teil(a, "batterie", { x: 0, y: 1 }, { spannung: 12, innenwiderstand: 0 }); a = bat.aufbau;
    const r = teil(a, "widerstand", { x: 0.3, y: 1 }, { widerstand: 24, masseVorgabe: 0.02 }); a = r.aufbau;
    a = verbinde(a, "schraube", amTeil(bat.id), wand({ x: 0, y: 1 })).aufbau;
    a = verbinde(a, "schraube", amTeil(r.id), wand({ x: 0.3, y: 1 })).aufbau;
    a = verbinde(a, "kabel", rechts(bat.id), links(r.id)).aufbau;
    a = verbinde(a, "kabel", rechts(r.id), links(bat.id)).aufbau;

    const w = starte(a);
    laufe(w, 5);

    // P = U²/R = 6 W. In fünf Sekunden sind das 30 J, abzüglich des bisschens,
    // das an die Luft und in die Wand geht.
    expect(w.stromMessung(r.id).leistung).toBeCloseTo(6, 3);
    expect(w.waermemenge(r.id)).toBeGreaterThan(20);
    expect(w.waermemenge(r.id)).toBeLessThan(30);
    expect(w.temperatur(r.id)).toBeGreaterThan(UMGEBUNG + 1);
    // Die Batterie ohne Innenwiderstand bleibt kalt.
    expect(w.uebertemperatur(bat.id)).toBeCloseTo(0, 6);
  });

  it("macht aus Reibung Wärme — und genau so viel, wie an Schwung verlorengeht", () => {
    let a = neuerAufbau();
    const rad = teil(a, "scheibe", { x: 0, y: 2 }, { durchmesser: 0.3, masseVorgabe: 3, stoff: 1 }); a = rad.aufbau;
    a = verbinde(a, "achse", amTeil(rad.id), wand({ x: 0, y: 2 }), { reibung: 0.05, motorMoment: 0, drehzahl: 0 }).aufbau;

    const w = starte(a);
    w.gibDrehung(rad.id, 30);
    w.schritt();
    const vorher = 0.5 * w.traegheit(rad.id) * w.zustand(rad.id)!.omega ** 2;
    laufe(w, 5);
    const nachher = 0.5 * w.traegheit(rad.id) * w.zustand(rad.id)!.omega ** 2;

    expect(nachher).toBeLessThan(vorher * 0.8);
    // Was der Schwung verliert, steckt als Wärme im Rad — bis auf das, was die
    // Luft in fünf Sekunden schon wieder abgeführt hat.
    const verloren = vorher - nachher;
    expect(w.waermemenge(rad.id)).toBeGreaterThan(0.75 * verloren);
    expect(w.waermemenge(rad.id)).toBeLessThan(1.05 * verloren);
  });
});
