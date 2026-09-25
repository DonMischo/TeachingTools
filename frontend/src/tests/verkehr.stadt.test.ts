import { describe, expect, it } from "vitest";
import { KARTE, stadt, startpunkt } from "@/lib/verkehr/stadt";
import { schritt, KEINE_EINGABE, FIGUR_RADIUS } from "@/lib/verkehr/bewegung";
import { imVieleck } from "@/lib/verkehr/geometrie";
import { gestenDeckkraft, gesteZuTaste, GESTE_DAUER } from "@/lib/verkehr/gesten";

describe("Verkehrs-Karte", () => {
  it("trägt den OSM-Nachweis und die Läden aus dem Auftrag", () => {
    expect(KARTE.nachweis).toMatch(/OpenStreetMap/);
    expect(KARTE.nachweis).toMatch(/ODbL/);
    const namen = KARTE.punkte.filter((p) => p.shop === "supermarket").map((p) => p.name);
    expect(namen).toEqual(expect.arrayContaining(["Lidl", "Aldi"]));
    expect(namen.some((n) => n?.startsWith("Netto"))).toBe(true);
  });

  it("hat Bushalte, Ampeln, Zebrastreifen, Tram- und Bahngleise", () => {
    const zahl = (art: string) => KARTE.punkte.filter((p) => p.art === art).length;
    expect(zahl("bushalt")).toBeGreaterThanOrEqual(5);
    expect(zahl("ampelUebergang")).toBeGreaterThanOrEqual(5);
    expect(zahl("zebra")).toBeGreaterThanOrEqual(1);
    expect(KARTE.gleise.some((g) => g.art === "tram")).toBe(true);
    expect(KARTE.gleise.some((g) => g.art === "bahn")).toBe(true);
  });

  it("legt je einen ausgedachten Tram- und Bahnhalt auf echte Gleise", () => {
    const s = stadt();
    for (const art of ["tramhalt", "bahnhalt"] as const) {
      const h = s.halte.find((h) => h.art === art);
      expect(h, art).toBeTruthy();
      expect(h!.name).toMatch(/fiktiv/);
      expect(s.untergrund(h!.p[0], h!.p[1]).art).toBe("gleis");
    }
  });

  it("startet auf einem Gehweg nahe der Schule", () => {
    const s = stadt();
    const [x, y] = startpunkt(s);
    expect(s.untergrund(x, y).art).toBe("gehweg");
    expect(Math.hypot(x, y)).toBeLessThan(150);
  });

  it("erkennt die Mitte einer Hauptstraße als Fahrbahn", () => {
    const s = stadt();
    const haupt = s.strassen.find((st) => st.art === "secondary" && st.linie.length >= 2)!;
    const [a, b] = haupt.linie;
    const u = s.untergrund((a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    expect(["fahrbahn", "gleis"]).toContain(u.art);
  });

  it("lässt niemanden in ein Haus laufen", () => {
    const s = stadt();
    const haus = KARTE.gebaeude.find((g) => g.umriss.length >= 4 && Math.abs(g.umriss[0][0]) < 300)!;
    const cx = haus.umriss.reduce((t, p) => t + p[0], 0) / haus.umriss.length;
    const cy = haus.umriss.reduce((t, p) => t + p[1], 0) / haus.umriss.length;
    // Von außen 30 s lang auf die Mitte zulaufen.
    let f = { x: cx - 40, y: cy, winkel: 0, tempo: 0 };
    for (let i = 0; i < 300; i++) f = schritt(f, { ...KEINE_EINGABE, rechts: true }, 0.1, s);
    expect(imVieleck(f.x, f.y, haus.umriss)).toBe(false);
    expect(s.imHaus(f.x, f.y)).toBeNull();
    expect(FIGUR_RADIUS).toBeGreaterThan(0);
  });

  it("bleibt ohne Eingabe stehen", () => {
    const s = stadt();
    const f = schritt({ x: 1, y: 2, winkel: 1, tempo: 3 }, KEINE_EINGABE, 0.1, s);
    expect(f).toMatchObject({ x: 1, y: 2, tempo: 0 });
  });
});

describe("Gesten", () => {
  it("zeigen sich zwei Sekunden und blenden am Ende aus", () => {
    expect(GESTE_DAUER).toBe(2);
    expect(gestenDeckkraft(0)).toBe(1);
    expect(gestenDeckkraft(1.2)).toBe(1);
    expect(gestenDeckkraft(1.75)).toBeCloseTo(0.5);
    expect(gestenDeckkraft(2)).toBe(0);
    expect(gestenDeckkraft(-1)).toBe(0);
  });

  it("liegen auf den Zifferntasten", () => {
    expect(gesteZuTaste("Digit1")?.emoji).toBe("😊");
    expect(gesteZuTaste("Numpad2")?.id).toBe("hand");
    expect(gesteZuTaste("KeyW")).toBeUndefined();
  });
});

describe("Bushaltestellen", () => {
  it("haben eine Wartefläche an der Bordsteinkante, die als Gehweg zählt", () => {
    const s = stadt();
    const bus = s.halte.filter((h) => h.art === "bushalt");
    expect(s.wartebereiche.length).toBe(bus.length);
    for (const w of s.wartebereiche) {
      const mx = w.reduce((a, p) => a + p[0], 0) / 4, my = w.reduce((a, p) => a + p[1], 0) / 4;
      expect(s.untergrund(mx, my).art).toBe("gehweg");
    }
  });
});

describe("Spuren", () => {
  it("legt bei zwei Spuren je Richtung zwei Kanten nebeneinander", async () => {
    const { Strassenverkehr } = await import("@/lib/verkehr/autos");
    const { baueAnlagen } = await import("@/lib/verkehr/ampeln");
    const s = stadt();
    const v = new Strassenverkehr(s, baueAnlagen(s), 0);
    const zwei = v.kanten.filter((k) => k.spuren >= 2);
    expect(zwei.length).toBeGreaterThan(20);
    // Parallele Spuren: gleiche Knoten, verschiedene Querlage, gut 3 m auseinander
    const k = zwei[0];
    const nachbar = v.kanten.find((x) => x !== k && x.von === k.von && x.nach === k.nach)!;
    expect(Math.abs(nachbar.spur - k.spur)).toBeGreaterThan(2.5);
  });

  it("teilt Gegenverkehr nach lanes:forward/backward auf", async () => {
    const { spurLagen } = await import("@/lib/verkehr/stadt");
    const s = { art: "tertiary" as const, linie: [], spuren: 3, spurenHin: 2, spurenRueck: 1, breite: 9.75 };
    expect(spurLagen(s, true).lagen).toHaveLength(2);
    expect(spurLagen(s, false).lagen).toHaveLength(1);
    // Alle Spurmitten liegen auf der Fahrbahn und rechts ihrer Richtung
    for (const l of spurLagen(s, true).lagen) expect(Math.abs(l)).toBeLessThan(s.breite / 2);
    expect(spurLagen(s, false).lagen[0]).toBeGreaterThan(0);
  });
});
