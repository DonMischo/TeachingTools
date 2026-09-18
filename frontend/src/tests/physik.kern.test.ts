/**
 * Der neue Kern: ein Löser, Grundteile, Verbinder.
 *
 * Geprüft wird gegen die Physik, nicht gegen den eigenen Code: die Pendel-
 * dauer gegen 2π√(L/g), die Federdauer gegen 2π√(m/k), die Seilkraft gegen
 * m·g. Stimmen diese, lässt sich mit dem Baukasten messen — dann braucht es
 * keine eigenen Rechenmodelle je Schulgerät mehr.
 */
import { afterEach, describe, it, expect } from "vitest";
import { amTeil, fuegeTeilHinzu, neuerAufbau, verbinde, wand, type Aufbau, type TeilArt } from "@/lib/physik/kern/modell";
import { standardWerteTeil, teilMasse } from "@/lib/physik/kern/teile";
import { Welt, type Ereignis } from "@/lib/physik/kern/welt";
import { FESTSTOFFE } from "@/lib/physik/material";

const stoff = (name: string) => FESTSTOFFE.findIndex(f => f.name === name);
const G = 9.81;

// Jede Welt belegt einen der 32 Plätze im Löser — nach jedem Test freigeben.
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

function teil(a: Aufbau, art: TeilArt, pos: { x: number; y: number }, werte: Record<string, number> = {}, winkel = 0) {
  return fuegeTeilHinzu(a, art, pos, { ...standardWerteTeil(art), ...werte }, winkel);
}

describe("Massen aus Werkstoff und Volumen", () => {
  it("rechnet ein Holzbrett aus Länge, Dicke und Tiefe", () => {
    const { aufbau, id } = teil(neuerAufbau(), "brett", { x: 0, y: 1 }, { laenge: 0.6, dicke: 0.02, tiefe: 0.1, stoff: stoff("Holz") });
    const t = aufbau.teile.find(x => x.id === id)!;
    // 0,6 · 0,02 · 0,1 m³ · 600 kg/m³
    expect(teilMasse(t)).toBeCloseTo(0.72, 9);
    // Und der Löser sieht dieselbe Masse.
    expect(starte(aufbau).masse(id)).toBeCloseTo(0.72, 6);
  });

  it("wiegt eine Stange gleich viel, ob längs oder von vorn gesehen", () => {
    let a = neuerAufbau();
    const laengs = teil(a, "stange", { x: 0, y: 1 }, { laenge: 0.5, durchmesser: 0.01, stoff: stoff("Stahl"), stirn: 0 });
    a = laengs.aufbau;
    const stirn = teil(a, "stange", { x: 1, y: 1 }, { laenge: 0.5, durchmesser: 0.01, stoff: stoff("Stahl"), stirn: 1 });
    a = stirn.aufbau;
    const w = starte(a);
    expect(w.masse(laengs.id)).toBeCloseTo(7850 * Math.PI * 0.005 ** 2 * 0.5, 5);
    expect(w.masse(stirn.id)).toBeCloseTo(w.masse(laengs.id), 6);
  });

  it("gibt Murmel, Klotz und Brett aus verschiedenen Stoffen verschiedene Massen", () => {
    const m = (art: TeilArt, s: string) =>
      teilMasse(teil(neuerAufbau(), art, { x: 0, y: 0 }, { stoff: stoff(s) }).aufbau.teile[0]);
    expect(m("kugel", "Stahl") / m("kugel", "Styropor")).toBeCloseTo(7850 / 30, 6);
    expect(m("klotz", "Stahl")).toBeGreaterThan(m("klotz", "Holz"));
  });

  it("nimmt eine vorgegebene Masse statt der berechneten", () => {
    const { aufbau, id } = teil(neuerAufbau(), "klotz", { x: 0, y: 1 }, { masseVorgabe: 2.5 });
    expect(starte(aufbau).masse(id)).toBeCloseTo(2.5, 6);
  });
});

describe("Die Wand", () => {
  it("hält ein angeschraubtes Brett, ein loses fällt", () => {
    let a = neuerAufbau();
    const fest = teil(a, "brett", { x: 0, y: 1 });
    a = verbinde(fest.aufbau, "schraube", amTeil(fest.id), wand({ x: 0, y: 1 })).aufbau;
    const lose = teil(a, "brett", { x: 1, y: 1 });
    a = lose.aufbau;
    const w = starte(a);
    laufe(w, 1);
    expect(w.zustand(fest.id)!.y).toBeCloseTo(1, 3);
    expect(w.zustand(lose.id)!.y).toBeLessThan(0.1);
  });

  it("macht aus einer Stange von vorn einen Stift, an dem eine Murmel liegen bleibt", () => {
    let a = neuerAufbau();
    // Der Stift sitzt so tief, dass er der rollenden Murmel (3 cm) im Weg ist:
    // Unterkante 2 cm über dem Boden, Murmel oben bei 3 cm.
    const stift = teil(a, "stange", { x: 0.3, y: 0.03 }, { durchmesser: 0.02, stirn: 1 });
    a = verbinde(stift.aufbau, "schraube", amTeil(stift.id), wand({ x: 0.3, y: 0.03 })).aufbau;
    const kugel = teil(a, "kugel", { x: 0, y: 0.015 }, { durchmesser: 0.03, stoff: stoff("Stahl") });
    const w = starte(kugel.aufbau);
    w.gibTempo(kugel.id, 1, 0);
    laufe(w, 1.5);
    expect(w.zustand(kugel.id)!.x).toBeLessThan(0.3);
  });
});

describe("Messen mit dem Baukasten", () => {
  it("lässt ein Massestück am Seil mit 2π√(L/g) schwingen", () => {
    let a = neuerAufbau();
    const winkel = 0.08;
    const m = teil(a, "massestueck", { x: Math.sin(winkel), y: 2 - Math.cos(winkel) }, { masse: 0.5 });
    a = verbinde(m.aufbau, "seil", wand({ x: 0, y: 2 }), amTeil(m.id)).aufbau;
    const w = starte(a);
    const durchgaenge: number[] = [];
    let vorher = w.zustand(m.id)!.x;
    laufe(w, 12, () => {
      const x = w.zustand(m.id)!.x;
      if (vorher > 0 && x <= 0) durchgaenge.push(w.t - (1 / 60) * (x / (x - vorher)));
      vorher = x;
    });
    const T = (durchgaenge.at(-1)! - durchgaenge[0]) / (durchgaenge.length - 1);
    // Kleine Auslenkung: die Korrektur (1 + θ²/16) ist hier schon unter 0,05 %.
    expect(T).toBeCloseTo(2 * Math.PI * Math.sqrt(1 / G), 2);
  });

  it("zeigt am Seil die Gewichtskraft der Last", () => {
    let a = neuerAufbau();
    const m = teil(a, "massestueck", { x: 0, y: 1.5 }, { masse: 2 });
    const seil = verbinde(m.aufbau, "seil", wand({ x: 0, y: 2 }), amTeil(m.id));
    const w = starte(seil.aufbau);
    laufe(w, 1);
    expect(w.kraft(seil.id)!.betrag).toBeCloseTo(2 * G, 1);
  });

  it("dehnt eine Feder um m·g/k und lässt sie mit 2π√(m/k) schwingen", () => {
    let a = neuerAufbau();
    const k = 40, masse = 0.5;
    // Zu Beginn entspannt: 0,3 m Ruhelänge, die Last hängt genau dort.
    const m = teil(a, "massestueck", { x: 0, y: 1.7 }, { masse });
    const feder = verbinde(m.aufbau, "feder", wand({ x: 0, y: 2 }), amTeil(m.id), { federkonstante: k, laenge: 0.3 });
    const w = starte(feder.aufbau);
    const y: number[] = [];
    const tiefpunkte: number[] = [];
    laufe(w, 6, () => {
      y.push(w.zustand(m.id)!.y);
      const n = y.length;
      if (n >= 3 && y[n - 2] < y[n - 3] && y[n - 2] <= y[n - 1]) tiefpunkte.push(w.t);
    });
    const mitte = (Math.max(...y) + Math.min(...y)) / 2;
    expect(1.7 - mitte).toBeCloseTo((masse * G) / k, 2);
    const T = (tiefpunkte.at(-1)! - tiefpunkte[0]) / (tiefpunkte.length - 1);
    expect(T).toBeCloseTo(2 * Math.PI * Math.sqrt(masse / k), 1);
  });
});

describe("Maschinen aus Grundteilen", () => {
  it("baut aus Brett und Achse eine Wippe, die einen Klotz schleudert", () => {
    const wippe = (mitGewicht: boolean) => {
      let a = neuerAufbau();
      const brett = teil(a, "brett", { x: 0, y: 0.12 }, { laenge: 0.8, dicke: 0.02 });
      a = verbinde(brett.aufbau, "achse", amTeil(brett.id), wand({ x: 0, y: 0.12 })).aufbau;
      const klotz = teil(a, "klotz", { x: -0.35, y: 0.155 }, { breite: 0.05, hoehe: 0.05, tiefe: 0.05 });
      a = klotz.aufbau;
      if (mitGewicht) a = teil(a, "massestueck", { x: 0.35, y: 1.2 }, { masse: 3 }).aufbau;
      const w = starte(a);
      let hoch = 0;
      laufe(w, 2, () => { hoch = Math.max(hoch, w.zustand(klotz.id)!.y); });
      return hoch;
    };
    expect(wippe(false)).toBeLessThan(0.2);
    expect(wippe(true)).toBeGreaterThan(0.5);
  });

  it("lässt eine Schraube mit Bruchkraft nachgeben — und meldet es", () => {
    let a = neuerAufbau();
    const brett = teil(a, "brett", { x: 0, y: 1 });
    const schraube = verbinde(brett.aufbau, "schraube", amTeil(brett.id), wand({ x: 0, y: 1 }), { bruchkraft: 20 });
    a = schraube.aufbau;
    // 5 kg daran — das hält eine 20-N-Schraube nicht.
    const last = teil(a, "massestueck", { x: 0.25, y: 0.9 }, { masse: 5 });
    a = verbinde(last.aufbau, "seil", amTeil(brett.id, { x: 0.25, y: 0 }), amTeil(last.id)).aufbau;
    const w = starte(a);
    const ereignisse: Ereignis[] = [];
    laufe(w, 1, () => ereignisse.push(...w.holeEreignisse()));
    expect(w.haelt(schraube.id)).toBe(false);
    expect(ereignisse.some(e => e.art === "bruch" && e.verbinder === schraube.id)).toBe(true);
    expect(w.zustand(brett.id)!.y).toBeLessThan(0.5);
  });

  it("löst auf Knopfdruck, was ein Verbinder hielt", () => {
    let a = neuerAufbau();
    const m = teil(a, "massestueck", { x: 0, y: 1.5 });
    const seil = verbinde(m.aufbau, "seil", wand({ x: 0, y: 2 }), amTeil(m.id));
    const w = starte(seil.aufbau);
    laufe(w, 0.5);
    expect(w.zustand(m.id)!.y).toBeCloseTo(1.5, 2);
    w.loese(seil.id);
    laufe(w, 1);
    expect(w.zustand(m.id)!.y).toBeLessThan(0.1);
    expect(w.holeEreignisse().some(e => e.art === "geloest")).toBe(true);
  });

  it("dreht eine Achse mit Motor gleichmäßig — auch über eine Umdrehung hinaus", () => {
    let a = neuerAufbau();
    const s = teil(a, "scheibe", { x: 0, y: 1 });
    a = verbinde(s.aufbau, "achse", wand({ x: 0, y: 1 }), amTeil(s.id), { motorMoment: 50, drehzahl: 3 }).aufbau;
    const w = starte(a);
    laufe(w, 4);
    // 3 rad/s über 4 s: fast zwei Umdrehungen, aufsummiert statt bei ±π abgeschnitten.
    expect(w.zustand(s.id)!.umdrehung).toBeCloseTo(12, 0);
  });
});

describe("Die Hand und der Löser", () => {
  it("zieht ein gegriffenes Teil zum Zeiger", () => {
    const { aufbau, id } = teil(neuerAufbau(), "klotz", { x: 0, y: 0.05 });
    const w = starte(aufbau);
    w.greife(id, { x: 0, y: 0.05 });
    w.ziehe({ x: 0.4, y: 0.6 });
    laufe(w, 2);
    expect(w.zustand(id)!.x).toBeCloseTo(0.4, 1);
    expect(w.zustand(id)!.y).toBeCloseTo(0.6, 1);
  });

  it("gibt beim Zerstören den Platz frei — auch nach vielen Versuchen", () => {
    // Der Port hält höchstens 32 Welten; ohne Freigabe schlüge die 33. still fehl.
    for (let i = 0; i < 50; i++) new Welt(neuerAufbau()).zerstoere();
    const w = starte(teil(neuerAufbau(), "kugel", { x: 0, y: 1 }).aufbau);
    laufe(w, 0.5);
    expect(w.zustand("t1")!.y).toBeLessThan(1);
  });
});
