/**
 * Messen am Baukasten: was der Löser weiß, sauber abgelesen.
 *
 * Geprüft wird gegen die Schulformeln — freier Fall mit ½gt², Energieerhaltung
 * am Pendel, Seilkraft gleich Gewicht. Wenn eine Messgröße falsch abgeleitet
 * ist, fällt das hier auf und nicht erst an einer Kurve, die »irgendwie
 * komisch« aussieht.
 */
import { afterEach, describe, it, expect } from "vitest";
import { G } from "@/lib/physik/einheiten";
import { alsCsv, messgroessen, Schreiber, MESSTAKT } from "@/lib/physik/kern/messen";
import { amTeil, fuegeTeilHinzu, neuerAufbau, verbinde, wand, type Aufbau, type TeilArt } from "@/lib/physik/kern/modell";
import { standardWerteTeil } from "@/lib/physik/kern/teile";
import { Welt } from "@/lib/physik/kern/welt";

const welten: Welt[] = [];
afterEach(() => { while (welten.length) welten.pop()!.zerstoere(); });

function teil(a: Aufbau, art: TeilArt, pos: { x: number; y: number }, werte: Record<string, number> = {}) {
  return fuegeTeilHinzu(a, art, pos, { ...standardWerteTeil(art), ...werte });
}
const starte = (a: Aufbau) => { const w = new Welt(a); welten.push(w); return w; };
const laufe = (w: Welt, s: number, je?: () => void) => {
  for (let i = 0; i < Math.round(s * 60); i++) { w.schritt(); je?.(); }
};
const finde = (a: Aufbau, id: string) => {
  const m = messgroessen(a).find(x => x.id === id);
  if (!m) throw new Error(`Keine Messgröße ${id}`);
  return m;
};

describe("Die Messgrößen eines Aufbaus", () => {
  it("nennt Teile durchgezählt nach ihrer Art", () => {
    let a = neuerAufbau();
    a = teil(a, "massestueck", { x: 0, y: 1 }).aufbau;
    a = teil(a, "massestueck", { x: 1, y: 1 }).aufbau;
    a = teil(a, "brett", { x: 0, y: 2 }).aufbau;
    const quellen = [...new Set(messgroessen(a).map(m => m.quelle))];
    expect(quellen).toEqual(["Massestück 1", "Massestück 2", "Brett 1"]);
  });

  it("misst den freien Fall mit ½·g·t² und v = g·t", () => {
    let a = neuerAufbau();
    const kugel = teil(a, "kugel", { x: 0, y: 5 }, { durchmesser: 0.05 }); a = kugel.aufbau;
    const w = starte(a);
    const hoehe = finde(a, `${kugel.id}.y`);
    const tempo = finde(a, `${kugel.id}.vy`);
    laufe(w, 0.5);

    // Auf einen Zentimeter genau: der Löser rechnet in Schritten, und dabei
    // bleibt der Fall um einen halben Schritt hinter der Formel zurück.
    expect(hoehe.lies(w)!).toBeCloseTo(5 - 0.5 * G * 0.5 ** 2, 1);
    expect(tempo.lies(w)!).toBeCloseTo(-G * 0.5, 1);
  });

  it("hält die Summe der Energien am Pendel fest", () => {
    let a = neuerAufbau();
    // Ein Meter Seil, das Gewicht um 30° ausgelenkt.
    const m = teil(a, "massestueck", { x: Math.sin(0.5), y: 3 - Math.cos(0.5) }, { masse: 0.5 }); a = m.aufbau;
    a = verbinde(a, "seil", wand({ x: 0, y: 3 }), amTeil(m.id), { laenge: 1 }).aufbau;
    const w = starte(a);
    const ekin = finde(a, `${m.id}.ekin`), epot = finde(a, `${m.id}.epot`);

    const summe = () => ekin.lies(w)! + epot.lies(w)!;
    const start = summe();
    let kleinste = start, groesste = start;
    laufe(w, 2, () => { kleinste = Math.min(kleinste, summe()); groesste = Math.max(groesste, summe()); });

    // Das Pendel schwingt wirklich: die Bewegungsenergie wird unterwegs groß.
    expect(groesste).toBeGreaterThan(0);
    // Und die Summe bleibt: weniger als ein Zwanzigstel Schwankung.
    expect(groesste - kleinste).toBeLessThan(0.05 * start);
  });

  it("liest die Seilkraft als das Gewicht der Last", () => {
    let a = neuerAufbau();
    const m = teil(a, "massestueck", { x: 0, y: 2 }, { masse: 3 }); a = m.aufbau;
    const seil = verbinde(a, "seil", wand({ x: 0, y: 3 }), amTeil(m.id), { laenge: 1 });
    a = seil.aufbau;
    const w = starte(a);
    laufe(w, 1);

    expect(finde(a, `${seil.id}.kraft`).lies(w)!).toBeCloseTo(3 * G, 0);
    expect(finde(a, `${seil.id}.laenge`).lies(w)!).toBeCloseTo(1, 1);
  });

  it("zählt die Drehenergie mit, wenn sich etwas dreht", () => {
    let a = neuerAufbau();
    const rad = teil(a, "scheibe", { x: 0, y: 2 }, { durchmesser: 0.4, masseVorgabe: 2 }); a = rad.aufbau;
    a = verbinde(a, "achse", amTeil(rad.id), wand({ x: 0, y: 2 }), { motorMoment: 50, drehzahl: 6 }).aufbau;
    const w = starte(a);
    laufe(w, 1);

    // Die Scheibe steht auf der Stelle, hat aber Energie: ½·J·ω².
    const z = w.zustand(rad.id)!;
    expect(Math.hypot(z.vx, z.vy)).toBeLessThan(0.01);
    expect(finde(a, `${rad.id}.ekin`).lies(w)!).toBeCloseTo(0.5 * w.traegheit(rad.id) * z.omega ** 2, 4);
    expect(finde(a, `${rad.id}.ekin`).lies(w)!).toBeGreaterThan(0.5);
  });
});

describe("Der Schreiber", () => {
  it("nimmt mit, ohne bei jedem Rechenschritt einen Punkt zu setzen", () => {
    let a = neuerAufbau();
    const kugel = teil(a, "kugel", { x: 0, y: 5 }); a = kugel.aufbau;
    const w = starte(a);
    const groessen = messgroessen(a);
    const s = new Schreiber(groessen);
    laufe(w, 2, () => s.nimmAuf(w));

    const verlauf = s.bus.verlauf(`${kugel.id}.y`)!;
    expect(verlauf.t.length).toBeCloseTo(2 / MESSTAKT, -1);
    expect(verlauf.t[0]).toBeLessThan(0.1);
    // Aufgezeichnet wird alles, nicht nur das später Angekreuzte.
    expect(s.bus.ids().length).toBe(groessen.length);
  });

  it("schreibt die Aufzeichnung als CSV mit Kopfzeile und Einheiten", () => {
    let a = neuerAufbau();
    const kugel = teil(a, "kugel", { x: 0, y: 5 }); a = kugel.aufbau;
    const w = starte(a);
    const groessen = messgroessen(a);
    const s = new Schreiber(groessen);
    laufe(w, 0.5, () => s.nimmAuf(w));

    const gewaehlt = [finde(a, `${kugel.id}.y`), finde(a, `${kugel.id}.drehung`)];
    const zeilen = alsCsv(s.bus, gewaehlt).split("\n");
    expect(zeilen[0]).toBe("t (s);Murmel 1 Höhe (m);Murmel 1 Drehung (°)");
    expect(zeilen.length).toBeGreaterThan(10);
    expect(zeilen[1].split(";")).toHaveLength(3);
    // Die Höhe der zweiten Zeile liegt noch nahe am Start.
    expect(Number(zeilen[1].split(";")[1])).toBeCloseTo(5, 1);
  });
});
