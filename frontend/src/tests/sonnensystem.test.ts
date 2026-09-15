/**
 * Die Rechnung hinter der Simulation »Sonnensystem«: stimmen die Bahnen mit
 * echten Ereignissen überein, passen Daten, Aufträge und Bildnachweise
 * zueinander, und liegt jede Bilddatei wirklich im Repo?
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import {
  abstand, bahnPunkte, heliozentrisch, julianischerTag, loeseKepler, mondVersatz, umlaufTage, type Vec3,
} from "@/lib/sonnensystem/bahnen";
import { KOERPER, KOERPER_NACH_ID, mondeVon } from "@/lib/sonnensystem/daten";
import { AUFTRAEGE, gemischteAntworten } from "@/lib/sonnensystem/auftraege";
import { GALERIE } from "@/lib/sonnensystem/galerie";
import { ALLE_NACHWEISE, foto, galerieBild, textur } from "@/lib/sonnensystem/bilder";
import { dauer, km, tage, zehnerpotenz } from "@/lib/sonnensystem/format";

const K = KOERPER_NACH_ID;
const pos = (id: string, datum: string) => heliozentrisch(K[id].bahn!, julianischerTag(new Date(datum)));
const winkel = (a: Vec3, b: Vec3) => {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return (Math.acos(d / (Math.hypot(...a) * Math.hypot(...b))) * 180) / Math.PI;
};

describe("Keplerbahnen", () => {
  it("löst die Keplergleichung auch für lang gestreckte Bahnen", () => {
    for (const e of [0, 0.2, 0.6, 0.95]) {
      for (const M of [-3, -1, 0.1, 2.5]) {
        const E = loeseKepler(M, e);
        expect(E - e * Math.sin(E)).toBeCloseTo(M, 10);
      }
    }
  });

  it("stellt die Erde zu J2000 an die bekannte Stelle", () => {
    const [x, y, z] = pos("erde", "2000-01-01T12:00:00Z");
    expect(x).toBeCloseTo(-0.177, 2);
    expect(y).toBeCloseTo(0.967, 2);
    expect(Math.abs(z)).toBeLessThan(1e-3);
  });

  it("hält die Erde das ganze Jahr zwischen Perihel und Aphel", () => {
    for (let m = 0; m < 12; m++) {
      const r = Math.hypot(...pos("erde", `2026-${String(m + 1).padStart(2, "0")}-15`));
      expect(r).toBeGreaterThan(0.983);
      expect(r).toBeLessThan(1.017);
    }
  });

  it("trifft die Marsnähe vom 12. Januar 2025 (0,64 AE)", () => {
    expect(abstand(pos("mars", "2025-01-12"), pos("erde", "2025-01-12"))).toBeCloseTo(0.642, 2);
  });

  it("rechnet Umlaufzeiten nach dem dritten Keplergesetz", () => {
    expect(umlaufTage(K.jupiter.bahn!)).toBeCloseTo(4332, -1);
    expect(umlaufTage(K.erde.bahn!)).toBeCloseTo(365.25, 0);
  });

  it("schließt die Bahnlinie", () => {
    const punkte = bahnPunkte(K.merkur.bahn!, julianischerTag(new Date("2026-01-01")));
    expect(abstand(punkte[0], punkte[punkte.length - 1])).toBeLessThan(1e-9);
  });
});

describe("Monde", () => {
  // Vollmond: der Mond steht von der Sonne aus hinter der Erde.
  it("zeigt den Vollmond der Mondfinsternis vom 3. März 2026", () => {
    const jd = julianischerTag(new Date("2026-03-03T11:33:00Z"));
    const erde = heliozentrisch(K.erde.bahn!, jd);
    expect(winkel(mondVersatz(K.mond, K.erde, jd), erde)).toBeLessThan(5);
  });

  it("zeigt den Neumond der Sonnenfinsternis vom 17. Februar 2026", () => {
    const jd = julianischerTag(new Date("2026-02-17T12:12:00Z"));
    const zurSonne = heliozentrisch(K.erde.bahn!, jd).map(v => -v) as Vec3;
    expect(winkel(mondVersatz(K.mond, K.erde, jd), zurSonne)).toBeLessThan(5);
  });

  it("hält jeden Mond auf seinem Bahnradius", () => {
    const jd = julianischerTag(new Date("2026-09-15"));
    for (const mond of KOERPER.filter(k => k.art === "mond" && k.id !== "mond")) {
      expect(Math.hypot(...mondVersatz(mond, K[mond.mutter!], jd))).toBeCloseTo(mond.mondBahn!.aKm, 0);
    }
  });
});

describe("Daten", () => {
  it("gibt jedem Mond einen vorhandenen Planeten und jedem Planeten eine Bahn", () => {
    for (const k of KOERPER) {
      if (k.art === "mond") {
        expect(K[k.mutter!], k.id).toBeDefined();
        expect(k.mondBahn, k.id).toBeDefined();
      } else if (k.art !== "stern") {
        expect(k.bahn, k.id).toBeDefined();
      }
    }
    expect(new Set(KOERPER.map(k => k.id)).size).toBe(KOERPER.length);
  });

  it("stützt die Antworten der Aufträge", () => {
    expect(K.enceladus.mutter).toBe("saturn");
    expect(K.ganymed.radiusKm).toBeGreaterThan(K.merkur.radiusKm);
    expect(K.saturn.dichte).toBeLessThan(1);
    expect(K.uranus.achsneigung).toBeGreaterThan(90);
    expect(K.triton.mondBahn!.umlaufTage).toBeLessThan(0);
    expect(K.merkur.sonnentagStunden! / 24).toBeCloseTo(176, 0);
    expect(mondeVon("jupiter").map(m => m.id)).toContain("io");
  });

  it("führt jeden Auftrag zu einem vorhandenen Ziel, mit genau einer richtigen Antwort", () => {
    for (const a of AUFTRAEGE) {
      expect(K[a.ziel], a.id).toBeDefined();
      const gemischt = gemischteAntworten(a);
      expect(gemischt.filter(x => x.richtig)).toHaveLength(1);
      expect(gemischteAntworten(a)).toEqual(gemischt);
    }
    expect(new Set(AUFTRAEGE.map(a => a.id)).size).toBe(AUFTRAEGE.length);
  });
});

describe("Bilder", () => {
  it("hat für jeden Körper ein Foto und — außer Ceres — eine Textur", () => {
    for (const k of KOERPER) {
      expect(foto(k.id), `Foto ${k.id}`).toBeDefined();
      if (k.id !== "ceres") expect(textur(k.id), `Textur ${k.id}`).toBeDefined();
    }
  });

  it("hat für jeden Galerie-Eintrag ein Bild, und Paare verweisen aufeinander", () => {
    for (const g of GALERIE) {
      expect(galerieBild(g.id), g.id).toBeDefined();
      if (g.paar) expect(GALERIE.find(x => x.id === g.paar)?.paar).toBe(g.id);
    }
  });

  it("nennt zu jedem Bild Lizenz und Urheber, und die Datei liegt im Repo", () => {
    for (const [schluessel, b] of Object.entries(ALLE_NACHWEISE)) {
      expect(b.lizenz, schluessel).toMatch(/public domain|CC0|CC BY|Attribution/i);
      expect(b.urheber.length, schluessel).toBeGreaterThan(0);
      expect(existsSync(join(process.cwd(), "public", b.datei)), b.datei).toBe(true);
    }
  });
});

describe("Formate", () => {
  it("schreibt Zahlen deutsch und mit Einheit", () => {
    expect(km(149_597_870.7)).toBe("149,6 Mio. km");
    expect(km(4_495_000_000)).toBe("4,50 Mrd. km");
    expect(dauer(499)).toBe("8 min 19 s");
    expect(dauer(4.17 * 3600)).toBe("4 h 10 min");
    expect(zehnerpotenz(5.972e24)).toBe("5,97 · 10²⁴");
    expect(tage(0.41354)).toBe("9 h 55 min");
    expect(tage(224.7)).toBe("225 Tage");
    expect(tage(4332)).toBe("11,9 Jahre");
  });
});
