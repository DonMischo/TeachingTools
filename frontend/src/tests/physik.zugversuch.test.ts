/**
 * Der Zugversuch — σ = F/A und ε = σ/E.
 *
 * Der Kern der Sache ist, dass nicht die Kraft über den Bruch entscheidet,
 * sondern die **Spannung**: derselbe Klotz reißt einen dünnen Draht und lässt
 * einen dicken kalt. Genau das steht hier als Test, und dazu die Rangfolge der
 * Werkstoffe — Stahl hält, Gummi dehnt sich, Glas reißt spröde.
 */
import { describe, it, expect } from "vitest";
import { leererZustand, schritt, ueberlastet, zugversuch } from "@/lib/physik/rechenwerke";
import { signalId } from "@/lib/physik/messbus";
import { aufgeloest, neueSzene, portOrt, stelle, verbinde } from "@/lib/physik/szene";
import { querschnitt, WERKSTOFFE, werkstoff } from "@/lib/physik/material";
import { G } from "@/lib/physik/einheiten";
import type { Szene } from "@/lib/physik/typen";

const DT = 1 / 240;
const nummer = (name: string) => WERKSTOFFE.findIndex(w => w.name === name);

/** Probe aus dem angegebenen Werkstoff, mit einem Gewicht daran. */
function versuch(stoffName: string, durchmesser: number, masse: number, laenge = 0.2) {
  let s: Szene = stelle(neueSzene(), "probe", { x: 0, y: 1 });
  const probe = s.geraete[0].id;
  s = { ...s, geraete: s.geraete.map(g => (g.id === probe
    ? { ...g, werte: { werkstoff: nummer(stoffName), laenge, durchmesser } } : g)) };

  s = stelle(s, "massestueck", { x: 0, y: 0.5 });
  const last = s.geraete[1].id;
  s = { ...s, geraete: s.geraete.map(g => (g.id === last ? { ...g, werte: { masse } } : g)) };
  s = verbinde(s, { geraet: probe, port: "unten" }, { geraet: last, port: "oese" });
  return { szene: s, probe, last };
}

describe("Spannung und Dehnung", () => {
  it("rechnet die Zugkraft aus dem angehängten Gewicht", () => {
    const { szene, probe } = versuch("Stahl", 0.0005, 2);
    const z = zugversuch(szene, szene.geraete.find(g => g.id === probe)!, {});
    expect(z.kraft).toBeCloseTo(2 * G, 9);
  });

  it("teilt die Kraft durch den Querschnitt", () => {
    const { szene, probe } = versuch("Stahl", 0.0005, 2);
    const z = zugversuch(szene, szene.geraete.find(g => g.id === probe)!, {});
    expect(z.flaeche).toBeCloseTo(querschnitt(0.0005), 12);
    expect(z.spannung).toBeCloseTo((2 * G) / querschnitt(0.0005), 3);
  });

  it("folgt dem Hookeschen Gesetz: ε = σ / E", () => {
    const { szene, probe } = versuch("Kupfer", 0.0008, 3);
    const z = zugversuch(szene, szene.geraete.find(g => g.id === probe)!, {});
    expect(z.dehnung).toBeCloseTo(z.spannung / werkstoff(nummer("Kupfer")).E, 12);
    expect(z.verlaengerung).toBeCloseTo(z.dehnung * 0.2, 12);
  });

  it("dehnt Gummi weit mehr als Stahl bei derselben Last", () => {
    const stahl = versuch("Stahl", 0.001, 1);
    const gummi = versuch("Gummi", 0.001, 1);
    const a = zugversuch(stahl.szene, stahl.szene.geraete[0], {}).dehnung;
    const b = zugversuch(gummi.szene, gummi.szene.geraete[0], {}).dehnung;
    // Der Elastizitätsmodul unterscheidet sich um mehr als das Tausendfache.
    expect(b / a).toBeGreaterThan(1000);
  });

  it("legt alles auf den Messbus, die Dehnung in Prozent lesbar", () => {
    const { szene, probe } = versuch("Kupfer", 0.0008, 3);
    const { werte } = schritt(szene, leererZustand(), DT);
    expect(werte.get(signalId(probe, "kraft"))).toBeCloseTo(3 * G, 6);
    expect(werte.get(signalId(probe, "spannung"))).toBeGreaterThan(0);
    expect(werte.get(signalId(probe, "dehnung"))).toBeGreaterThan(0);
  });
});

describe("Der Querschnitt entscheidet, nicht die Kraft", () => {
  it("reißt den dünnen Draht und lässt den dicken heil", () => {
    // Dieselbe Last, derselbe Werkstoff — nur der Durchmesser unterscheidet sich.
    const duenn = versuch("Kupfer", 0.0002, 3);
    const dick = versuch("Kupfer", 0.002, 3);
    expect(zugversuch(duenn.szene, duenn.szene.geraete[0], {}).reisst).toBe(true);
    expect(zugversuch(dick.szene, dick.szene.geraete[0], {}).reisst).toBe(false);
  });

  it("nennt die überlasteten Proben beim Namen", () => {
    const { szene, probe } = versuch("Gummi", 0.0003, 5);
    expect(ueberlastet(szene, {})).toEqual([probe]);
  });

  it("lässt eine unbelastete Probe in Ruhe", () => {
    let s: Szene = stelle(neueSzene(), "probe", { x: 0, y: 1 });
    expect(ueberlastet(s, {})).toEqual([]);
    s = stelle(s, "massestueck", { x: 1, y: 1 }); // danebengelegt, nicht angehängt
    expect(ueberlastet(s, {})).toEqual([]);
  });
});

describe("Werkstoffe im Vergleich", () => {
  it("hält Stahl, wo Aluminium schon reißt", () => {
    // 2 kg an 0,3 mm sind rund 280 MPa: ueber der Zugfestigkeit von Aluminium
    // (150 MPa), deutlich unter der von Stahl (500 MPa).
    const stahl = versuch("Stahl", 0.0003, 2);
    const alu = versuch("Aluminium", 0.0003, 2);
    expect(zugversuch(stahl.szene, stahl.szene.geraete[0], {}).reisst).toBe(false);
    expect(zugversuch(alu.szene, alu.szene.geraete[0], {}).reisst).toBe(true);
  });

  it("reißt Glas, ohne sich vorher zu recken", () => {
    const stoff = werkstoff(nummer("Glas"));
    // Spröde: Streckgrenze und Zugfestigkeit fallen zusammen.
    expect(stoff.sproede).toBe(true);
    expect(stoff.streckgrenze).toBe(stoff.zugfestigkeit);
  });
});

describe("Die Probe wird länger", () => {
  it("hängt die Last am gedehnten Ende, nicht am ungedehnten", () => {
    const { szene, probe } = versuch("Gummi", 0.001, 2);
    const z = zugversuch(szene, szene.geraete[0], {});
    expect(z.verlaengerung).toBeGreaterThan(0.001);

    const g = szene.geraete.find(x => x.id === probe)!;
    const ohne = portOrt(g, "unten", { q: 0 })!;
    const mit = portOrt(g, "unten", { q: z.verlaengerung })!;
    expect(ohne.y - mit.y).toBeCloseTo(z.verlaengerung, 12);
  });

  it("zieht das angehängte Gewicht mit nach unten", () => {
    const { szene, probe, last } = versuch("Gummi", 0.001, 2);
    const z = zugversuch(szene, szene.geraete[0], {});
    const mechanik = { [probe]: { q: z.verlaengerung } };

    const gedehnt = aufgeloest(szene, mechanik).geraete.find(g => g.id === last)!;
    const schlaff = aufgeloest(szene, { [probe]: { q: 0 } }).geraete.find(g => g.id === last)!;
    expect(schlaff.pos.y - gedehnt.pos.y).toBeCloseTo(z.verlaengerung, 9);
  });
});
