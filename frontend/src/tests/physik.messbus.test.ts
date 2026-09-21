/**
 * Der Messbus: die Stelle, an der alles Zeitabhängige zusammenkommt.
 *
 * Er ist reine Ablage — wer einen Wert geschrieben hat, erfährt er nie, und
 * genau deshalb liest *ein* Messschreiber die Größen aus dem ganzen Labor.
 * Die Obergrenze ist keine Sparsamkeit: ohne sie fräße ein Labor, das eine
 * Schulstunde lang offensteht, den Browser auf.
 */
import { describe, it, expect } from "vitest";
import { Messbus, signalId } from "@/lib/physik/messbus";

describe("Messbus", () => {
  it("schreibt und liest einen Verlauf", () => {
    const bus = new Messbus();
    bus.schreibe(0, [["g1.spannung", 1]]);
    bus.schreibe(0.1, [["g1.spannung", 2]]);
    expect(bus.verlauf("g1.spannung")).toEqual({ t: [0, 0.1], v: [1, 2] });
  });

  it("kennt den jüngsten Wert", () => {
    const bus = new Messbus();
    bus.schreibe(0, [["g1.kraft", 5]]);
    bus.schreibe(1, [["g1.kraft", 7]]);
    expect(bus.letzter("g1.kraft")).toBe(7);
    expect(bus.letzter("gibtsnicht")).toBeUndefined();
  });

  it("wirft die ältesten Werte weg, statt endlos zu wachsen", () => {
    const bus = new Messbus(100);
    for (let i = 0; i < 500; i++) bus.schreibe(i, [["g1.spannung", i]]);
    const v = bus.verlauf("g1.spannung")!;
    expect(v.v.length).toBeLessThanOrEqual(100);
    // Der jüngste Wert bleibt in jedem Fall stehen.
    expect(v.v[v.v.length - 1]).toBe(499);
  });

  it("listet die Signale, die geschrieben wurden", () => {
    const bus = new Messbus();
    bus.schreibe(0, [["g1.spannung", 1], ["g2.kraft", 2]]);
    expect(bus.ids().sort()).toEqual(["g1.spannung", "g2.kraft"]);
  });

  it("lässt sich leeren", () => {
    const bus = new Messbus();
    bus.schreibe(0, [["g1.spannung", 1]]);
    bus.leere();
    expect(bus.ids()).toEqual([]);
  });
});

describe("signalId", () => {
  it("setzt sich aus Gerät und Größe zusammen", () => {
    expect(signalId("g3", "kraft")).toBe("g3.kraft");
  });
});
