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

describe("Buslinien auf dem echten Fahrweg", () => {
  const linien = (s.karte.linien ?? []).filter((l) => l.art === "bus" && l.richtungen.some((r) => r.spur?.length && r.steige?.length));
  const halteIn = (v: Strassenverkehr, nr: string) => {
    const l = linien.find((x) => x.nr === nr)!;
    const namen = new Set(l.richtungen.flatMap((r) => r.halte));
    return { l, linie: v.baueLinienweg(l.richtungen, s.halte.filter((h) => h.art === "bushalt" && namen.has(h.name)))! };
  };

  it("halten Linie 9 und 35 an allen ihren Steigen, der Reihe nach, zusammenhängend", () => {
    const v = new Strassenverkehr(s, anlagen, 0);
    for (const nr of ["9", "35"]) {
      const { l, linie } = halteIn(v, nr);
      expect(linie).toBeTruthy();
      for (let i = 0; i < linie.kanten.length; i++) {
        const a = v.kanten[linie.kanten[i]], b = v.kanten[linie.kanten[(i + 1) % linie.kanten.length]];
        // Springen darf der Bus nur am Kartenrand (raus und woanders wieder rein)
        if (linie.spruenge?.has(i)) {
          expect(Math.max(Math.abs(a.b[0]), Math.abs(a.b[1]))).toBeGreaterThan(600);
          expect(Math.max(Math.abs(b.a[0]), Math.abs(b.a[1]))).toBeGreaterThan(600);
        } else expect(b.von).toBe(a.nach);
      }
      const gefahren = [...linie.halte.entries()].sort((a, b) => a[0] - b[0]).map(([, h]) => `${h.halt.name}@${h.halt.p.join(",")}`);
      const soll = l.richtungen.flatMap((r) => (r.steige ?? []).map((st) => st.name));
      expect(gefahren.map((g) => g.split("@")[0])).toEqual(soll.filter((n) => s.halte.some((h) => h.name === n)));
    }
  });

  it("fährt keine Schleifen (keine Kante zweimal im Umlauf)", () => {
    const v = new Strassenverkehr(s, anlagen, 0);
    for (const nr of ["9", "35"]) {
      const { linie } = halteIn(v, nr);
      expect(new Set(linie.kanten).size).toBe(linie.kanten.length);
    }
  });

  it("hält nie am Steig der Gegenrichtung: der Steig liegt rechts der Fahrtrichtung", () => {
    const v = new Strassenverkehr(s, anlagen, 0);
    for (const nr of ["9", "35"]) {
      const { linie } = halteIn(v, nr);
      for (const [ri, { halt }] of linie.halte) {
        const k = v.kanten[linie.kanten[ri]];
        const quer = (-(halt.p[0] - k.a[0]) * (k.b[1] - k.a[1]) + (halt.p[1] - k.a[1]) * (k.b[0] - k.a[0])) / k.laenge;
        expect(quer).toBeGreaterThan(0);
      }
    }
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
    const ohneE = r2.pruefe(0, 1.5, offen("einsteigen"));
    expect(ohneE.einsteigen).toBeNull();
    expect(ohneE.bereit).toBeTruthy();
    expect(ohneE.meldungen).toEqual([]);
    const e = r2.pruefe(0, 1.5, offen("einsteigen"), true);
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

describe("Aussteigen", () => {
  it("bestraft niemanden, der selbst gerade ausgestiegen ist", () => {
    const [tuer] = tueren(0, 0, 0, 2.5, [0]);
    const r = new Einstiegsregeln();
    r.ausgestiegen("bus-1", "7");
    const aus = r.pruefe(0, 2.4, [{ fahrzeug: "bus-1", halt: "7", phase: "aussteigen", tuer }]);
    expect(aus.meldungen).toEqual([]);
    // Beim nächsten Halt gilt wieder alles.
    expect(r.pruefe(0, 2.4, [{ fahrzeug: "bus-1", halt: "8", phase: "aussteigen", tuer }]).meldungen.map((m) => m.id)).toEqual(["tuerBlockiert"]);
  });
});

describe("Kein Stau für immer", () => {
  it("löst Kreuzungen, in denen sich Abbieger gegenseitig blockieren", () => {
    const v = new Strassenverkehr(s, anlagen);
    let laengstes = 0;
    for (let i = 0; i < 6000; i++) {
      const t = i * 0.1;
      v.schritt(0.1, t, [{ id: "ich", x: -130, y: 250, hand: -1, karmaBis: -1 }], () => -Infinity);
      for (const f of v.fahrzeuge) if (f.stehtSeit !== undefined) laengstes = Math.max(laengstes, t - f.stehtSeit);
    }
    // Im Stau kriecht man auch mal ein paar Rotphasen lang — aber niemand steht für immer
    expect(laengstes).toBeLessThan(150);
  });
});

describe("Busse verschwinden nicht vor den Augen", () => {
  it("nimmt beim Ausdünnen nur Busse, die niemand sieht", () => {
    const v = new Strassenverkehr(s, anlagen, 0);
    const linie = v.baueBuslinie(s.halte.filter((h) => h.art === "bushalt"))!;
    v.busseAnpassen(linie, 2);
    const [a, b] = v.fahrzeuge;
    v.busseAnpassen(linie, 0, (f) => f === a);
    expect(v.fahrzeuge).toEqual([a]);
    void b;
  });
});

describe("Busse nach Fahrplan", () => {
  it("sind pünktlich am Halt und fahren nicht vor der Abfahrtszeit ab; am Kartenrand ist Schluss", () => {
    const v = new Strassenverkehr(s, anlagen, 0);
    const l = (s.karte.linien ?? []).find((x) => x.nr === "9")!;
    const namen = new Set(l.richtungen.flatMap((r) => r.halte));
    const linie = v.baueLinienweg(l.richtungen, s.halte.filter((h) => h.art === "bushalt" && namen.has(h.name)))!;
    expect(linie.abschnitte?.length).toBe(2);
    const a = linie.abschnitte![0];
    const ref = [...linie.halte.keys()].filter((i) => i >= a.von && i <= a.bis).sort((x, y) => x - y)[0];
    const refName = linie.halte.get(ref)!.halt.name;
    const D = 400; // fällig in gut sechs Minuten
    const abfahrten = (halt: string, ziel: string) => (halt === refName && ziel === a.ziel ? [D] : []);
    let ankunft: number | null = null, abfahrt: number | null = null, weg = false, gesehen = false;
    for (let i = 0; i < 12000 && !weg; i++) {
      const t = i * 0.1;
      if (i % 10 === 0) v.fahrplan(linie, t, 0, abfahrten);
      v.schritt(0.1, t, [], () => -Infinity);
      const bus = v.fahrzeuge.find((f) => f.art === "bus");
      if (bus) gesehen = true;
      if (gesehen && !bus) weg = true;
      if (bus?.haltSeit != null && bus.haltRi === ref && ankunft === null) ankunft = t;
      if (ankunft !== null && abfahrt === null && bus && bus.haltSeit == null) abfahrt = t;
    }
    expect(ankunft).not.toBeNull();
    // Rechtzeitig da (höchstens eine Minute zu spät), nicht vor der Zeit weg
    expect(ankunft!).toBeLessThan(D + 60);
    expect(abfahrt!).toBeGreaterThanOrEqual(D - 0.5);
    expect(weg).toBe(true);
  });
});
