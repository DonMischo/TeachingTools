import { describe, expect, it } from "vitest";
import { KARTE, stadt, schulMitte } from "@/lib/verkehr/stadt";
import { baueAnlagen } from "@/lib/verkehr/ampeln";
import { Strassenverkehr } from "@/lib/verkehr/autos";
import { Regelwaechter } from "@/lib/verkehr/regeln";
import { turnhalle } from "@/lib/verkehr/zeichnen";

const s = stadt();
// Seit 25.09.2026 in OSM, zwei Stücke: vom Eingang an der Eugen-Richter-Straße bis zur Dortmunder Straße
// (nur das erste trägt den Namen; beide haben die Tore).
const stuecke = s.strassen.filter((x) => x.art === "living_street" && x.tore);
const spiel = { ...stuecke[0], linie: [...stuecke[0].linie, ...stuecke[1].linie.slice(1)] };

describe("Spielstraße an der Schule (»Kiss and Ride Zone« aus OSM)", () => {
  it("ist in der Karte, Einbahn von der Eugen-Richter-Straße zur Dortmunder Straße", () => {
    expect(spiel).toBeTruthy();
    expect(spiel.art).toBe("living_street");
    expect(spiel.einbahn).toBe(true);
    const erste = spiel.linie[0], letzte = spiel.linie[spiel.linie.length - 1];
    const eugen = s.strassen.filter((x) => x.name === "Eugen-Richter-Straße").flatMap((x) => x.linie);
    const dortmunder = s.strassen.filter((x) => x.name === "Dortmunder Straße").flatMap((x) => x.linie);
    expect(eugen.some((p) => p[0] === erste[0] && p[1] === erste[1])).toBe(true);
    expect(dortmunder.some((p) => p[0] === letzte[0] && p[1] === letzte[1])).toBe(true);
  });

  it("geht durch kein Haus", () => {
    for (let i = 0; i + 1 < spiel.linie.length; i++)
      for (let f = 0; f <= 1; f += 0.1) {
        const x = spiel.linie[i][0] + (spiel.linie[i + 1][0] - spiel.linie[i][0]) * f;
        const y = spiel.linie[i][1] + (spiel.linie[i + 1][1] - spiel.linie[i][1]) * f;
        expect(s.untergrund(x, y).art).not.toBe("haus");
      }
  });

  it("zählt als Spielstraße, nicht als Fahrbahn — dort gibt es keine Querungsregeln", () => {
    const [x, y] = [(spiel.linie[1][0] + spiel.linie[2][0]) / 2, (spiel.linie[1][1] + spiel.linie[2][1]) / 2];
    expect(s.untergrund(x, y).art).toBe("spielstrasse");
    const w = new Regelwaechter(s, baueAnlagen(s));
    w.pruefe(x - 5, y, 0);
    expect(w.pruefe(x, y, 1).map((m) => m.id)).toEqual([]);
  });

  it("hat Tore an beiden Enden, einen Überweg und einen Spielplatz", () => {
    expect(s.tore.filter((t) => t.zeiten)).toHaveLength(2);
    // Überweg zwischen Nordbau und Turnhalle (aus OSM)
    expect(KARTE.punkte.some((p) => p.art === "zebra" && Math.hypot(p.p[0] + 7, p.p[1] + 33.3) < 3)).toBe(true);
    const [mx, my] = schulMitte(s);
    expect(KARTE.flaechen.some((f) => f.art === "spielplatz" && Math.hypot(f.umriss[0][0] - mx, f.umriss[0][1] - my) < 150)).toBe(true);
  });

  it("wird von Autos kaum befahren, außer morgens von Eltern; nachts sind die Tore zu", () => {
    const zaehle = (elternzeit: boolean, stunde: number) => {
      const v = new Strassenverkehr(s, baueAnlagen(s), 0);
      v.schule = schulMitte(s);
      v.elternzeit = elternzeit;
      v.stunde = stunde;
      const i = v.kanten.findIndex((k) => k.a[0] === spiel.linie[0][0] && k.a[1] === spiel.linie[0][1] && k.strasse.name === "Kiss and Ride Zone");
      // Knoten vor der Einfahrt: wie oft biegen Autos dort ab?
      const vorher = v.kanten.findIndex((k) => k.nach === v.kanten[i].von && k.strasse.name === "Eugen-Richter-Straße");
      let rein = 0;
      for (let n = 0; n < 2000; n++) if ((v as unknown as { waehleNaechste(k: number): number }).waehleNaechste(vorher) === i) rein++;
      return rein / 2000;
    };
    expect(zaehle(false, 12)).toBeLessThan(0.1);
    expect(zaehle(true, 7.75)).toBeGreaterThan(0.25);
    expect(zaehle(true, 23)).toBe(0);
  });

  it("die Turnhalle ist das große Rechteck im Westen", () => {
    const h = turnhalle(s)!;
    expect(h).toBeTruthy();
    expect((h.box.x0 + h.box.x1) / 2).toBeLessThan(schulMitte(s)[0]);
  });
});

describe("Lose Enden anschließen", () => {
  it("verbindet zwei lose Enden, statt sie zu vertauschen", async () => {
    const { anschliessen } = await import("@/lib/verkehr/stadt");
    const a = { art: "residential" as const, linie: [[0, 0], [100, 0]] as [number, number][] };
    const b = { art: "residential" as const, linie: [[105, 3], [200, 0]] as [number, number][] };
    const [x, y] = anschliessen([a, b]);
    expect(x.linie[1]).toEqual(y.linie[0]);
  });

  it("lässt Straßen, die schon verbunden sind, in Ruhe", async () => {
    const { anschliessen } = await import("@/lib/verkehr/stadt");
    const a = { art: "residential" as const, linie: [[0, 0], [100, 0]] as [number, number][] };
    const b = { art: "residential" as const, linie: [[100, 0], [200, 0]] as [number, number][] };
    const c = { art: "residential" as const, linie: [[100, 5], [100, 50]] as [number, number][] };
    const [x, y, z] = anschliessen([a, b, c]);
    expect(x).toBe(a);
    expect(y).toBe(b);
    expect(z.linie[0]).toEqual([100, 0]);
  });
});
