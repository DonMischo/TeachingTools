/**
 * Main Character: die Lebenssimulation verhält sich wie im Unterricht erklärt —
 * das NPC bleibt stehen, Style braucht Pflege, der Streber brennt aus,
 * Stärken helfen, Baustellen schrumpfen.
 */
import { describe, expect, it } from "vitest";
import {
  ABSCHLUSS, KLASSEN, NEUTRAL, SPIELKLASSEN, lauf, startZustand, wert, werte, woche,
  type Profil,
} from "@/lib/mainCharacter";

const mit = (teil: Partial<Profil>): Profil => ({ ...NEUTRAL, ...teil });

describe("Grundregeln", () => {
  it("das NPC bleibt nach wenigen Wochen stehen", () => {
    const npc = KLASSEN.npc;
    const z = startZustand(npc.start);
    for (let i = 0; i < 40; i++) woche(z, npc);
    const mitte = werte(z);
    for (let i = 40; i < ABSCHLUSS; i++) woche(z, npc);
    const ende = werte(z);
    for (const w of ["W", "S", "M", "E"] as const) expect(Math.abs(ende[w] - mitte[w])).toBeLessThan(1.5);
    expect(ende.Z).toBeLessThan(5);
  });

  it("alle Werte bleiben zwischen 0 und 100", () => {
    for (const k of SPIELKLASSEN) {
      const z = lauf(KLASSEN[k]);
      for (const v of Object.values(werte(z))) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
  });

  it("Style fällt schnell, wenn keine Zeit mehr hineinfließt", () => {
    const z = lauf(KLASSEN.styler, NEUTRAL, undefined, 20);
    const vorher = z.S;
    for (let i = 0; i < 4; i++) woche(z, KLASSEN.styler, NEUTRAL, { ...KLASSEN.nerd.plan! });
    expect(z.S).toBeLessThan(vorher * .55);
  });

  it("Zielgerichtet fällt kaum, wenn man eine Weile aussetzt", () => {
    const z = lauf(KLASSEN.checker, NEUTRAL, undefined, 40);
    const vorher = z.Z;
    for (let i = 0; i < 4; i++) woche(z, KLASSEN.bored);
    expect(z.Z).toBeGreaterThan(vorher * .95);
  });

  it("der Streber wächst erst und brennt dann aus", () => {
    const st = KLASSEN.streber;
    const z = startZustand(st.start);
    for (let i = 0; i < 8; i++) woche(z, st);
    expect(wert(z, "W")).toBeGreaterThan(st.start.W);
    for (let i = 8; i < 30; i++) woche(z, st);
    expect(z.E).toBeLessThan(15);
    expect(z.leer).toBeLessThan(0); // überplant
  });

  it("der Mitläufer landet beim Ziel unter dem Sportler", () => {
    expect(lauf(KLASSEN.mitlaeufer).Z).toBeLessThan(lauf(KLASSEN.sportler).Z - 20);
  });

  it("Bored to death endet nah am NPC", () => {
    const b = werte(lauf(KLASSEN.bored)), n = werte(lauf(KLASSEN.npc));
    expect(Math.abs(b.Z - n.Z)).toBeLessThan(10);
    expect(b.W).toBeLessThan(n.W);
  });
});

describe("Talente, Stärken, Baustellen", () => {
  it("ein Talent hebt den passenden Wert", () => {
    const ohne = lauf(KLASSEN.hoodie);
    const mitTalent = lauf(KLASSEN.hoodie, mit({ talente: { W: 1.4, Z: 1, S: 1, M: 1, E: 1 } }));
    expect(wert(mitTalent, "W")).toBeGreaterThan(wert(ohne, "W") + 5);
  });

  it("jede Stärke hilft oder schadet zumindest nie", () => {
    for (const s of ["neugierig", "hartnaeckig", "kreativ", "empathisch", "organisiert",
      "sportlich", "flexibel", "spaetzuender", "humorvoll", "ruhig"] as const) {
      for (const k of SPIELKLASSEN) {
        const a = werte(lauf(KLASSEN[k])), b = werte(lauf(KLASSEN[k], mit({ staerken: [s] })));
        const summeA = Object.values(a).reduce((x, y) => x + y, 0);
        const summeB = Object.values(b).reduce((x, y) => x + y, 0);
        expect(summeB, `${s} bei ${k}`).toBeGreaterThanOrEqual(summeA - .01);
      }
    }
  });

  it("Flexibel nimmt dem Mitläufer die Wechselkosten", () => {
    expect(lauf(KLASSEN.mitlaeufer, mit({ staerken: ["flexibel"] })).Z)
      .toBeGreaterThan(lauf(KLASSEN.mitlaeufer).Z + 5);
  });

  it("Baustellen bremsen anfangs und schrumpfen mit Einsatz", () => {
    const prof = mit({ baustellen: ["lernfrust"] });
    const z = startZustand(KLASSEN.nerd.start, prof.baustellen);
    expect(z.rest.lernfrust).toBe(100);
    for (let i = 0; i < 30; i++) woche(z, KLASSEN.nerd, prof);
    expect(z.rest.lernfrust).toBe(0);
    expect(wert(lauf(KLASSEN.nerd, prof), "W")).toBeLessThan(wert(lauf(KLASSEN.nerd), "W"));
  });

  it("jede Baustelle ist mit passendem Einsatz bis zum Abschluss geschafft", () => {
    const passend = { handy: "checker", aufschieben: "checker", schlaf: "sportler", lernfrust: "nerd", unsicher: "hoodie" } as const;
    for (const [b, k] of Object.entries(passend)) {
      const z = lauf(KLASSEN[k], mit({ baustellen: [b as keyof typeof passend] }));
      expect(z.rest[b as keyof typeof passend], b).toBe(0);
    }
  });

  it("ein eigener Plan ersetzt den Klassenplan", () => {
    const nurStyle = { W: 0, Z: 0, S: 1, M: 0, E: 0 };
    expect(lauf(KLASSEN.nerd, NEUTRAL, nurStyle).S).toBeGreaterThan(80);
  });
});
