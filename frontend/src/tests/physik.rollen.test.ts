/**
 * Seile über Rollen: feste Rolle, lose Rolle, Flaschenzug, Atwood.
 *
 * Das ist die Probe auf `kern/seilzug.ts`. Gemessen wird nicht, ob es „sich
 * richtig anfühlt“, sondern gegen die Formeln aus dem Buch: die feste Rolle
 * lenkt nur um, die lose halbiert, der Flaschenzug viertelt, und die
 * Atwoodsche Fallmaschine fällt mit (m₁−m₂)g/(m₁+m₂).
 *
 * Die früheren Anläufe scheiterten genau hier — ein Seil aus Gliedern dehnte
 * sich, starre Stränge waren statisch unbestimmt, und am Kranz festgebunden
 * konnte das Seil nicht rutschen. Deshalb stehen die Zahlen so genau da.
 */
import { afterEach, describe, it, expect } from "vitest";
import { amTeil, entferneTeil, fuegeTeilHinzu, neuerAufbau, verbinde, wand, type Aufbau, type TeilArt } from "@/lib/physik/kern/modell";
import { standardWerteTeil } from "@/lib/physik/kern/teile";
import { Welt } from "@/lib/physik/kern/welt";

const G = 9.81;
const welten: Welt[] = [];
afterEach(() => { while (welten.length) welten.pop()!.zerstoere(); });

function teil(a: Aufbau, art: TeilArt, pos: { x: number; y: number }, werte: Record<string, number> = {}) {
  return fuegeTeilHinzu(a, art, pos, { ...standardWerteTeil(art), ...werte });
}
const starte = (a: Aufbau) => { const w = new Welt(a); welten.push(w); return w; };
const laufe = (w: Welt, s: number) => { for (let i = 0; i < Math.round(s * 60); i++) w.schritt(); };

/** Eine Scheibe an einer Achse an der Wand — die feste Rolle. */
function festeRolle(a: Aufbau, pos: { x: number; y: number }, durchmesser = 0.2) {
  const r = teil(a, "scheibe", pos, { durchmesser, masseVorgabe: 0.05 });
  return { id: r.id, aufbau: verbinde(r.aufbau, "achse", amTeil(r.id), wand(pos)).aufbau };
}

describe("Die feste Rolle", () => {
  it("lenkt nur um: die Seilkraft bleibt das Gewicht der Last", () => {
    let a = neuerAufbau();
    const rolle = festeRolle(a, { x: 0, y: 3 }); a = rolle.aufbau;
    const last = teil(a, "massestueck", { x: -0.1, y: 1 }, { masse: 1 }); a = last.aufbau;
    const seil = verbinde(a, "seil", amTeil(last.id), wand({ x: 0.1, y: 1 }), {}, [amTeil(rolle.id)]);
    const w = starte(seil.aufbau);
    laufe(w, 1.5);

    expect(w.kraft(seil.id)!.betrag).toBeCloseTo(1 * G, 0);
    // Die Last hängt: sie sackt höchstens ein paar Millimeter durch.
    expect(w.zustand(last.id)!.y).toBeGreaterThan(0.99);
  });

  it("dreht sich mit, wenn Seil über sie läuft", () => {
    let a = neuerAufbau();
    const rolle = festeRolle(a, { x: 0, y: 3 }); a = rolle.aufbau;
    const schwer = teil(a, "massestueck", { x: -0.1, y: 1 }, { masse: 2 }); a = schwer.aufbau;
    const leicht = teil(a, "massestueck", { x: 0.1, y: 1 }, { masse: 1 }); a = leicht.aufbau;
    const seil = verbinde(a, "seil", amTeil(schwer.id), amTeil(leicht.id), {}, [amTeil(rolle.id)]);
    const w = starte(seil.aufbau);
    laufe(w, 0.4);

    const v = -w.zustand(schwer.id)!.vy;
    expect(v).toBeGreaterThan(0.5);
    // ω = v/r: die schwerere Seite links sinkt, also läuft die Rolle links
    // abwärts und rechts aufwärts — gegen den Uhrzeigersinn.
    expect(w.zustand(rolle.id)!.omega).toBeCloseTo(v / 0.1, 0);
  });
});

describe("Die lose Rolle", () => {
  it("halbiert die Kraft: zwei Stränge tragen die Last", () => {
    let a = neuerAufbau();
    const rolle = teil(a, "scheibe", { x: 0, y: 2 }, { durchmesser: 0.2, masseVorgabe: 2 }); a = rolle.aufbau;
    const seil = verbinde(a, "seil", wand({ x: -0.1, y: 3 }), wand({ x: 0.1, y: 3 }), {}, [amTeil(rolle.id)]);
    const w = starte(seil.aufbau);
    laufe(w, 1.5);

    expect(w.kraft(seil.id)!.betrag).toBeCloseTo((2 * G) / 2, 0);
    expect(w.zustand(rolle.id)!.y).toBeGreaterThan(1.98);
  });

  it("im Flaschenzug mit vier Strängen viertelt sie", () => {
    let a = neuerAufbau();
    const o1 = festeRolle(a, { x: -0.15, y: 3 }, 0.1); a = o1.aufbau;
    const o2 = festeRolle(a, { x: 0.15, y: 3 }, 0.1); a = o2.aufbau;
    const u1 = teil(a, "scheibe", { x: -0.15, y: 2 }, { durchmesser: 0.1, masseVorgabe: 2 }); a = u1.aufbau;
    const u2 = teil(a, "scheibe", { x: 0.15, y: 2 }, { durchmesser: 0.1, masseVorgabe: 2 }); a = u2.aufbau;
    // Die beiden unteren Rollen sitzen in einem Block, also fest aneinander.
    a = verbinde(a, "schraube", amTeil(u1.id, { x: 0.15, y: 0 }), amTeil(u2.id, { x: -0.15, y: 0 })).aufbau;
    const seil = verbinde(a, "seil", wand({ x: -0.3, y: 3 }), wand({ x: 0.3, y: 3 }), {}, [
      amTeil(u1.id), amTeil(o1.id), amTeil(u2.id), amTeil(o2.id),
    ]);
    const w = starte(seil.aufbau);
    laufe(w, 1.5);

    expect(w.kraft(seil.id)!.betrag).toBeCloseTo((4 * G) / 4, 0);
  });
});

describe("Die Atwoodsche Fallmaschine", () => {
  it("fällt mit (m₁−m₂)·g/(m₁+m₂) und hält im ganzen Seil dieselbe Kraft", () => {
    const m1 = 2, m2 = 1;
    let a = neuerAufbau();
    const rolle = festeRolle(a, { x: 0, y: 6 }); a = rolle.aufbau;
    const links = teil(a, "massestueck", { x: -0.1, y: 1 }, { masse: m1 }); a = links.aufbau;
    const rechts = teil(a, "massestueck", { x: 0.1, y: 1 }, { masse: m2 }); a = rechts.aufbau;
    const seil = verbinde(a, "seil", amTeil(links.id), amTeil(rechts.id), {}, [amTeil(rolle.id)]);
    const w = starte(seil.aufbau);
    laufe(w, 0.6);

    const beschleunigung = ((m1 - m2) * G) / (m1 + m2);
    expect(1 - w.zustand(links.id)!.y).toBeCloseTo(0.5 * beschleunigung * 0.6 ** 2, 1);
    // Was links fällt, steigt rechts — das Seil ist weder länger noch kürzer geworden.
    expect(w.zustand(rechts.id)!.y - 1).toBeCloseTo(1 - w.zustand(links.id)!.y, 1);
    expect(w.kraft(seil.id)!.betrag).toBeCloseTo((2 * m1 * m2 * G) / (m1 + m2), 0);
  });

  it("läuft weiter, statt an der Rolle hängenzubleiben", () => {
    let a = neuerAufbau();
    const rolle = festeRolle(a, { x: 0, y: 6 }); a = rolle.aufbau;
    const links = teil(a, "massestueck", { x: -0.1, y: 3 }, { masse: 2 }); a = links.aufbau;
    const rechts = teil(a, "massestueck", { x: 0.1, y: 3 }, { masse: 1 }); a = rechts.aufbau;
    const seil = verbinde(a, "seil", amTeil(links.id), amTeil(rechts.id), {}, [amTeil(rolle.id)]);
    const w = starte(seil.aufbau);
    laufe(w, 1.2);

    // Früher rutschte das Seil nicht über die Rolle und alles stand nach 15 cm.
    expect(3 - w.zustand(links.id)!.y).toBeGreaterThan(1.5);
  });
});

describe("Das Seil über Rollen", () => {
  it("zieht nur und drückt nie", () => {
    let a = neuerAufbau();
    const rolle = festeRolle(a, { x: 0, y: 3 }); a = rolle.aufbau;
    const last = teil(a, "massestueck", { x: -0.1, y: 1 }, { masse: 1 }); a = last.aufbau;
    // Das Seil ist einen halben Meter länger als der Weg: es hängt durch.
    const seil = verbinde(a, "seil", amTeil(last.id), wand({ x: 0.1, y: 1 }), { laenge: 4.5 }, [amTeil(rolle.id)]);
    const w = starte(seil.aufbau);
    laufe(w, 0.3);

    expect(w.kraft(seil.id)!.betrag).toBeCloseTo(0, 3);
    expect(w.zustand(last.id)!.vy).toBeLessThan(-2); // fällt frei
  });

  it("lässt sich von einer Winde einholen, auch über eine Rolle", () => {
    let a = neuerAufbau();
    const trommel = teil(a, "scheibe", { x: -1, y: 3 }, { durchmesser: 0.2, masseVorgabe: 0.5 }); a = trommel.aufbau;
    a = verbinde(a, "achse", amTeil(trommel.id), wand({ x: -1, y: 3 }), { motorMoment: 200, drehzahl: 2 }).aufbau;
    const rolle = festeRolle(a, { x: 0, y: 3 }); a = rolle.aufbau;
    const last = teil(a, "massestueck", { x: 0, y: 1 }, { masse: 2 }); a = last.aufbau;
    const seil = verbinde(a, "seil", amTeil(trommel.id, { x: 0, y: 0.1 }), amTeil(last.id), {
      laenge: 0, wickelt: 1, wickelrichtung: 1,
    }, [amTeil(rolle.id)]);
    const w = starte(seil.aufbau);
    const start = w.zustand(last.id)!.y;
    laufe(w, 1);

    // Halbmesser mal Drehwinkel, abzüglich des ersten Durchhängens.
    const soll = 0.1 * w.zustand(trommel.id)!.umdrehung;
    expect(w.zustand(last.id)!.y - start).toBeCloseTo(soll, 1);
    expect(w.kraft(seil.id)!.betrag).toBeCloseTo(2 * G, 0);
  });

  it("reißt, wenn die Bruchkraft überschritten wird", () => {
    let a = neuerAufbau();
    const rolle = festeRolle(a, { x: 0, y: 3 }); a = rolle.aufbau;
    const last = teil(a, "massestueck", { x: -0.1, y: 1 }, { masse: 5 }); a = last.aufbau;
    const seil = verbinde(a, "seil", amTeil(last.id), wand({ x: 0.1, y: 1 }), { bruchkraft: 20 }, [amTeil(rolle.id)]);
    const w = starte(seil.aufbau);
    laufe(w, 0.5);

    expect(w.haelt(seil.id)).toBe(false);
    expect(w.zustand(last.id)!.y).toBeLessThan(0.9);
  });
});

describe("Der Aufbau mit Rollen", () => {
  it("lässt ein Seil über eine Rolle zur Wand zurücklaufen", () => {
    let a = neuerAufbau();
    const rolle = teil(a, "scheibe", { x: 0, y: 2 }); a = rolle.aufbau;
    const seil = verbinde(a, "seil", wand({ x: -0.1, y: 3 }), wand({ x: 0.1, y: 3 }), {}, [amTeil(rolle.id)]);
    expect(seil.aufbau.verbinder[0].ueber).toHaveLength(1);
    // Ohne Umweg bliebe es verboten.
    expect(() => verbinde(a, "seil", wand({ x: 0, y: 1 }), wand({ x: 1, y: 1 }))).toThrow();
  });

  it("nimmt das Seil mit, wenn die Rolle weggeräumt wird", () => {
    let a = neuerAufbau();
    const rolle = teil(a, "scheibe", { x: 0, y: 2 }); a = rolle.aufbau;
    const last = teil(a, "massestueck", { x: -0.1, y: 1 }); a = last.aufbau;
    a = verbinde(a, "seil", amTeil(last.id), wand({ x: 0.1, y: 1 }), {}, [amTeil(rolle.id)]).aufbau;
    expect(entferneTeil(a, rolle.id).verbinder).toHaveLength(0);
  });
});
