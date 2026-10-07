import { describe, expect, it } from "vitest";
import {
  anfang, aufgabe, fertig, hinweis, mitErgebnis, schritt, spiegel, sterne, vorfuehrung,
  type Aktion, type Level, type Zustand,
} from "@/lib/koordinaten/spiel";
import { INFOS, LEVEL, WELTEN, infoNach } from "@/lib/koordinaten/level";

const lauf = (l: Level, z: Zustand, aktionen: Aktion[]) => {
  const a = aufgabe(l);
  let ereignis = null;
  for (const ak of aktionen) ({ zustand: z, ereignis } = schritt(a, l.bereich, z, ak));
  return { z, ereignis };
};
const rep = (a: Aktion, n: number) => Array<Aktion>(n).fill(a);
const level = (id: string) => LEVEL.find(l => l.id === id)!;

describe("Koordinaten-Lauf: Regeln", () => {
  it("erst laufen, dann springen setzt den Punkt; danach steht die Figur wieder auf der x-Achse", () => {
    const l = level("w1-edelsteine");
    const z0 = anfang(aufgabe(l), l.bereich);
    expect(z0.held).toEqual({ x: 0, y: 0 });
    const { z, ereignis } = lauf(l, z0, [...rep("rechts", 3), ...rep("hoch", 2), "springen"]);
    expect(ereignis).toMatchObject({ art: "treffer", ziel: 0, p: { x: 3, y: 2 } });
    expect(z.held).toEqual({ x: 3, y: 0 });
    expect(z.sprung).toBe(0);
  });

  it("vertauschte Koordinaten sind ein Fehler mit passendem Hinweis", () => {
    const l = level("w1-karte");   // A(4|1) — (1|4) ist kein Ziel
    const { z, ereignis } = lauf(l, anfang(aufgabe(l), l.bereich), ["rechts", ...rep("hoch", 4), "springen"]);
    expect(ereignis).toMatchObject({ art: "daneben" });
    expect(ereignis && "hinweis" in ereignis && ereignis.hinweis).toMatch(/vertauscht/);
    expect(z.fehler).toBe(1);
  });

  it("Rand des Bereichs bremst Laufen und Springen", () => {
    const l = level("w1-edelsteine");
    const { z } = lauf(l, anfang(aufgabe(l), l.bereich), ["links", "runter", ...rep("hoch", 20)]);
    expect(z.held.x).toBe(0);
    expect(z.sprung).toBe(l.bereich.y1);
  });

  it("negative y heißt abtauchen", () => {
    const l = level("w2-tauchen");  // A(3|-2)
    const { ereignis } = lauf(l, anfang(aufgabe(l), l.bereich), [...rep("rechts", 3), ...rep("runter", 2), "springen"]);
    expect(ereignis).toMatchObject({ art: "treffer", p: { x: 3, y: -2 } });
  });

  it("alle Punkte gesetzt → fertig", () => {
    const l = level("w1-edelsteine");
    const a = aufgabe(l);
    let z = anfang(a, l.bereich);
    for (const t of a.ziele) {
      ({ z } = lauf(l, z, [...rep(t.p.x > z.held.x ? "rechts" : "links", Math.abs(t.p.x - z.held.x)), ...rep("hoch", t.p.y), "springen"]));
    }
    expect(fertig(z)).toBe(true);
  });

  it("Spiegeln: Bildpunkte auf der Achse stehen von Anfang an", () => {
    const a = aufgabe(level("w3-tanne"));
    expect(a.ziele[1]).toEqual({ name: "B'", p: { x: 2, y: 2 } });
    expect(a.vorab[0]).toBe(true);   // A(0|5) liegt auf der y-Achse
    expect(a.vorab[1]).toBe(false);
  });

  it("spiegel an allen Achsenarten", () => {
    const p = { x: 3, y: -1 };
    expect(spiegel(p, { art: "x" })).toEqual({ x: 3, y: 1 });
    expect(spiegel(p, { art: "y" })).toEqual({ x: -3, y: -1 });
    expect(spiegel(p, { art: "ursprung" })).toEqual({ x: -3, y: 1 });
    expect(spiegel(p, { art: "senkrecht", k: 2 })).toEqual({ x: 1, y: -1 });
    expect(spiegel(p, { art: "waagerecht", k: 1 })).toEqual({ x: 3, y: 3 });
  });

  it("Originalpunkt statt Spiegelbild gibt den passenden Hinweis", () => {
    const l = level("w3-tanne");
    const a = aufgabe(l);
    const z = anfang(a, l.bereich);
    expect(hinweis(a, z, { x: -2, y: 2 })).toMatch(/Originalpunkt/);
  });

  it("Steigung: die Figur steht auf dem Start und läuft auf dessen Höhe", () => {
    const l = level("w4-flach");     // start (-6|-2), m = 1/2
    const a = aufgabe(l);
    const z0 = anfang(a, l.bereich);
    expect(z0.held).toEqual({ x: -6, y: -2 });
    const { z, ereignis } = lauf(l, z0, ["rechts", "rechts", "hoch", "springen"]);
    expect(ereignis).toMatchObject({ art: "treffer", p: { x: -4, y: -1 } });
    expect(z.held).toEqual({ x: -4, y: -1 });  // steht jetzt auf dem neuen Punkt
  });

  it("Steigung vertauscht: Hinweis auf Zähler und Nenner", () => {
    const l = level("w4-flach");
    const { ereignis } = lauf(l, anfang(aufgabe(l), l.bereich), ["rechts", "hoch", "hoch", "springen"]);
    expect(ereignis && "hinweis" in ereignis && ereignis.hinweis).toMatch(/Nenner.*Zähler/);
  });

  it("Gerade: erst (0|n) absolut, dann relativ", () => {
    const l = level("w5-zwei");      // y = 2x − 3
    const a = aufgabe(l);
    expect(a.ziele.map(t => t.p)).toEqual([{ x: 0, y: -3 }, { x: 1, y: -1 }, { x: 2, y: 1 }, { x: 3, y: 3 }]);
    let z = anfang(a, l.bereich);
    expect(z.held).toEqual({ x: 0, y: 0 });
    ({ z } = lauf(l, z, ["rechts", "springen"]));
    expect(hinweis(a, { ...z, fehler: 0 }, { x: 1, y: 0 })).toMatch(/x = 0/);
    ({ z } = lauf(l, anfang(a, l.bereich), [...rep("runter", 3), "springen"]));
    expect(z.held).toEqual({ x: 0, y: -3 });
  });

  it("Vorführung erreicht im echten Regelwerk jedes Ziel jedes Levels", () => {
    for (const l of [...LEVEL, ...INFOS.map(i => i.beispiel)]) {
      const a = aufgabe(l);
      let z = anfang(a, l.bereich);
      for (let n = 0; n < 30 && !fertig(z); n++) {
        const fehlerVorher = z.fehler;
        ({ z } = lauf(l, z, vorfuehrung(l, a, z).flatMap(s => s.aktionen)));
        expect(z.fehler, l.id).toBe(fehlerVorher);
      }
      expect(fertig(z), l.id).toBe(true);
    }
  });

  it("alle Ziele liegen im Bereich, Ids sind eindeutig, Infos existieren", () => {
    const ids = new Set<string>();
    for (const l of LEVEL) {
      expect(ids.has(l.id), l.id).toBe(false);
      ids.add(l.id);
      const a = aufgabe(l);
      for (const t of [...a.ziele, ...a.vorlage]) {
        expect(t.p.x >= l.bereich.x0 && t.p.x <= l.bereich.x1 && t.p.y >= l.bereich.y0 && t.p.y <= l.bereich.y1, `${l.id} ${t.name}`).toBe(true);
      }
      for (const i of l.info) expect(infoNach(i), i).toBeDefined();
      expect(WELTEN.some(w => w.nr === l.welt)).toBe(true);
    }
    for (const w of WELTEN) for (const i of w.infos) expect(infoNach(i), i).toBeDefined();
  });

  it("Sterne und Fortschritt: besser ersetzt schlechter, nie umgekehrt", () => {
    expect([0, 1, 2, 3, 9].map(sterne)).toEqual([3, 2, 2, 1, 1]);
    expect(mitErgebnis({ a: 2 }, "a", 1)).toEqual({ a: 2 });
    expect(mitErgebnis({ a: 2 }, "a", 3)).toEqual({ a: 3 });
  });
});
