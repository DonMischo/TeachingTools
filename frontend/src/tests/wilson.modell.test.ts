import { describe, expect, it } from "vitest";
import {
  AUFBRUCH, GIPFEL, KOLLISION, SUBDUKTION, ZYKLUS, PHASEN,
  kanteA, kanteB, ozeanBreite, ozeanTiefe, phaseBei, streifen, zustand, plattenBahn, bogenAbstand,
} from "@/lib/wilson/modell";

describe("Wilson-Zyklus", () => {
  it("die Phasen decken den Zyklus lückenlos ab", () => {
    expect(PHASEN[0].von).toBe(0);
    expect(PHASEN[PHASEN.length - 1].bis).toBe(ZYKLUS);
    for (let i = 1; i < PHASEN.length; i++) expect(PHASEN[i].von).toBe(PHASEN[i - 1].bis);
    expect(phaseBei(ZYKLUS + 10).id).toBe("ruhe");
  });

  it("vor dem Aufbruch gibt es keinen Ozean, beim Subduktionsbeginn ist er ~6000 km breit", () => {
    expect(ozeanBreite(AUFBRUCH - 1)).toBe(0);
    expect(ozeanBreite(SUBDUKTION)).toBeCloseTo(6000, -2);
  });

  it("der Ozean schließt sich genau dort, wo er sich geöffnet hat", () => {
    expect(kanteA(KOLLISION)).toBeCloseTo(0, 5);
    expect(kanteB(KOLLISION)).toBeCloseTo(0, 5);
    expect(ozeanBreite(KOLLISION - 50)).toBeGreaterThan(0);
    expect(ozeanBreite(KOLLISION)).toBe(0);
  });

  it("Magnetstreifen liegen spiegelbildlich zum Rücken, außen ist der Boden älter", () => {
    const s = streifen(200);
    const a = s.filter(x => x.seite === "A");
    const b = s.filter(x => x.seite === "B");
    for (let i = 0; i < a.length; i++) {
      expect(a[i].x).toBeCloseTo(-b[i].x, 3);
      expect(a[i].normal).toBe(b[i].normal);
    }
    const aussen = a.reduce((m, x) => (x.x < m.x ? x : m));
    const innen = a.reduce((m, x) => (x.x > m.x ? x : m));
    expect(aussen.alter).toBeGreaterThan(innen.alter);
    expect(ozeanTiefe(aussen.alter)).toBeGreaterThan(ozeanTiefe(innen.alter) + 2);
  });

  it("an der Rinne taucht zuerst der älteste Boden ab, bis zur Kollision alles", () => {
    const s = streifen(280).filter(x => x.abgetaucht > 0);
    expect(s.length).toBeGreaterThan(0);
    const aeltester = s.reduce((m, x) => (x.abgetaucht > m.abgetaucht ? x : m));
    expect(aeltester.geboren).toBeLessThan(AUFBRUCH + 5);
    const offen = streifen(KOLLISION).filter(x => x.abgetaucht === 0 && x.x > kanteA(KOLLISION) + 1);
    expect(offen.length).toBe(0);
  });

  it("die Kollision türmt ein Hochgebirge auf, das bis zum Zyklusende abgetragen wird", () => {
    expect(zustand(GIPFEL).gipfel).toBeGreaterThan(5);
    expect(zustand(ZYKLUS - 1).gipfel).toBeLessThan(1.5);
    expect(zustand(200).gipfel).toBeLessThan(1);
  });

  it("die abtauchende Platte erreicht 660 km und der Vulkanbogen liegt 150–350 km hinter der Rinne", () => {
    expect(plattenBahn(1200).z).toBeGreaterThan(640);
    expect(bogenAbstand()).toBeGreaterThan(150);
    expect(bogenAbstand()).toBeLessThan(350);
  });

  it("die abtauchende Platte bleibt lückenlos, auch nachdem der Rücken abgetaucht ist", () => {
    for (const t of [280, 320, 360, 399]) {
      const ab = streifen(t).filter(s => s.abgetaucht > 0).sort((a, b) => a.abgetaucht - b.abgetaucht);
      for (let i = 1; i < ab.length; i++) {
        const luecke = ab[i].abgetaucht - ab[i].breite / 2 - (ab[i - 1].abgetaucht + ab[i - 1].breite / 2);
        // Fugen von der Streifenbreite (≤ 10 km) sind Rundung; vorher klaffte bis zu 1800 km.
        expect(luecke).toBeLessThan(15);
      }
    }
  });
});
