import { describe, expect, it } from "vitest";
import type { Schaltung } from "@/lib/stromkreis/modell";
import { drehe, fuegeBauteilHinzu, fuegeDrahtHinzu, LEER, loesche, normalisiere, treffer, verschiebe, verschiebeEnde } from "@/lib/stromkreis/editor";
import { farbringe } from "@/lib/stromkreis/farbringe";
import { formatiere } from "@/lib/stromkreis/format";
import { schrittweite } from "@/lib/stromkreis/lauf";
import { Simulation } from "@/lib/stromkreis/simulation";

const P = (x: number, y: number) => ({ x, y });

describe("Editor", () => {
  it("teilt einen Draht, auf dessen Mitte ein Anschluss liegt — der ist dann verbunden", () => {
    let s: Schaltung = { ...LEER, draehte: [{ id: "d1", a: P(0, 0), b: P(8, 0) }] };
    s = fuegeBauteilHinzu(s, "widerstand", P(4, 0), P(4, 4)).schaltung;
    expect(s.draehte).toHaveLength(2);
    expect(s.draehte.map(d => [d.a, d.b])).toEqual([[P(0, 0), P(4, 0)], [P(4, 0), P(8, 0)]]);
  });

  it("ein Bauteil auf einer Leitung ersetzt das Stück darunter, statt kurzgeschlossen zu sein", () => {
    // Rahmen: Batterie links, oben und unten je eine durchgehende Leitung, rechts zu
    let s = fuegeBauteilHinzu(LEER, "batterie", P(0, 4), P(0, 0)).schaltung;
    s = fuegeDrahtHinzu(s, P(0, 0), P(12, 0));
    s = fuegeDrahtHinzu(s, P(12, 0), P(12, 4));
    s = fuegeDrahtHinzu(s, P(12, 4), P(0, 4));
    // Motor mitten auf die untere Leitung, Lämpchen mitten auf die obere
    s = fuegeBauteilHinzu(s, "motor", P(8, 4), P(4, 4)).schaltung;
    s = fuegeBauteilHinzu(s, "lampe", P(4, 0), P(8, 0)).schaltung;
    expect(s.draehte.some(d => d.a.y === 4 && Math.min(d.a.x, d.b.x) >= 4 && Math.max(d.a.x, d.b.x) <= 8)).toBe(false);
    const sim = new Simulation(s);
    sim.laufe(0.5, 1e-3);
    expect(sim.messung("b2").drehzahl!).toBeGreaterThan(50);
    expect(Math.abs(sim.messung("b2").spannung)).toBeGreaterThan(1);
    expect(sim.messung("b3").helligkeit!).toBeGreaterThan(0.05);
  });

  it("Umschalter und Trafo verdrängen keine Leitung zwischen a und b", () => {
    let s = fuegeDrahtHinzu(LEER, P(0, 0), P(8, 0));
    s = fuegeBauteilHinzu(s, "trafo", P(2, 0), P(6, 0)).schaltung;
    expect(s.draehte.some(d => d.a.x === 2 && d.b.x === 6)).toBe(true);
  });

  it("ein schräg gezogener Draht wird zum Winkel, doppelte und leere fallen weg", () => {
    let s = fuegeDrahtHinzu(LEER, P(0, 0), P(3, 2));
    expect(s.draehte.map(d => [d.a, d.b])).toEqual([[P(0, 0), P(3, 0)], [P(3, 0), P(3, 2)]]);
    s = fuegeDrahtHinzu(s, P(3, 0), P(0, 0));
    expect(s.draehte).toHaveLength(2);
    expect(fuegeDrahtHinzu(s, P(1, 1), P(1, 1))).toBe(s);
  });

  it("verschieben nimmt angeschlossene Drähte mit", () => {
    let s = fuegeBauteilHinzu(LEER, "lampe", P(0, 0)).schaltung;
    s = fuegeDrahtHinzu(s, P(4, 0), P(4, 4));
    s = verschiebe(s, { art: "bauteil", id: "b1" }, 0, -2);
    expect(s.bauteile[0].a).toEqual(P(0, -2));
    expect(s.draehte[0].a).toEqual(P(4, -2));
    expect(s.draehte[0].b).toEqual(P(4, 4));
  });

  it("…aber reißt nichts ab, was dort noch an einem anderen Bauteil hängt", () => {
    let s = fuegeBauteilHinzu(LEER, "lampe", P(0, 0)).schaltung;
    s = fuegeBauteilHinzu(s, "widerstand", P(4, 0), P(8, 0)).schaltung;
    s = fuegeDrahtHinzu(s, P(4, 0), P(4, 4));
    s = verschiebe(s, { art: "bauteil", id: "b1" }, 0, -2);
    expect(s.draehte[0].a).toEqual(P(4, 0));
  });

  it("drehen: 90° im Uhrzeigersinn um a, Draht folgt", () => {
    let s = fuegeBauteilHinzu(LEER, "widerstand", P(0, 0)).schaltung;
    s = fuegeDrahtHinzu(s, P(4, 0), P(6, 0));
    s = drehe(s, { art: "bauteil", id: "b1" });
    expect(s.bauteile[0].b).toEqual(P(0, 4));
    expect(s.draehte[0].a).toEqual(P(0, 4));
  });

  it("Enden ziehen: Umschalter bleibt gerade, nichts schrumpft auf null", () => {
    const s = fuegeBauteilHinzu(LEER, "umschalter", P(0, 0)).schaltung;
    const w = { art: "bauteil" as const, id: "b1" };
    expect(verschiebeEnde(s, w, "b", P(6, 3))).toBe(s);
    expect(verschiebeEnde(s, w, "b", P(0, 0))).toBe(s);
    expect(verschiebeEnde(s, w, "b", P(6, 0)).bauteile[0].b).toEqual(P(6, 0));
  });

  it("treffer: Bauteil vor Draht, Ende nur nahe am Ende", () => {
    let s = fuegeBauteilHinzu(LEER, "widerstand", P(0, 0)).schaltung;
    s = fuegeDrahtHinzu(s, P(0, 1), P(4, 1));
    expect(treffer(s, { x: 2, y: 0.1 })).toEqual({ art: "bauteil", id: "b1" });
    expect(treffer(s, { x: 3.9, y: 0 })).toEqual({ art: "bauteil", id: "b1", ende: "b" });
    expect(treffer(s, { x: 2, y: 1.2 })?.art).toBe("draht");
    expect(treffer(s, { x: 2, y: 5 })).toBeNull();
  });

  it("gebaute Schaltung rechnet: Batterie, Draht auf die Mitte, Lämpchen", () => {
    let s = fuegeBauteilHinzu(LEER, "batterie", P(0, 4), P(0, 0)).schaltung;
    s = fuegeDrahtHinzu(s, P(0, 0), P(8, 0));
    s = fuegeDrahtHinzu(s, P(8, 4), P(0, 4));
    // Lämpchen quer dazwischen: oben auf die Mitte des einen Drahts, unten auf die Mitte des anderen
    s = fuegeBauteilHinzu(s, "lampe", P(4, 0), P(4, 4)).schaltung;
    const sim = new Simulation(normalisiere(s));
    sim.schritt(1e-3);
    expect(sim.messung("b2").strom).toBeGreaterThan(0.1);
    s = loesche(s, { art: "bauteil", id: "b2" });
    expect(s.bauteile).toHaveLength(1);
  });
});

describe("Anzeige", () => {
  it("formatiert mit Komma und SI-Vorsatz", () => {
    expect(formatiere(0.045, "A")).toBe("45 mA");
    expect(formatiere(4.5, "V")).toBe("4,5 V");
    expect(formatiere(1500, "Ω")).toBe("1,5 kΩ");
    expect(formatiere(1e-3, "F")).toBe("1 mF");
    expect(formatiere(-0.25, "W")).toBe("-250 mW");
    expect(formatiere(4.5e-12, "A")).toBe("0 A");
  });

  it("Schrittweite: 100 Schritte je Periode", () => {
    const ac: Schaltung = { ...LEER, bauteile: [{ id: "q", art: "wechselquelle", a: P(0, 0), b: P(0, 4), werte: { frequenz: 50 } }] };
    expect(schrittweite(ac)).toBeCloseTo(2e-4, 10);
    expect(schrittweite(LEER)).toBe(1e-3);
  });
});

describe("Farbringe", () => {
  const namen = (ohm: number) => farbringe(ohm).map(r => r.name).join(" ");
  it("liest Schulwerte richtig", () => {
    expect(namen(100)).toBe("braun schwarz braun gold");
    expect(namen(470)).toBe("gelb violett braun gold");
    expect(namen(4700)).toBe("gelb violett rot gold");
    expect(namen(10)).toBe("braun schwarz schwarz gold");
    expect(namen(1)).toBe("braun schwarz gold gold");
    expect(namen(2.2)).toBe("rot rot gold gold");
    expect(namen(1e6)).toBe("braun schwarz grün gold");
    // auf zwei Stellen gerundet, auch über die Stufe hinweg
    expect(namen(996)).toBe("braun schwarz rot gold");
  });
});
