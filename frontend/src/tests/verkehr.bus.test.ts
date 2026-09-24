import { describe, expect, it } from "vitest";
import { stadt } from "@/lib/verkehr/stadt";
import { baueAnlagen } from "@/lib/verkehr/ampeln";
import { Strassenverkehr } from "@/lib/verkehr/autos";
import { HALT_DAUER, tuerPhase, tueren, imKorridor, seitlichDaneben, anDerTuer, aussteigerLage } from "@/lib/verkehr/tueren";
import { baueBahnen, bahnStand } from "@/lib/verkehr/schiene";
import { Einstiegsregeln } from "@/lib/verkehr/regeln";

const s = stadt();
const anlagen = baueAnlagen(s);

describe("Buslinie", () => {
  it("führt als Rundkurs durch die meisten Haltestellen", () => {
    const v = new Strassenverkehr(s, anlagen, 0);
    const bushalte = s.halte.filter((h) => h.art === "bushalt");
    const linie = v.baueBuslinie(bushalte)!;
    expect(linie).toBeTruthy();
    expect(linie.halte.size).toBeGreaterThanOrEqual(Math.floor(bushalte.length * 0.6));
    // zusammenhängend: jede Kante beginnt, wo die vorige endet
    for (let i = 0; i < linie.kanten.length; i++) {
      const a = v.kanten[linie.kanten[i]], b = v.kanten[linie.kanten[(i + 1) % linie.kanten.length]];
      expect(b.von).toBe(a.nach);
    }
  });

  it("lässt den Bus an einer Haltestelle halten und nach dem Halt weiterfahren", () => {
    const v = new Strassenverkehr(s, anlagen, 0);
    const linie = v.baueBuslinie(s.halte.filter((h) => h.art === "bushalt"))!;
    v.setzeBusse(linie, 1);
    const bus = v.fahrzeuge[0];
    let gehalten: number | null = null, weiter = false;
    for (let n = 0; n < 20 * 600 && !weiter; n++) {
      const t = n * 0.05;
      v.schritt(0.05, t, []);
      if (bus.haltSeit != null && gehalten === null) gehalten = t;
      if (gehalten !== null && t > gehalten + HALT_DAUER + 3 && bus.tempo > 1) weiter = true;
    }
    expect(gehalten).not.toBeNull();
    expect(weiter).toBe(true);
  });
});

describe("Türen", () => {
  const [tuer] = tueren(0, 0, 0, 2.5, [0]);
  it("gehen erst auf, lassen aussteigen, dann einsteigen, dann zu", () => {
    expect(tuerPhase(0.5)).toBe("zu");
    expect(tuerPhase(3)).toBe("aussteigen");
    expect(tuerPhase(10)).toBe("einsteigen");
    expect(tuerPhase(HALT_DAUER - 1)).toBe("schliessen");
    expect(tuerPhase(HALT_DAUER + 1)).toBe("zu");
  });

  it("unterscheiden »vor der Tür« von »seitlich daneben«", () => {
    // rechte Seite bei Winkel 0 ist +y
    expect(tuer.p[1]).toBeCloseTo(1.25);
    expect(imKorridor(tuer, 0, 2.5)).toBe(true);
    expect(seitlichDaneben(tuer, 0, 2.5)).toBe(false);
    expect(seitlichDaneben(tuer, 1.6, 2.2)).toBe(true);
    expect(anDerTuer(tuer, 0, 1.5)).toBe(true);
  });

  it("lassen Aussteigende erst gerade durch den Streifen vor der Tür hinaus", () => {
    const p = aussteigerLage(tuer, 0, 2.5)!;
    expect(p).not.toBeNull();
    expect(imKorridor(tuer, p[0], p[1])).toBe(true);
  });

  it("bestrafen Blockieren und belohnen seitliches Warten", () => {
    const r = new Einstiegsregeln();
    const offen = (phase: "aussteigen" | "einsteigen") => [{ fahrzeug: "b", halt: "h", phase, tuer }];
    expect(r.pruefe(0, 2.4, offen("aussteigen")).meldungen.map((m) => m.id)).toEqual(["tuerBlockiert"]);
    const r2 = new Einstiegsregeln();
    r2.pruefe(1.6, 2.2, offen("aussteigen"));
    const e = r2.pruefe(0, 1.5, offen("einsteigen"));
    expect(e.einsteigen).toBeTruthy();
    expect(e.meldungen.map((m) => m.id)).toEqual(["gutEingestiegen"]);
  });
});

describe("Bahnen", () => {
  const bahnen = baueBahnen(s);
  it("gibt es als Straßenbahn und Zug auf echten Gleisen", () => {
    expect(bahnen.map((b) => b.art).sort()).toEqual(["tram", "zug"]);
    for (const b of bahnen) expect(b.laengen[b.laengen.length - 1]).toBeGreaterThan(100);
  });

  it("halten im Takt am Halt und fahren sonst", () => {
    for (const b of bahnen) {
      let halten = 0, fahren = 0;
      for (let t = 0; t < b.takt; t += 0.5) {
        const st = bahnStand(b, t);
        if (st.haltAlter !== null) { halten++; expect(st.s).toBeCloseTo(b.sHalt); }
        else if (st.sichtbar && st.tempo > 0) fahren++;
      }
      expect(halten * 0.5).toBeGreaterThan(HALT_DAUER - 1);
      expect(fahren).toBeGreaterThan(0);
    }
  });
});
