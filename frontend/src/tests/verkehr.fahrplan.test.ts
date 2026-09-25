import { describe, expect, it } from "vitest";
import { abfahrten, abschnitt, helligkeit, linienImViertel, takt, verkehrsFaktor, type Zeit } from "@/lib/verkehr/fahrplan";
import { stadt, schulMitte, schulStart } from "@/lib/verkehr/stadt";
import { bahnStand, baueBahnen, bahnTakt } from "@/lib/verkehr/schiene";
import { ERFOLGE, LEER, verbuche, type Ereignis, type Fortschritt } from "@/lib/verkehr/missionen";

/** Ein Zeitpunkt: Wochentag (0 = So) und Uhrzeit, im September. */
function um(tag: number, h: number, m = 0): Zeit {
  const datum = new Date(2026, 8, 20 + tag, h, m); // 20.9.2026 ist ein Sonntag
  return { wochentag: datum.getDay(), minute: h * 60 + m, datum };
}

describe("Linien im Viertel", () => {
  it("sind die echten EVAG-Linien aus OSM: Bus 9 und 35, Tram 1 und 5", () => {
    const nr = linienImViertel().map((l) => `${l.art} ${l.nr}`).sort();
    expect(nr).toEqual(expect.arrayContaining(["bus 35", "bus 9", "tram 1", "tram 5"]));
    expect(nr).not.toContain("bus 220");
  });

  it("halten an den Haltestellen der Karte", () => {
    const neun = linienImViertel().find((l) => l.nr === "9")!;
    expect(neun.richtungen.flatMap((r) => r.halte)).toEqual(expect.arrayContaining(["Fritz-Büchner-Straße", "Steinplatz"]));
    const f35 = linienImViertel().find((l) => l.nr === "35")!;
    expect(f35.richtungen.flatMap((r) => r.halte)).toContain("Eugen-Richter-Straße");
  });
});

describe("Takt und Tageszeit", () => {
  it("fährt tagsüber werktags alle 10, abends alle 20 Minuten, nachts nicht", () => {
    const tram = { art: "tram" as const, nr: "1" };
    expect(takt(tram, um(1, 9))).toBe(10);
    expect(takt(tram, um(1, 20))).toBe(20);
    expect(takt(tram, um(6, 9))).toBe(20);
    expect(takt(tram, um(1, 2))).toBeNull();
    expect(takt({ art: "bus", nr: "35" }, um(0, 12))).toBeNull();
  });

  it("kennt Berufsverkehr nur werktags und macht dann mehr Autos", () => {
    expect(abschnitt(um(1, 7, 30))).toBe("rushMorgen");
    expect(abschnitt(um(1, 16))).toBe("rushAbend");
    expect(abschnitt(um(6, 7, 30))).not.toBe("rushMorgen");
    expect(verkehrsFaktor(um(1, 7, 30))).toBeGreaterThan(verkehrsFaktor(um(1, 11)));
    expect(verkehrsFaktor(um(1, 23))).toBeLessThan(0.5);
  });

  it("ist mittags hell und nachts dunkel", () => {
    expect(helligkeit(um(1, 12))).toBe(1);
    expect(helligkeit(um(1, 23))).toBe(0);
  });

  it("zeigt die nächsten Abfahrten sortiert, im Takt", () => {
    const ab = abfahrten("Fritz-Büchner-Straße", um(1, 9, 3), linienImViertel(), 4);
    expect(ab.length).toBe(4);
    expect(ab.every((a) => a.linie === "9")).toBe(true);
    expect(ab.map((a) => a.inMinuten)).toEqual([...ab.map((a) => a.inMinuten)].sort((a, b) => a - b));
    // je Richtung alle 10 Minuten
    const eineRichtung = ab.filter((a) => a.ziel === ab[0].ziel).map((a) => a.inMinuten);
    if (eineRichtung.length > 1) expect(eineRichtung[1] - eineRichtung[0]).toBe(10);
    // Nachts fährt nichts: die erste Abfahrt liegt nach 5 Uhr.
    expect(abfahrten("Fritz-Büchner-Straße", um(1, 2), linienImViertel(), 4).every((a) => a.inMinuten >= 3 * 60)).toBe(true);
  });
});

describe("Bahnen nach Fahrplan", () => {
  it("fahren nachts nicht und tagsüber im halben Linientakt (Linie 1 und 5 im Wechsel)", () => {
    const tram = baueBahnen(stadt()).find((b) => b.art === "tram")!;
    expect(bahnTakt(tram, 10)).toBe(300);
    expect(bahnStand(tram, 1000, null).sichtbar).toBe(false);
  });
});

describe("Start an der Schule", () => {
  it("beginnt auf dem Gehweg der Eugen-Richter-Straße, nah an der Schule", () => {
    const s = stadt();
    const [x, y] = schulStart(s);
    expect(s.untergrund(x, y).art).toBe("gehweg");
    const n = s.naechsteStrasse(x, y, 8);
    expect(n?.s.name).toBe("Eugen-Richter-Straße");
    const [mx, my] = schulMitte(s);
    expect(Math.hypot(x - mx, y - my)).toBeLessThan(150);
  });
});

describe("Erfolge", () => {
  const alle = (f: Fortschritt, ...e: Ereignis[]) => e.reduce((x, y) => verbuche(x, y).f, f);

  it("zählen Weg, Blicke und Querungen und schalten Erfolge frei", () => {
    const f = alle(LEER, { typ: "weg", meter: 60 }, { typ: "weg", meter: 50 });
    expect(f.erfolge).toContain("schritte");
    const g = alle(LEER, ...Array.from({ length: 10 }, (_, i) => ({ typ: "meldung" as const, id: "zebraGequert" as const, t: i })));
    expect(g.erfolge).toContain("zebrakoenig");
    expect(g.stat!.serie).toBe(10);
  });

  it("setzen die Serie bei einem schweren Verstoß zurück", () => {
    const f = alle(LEER, { typ: "meldung", id: "zebraGequert", t: 0 }, { typ: "meldung", id: "rot", t: 1 });
    expect(f.stat!.serie).toBe(0);
    expect(f.schwere).toBe(1);
  });

  it("zählt Danke nur kurz nach einer Querung", () => {
    const f = alle(LEER, { typ: "meldung", id: "sicherGequert", t: 0 }, { typ: "danke", t: 5 }, { typ: "danke", t: 6 });
    expect(f.stat!.danke).toBe(1);
  });

  it("verbucht Nacht mit Weste und Berufsverkehr als Extra-Aufträge", () => {
    const f = alle(LEER, { typ: "querung", nacht: true, weste: true, rush: false }, { typ: "querung", nacht: false, weste: false, rush: true });
    expect(f.erledigt).toEqual(expect.arrayContaining(["nacht", "rush"]));
  });

  it("haben eindeutige Namen", () => {
    expect(new Set(ERFOLGE.map((e) => e.id)).size).toBe(ERFOLGE.length);
  });
});

describe("Linie 9 nach echtem EVAG-Fahrplan", () => {
  it("unterscheidet Schultag, Ferien, Samstag und Feiertag", async () => {
    const { tagesart } = await import("@/lib/verkehr/fahrplan");
    expect(tagesart(new Date(2026, 8, 24))).toBe("moDoSchule"); // Do 24.9.2026
    expect(tagesart(new Date(2026, 8, 25))).toBe("frSchule");
    expect(tagesart(new Date(2026, 9, 14))).toBe("moDoFerien"); // Herbstferien
    expect(tagesart(new Date(2026, 8, 26))).toBe("sa");
    expect(tagesart(new Date(2026, 9, 3))).toBe("so"); // Tag der Deutschen Einheit (Sa, aber Feiertag)
    expect(tagesart(new Date(2026, 8, 20))).toBe("so"); // Weltkindertag in Thüringen
  });

  it("zeigt an der Fritz-Büchner-Straße die echten Zeiten Richtung Nordbahnhof", () => {
    // Do 24.9.2026, 6:00 — laut Fahrplan fährt der Bus um 6:02, 6:18, 6:26 …
    const z = { wochentag: 4, minute: 6 * 60, datum: new Date(2026, 8, 24, 6, 0) };
    const ab = abfahrten("Fritz-Büchner-Straße", z, linienImViertel(), 8).filter((a) => a.ziel === "Nordbahnhof");
    expect(ab.slice(0, 3).map((a) => a.inMinuten)).toEqual([2, 18, 26]);
    expect(ab.every((a) => a.echt)).toBe(true);
  });

  it("fährt nach Mitternacht noch (Stunde 0) und nachts dann nicht", () => {
    const z = { wochentag: 4, minute: 23 * 60 + 55, datum: new Date(2026, 8, 24, 23, 55) };
    const ab = abfahrten("Fritz-Büchner-Straße", z, linienImViertel(), 8).filter((a) => a.ziel === "Nordbahnhof");
    expect(ab[0].inMinuten).toBe(41); // 0:36
  });

  it("leitet den Takt aus dem echten Fahrplan ab: zur Schulzeit dichter", () => {
    const berufs = takt({ art: "bus", nr: "9" }, { wochentag: 4, minute: 7 * 60, datum: new Date(2026, 8, 24, 7, 0) });
    const mittag = takt({ art: "bus", nr: "9" }, { wochentag: 4, minute: 11 * 60, datum: new Date(2026, 8, 24, 11, 0) });
    expect(berufs).toBeLessThan(mittag!);
  });
});

describe("Zeitraffer", () => {
  it("läuft ab dem Anker schneller, ohne dass die Uhr springt", async () => {
    const { spielSekunden, mitFaktor, gestellt, ECHTE_UHR } = await import("@/lib/verkehr/fahrplan");
    const t0 = 1_800_000_000;
    expect(spielSekunden(t0, ECHTE_UHR)).toBe(t0);
    const schnell = mitFaktor(ECHTE_UHR, t0, 5);
    expect(spielSekunden(t0, schnell)).toBeCloseTo(t0);
    expect(spielSekunden(t0 + 60, schnell) - spielSekunden(t0, schnell)).toBeCloseTo(300);
    // Umstellen auf ×10 später: stetig weiter
    const t1 = t0 + 100;
    const zehn = mitFaktor(schnell, t1, 10);
    expect(spielSekunden(t1, zehn)).toBeCloseTo(spielSekunden(t1, schnell));
    expect(spielSekunden(t1 + 6, zehn) - spielSekunden(t1, zehn)).toBeCloseTo(60);
    // Nicht über ×10, nicht unter ×1
    expect(mitFaktor(ECHTE_UHR, t0, 50).faktor).toBe(10);
    expect(mitFaktor(ECHTE_UHR, t0, 0.2).faktor).toBe(1);
    // Uhrzeit stellen behält das Tempo
    const g = gestellt(zehn, t1, 3600);
    expect(g.faktor).toBe(10);
    expect(spielSekunden(t1, g)).toBeCloseTo(t1 + 3600);
  });
});

describe("Abfahrtstafel am Steig", () => {
  it("zeigt nur die Richtung, die an diesem Steig hält", async () => {
    const { richtungenAmSteig, abfahrten, linienImViertel } = await import("@/lib/verkehr/fahrplan");
    const s = stadt();
    const linien = linienImViertel();
    const steige = s.halte.filter((h) => h.name === "Fritz-Büchner-Straße");
    expect(steige).toHaveLength(2);
    const ziele = steige.map((h) => [...(richtungenAmSteig(h, linien) ?? [])]);
    expect(ziele.flat().sort()).toEqual(["9|Daberstedt", "9|Nordbahnhof"]);
    for (const [i, h] of steige.entries()) {
      const tafel = abfahrten(h.name, um(3, 10), linien, 4, false, richtungenAmSteig(h, linien));
      expect(tafel.length).toBeGreaterThan(0);
      expect(new Set(tafel.map((a) => `${a.linie}|${a.ziel}`))).toEqual(new Set(ziele[i]));
    }
  });
});
