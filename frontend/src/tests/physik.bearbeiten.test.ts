/**
 * Bauen am Aufbau: treffen, befestigen, verschieben, rückgängig, speichern.
 */
import { afterEach, describe, it, expect } from "vitest";
import {
  merke, mitteAnWand, neuerVerlauf, setze, setzeGelenk, setzeLage, setzeMitteAnWand, spanne, teileUnter, tue,
  verbinderUnter, vor, zumBild, zurueck, zurWelt,
} from "@/lib/physik/kern/bearbeiten";
import { amTeil, endeInWelt, fuegeTeilHinzu, neuerAufbau, verbinde, wand, type Aufbau, type TeilArt } from "@/lib/physik/kern/modell";
import { aufbauAusJSON } from "@/lib/physik/kern/speicher";
import { standardWerteTeil } from "@/lib/physik/kern/teile";
import { Welt } from "@/lib/physik/kern/welt";

const welten: Welt[] = [];
afterEach(() => { while (welten.length) welten.pop()!.zerstoere(); });

function teil(a: Aufbau, art: TeilArt, pos: { x: number; y: number }, werte: Record<string, number> = {}, winkel = 0) {
  return fuegeTeilHinzu(a, art, pos, { ...standardWerteTeil(art), ...werte }, winkel);
}
const erfolg = <T,>(r: T | { fehler: string }): T => {
  if ((r as { fehler?: string }).fehler) throw new Error((r as { fehler: string }).fehler);
  return r as T;
};

describe("Meter und Pixel", () => {
  it("rechnet hin und zurück auf denselben Punkt", () => {
    const blick = { mitte: { x: 0.3, y: 0.6 }, skala: 250, breite: 800, hoehe: 500 };
    const p = { x: -0.42, y: 1.37 };
    const q = zurWelt(zumBild(p, blick), blick);
    expect(q.x).toBeCloseTo(p.x, 12);
    expect(q.y).toBeCloseTo(p.y, 12);
  });
});

describe("Treffer", () => {
  it("findet ein gedrehtes Brett nur dort, wo es liegt", () => {
    const { aufbau, id } = teil(neuerAufbau(), "brett", { x: 0, y: 1 }, { laenge: 0.6, dicke: 0.02 }, Math.PI / 4);
    // Entlang der Diagonale liegt es …
    expect(teileUnter(aufbau, { x: 0.2, y: 1.2 }).map(t => t.id)).toEqual([id]);
    // … quer dazu nicht, obwohl der Punkt im achsenparallelen Kasten läge.
    expect(teileUnter(aufbau, { x: 0.2, y: 0.8 })).toEqual([]);
  });

  it("nennt das zuletzt hingestellte Teil zuerst", () => {
    let a = neuerAufbau();
    const unten = teil(a, "brett", { x: 0, y: 1 });
    a = unten.aufbau;
    const oben = teil(a, "klotz", { x: 0, y: 1 });
    expect(teileUnter(oben.aufbau, { x: 0, y: 1 }).map(t => t.id)).toEqual([oben.id, unten.id]);
  });
});

describe("Befestigen", () => {
  it("schraubt ein einzelnes Teil an die Wand", () => {
    const { aufbau, id } = teil(neuerAufbau(), "brett", { x: 0, y: 1 });
    const r = erfolg(setzeGelenk(aufbau, "schraube", { x: 0.1, y: 1 }));
    const v = r.aufbau.verbinder[0];
    expect(v.a.teil).toBe(id);
    expect(v.b.teil).toBeNull();
    expect(v.b.punkt).toEqual({ x: 0.1, y: 1 });
  });

  it("verbindet mit einer Achse die beiden Teile, die übereinander liegen", () => {
    let a = neuerAufbau();
    const arm = teil(a, "brett", { x: 0, y: 1 });
    a = arm.aufbau;
    const gewicht = teil(a, "massestueck", { x: 0.3, y: 1 }, { masse: 1 });
    const r = erfolg(setzeGelenk(gewicht.aufbau, "achse", { x: 0.3, y: 1 }));
    const v = r.aufbau.verbinder[0];
    expect([v.a.teil, v.b.teil]).toEqual([gewicht.id, arm.id]);
  });

  it("verweigert ein Gelenk im Leeren", () => {
    expect(setzeGelenk(neuerAufbau(), "achse", { x: 0, y: 1 })).toHaveProperty("fehler");
  });

  it("spannt ein Seil von der Wand zu einem Teil — und findet es wieder", () => {
    const { aufbau, id } = teil(neuerAufbau(), "massestueck", { x: 0, y: 1 });
    const r = erfolg(spanne(aufbau, "seil", { x: 0, y: 2 }, { x: 0, y: 1 }));
    const v = r.aufbau.verbinder[0];
    expect(v.a.teil).toBeNull();
    expect(v.b.teil).toBe(id);
    expect(verbinderUnter(r.aufbau, { x: 0.005, y: 1.5 }, 0.02)?.id).toBe(v.id);
  });

  it("baut aus einem angetippten Brett eine Wippe, die im Versuch kippt", () => {
    let a = neuerAufbau();
    const brett = teil(a, "brett", { x: 0, y: 0.3 }, { laenge: 0.8 });
    a = erfolg(setzeGelenk(brett.aufbau, "achse", { x: 0, y: 0.3 })).aufbau;
    const gewicht = teil(a, "massestueck", { x: 0.35, y: 0.33 }, { masse: 1 });
    const w = new Welt(gewicht.aufbau);
    welten.push(w);
    for (let i = 0; i < 60; i++) w.schritt();
    // Das Gewicht rechts drückt das Brett im Uhrzeigersinn herunter.
    expect(w.zustand(brett.id)!.winkel).toBeLessThan(-0.1);
    expect(w.zustand(brett.id)!.y).toBeCloseTo(0.3, 2);
  });
});

describe("Verschieben", () => {
  it("nimmt die Schraube zur Wand mit, wenn man das Teil verschiebt", () => {
    const { aufbau, id } = teil(neuerAufbau(), "brett", { x: 0, y: 1 });
    const a = erfolg(setzeGelenk(aufbau, "schraube", { x: 0.2, y: 1 })).aufbau;
    const b = setzeLage(a, id, { x: 1, y: 2 }, Math.PI / 2);
    const v = b.verbinder[0];
    // Der Wandpunkt sitzt wieder genau am Brett.
    const amBrett = endeInWelt(b, v.a);
    expect(v.b.punkt.x).toBeCloseTo(amBrett.x, 12);
    expect(v.b.punkt.y).toBeCloseTo(amBrett.y, 12);
    expect(amBrett.x).toBeCloseTo(1, 12);
    expect(amBrett.y).toBeCloseTo(2.2, 12);
  });

  it("lässt den Wandpunkt eines Seils stehen — das Seil wird länger", () => {
    const { aufbau, id } = teil(neuerAufbau(), "massestueck", { x: 0, y: 1 });
    const a = erfolg(spanne(aufbau, "seil", { x: 0, y: 2 }, { x: 0, y: 1 })).aufbau;
    const b = setzeLage(a, id, { x: 0, y: 0.5 });
    expect(b.verbinder[0].a.punkt).toEqual({ x: 0, y: 2 });
  });
});

describe("Rückgängig", () => {
  it("geht Schritte zurück und wieder vor", () => {
    const leer = neuerAufbau();
    const eins = teil(leer, "klotz", { x: 0, y: 1 }).aufbau;
    const zwei = teil(eins, "kugel", { x: 1, y: 1 }).aufbau;
    let v = tue(tue(neuerVerlauf(leer), eins), zwei);
    v = zurueck(v);
    expect(v.jetzt).toBe(eins);
    v = zurueck(v);
    expect(v.jetzt).toBe(leer);
    v = vor(v);
    expect(v.jetzt).toBe(eins);
  });

  it("fasst ein ganzes Ziehen zu einem Schritt zusammen", () => {
    const start = teil(neuerAufbau(), "klotz", { x: 0, y: 1 });
    let v = merke(neuerVerlauf(start.aufbau));
    for (let i = 1; i <= 50; i++) v = setze(v, setzeLage(v.jetzt, start.id, { x: i / 50, y: 1 }));
    expect(v.jetzt.teile[0].pos.x).toBeCloseTo(1, 12);
    v = zurueck(v);
    expect(v.jetzt.teile[0].pos.x).toBe(0);
  });

  it("verwirft das Vorwärts, sobald man etwas Neues tut", () => {
    const leer = neuerAufbau();
    const eins = teil(leer, "klotz", { x: 0, y: 1 }).aufbau;
    const anders = teil(leer, "kugel", { x: 0, y: 1 }).aufbau;
    const v = tue(zurueck(tue(neuerVerlauf(leer), eins)), anders);
    expect(v.nachher).toEqual([]);
  });
});

describe("Speichern", () => {
  it("liest einen gespeicherten Aufbau unverändert zurück", () => {
    let a = teil(neuerAufbau(), "brett", { x: 0, y: 1 }, {}, 0.3).aufbau;
    a = erfolg(setzeGelenk(a, "achse", { x: 0, y: 1 })).aufbau;
    expect(aufbauAusJSON(JSON.stringify(a))).toEqual(a);
  });

  it("verwirft Verbinder zu Teilen, die es nicht gibt, statt zu werfen", () => {
    const roh = JSON.stringify({
      version: 2, titel: "x", treue: "real", teile: [],
      verbinder: [{ id: "v1", art: "seil", a: { teil: "t9", punkt: { x: 0, y: 0 } }, b: { teil: null, punkt: { x: 0, y: 1 } }, werte: {} }],
    });
    expect(aufbauAusJSON(roh).verbinder).toEqual([]);
    expect(aufbauAusJSON("kein json").teile).toEqual([]);
  });
});

describe("In der Mitte an die Wand", () => {
  it("schaltet statt zu stapeln: fest, drehbar, gelöst", () => {
    const { aufbau, id } = teil(neuerAufbau(), "brett", { x: 0, y: 1 });
    let a = setzeMitteAnWand(aufbau, id, "schraube");
    a = setzeMitteAnWand(a, id, "schraube");
    expect(a.verbinder).toHaveLength(1);
    expect(mitteAnWand(a, id)).toBe("schraube");

    a = setzeMitteAnWand(a, id, "achse");
    expect(a.verbinder.map(v => v.art)).toEqual(["achse"]);

    a = setzeMitteAnWand(a, id, null);
    expect(a.verbinder).toEqual([]);
    expect(mitteAnWand(a, id)).toBeNull();
  });

  it("räumt schon angesammelte Doppel in der Mitte auf, lässt Stifte an anderen Stellen stehen", () => {
    const { aufbau, id } = teil(neuerAufbau(), "brett", { x: 0, y: 1 });
    let a = aufbau;
    // So sah es vorher nach mehrmaligem Klicken aus: neun Stifte in der Mitte.
    for (let i = 0; i < 9; i++) {
      a = verbinde(a, i % 2 ? "achse" : "schraube", amTeil(id), wand({ x: 0, y: 1 })).aufbau;
    }
    a = verbinde(a, "schraube", amTeil(id, { x: 0.25, y: 0 }), wand({ x: 0.25, y: 1 })).aufbau;
    const b = setzeMitteAnWand(a, id, "achse");
    expect(b.verbinder.map(v => v.art).sort()).toEqual(["achse", "schraube"]);
  });

  it("setzt kein zweites Gelenk an dieselbe Stelle", () => {
    const { aufbau } = teil(neuerAufbau(), "brett", { x: 0, y: 1 });
    const eins = erfolg(setzeGelenk(aufbau, "achse", { x: 0.1, y: 1 })).aufbau;
    expect(setzeGelenk(eins, "achse", { x: 0.1, y: 1 })).toEqual({ fehler: "Hier sitzt schon eine Achse." });
    // Ein Stück daneben ist eine andere Stelle.
    expect(erfolg(setzeGelenk(eins, "achse", { x: 0.2, y: 1 })).aufbau.verbinder).toHaveLength(2);
  });
});
