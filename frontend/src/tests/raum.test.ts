/**
 * Prüft das räumliche Modell an den Winkeln, die im Unterricht genannt
 * werden: 109,5° am gesättigten Kohlenstoff, 120° am Alken, 180° am Alkin.
 */
import { describe, expect, it } from "vitest";
import { ausName } from "@/lib/struktur/iupac";
import { baueRaum, bindungslaenge, winkel, type Raummodell } from "@/lib/struktur/raum";

const raum = (name: string): Raummodell => {
  const r = ausName(name);
  if (!r.ok) throw new Error(`${name}: ${r.fehler}`);
  return baueRaum(r.m);
};

const abstand = (m: Raummodell, a: number, b: number) =>
  Math.hypot(m.atome[a].pos.x - m.atome[b].pos.x,
    m.atome[a].pos.y - m.atome[b].pos.y,
    m.atome[a].pos.z - m.atome[b].pos.z);

/** Alle Winkel an einem Atom, über seine Bindungen. */
const winkelAn = (m: Raummodell, i: number): number[] => {
  const n = m.bindungen.flatMap(b => (b.a === i ? [b.b] : b.b === i ? [b.a] : []));
  const aus: number[] = [];
  for (let a = 0; a < n.length; a++) {
    for (let b = a + 1; b < n.length; b++) aus.push(winkel(m, n[a], i, n[b]));
  }
  return aus;
};

describe("Bindungswinkel", () => {
  it("macht das gesättigte C zum Tetraeder (109,5°)", () => {
    const m = raum("Methan");
    for (const w of winkelAn(m, 0)) expect(w).toBeCloseTo(109.47, 0);
  });

  it("legt das Alken flach mit 120°", () => {
    const m = raum("Ethen");
    for (const i of [0, 1]) {
      for (const w of winkelAn(m, i)) expect(w).toBeCloseTo(120, 0);
    }
    // Flach heißt: alle sechs Atome liegen in einer Ebene.
    const z = m.atome.map(a => a.pos.z);
    expect(Math.max(...z) - Math.min(...z)).toBeLessThan(0.01);
  });

  it("streckt das Alkin gerade (180°)", () => {
    const m = raum("Ethin");
    for (const i of [0, 1]) {
      for (const w of winkelAn(m, i)) expect(w).toBeCloseTo(180, 0);
    }
  });

  it("winkelt das Wasserstoffatom am Sauerstoff ab", () => {
    const m = raum("Methanol");
    // C–O–H liegt beim Tetraederwinkel, nicht gestreckt.
    const o = m.atome.findIndex(a => a.el === "O");
    expect(winkelAn(m, o)[0]).toBeCloseTo(109.47, 0);
  });
});

describe("Bindungslängen", () => {
  it("nimmt die Längen aus der Tabelle", () => {
    expect(bindungslaenge("C", "C", 1)).toBeCloseTo(1.54, 2);
    expect(bindungslaenge("C", "C", 2)).toBeCloseTo(1.34, 2);
    expect(bindungslaenge("C", "C", 3)).toBeCloseTo(1.20, 2);
    // Die Reihenfolge der Partner darf keine Rolle spielen.
    expect(bindungslaenge("O", "C", 2)).toBeCloseTo(bindungslaenge("C", "O", 2), 5);
  });

  it("setzt jedes Atom in der richtigen Entfernung", () => {
    for (const name of ["Ethanol", "Essigsäure", "Propen", "2-Chlorpropan", "Aceton"]) {
      const m = raum(name);
      for (const b of m.bindungen) {
        const soll = bindungslaenge(m.atome[b.a].el, m.atome[b.b].el, b.grad);
        expect(abstand(m, b.a, b.b), `${name}: ${m.atome[b.a].el}–${m.atome[b.b].el}`).toBeCloseTo(soll, 2);
      }
    }
  });
});

describe("Aufbau", () => {
  it("ergänzt die Wasserstoffatome als eigene Kugeln", () => {
    const m = raum("Ethan");
    expect(m.atome.filter(a => a.el === "H")).toHaveLength(6);
    expect(m.atome.filter(a => a.el === "C")).toHaveLength(2);
    expect(m.bindungen).toHaveLength(7);
  });

  it("legt den Benzolring flach", () => {
    const m = raum("Benzol");
    const z = m.atome.map(a => a.pos.z);
    expect(Math.max(...z) - Math.min(...z)).toBeLessThan(0.01);
  });

  it("wellt den gesättigten Ring, statt ihn flach zu lassen", () => {
    const m = raum("Cyclohexan");
    const ringZ = m.atome.slice(0, 6).map(a => a.pos.z);
    expect(Math.max(...ringZ) - Math.min(...ringZ)).toBeGreaterThan(0.3);
  });

  it("setzt kein Atom auf ein anderes", () => {
    for (const name of ["Methan", "Ethanol", "Essigsäure", "Benzol", "2,3-Dimethylbutan", "Glycerin", "Aceton"]) {
      const m = raum(name);
      for (let i = 0; i < m.atome.length; i++) {
        for (let j = i + 1; j < m.atome.length; j++) {
          expect(abstand(m, i, j), `${name}: Atom ${i} und ${j}`).toBeGreaterThan(0.8);
        }
      }
    }
  });

  it("rückt den Schwerpunkt in den Ursprung", () => {
    const m = raum("Essigsäure");
    const s = m.atome.reduce((a, b) => ({
      x: a.x + b.pos.x, y: a.y + b.pos.y, z: a.z + b.pos.z,
    }), { x: 0, y: 0, z: 0 });
    expect(Math.hypot(s.x, s.y, s.z) / m.atome.length).toBeCloseTo(0, 5);
  });
});
