/**
 * Die Rechnung hinter der Simulation »Sonnensystem«: stimmen die Bahnen mit
 * echten Ereignissen überein, passen Daten, Aufträge und Bildnachweise
 * zueinander, und liegt jede Bilddatei wirklich im Repo?
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { join } from "path";
import {
  abstand, bahnPunkte, heliozentrisch, julianischerTag, loeseKepler, mondVersatz, MONDBAHNEN, satellitVersatz, umlaufTage, type Vec3,
} from "@/lib/sonnensystem/bahnen";
import { KOERPER, KOERPER_NACH_ID, mondeVon } from "@/lib/sonnensystem/daten";
import { AUFTRAEGE, auftragZu, gemischteAntworten } from "@/lib/sonnensystem/auftraege";
import { GALERIE, benoetigt, bildFuer, freigeschaltet, zeigt, zielName } from "@/lib/sonnensystem/galerie";
import { ALLE_NACHWEISE, foto, textur } from "@/lib/sonnensystem/bilder";
import {
  HOECHSTTEMPO, OVERDRIVE_TEMPO, haltAbstand, overdriveLohntNicht, schaetzeFlugzeit, schleichTempo, vielfachesLicht, zielTempo,
} from "@/lib/sonnensystem/flugmodell";
import { flugMondbahn, flugRadius } from "@/lib/sonnensystem/massstab";
import { ERFOLGE, LEERE_STATISTIK, neueErfolge } from "@/lib/sonnensystem/erfolge";
import { KODEX_GRUPPEN, datenZeilen } from "@/lib/sonnensystem/kodex";
import { ORTE, ORTE_NACH_ID, ortAmPlaneten, ortHeliozentrisch } from "@/lib/sonnensystem/orte";
import { baueKodexPdf, fuerPdf } from "@/components/sonnensystem/kodexPdf";
import { ladeFortschritt } from "@/components/sonnensystem/fortschritt";
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

  it("trifft die echten Mondpositionen von JPL Horizons", () => {
    // Die Bahnelemente stammen von Anfang 2026, die Vergleichspunkte von gut
    // ein Jahr später — geprüft wird also auch die Bewegung, nicht nur der Start.
    // Die meisten Monde liegen unter einem halben Grad daneben; am schlechtesten
    // sind Phobos und Mimas mit knapp 4 Grad, weil ihre Bahnen stark gestört sind.
    for (const mond of KOERPER.filter(k => k.art === "mond")) {
      const soll = MONDBAHNEN.monde[mond.id].probe as Vec3;
      const ist = mondVersatz(mond, K[mond.mutter!], MONDBAHNEN.probeJd);
      const fehler = (2 * Math.asin(Math.min(1, abstand(ist, soll) / 2 / Math.hypot(...soll))) * 180) / Math.PI;
      expect(fehler, `${mond.id}: ${fehler.toFixed(1)}° daneben`).toBeLessThan(5);
    }
  });

  it("lässt die Monde in die richtige Richtung laufen — Triton rückwärts", () => {
    const jd = julianischerTag(new Date("2026-09-16"));
    const dreh = (mond: typeof K.io) => {
      const a = mondVersatz(mond, K[mond.mutter!], jd);
      const b = mondVersatz(mond, K[mond.mutter!], jd + 0.02);
      // Drehsinn um die z-Achse der Ekliptik: positiv = rechtläufig
      return a[0] * b[1] - a[1] * b[0];
    };
    expect(dreh(K.io)).toBeGreaterThan(0);
    expect(dreh(K.mond)).toBeGreaterThan(0);
    expect(dreh(K.triton)).toBeLessThan(0);
  });

  it("hält jeden Mond in der Nähe seiner mittleren Bahn", () => {
    const jd = julianischerTag(new Date("2026-09-15"));
    for (const mond of KOERPER.filter(k => k.art === "mond")) {
      const r = Math.hypot(...mondVersatz(mond, K[mond.mutter!], jd));
      expect(Math.abs(r - mond.mondBahn!.aKm) / mond.mondBahn!.aKm, mond.id).toBeLessThan(0.08);
    }
  });
});

describe("Daten", () => {
  it("gibt jedem Mond einen vorhandenen Planeten und jedem Planeten eine Bahn", () => {
    for (const k of KOERPER) {
      if (k.art === "mond") {
        expect(K[k.mutter!], k.id).toBeDefined();
        expect(k.mondBahn, k.id).toBeDefined();
      } else if (k.art === "satellit") {
        expect(K[k.mutter!], k.id).toBeDefined();
        expect(k.satBahn, k.id).toBeDefined();
        // Raumfahrzeuge kreisen über der Oberfläche, nicht darin.
        expect(k.satBahn!.aKm * (1 - k.satBahn!.e), k.id).toBeGreaterThan(K[k.mutter!].radiusKm);
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
      expect(K[a.ziel] ?? ORTE_NACH_ID[a.ziel], a.id).toBeDefined();
      const gemischt = gemischteAntworten(a);
      expect(gemischt.filter(x => x.richtig)).toHaveLength(1);
      expect(gemischteAntworten(a)).toEqual(gemischt);
    }
    expect(new Set(AUFTRAEGE.map(a => a.id)).size).toBe(AUFTRAEGE.length);
  });
});

describe("Lagrangepunkte", () => {
  const jd = 2_461_041.5;
  const laenge = (v: readonly number[]) => Math.hypot(v[0], v[1], v[2]);
  const winkel = (a: readonly number[], b: readonly number[]) =>
    (Math.acos((a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / (laenge(a) * laenge(b))) * 180) / Math.PI;

  it("legt L1 und L2 1,5 Mio. km vor und hinter die Erde", () => {
    const erde = heliozentrisch(K.erde.bahn!, jd);
    const l1 = ortHeliozentrisch(ORTE_NACH_ID["ort-erde-l1"], jd);
    const l2 = ortHeliozentrisch(ORTE_NACH_ID["ort-erde-l2"], jd);
    expect(laenge(l1)).toBeLessThan(laenge(erde));
    expect(laenge(l2)).toBeGreaterThan(laenge(erde));
    for (const o of ["ort-erde-l1", "ort-erde-l2"]) {
      const nah = ortAmPlaneten(ORTE_NACH_ID[o], jd)!;
      expect(nah.km / 1e6).toBeCloseTo(1.5, 1);
    }
    expect(ortAmPlaneten(ORTE_NACH_ID["ort-erde-l4"], jd)).toBeNull();
  });

  it("stellt L4 und L5 60° voraus und hinterher auf dieselbe Bahn", () => {
    for (const o of ORTE.filter(x => x.punkt === 4 || x.punkt === 5)) {
      const planet = heliozentrisch(K[o.planet].bahn!, jd);
      const p = ortHeliozentrisch(o, jd);
      expect(winkel(planet, p), o.id).toBeCloseTo(60, 4);
      expect(laenge(p) / laenge(planet), o.id).toBeCloseTo(1, 6);
    }
  });

  it("stellt L3 der Erde gegenüber, hinter die Sonne", () => {
    const erde = heliozentrisch(K.erde.bahn!, jd);
    const l3 = ortHeliozentrisch(ORTE_NACH_ID["ort-erde-l3"], jd);
    expect(winkel(erde, l3)).toBeCloseTo(180, 4);
  });

  it("gibt jedem Ort eine eigene Id und einen bekannten Planeten", () => {
    expect(new Set(ORTE.map(o => o.id)).size).toBe(ORTE.length);
    for (const o of ORTE) expect(K[o.planet], o.id).toBeDefined();
  });
});

describe("Raumfahrzeuge", () => {
  const jd = 2_461_041.5;
  const laenge = (v: readonly number[]) => Math.hypot(v[0], v[1], v[2]);

  it("hält jedes Raumfahrzeug zwischen seinem nächsten und fernsten Bahnpunkt", () => {
    for (const k of KOERPER.filter(x => x.art === "satellit")) {
      const b = k.satBahn!;
      for (let i = 0; i < 40; i++) {
        const r = laenge(satellitVersatz(k, K[k.mutter!], jd + i * 0.037));
        expect(r, k.id).toBeGreaterThanOrEqual(b.aKm * (1 - b.e) - 1);
        expect(r, k.id).toBeLessThanOrEqual(b.aKm * (1 + b.e) + 1);
      }
    }
  });

  it("bewegt Chandra ruckfrei — die Keplergleichung braucht die Anomalie modulo 2π", () => {
    // Ohne das Zurückholen sprang der Satellit, weil die mittlere Anomalie seit
    // J2000 auf über 20 000 Bogenmaß aufgelaufen war und Newton nicht mehr traf.
    const chandra = K.chandra;
    const schritt = 1 / 1440; // eine Minute
    let vor = satellitVersatz(chandra, K.erde, jd);
    for (let i = 1; i <= 200; i++) {
      const jetzt = satellitVersatz(chandra, K.erde, jd + i * schritt);
      const weg = Math.hypot(jetzt[0] - vor[0], jetzt[1] - vor[1], jetzt[2] - vor[2]);
      // Im schnellsten Punkt legt Chandra rund 500 km je Minute zurück.
      expect(weg, `Schritt ${i}`).toBeLessThan(1_000);
      vor = jetzt;
    }
  });

  it("lässt den geostationären Meteosat über demselben Punkt stehen", () => {
    // Ein Sterntag später steht er wieder genau dort, wo er war.
    const a = satellitVersatz(K.meteosat, K.erde, jd);
    const b = satellitVersatz(K.meteosat, K.erde, jd + K.erde.rotationStunden! / 24);
    for (let i = 0; i < 3; i++) expect(b[i]).toBeCloseTo(a[i], 3);
  });
});

describe("Sonnensturm", () => {
  it("wirft einen Kegel zur Erde, keine Kugel", async () => {
    const THREE = await import("three");
    const { baueSturmwolke } = await import("@/components/sonnensystem/magnetfeld");
    const wolke = baueSturmwolke();
    const zurErde = new THREE.Vector3(0, 0, -100);
    wolke.richteAus(zurErde);
    // Die Achse des Kegels ist das lokale +z; sie muss zur Erde zeigen.
    const achse = new THREE.Vector3(0, 0, 1).applyQuaternion(wolke.wolke.quaternion);
    expect(achse.angleTo(zurErde.clone().normalize())).toBeCloseTo(0, 5);

    const front = 50;
    wolke.setze(front, 1);
    const orte = wolke.wolke.geometry.attributes.position.array as Float32Array;
    const punkt = new THREE.Vector3();
    let groesster = 0;
    for (let i = 0; i < orte.length; i += 3) {
      punkt.set(orte[i], orte[i + 1], orte[i + 2]);
      // Die Wolke hat Tiefe, reicht aber nie über die Front hinaus.
      expect(punkt.length()).toBeLessThanOrEqual(front + 1e-4);
      expect(punkt.length()).toBeGreaterThan(front * 0.45);
      groesster = Math.max(groesster, punkt.angleTo(new THREE.Vector3(0, 0, 1)));
    }
    // Ein Auswurf ist 20 bis 45 Grad weit — und deckt eben nicht den ganzen Himmel ab.
    expect((groesster * 180) / Math.PI).toBeLessThanOrEqual(38.01);
    expect((groesster * 180) / Math.PI).toBeGreaterThan(30);
    wolke.entsorgen();
  });
});

describe("Keplersche Gesetze", () => {
  it("hält T² zu a³ für jeden Planeten bei eins", () => {
    for (const k of KOERPER.filter(x => x.bahn)) {
      const a = k.bahn!.a;
      const T = umlaufTage(k.bahn!) / 365.25;
      // In AE und Jahren ist die Konstante genau 1 — daran hängt der ganze dritte Satz.
      expect((T * T) / (a * a * a), k.id).toBeCloseTo(1, 2);
    }
  });

  it("löst die Keplergleichung auch bei stark exzentrischen Bahnen und großen Anomalien", () => {
    const aufKreis = (w: number) => Math.atan2(Math.sin(w), Math.cos(w));
    for (const e of [0, 0.2, 0.5, 0.81, 0.95]) {
      // Auch weit außerhalb einer Umdrehung: so kommt die Anomalie eines
      // Satelliten an, der seit J2000 tausende Male herumgelaufen ist.
      for (const M of [0, 1, 3, 3.1416, -3.1017, 5, 6.2, 22_559.8167]) {
        const E = loeseKepler(M, e);
        expect(aufKreis(E - e * Math.sin(E) - M), `e=${e} M=${M}`).toBeCloseTo(0, 9);
      }
    }
  });
});

describe("Bilder", () => {
  it("hat für jeden Körper ein Foto und — außer Ceres — eine Textur", () => {
    for (const k of KOERPER) {
      expect(foto(k.id), `Foto ${k.id}`).toBeDefined();
      // Raumfahrzeuge bekommen keine Kugeltextur, Ceres hat keine brauchbare.
      if (k.id !== "ceres" && k.art !== "satellit") expect(textur(k.id), `Textur ${k.id}`).toBeDefined();
    }
  });

  it("hat für jeden Galerie-Eintrag ein Bild, und Paare verweisen aufeinander", () => {
    for (const g of GALERIE) {
      expect(bildFuer(g), g.id).toBeDefined();
      for (const id of benoetigt(g)) expect(K[id] ?? ORTE_NACH_ID[id], `${g.id} braucht ${id}`).toBeDefined();
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

describe("Galerie freischalten und filtern", () => {
  const eintrag = (id: string) => GALERIE.find(g => g.id === id)!;

  it("enthält für jeden Himmelskörper ein Porträt und jede Bild-Id nur einmal", () => {
    for (const k of KOERPER) expect(GALERIE.some(g => g.portraet && g.koerper === k.id), k.id).toBe(true);
    expect(new Set(GALERIE.map(g => g.id)).size).toBe(GALERIE.length);
  });

  it("schaltet ein Bild erst frei, wenn alle nötigen Körper gescannt sind", () => {
    expect(freigeschaltet(eintrag("mars-ingenuity"), [])).toBe(false);
    expect(freigeschaltet(eintrag("mars-ingenuity"), ["mars"])).toBe(true);
    expect(freigeschaltet(eintrag("riesen-webb"), ["jupiter", "saturn", "uranus"])).toBe(false);
    expect(freigeschaltet(eintrag("riesen-webb"), ["jupiter", "saturn", "uranus", "neptun"])).toBe(true);
  });

  it("zeigt beim Planeten auch die Bilder seiner Monde, beim Mond nur seine", () => {
    expect(zeigt(eintrag("enceladus-fontaenen"), "saturn")).toBe(true);
    expect(zeigt(eintrag("enceladus-fontaenen"), "enceladus")).toBe(true);
    expect(zeigt(eintrag("saturn-hexagon"), "enceladus")).toBe(false);
    expect(zeigt(eintrag("hubble-deep-field"), "saturn")).toBe(false);
    expect(zeigt(eintrag("hubble-deep-field"), null)).toBe(true);
  });
});

describe("Aufträge", () => {
  it("sind von Grundwissen bis Profi sortiert, mit höchstens einem Auftrag je Körper", () => {
    expect(AUFTRAEGE.length).toBeGreaterThanOrEqual(24);
    for (let i = 1; i < AUFTRAEGE.length; i++) expect(AUFTRAEGE[i].stufe).toBeGreaterThanOrEqual(AUFTRAEGE[i - 1].stufe);
    expect(new Set(AUFTRAEGE.map(a => a.ziel)).size).toBe(AUFTRAEGE.length);
    // Die Liste zeigt bei gelösten Aufträgen den Namen des Ziels. Ein
    // Lagrangepunkt steht nicht in KOERPER_NACH_ID — der direkte Zugriff riss
    // die ganze Ansicht mit, sobald der erste solche Auftrag gelöst war.
    for (const a of AUFTRAEGE) expect(zielName(a.ziel), a.id).not.toBe(a.ziel);
  });

  it("findet zu jedem gescannten Ziel den offenen Auftrag, egal in welcher Reihenfolge", () => {
    expect(auftragZu("triton", [])?.id).toBe("rueckwaerts");
    expect(auftragZu("triton", ["rueckwaerts"])).toBeNull();
    expect(auftragZu("tethys", [])).toBeNull();
  });
});

describe("Flugmodell", () => {
  it("begrenzt Pulsantrieb auf 100-fache und Overdrive auf 1000-fache Lichtgeschwindigkeit", () => {
    expect(vielfachesLicht(zielTempo({ puls: true, overdrive: false, schub: 1 }, 1e9))).toBeCloseTo(100, 6);
    expect(vielfachesLicht(zielTempo({ puls: true, overdrive: true, schub: 1 }, 1e9))).toBeCloseTo(1000, 6);
    expect(OVERDRIVE_TEMPO).toBeCloseTo(HOECHSTTEMPO * 10, 9);
  });

  it("wird langsamer, je näher etwas voraus ist", () => {
    const puls = { puls: true, overdrive: false, schub: 1 };
    expect(zielTempo(puls, 100)).toBeLessThan(zielTempo(puls, 400));
    expect(overdriveLohntNicht(100)).toBe(true);
    expect(overdriveLohntNicht(100_000)).toBe(false);
  });

  it("schätzt die Flugzeit: null am Halteabstand, länger bei weiterem Weg, kürzer mit Overdrive", () => {
    const lage = { zielRadius: 70, startAbstand: 50, tempo: 0, puls: false, overdriveRest: 0, winkel: 0 };
    expect(schaetzeFlugzeit({ ...lage, abstand: haltAbstand(70) })).toBe(0);
    const nah = schaetzeFlugzeit({ ...lage, abstand: 2_000 });
    const weit = schaetzeFlugzeit({ ...lage, abstand: 20_000 });
    const sehrWeit = schaetzeFlugzeit({ ...lage, abstand: 70_000 });
    expect(nah).toBeGreaterThan(0);
    expect(weit).toBeGreaterThan(nah);
    expect(sehrWeit).toBeGreaterThan(weit);
    // Weit draußen bestimmt das Höchsttempo die Dauer: 50 000 Einheiten mehr brauchen gut 100 s mehr.
    expect(sehrWeit - weit).toBeCloseTo(50_000 / HOECHSTTEMPO, -1);
    expect(schaetzeFlugzeit({ ...lage, abstand: 70_000, puls: true, tempo: HOECHSTTEMPO, overdriveRest: 12 })).toBeLessThan(sehrWeit - 20);
    expect(schaetzeFlugzeit({ ...lage, abstand: 2_000, winkel: Math.PI })).toBeGreaterThan(nah);
  });
});

describe("Anflug auf kleine Körper", () => {
  it("hält so weit weg, dass jeder Körper sichtbar groß ist — auch Phobos und Deimos", () => {
    for (const k of KOERPER) {
      const r = flugRadius(k);
      const grad = (2 * Math.atan(r / haltAbstand(r)) * 180) / Math.PI;
      expect(grad, `${k.id}: ${grad.toFixed(1)}°`).toBeGreaterThan(15);
    }
  });

  it("schleicht vor kleinen Körpern langsamer, als sie um ihren Planeten kreisen", () => {
    // Deimos legt im 1000-fachen Zeitraffer 0,8 Einheiten je Sekunde zurück; in
    // Oberflächennähe bremst der Zeitraffer auf ein Fünfzigstel — dann ist er einholbar.
    const deimos = K.deimos;
    const bahn = flugMondbahn(deimos, K.mars);
    const tempoImRaffer = (2 * Math.PI * bahn) / ((Math.abs(deimos.mondBahn!.umlaufTage) * 86_400) / 1_000);
    expect(tempoImRaffer).toBeGreaterThan(schleichTempo(flugRadius(deimos)));
    expect(tempoImRaffer * 0.02).toBeLessThan(schleichTempo(flugRadius(deimos)));
  });
});

describe("Erfolge und Fortschritt", () => {
  const leer = { erforscht: [] as string[], erledigt: [] as string[], statistik: LEERE_STATISTIK };

  it("vergibt nichts ohne Fortschritt und jeden Erfolg nur einmal", () => {
    expect(neueErfolge(leer, [])).toHaveLength(0);
    expect(new Set(ERFOLGE.map(e => e.id)).size).toBe(ERFOLGE.length);
    const planeten = KOERPER.filter(k => k.art === "planet").map(k => k.id);
    const ids = neueErfolge({ ...leer, erforscht: planeten }, []).map(e => e.id);
    expect(ids).toEqual(expect.arrayContaining(["erster-scan", "planeten"]));
    expect(neueErfolge({ ...leer, erforscht: planeten }, ids)).toHaveLength(0);
  });

  it("zählt Missgeschicke, Overdrive und Umrundungen", () => {
    const statistik = { ...LEERE_STATISTIK, verglueht: 1, abstuerze: 1, abgestuerztAuf: ["mars"], overdrives: 1, umrundungen: 1, umrundet: ["mond"] };
    const ids = neueErfolge({ ...leer, statistik }, []).map(e => e.id);
    expect(ids).toEqual(expect.arrayContaining(["ikarus", "bruchlandung", "overdrive-1", "orbit-1"]));
  });

  it("liest auch einen alten Spielstand ohne Statistik", () => {
    localStorage.setItem("sonnensystem-forschung-v1:alt", JSON.stringify({ erforscht: ["mars"], erledigt: ["rost"] }));
    const f = ladeFortschritt("alt");
    expect(f.erforscht).toEqual(["mars"]);
    expect(f.statistik.abgestuerztAuf).toEqual([]);
    expect(f.erfolge).toEqual({});
  });
});

describe("Kodex", () => {
  it("führt jeden Himmelskörper genau einmal, Monde unter ihrem Planeten", () => {
    const ids = KODEX_GRUPPEN.flatMap(g => [g.haupt.id, ...g.monde.map(m => m.id), ...g.satelliten.map(s => s.id)]);
    expect([...ids].sort()).toEqual(KOERPER.map(k => k.id).sort());
    for (const g of KODEX_GRUPPEN) for (const m of [...g.monde, ...g.satelliten]) expect(m.mutter).toBe(g.haupt.id);
    expect(datenZeilen(K.io, true).some(([n]) => n === "Abstand zu Jupiter")).toBe(true);
    expect(datenZeilen(K.iss).some(([n]) => n === "Bahnhöhe")).toBe(true);
  });

  it("baut ein PDF mit einer Seite je Hauptkörper, Titel und Bildnachweisen", async () => {
    const doc = await baueKodexPdf();
    // Titelseite + je ein Hauptkörper + Bildnachweise, dazu Umbrüche bei langen Abschnitten.
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(KODEX_GRUPPEN.length + 2);
    const text = JSON.stringify(doc.internal.pages);
    expect(text).toContain("Kodex des Sonnensystems");
    expect(text).toContain("Bildnachweise");
    expect(text).toContain("Ganymed");
  }, 30_000);

  it("übersetzt Text für die PDF-Standardschrift", () => {
    expect(fuerPdf("5,97 · 10²⁴ kg")).toBe("5,97 · 10^24 kg");
    expect(fuerPdf("−173 °C bis 427 °C")).toBe("-173 °C bis 427 °C");
    expect(fuerPdf("🪐 Saturn — »Ringplanet«")).toBe("Saturn — »Ringplanet«");
    for (const k of KOERPER) {
      for (const text of [k.intro, ...k.fakten, ...datenZeilen(k).flat()]) {
        for (const c of fuerPdf(text)) expect(c.charCodeAt(0) <= 0xff || "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ".includes(c), `${k.id}: ${c}`).toBe(true);
      }
    }
  });
});
