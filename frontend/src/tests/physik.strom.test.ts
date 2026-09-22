/**
 * Der Stromkreis aus Bauteilen und Kabeln.
 *
 * Geprüft wird gegen das, was an der Tafel steht: Ohm, die Knotenregel, der
 * Spannungsteiler, die einbrechende Klemmenspannung unter Last. Und die
 * Brücke, an der sich entscheidet, ob der Baukasten hält, was er verspricht:
 * ein Motor hebt eine Last, und dieselbe Maschine wird zum Dynamo, wenn man
 * ihre Welle dreht.
 */
import { afterEach, describe, it, expect } from "vitest";
import { amTeil, fuegeTeilHinzu, neuerAufbau, verbinde, wand, type Aufbau, type TeilArt } from "@/lib/physik/kern/modell";
import { standardWerteTeil } from "@/lib/physik/kern/teile";
import { Stromkreis } from "@/lib/physik/kern/strom";
import { DREHZAHL_GRENZE, Welt } from "@/lib/physik/kern/welt";

const welten: Welt[] = [];
afterEach(() => { while (welten.length) welten.pop()!.zerstoere(); });

function teil(a: Aufbau, art: TeilArt, pos: { x: number; y: number }, werte: Record<string, number> = {}) {
  return fuegeTeilHinzu(a, art, pos, { ...standardWerteTeil(art), ...werte });
}
const starte = (a: Aufbau) => { const w = new Welt(a); welten.push(w); return w; };
const laufe = (w: Welt, s: number) => { for (let i = 0; i < Math.round(s * 60); i++) w.schritt(); };

/** Links = Minus (Pol 0), rechts = Plus (Pol 1). */
const links = (id: string) => amTeil(id, { x: -0.03, y: 0 });
const rechts = (id: string) => amTeil(id, { x: 0.03, y: 0 });
const kabel = (a: Aufbau, von: ReturnType<typeof links>, nach: ReturnType<typeof links>) =>
  verbinde(a, "kabel", von, nach).aufbau;

/** Rechnet den Kreis einmal durch, ohne Mechanik. */
function rechne(a: Aufbau) {
  const k = new Stromkreis(a);
  k.rechne(() => ({}), () => 0);
  return k;
}

describe("Der Stromkreis aus Bauteilen", () => {
  it("bringt das ohmsche Gesetz heraus", () => {
    let a = neuerAufbau();
    const bat = teil(a, "batterie", { x: 0, y: 1 }, { spannung: 12, innenwiderstand: 0 }); a = bat.aufbau;
    const r = teil(a, "widerstand", { x: 0.3, y: 1 }, { widerstand: 240 }); a = r.aufbau;
    a = kabel(a, rechts(bat.id), links(r.id));
    a = kabel(a, rechts(r.id), links(bat.id));

    const m = rechne(a).messung(r.id);
    expect(Math.abs(m.spannung)).toBeCloseTo(12, 5);
    expect(Math.abs(m.strom)).toBeCloseTo(12 / 240, 6);
    expect(m.leistung).toBeCloseTo((12 * 12) / 240, 5);
  });

  it("teilt die Spannung in der Reihenschaltung nach den Widerständen", () => {
    let a = neuerAufbau();
    const bat = teil(a, "batterie", { x: 0, y: 1 }, { spannung: 9, innenwiderstand: 0 }); a = bat.aufbau;
    const r1 = teil(a, "widerstand", { x: 0.3, y: 1 }, { widerstand: 100 }); a = r1.aufbau;
    const r2 = teil(a, "widerstand", { x: 0.6, y: 1 }, { widerstand: 200 }); a = r2.aufbau;
    a = kabel(a, rechts(bat.id), links(r1.id));
    a = kabel(a, rechts(r1.id), links(r2.id));
    a = kabel(a, rechts(r2.id), links(bat.id));

    const k = rechne(a);
    // Derselbe Strom, die Spannung im Verhältnis der Widerstände.
    expect(Math.abs(k.messung(r1.id).strom)).toBeCloseTo(9 / 300, 6);
    expect(Math.abs(k.messung(r2.id).strom)).toBeCloseTo(9 / 300, 6);
    expect(Math.abs(k.messung(r1.id).spannung)).toBeCloseTo(3, 5);
    expect(Math.abs(k.messung(r2.id).spannung)).toBeCloseTo(6, 5);
  });

  it("teilt den Strom in der Parallelschaltung und lässt die Knotenregel aufgehen", () => {
    let a = neuerAufbau();
    const bat = teil(a, "batterie", { x: 0, y: 1 }, { spannung: 6, innenwiderstand: 0 }); a = bat.aufbau;
    const r1 = teil(a, "widerstand", { x: 0.3, y: 1.2 }, { widerstand: 100 }); a = r1.aufbau;
    const r2 = teil(a, "widerstand", { x: 0.3, y: 0.8 }, { widerstand: 300 }); a = r2.aufbau;
    a = kabel(a, rechts(bat.id), links(r1.id));
    a = kabel(a, rechts(bat.id), links(r2.id));
    a = kabel(a, rechts(r1.id), links(bat.id));
    a = kabel(a, rechts(r2.id), links(bat.id));

    const k = rechne(a);
    const i1 = Math.abs(k.messung(r1.id).strom), i2 = Math.abs(k.messung(r2.id).strom);
    expect(i1).toBeCloseTo(6 / 100, 6);
    expect(i2).toBeCloseTo(6 / 300, 6);
    // Was die Batterie abgibt, ist die Summe der Zweigströme.
    expect(Math.abs(k.messung(bat.id).strom)).toBeCloseTo(i1 + i2, 6);
  });

  it("lässt die Klemmenspannung unter Last einbrechen", () => {
    let a = neuerAufbau();
    const bat = teil(a, "batterie", { x: 0, y: 1 }, { spannung: 4.5, innenwiderstand: 2 }); a = bat.aufbau;
    const r = teil(a, "widerstand", { x: 0.3, y: 1 }, { widerstand: 7 }); a = r.aufbau;
    a = kabel(a, rechts(bat.id), links(r.id));
    a = kabel(a, rechts(r.id), links(bat.id));

    // I = 4,5 / 9 = 0,5 A, also fallen 1 V innen ab: außen bleiben 3,5 V.
    const k = rechne(a);
    expect(Math.abs(k.messung(bat.id).strom)).toBeCloseTo(0.5, 6);
    expect(Math.abs(k.messung(bat.id).spannung)).toBeCloseTo(3.5, 5);
    expect(Math.abs(k.messung(r.id).spannung)).toBeCloseTo(3.5, 5);
  });

  it("unterbricht den Kreis, wenn der Schalter offen ist", () => {
    let a = neuerAufbau();
    const bat = teil(a, "batterie", { x: 0, y: 1 }, { spannung: 9, innenwiderstand: 0 }); a = bat.aufbau;
    const s = teil(a, "schalter", { x: 0.3, y: 1 }, { geschlossen: 0 }); a = s.aufbau;
    const lampe = teil(a, "lampe", { x: 0.6, y: 1 }, { widerstand: 20 }); a = lampe.aufbau;
    a = kabel(a, rechts(bat.id), links(s.id));
    a = kabel(a, rechts(s.id), links(lampe.id));
    a = kabel(a, rechts(lampe.id), links(bat.id));

    expect(Math.abs(rechne(a).messung(lampe.id).strom)).toBeCloseTo(0, 9);

    // Und zugeschaltet leuchtet sie mit U²/R.
    const zu = new Stromkreis(a);
    zu.rechne((id): Record<string, number> => (id === s.id ? { geschlossen: 1 } : {}), () => 0);
    expect(zu.messung(lampe.id).leistung).toBeCloseTo((9 * 9) / 20, 4);
  });

  it("kommt mit einem Bauteil klar, das nirgends angeschlossen ist", () => {
    let a = neuerAufbau();
    const bat = teil(a, "batterie", { x: 0, y: 1 }, { spannung: 9 }); a = bat.aufbau;
    const r = teil(a, "widerstand", { x: 1, y: 1 }); a = r.aufbau;
    expect(() => rechne(a)).not.toThrow();
    expect(rechne(a).messung(r.id).strom).toBeCloseTo(0, 9);
  });
});

describe("Die Maschine zwischen Strom und Mechanik", () => {
  /** Motor an der Wand, Welle auf eine Scheibe, Batterie darüber. */
  function maschine({ spannung = 6, last = 0, konstante = 0.05, widerstand = 2 } = {}) {
    let a = neuerAufbau();
    const motor = teil(a, "motor", { x: 0, y: 2 }, { widerstand, konstante }); a = motor.aufbau;
    a = verbinde(a, "schraube", amTeil(motor.id, { x: -0.06, y: 0.04 }), wand({ x: -0.06, y: 2.04 })).aufbau;
    const rad = teil(a, "scheibe", { x: 0, y: 2 }, { durchmesser: 0.2, masseVorgabe: 0.5 }); a = rad.aufbau;
    const achse = verbinde(a, "achse", amTeil(motor.id), amTeil(rad.id)); a = achse.aufbau;

    const bat = teil(a, "batterie", { x: 0, y: 2.5 }, { spannung, innenwiderstand: 0 }); a = bat.aufbau;
    a = kabel(a, rechts(bat.id), rechts(motor.id));
    a = kabel(a, links(motor.id), links(bat.id));

    if (last > 0) {
      const gewicht = teil(a, "massestueck", { x: 0.1, y: 1 }, { masse: last }); a = gewicht.aufbau;
      a = verbinde(a, "seil", amTeil(rad.id, { x: 0.1, y: 0 }), amTeil(gewicht.id),
        { laenge: 0, wickelt: 1, wickelrichtung: 1 }).aufbau;
      return { aufbau: a, motor: motor.id, rad: rad.id, bat: bat.id, gewicht: gewicht.id };
    }
    return { aufbau: a, motor: motor.id, rad: rad.id, bat: bat.id, gewicht: "" };
  }

  it("dreht die Welle und läuft in die Leerlaufdrehzahl U/k", () => {
    const { aufbau, motor, rad } = maschine({ spannung: 6, konstante: 0.3 });
    const w = starte(aufbau);
    laufe(w, 4);

    // Ohne Last steigt die Drehzahl, bis die Gegenspannung die Batterie einholt.
    expect(w.zustand(rad)!.omega).toBeCloseTo(6 / 0.3, 0);
    // Und dann fließt fast kein Strom mehr.
    expect(Math.abs(w.stromMessung(motor).strom)).toBeLessThan(0.1);
  });

  it("kommt über die Drehzahlgrenze des Lösers nicht hinaus", () => {
    // Zu klein ausgelegt: U/k wäre 600 rad/s. Die Welle bleibt bei 15π stehen,
    // und der Motor arbeitet von da an gegen eine unsichtbare Bremse.
    const { aufbau, rad } = maschine({ spannung: 6, konstante: 0.01 });
    const w = starte(aufbau);
    laufe(w, 10);
    expect(w.zustand(rad)!.omega).toBeLessThanOrEqual(DREHZAHL_GRENZE + 1e-6);
    expect(w.zustand(rad)!.omega).toBeGreaterThan(0.9 * DREHZAHL_GRENZE);
  });

  it("zieht beim Anlauf den größten Strom", () => {
    const { aufbau, motor } = maschine({ spannung: 6, widerstand: 2 });
    const w = starte(aufbau);
    w.schritt();
    // Stillstand heißt keine Gegenspannung: I = U/R.
    expect(Math.abs(w.stromMessung(motor).strom)).toBeCloseTo(6 / 2, 1);
  });

  it("hebt eine Last — und zieht dabei mehr Strom als im Leerlauf", () => {
    const mitLast = maschine({ spannung: 12, last: 0.5, konstante: 0.1 });
    const w = starte(mitLast.aufbau);
    const start = w.zustand(mitLast.gewicht)!.y;
    laufe(w, 2);

    expect(w.zustand(mitLast.gewicht)!.y).toBeGreaterThan(start + 0.1);
    const unterLast = Math.abs(w.stromMessung(mitLast.motor).strom);

    const leer = maschine({ spannung: 12, konstante: 0.1 });
    const w2 = starte(leer.aufbau);
    laufe(w2, 2);
    expect(unterLast).toBeGreaterThan(Math.abs(w2.stromMessung(leer.motor).strom));
  });

  it("wird zum Dynamo, wenn man die Welle dreht", () => {
    // Dieselbe Maschine, nur ohne Batterie: ein Lämpchen an den Klemmen.
    let a = neuerAufbau();
    const motor = teil(a, "motor", { x: 0, y: 2 }, { widerstand: 2, konstante: 0.1 }); a = motor.aufbau;
    a = verbinde(a, "schraube", amTeil(motor.id, { x: -0.06, y: 0.04 }), wand({ x: -0.06, y: 2.04 })).aufbau;
    const rad = teil(a, "scheibe", { x: 0, y: 2 }, { durchmesser: 0.2, masseVorgabe: 2 }); a = rad.aufbau;
    a = verbinde(a, "achse", amTeil(motor.id), amTeil(rad.id)).aufbau;
    const lampe = teil(a, "lampe", { x: 0.4, y: 2 }, { widerstand: 8 }); a = lampe.aufbau;
    a = kabel(a, rechts(motor.id), rechts(lampe.id));
    a = kabel(a, links(motor.id), links(lampe.id));

    const w = starte(a);
    // Die Welle wird angeworfen und läuft aus.
    w.gibDrehung(rad.id, 50);
    w.schritt();

    // U = k·ω = 5 V, davon fällt der Löwenanteil am Lämpchen ab.
    expect(Math.abs(w.stromMessung(lampe.id).spannung)).toBeCloseTo(0.1 * 50 * (8 / 10), 1);
    expect(w.stromMessung(lampe.id).leistung).toBeGreaterThan(0.1);

    // Und das kostet Schwung: das Rad wird langsamer, als es ohne Lämpchen würde.
    const vorher = w.zustand(rad.id)!.omega;
    laufe(w, 2);
    expect(w.zustand(rad.id)!.omega).toBeLessThan(vorher * 0.9);
  });
});
