/**
 * Die Berichte — Zahl, Formel und eingesetzte Rechnung.
 *
 * Geprüft wird beides: dass die Werte stimmen (Energieerhaltung am Pendel) und
 * dass die Rechnung dasteht. Eine Anzeige ohne Herleitung wäre ein
 * Debug-Fenster, kein Unterrichtsmittel.
 */
import { describe, it, expect } from "vitest";
import { bericht, alsText, fallhoehe } from "@/lib/physik/phaenomene";
import { leererZustand } from "@/lib/physik/rechenwerke";
import { mechanikSchritt } from "@/lib/physik/mechanik";
import { neueSzene, stelle } from "@/lib/physik/szene";
import { bogen, G } from "@/lib/physik/einheiten";
import type { LaborZustand } from "@/lib/physik/rechenwerke";
import type { Szene } from "@/lib/physik/typen";

function mit(typ: string, werte: Record<string, number>): Szene {
  const s = stelle(neueSzene(), typ, { x: 0, y: 1 });
  return { ...s, geraete: s.geraete.map(g => ({ ...g, werte: { ...g.werte, ...werte } })) };
}

const wert = (liste: ReturnType<typeof bericht>, name: string) =>
  liste.find(x => x.name === name)!;

describe("Bericht zum Fadenpendel", () => {
  const szene = mit("fadenpendel", { laenge: 1, masse: 0.2, startwinkel: bogen(20), daempfung: 0 });
  const zustand: LaborZustand = { ...leererZustand(), mechanik: mechanikSchritt(szene, {}, 1 / 240) };

  it("rechnet die Höhe über der Ruhelage aus dem Winkel", () => {
    const h = wert(bericht(szene, szene.geraete[0], zustand), "Höhe über Ruhelage");
    expect(h.wert).toBeCloseTo(1 * (1 - Math.cos(bogen(20))), 6);
    expect(h.formel).toBe("h = L · (1 − cos θ)");
  });

  it("setzt die Zahlen in die Formel ein", () => {
    const e = wert(bericht(szene, szene.geraete[0], zustand), "Lageenergie");
    expect(e.formel).toBe("E_pot = m · g · h");
    // Masse und g stehen mit ihren Werten in der Rechnung.
    expect(e.rechnung).toContain("0,2");
    expect(e.rechnung).toContain("9,81");
  });

  it("hält die Gesamtenergie über eine Schwingung konstant", () => {
    let mech = mechanikSchritt(szene, {}, 1 / 240);
    const energien: number[] = [];
    for (let i = 0; i < 480; i++) {
      mech = mechanikSchritt(szene, mech, 1 / 240);
      energien.push(wert(bericht(szene, szene.geraete[0], { ...leererZustand(), mechanik: mech }), "Gesamtenergie").wert);
    }
    const min = Math.min(...energien), max = Math.max(...energien);
    // Lage- und Bewegungsenergie tauschen sich, die Summe bleibt.
    expect((max - min) / max).toBeLessThan(0.01);
  });

  it("nennt die Schwingungsdauer nach der Formel", () => {
    const t = wert(bericht(szene, szene.geraete[0], zustand), "Schwingungsdauer");
    expect(t.wert).toBeCloseTo(2 * Math.PI * Math.sqrt(1 / G), 6);
  });
});

describe("Bericht zum Massestück", () => {
  it("rechnet Gewichtskraft und Lageenergie aus der Weltlage", () => {
    const szene = mit("massestueck", { masse: 0.5 });
    const zustand: LaborZustand = {
      ...leererZustand(),
      welt: { [szene.geraete[0].id]: { x: 0, y: 2, winkel: 0, vx: 3, vy: -4 } },
    };
    const liste = bericht(szene, szene.geraete[0], zustand);

    expect(wert(liste, "Gewichtskraft").wert).toBeCloseTo(0.5 * G, 9);
    expect(wert(liste, "Geschwindigkeit").wert).toBeCloseTo(5, 9);
    expect(wert(liste, "Lageenergie").wert).toBeCloseTo(0.5 * G * 2, 9);
    expect(wert(liste, "Bewegungsenergie").wert).toBeCloseTo(0.5 * 0.5 * 25, 9);
  });
});

describe("Bericht zur schiefen Ebene", () => {
  it("zerlegt die Gewichtskraft in Hangabtrieb und Normalkraft", () => {
    const szene = mit("schiefeebene", { winkel: bogen(30), masse: 2, laenge: 1 });
    const liste = bericht(szene, szene.geraete[0], leererZustand());
    expect(wert(liste, "Hangabtriebskraft").wert).toBeCloseTo(2 * G * 0.5, 6);
    expect(wert(liste, "Normalkraft").wert).toBeCloseTo(2 * G * Math.cos(bogen(30)), 6);
    expect(wert(liste, "Hangabtriebskraft").formel).toBe("F_H = F_G · sin α");
  });
});

describe("alsText", () => {
  it("schreibt Wert und Einheit, wie man es liest", () => {
    const szene = mit("massestueck", { masse: 0.5 });
    const liste = bericht(szene, szene.geraete[0], leererZustand());
    expect(alsText(wert(liste, "Masse"))).toBe("500 g");
  });

  it("zeigt Winkel in Grad, nicht im Bogenmaß", () => {
    const szene = mit("schiefeebene", { winkel: bogen(30), masse: 1, laenge: 1 });
    const liste = bericht(szene, szene.geraete[0], leererZustand());
    expect(alsText(wert(liste, "Neigung"))).toBe("30 °");
  });
});

describe("fallhoehe", () => {
  it("rechnet aus der Geschwindigkeit die Fallhöhe zurück", () => {
    // Aus 1,25 m fällt man auf rund 4,95 m/s.
    expect(fallhoehe(Math.sqrt(2 * G * 1.25))).toBeCloseTo(1.25, 9);
  });
});
