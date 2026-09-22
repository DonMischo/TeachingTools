/**
 * Baupläne: einfügen, zweimal einfügen, selbst sichern.
 *
 * Und die Probe, dass im Schrank nichts Behauptetes steht: die mitgelieferten
 * Pläne werden hier laufen gelassen. Das Trebuchet aus dem Schrank ist
 * dasselbe, das in physik.maschinen.kern.test.ts wirft.
 */
import { afterEach, describe, it, expect } from "vitest";
import { BAUPLAENE, bauplan, fuegeBauplanEin, umDenUrsprung } from "@/lib/physik/kern/bauplan";
import { amTeil, endeInWelt, fuegeTeilHinzu, neuerAufbau, verbinde, wand, type Aufbau } from "@/lib/physik/kern/modell";
import { standardWerteTeil } from "@/lib/physik/kern/teile";
import { Welt } from "@/lib/physik/kern/welt";

const welten: Welt[] = [];
afterEach(() => { while (welten.length) welten.pop()!.zerstoere(); });
function starte(a: Aufbau) {
  const w = new Welt(a);
  welten.push(w);
  return w;
}
const laufe = (w: Welt, sekunden: number, jeSchritt?: () => void) => {
  for (let i = 0; i < Math.round(sekunden * 60); i++) { w.schritt(); jeSchritt?.(); }
};

describe("Baupläne einfügen", () => {
  it("setzt den Plan dorthin, wo man tippt — auch seine Wandpunkte", () => {
    const plan = bauplan("pendel")!;
    const { aufbau } = fuegeBauplanEin(neuerAufbau(), plan, { x: 3, y: 2.5 });
    // Der Aufhängepunkt des Pendels liegt jetzt genau auf dem Tippunkt.
    const seil = aufbau.verbinder[0];
    const oben = seil.a.teil === null ? seil.a : seil.b;
    expect(oben.teil).toBeNull();
    expect(oben.punkt.x).toBeCloseTo(3, 9);
    expect(oben.punkt.y).toBeCloseTo(2.5, 9);
    // Und das Gewicht hängt einen Meter darunter.
    expect(aufbau.teile[0].pos.y).toBeCloseTo(1.5, 9);
  });

  it("verträgt zweimaliges Einfügen ohne Verwechslung der Teile", () => {
    const plan = bauplan("wippe")!;
    const eins = fuegeBauplanEin(neuerAufbau(), plan, { x: 0, y: 1 });
    const zwei = fuegeBauplanEin(eins.aufbau, plan, { x: 2, y: 1 });

    const ids = zwei.aufbau.teile.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    // Jeder Verbinder zeigt auf Teile, die es auch gibt.
    for (const v of zwei.aufbau.verbinder) {
      for (const e of [v.a, v.b]) if (e.teil !== null) expect(ids).toContain(e.teil);
    }
    // Die zweite Wippe steht zwei Meter weiter rechts.
    const links = eins.neu.map(id => zwei.aufbau.teile.find(t => t.id === id)!.pos.x);
    const rechts = zwei.neu.map(id => zwei.aufbau.teile.find(t => t.id === id)!.pos.x);
    expect(Math.min(...rechts) - Math.min(...links)).toBeCloseTo(2, 6);
  });

  it("macht aus einem eigenen Aufbau einen Plan, der wieder passt", () => {
    let a = neuerAufbau();
    const m = fuegeTeilHinzu(a, "massestueck", { x: 5, y: 4 }, standardWerteTeil("massestueck"));
    a = verbinde(m.aufbau, "seil", wand({ x: 5, y: 5 }), amTeil(m.id)).aufbau;

    const plan = { id: "eigen", name: "Meins", icon: "📐", beschreibung: "", aufbau: umDenUrsprung(a) };
    const { aufbau } = fuegeBauplanEin(neuerAufbau(), plan, { x: -2, y: 3 });
    const seil = aufbau.verbinder[0];
    // Der Abstand zwischen Wandpunkt und Gewicht bleibt, wo auch immer er steht.
    const oben = endeInWelt(aufbau, seil.a), unten = endeInWelt(aufbau, seil.b);
    expect(Math.hypot(oben.x - unten.x, oben.y - unten.y)).toBeCloseTo(1, 6);
    expect(aufbau.teile[0].pos.x).toBeCloseTo(-2, 6);
  });
});

describe("Die mitgelieferten Pläne laufen", () => {
  it("lässt das Pendel schwingen", () => {
    const { aufbau } = fuegeBauplanEin(neuerAufbau(), bauplan("pendel")!, { x: 0, y: 2 });
    const w = starte(aufbau);
    const id = aufbau.teile[0].id;
    // Anstoßen, dann muss es hin und her gehen.
    w.gibTempo(id, 0.8, 0);
    let rechts = -9, links = 9;
    laufe(w, 3, () => {
      const x = w.zustand(id)!.x;
      rechts = Math.max(rechts, x);
      links = Math.min(links, x);
    });
    expect(rechts - links).toBeGreaterThan(0.2);
    // Es hängt weiterhin: die Höhe bleibt in der Nähe des Aufhängepunkts.
    expect(w.zustand(id)!.y).toBeGreaterThan(0.8);
  });

  it("hebt mit der Winde die Last", () => {
    const { aufbau } = fuegeBauplanEin(neuerAufbau(), bauplan("winde")!, { x: 0, y: 2.4 });
    const w = starte(aufbau);
    const last = aufbau.teile.find(t => t.art === "massestueck")!.id;
    const start = w.zustand(last)!.y;
    laufe(w, 2);
    expect(w.zustand(last)!.y).toBeGreaterThan(start + 0.2);
  });

  it("hebt mit dem Flaschenzug — und das Seil hält nur die halbe Last", () => {
    const { aufbau } = fuegeBauplanEin(neuerAufbau(), bauplan("flaschenzug")!, { x: 0, y: 2.6 });
    const w = starte(aufbau);
    const lose = aufbau.teile.find(t => t.werte.masseVorgabe === 10)!.id;
    const seil = aufbau.verbinder.find(v => v.art === "seil")!.id;
    const start = w.zustand(lose)!.y;
    laufe(w, 2);

    expect(w.zustand(lose)!.y).toBeGreaterThan(start + 0.2);
    // Zwei Stränge tragen die lose Rolle, also hält das Seil die halbe Last.
    expect(w.kraft(seil)!.betrag).toBeLessThan(10 * 9.81 * 0.62);
    expect(w.kraft(seil)!.betrag).toBeGreaterThan(10 * 9.81 * 0.4);
  });

  it("stellt Pläne, die auf den Boden gehören, auf den Boden — egal wo man tippt", () => {
    const plan = bauplan("trebuchet")!;
    expect(plan.amBoden).toBe(true);
    const hoch = fuegeBauplanEin(neuerAufbau(), plan, { x: 1, y: 7 }).aufbau;
    const stein = hoch.teile.find(t => t.art === "kugel")!;
    // Der Stein liegt weiterhin am Boden, nur eben einen Meter weiter rechts.
    expect(stein.pos.y).toBeCloseTo(0.03, 6);
    expect(stein.pos.x).toBeCloseTo(plan.aufbau.teile.find(t => t.art === "kugel")!.pos.x + 1, 6);

    // Und er wirft auch dann.
    const w = starte(hoch);
    let schnellste = 0;
    laufe(w, 8, () => {
      const z = w.zustand(stein.id)!;
      schnellste = Math.max(schnellste, Math.hypot(z.vx, z.vy));
    });
    expect(schnellste).toBeGreaterThan(8);
  });

  it("wirft mit dem Trebuchet aus dem Schrank", () => {
    const { aufbau } = fuegeBauplanEin(neuerAufbau(), bauplan("trebuchet")!, { x: 0, y: 0 });
    const w = starte(aufbau);
    const stein = aufbau.teile.find(t => t.art === "kugel")!.id;
    let schnellste = 0;
    laufe(w, 8, () => {
      const z = w.zustand(stein)!;
      schnellste = Math.max(schnellste, Math.hypot(z.vx, z.vy));
    });
    expect(schnellste).toBeGreaterThan(8);
    expect(Math.abs(w.zustand(stein)!.x)).toBeGreaterThan(5);
  });

  it("bringt den Stromkreis zum Leuchten und schaltet ihn ab", () => {
    const { aufbau } = fuegeBauplanEin(neuerAufbau(), bauplan("stromkreis")!, { x: 0, y: 2.5 });
    const w = starte(aufbau);
    const lampe = aufbau.teile.find(t => t.art === "lampe")!.id;
    const schalter = aufbau.teile.find(t => t.art === "schalter")!.id;
    laufe(w, 0.2);

    expect(w.stromMessung(lampe).leistung).toBeGreaterThan(0.5);

    w.setzeTeilWert(schalter, { geschlossen: 0 });
    laufe(w, 0.2);
    expect(w.stromMessung(lampe).leistung).toBeCloseTo(0, 6);
  });

  it("hebt mit dem Motor die Last, sobald man einschaltet", () => {
    const { aufbau } = fuegeBauplanEin(neuerAufbau(), bauplan("motorwinde")!, { x: 0, y: 2.6 });
    const w = starte(aufbau);
    const last = aufbau.teile.find(t => t.art === "massestueck")!.id;
    const schalter = aufbau.teile.find(t => t.art === "schalter")!.id;

    // Der Schalter steht offen: es passiert nichts.
    const start = w.zustand(last)!.y;
    laufe(w, 0.5);
    expect(Math.abs(w.zustand(last)!.y - start)).toBeLessThan(0.02);

    w.setzeTeilWert(schalter, { geschlossen: 1 });
    laufe(w, 2);
    expect(w.zustand(last)!.y).toBeGreaterThan(start + 0.15);
  });

  it("brennt mit dem Brennglas ein Loch in den Span — sobald man einschaltet", () => {
    const { aufbau } = fuegeBauplanEin(neuerAufbau(), bauplan("brennglas")!, { x: 0, y: 2.8 });
    const w = starte(aufbau);
    const span = aufbau.teile.find(t => t.art === "klotz")!.id;
    const schalter = aufbau.teile.find(t => t.art === "schalter")!.id;

    laufe(w, 0.5);
    expect(w.strahlung(span)).toBeCloseTo(0, 6);

    w.setzeTeilWert(schalter, { geschlossen: 1 });
    laufe(w, 3);
    // Rund 60 W treffen den Span; 3 cm Holz sind 27 J/K, also gut 2 K je Sekunde.
    expect(w.strahlung(span)).toBeGreaterThan(30);
    expect(w.uebertemperatur(span)).toBeGreaterThan(5);
  });

  it("hat für jeden Plan einen Namen, ein Sinnbild und Teile", () => {
    for (const p of BAUPLAENE) {
      expect(p.name.length).toBeGreaterThan(2);
      expect(p.icon.length).toBeGreaterThan(0);
      expect(p.aufbau.teile.length).toBeGreaterThan(0);
      expect(p.beschreibung.length).toBeGreaterThan(10);
    }
  });
});
