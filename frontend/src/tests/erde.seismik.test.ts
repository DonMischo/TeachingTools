import { describe, expect, it } from "vitest";
import { ankunft, faecher, schalen, verfolge } from "@/lib/erde/seismik";
import { ERDRADIUS, SCHICHTEN, profilWert, schalenMasse, schalenVolumen } from "@/lib/erde/schichten";

const bereich = (t: boolean[], von: number, bis: number) => t.slice(von, bis + 1);

describe("Schalenbau", () => {
  it("Schichten schließen lückenlos von der Oberfläche bis zur Mitte an", () => {
    expect(SCHICHTEN[0].von).toBe(0);
    expect(SCHICHTEN[SCHICHTEN.length - 1].bis).toBe(ERDRADIUS);
    for (let i = 1; i < SCHICHTEN.length; i++) expect(SCHICHTEN[i].von).toBe(SCHICHTEN[i - 1].bis);
  });

  it("die Dichtetabelle ergibt die Erdmasse (5,97·10²⁴ kg) auf 3 %", () => {
    const m = schalenMasse(0, ERDRADIUS, 2000);
    expect(m / 5.972e24).toBeGreaterThan(0.97);
    expect(m / 5.972e24).toBeLessThan(1.03);
  });

  it("der Kern hat rund ein Drittel der Masse, aber nur ein Sechstel des Volumens", () => {
    const mKern = schalenMasse(2891, ERDRADIUS, 2000) / schalenMasse(0, ERDRADIUS, 2000);
    const vKern = schalenVolumen(2891, ERDRADIUS) / schalenVolumen(0, ERDRADIUS);
    expect(mKern).toBeGreaterThan(0.30);
    expect(mKern).toBeLessThan(0.34);
    expect(vKern).toBeGreaterThan(0.15);
    expect(vKern).toBeLessThan(0.17);
  });

  it("äußerer Kern ist heißer als sein Schmelzpunkt, innerer Kern kälter", () => {
    for (const z of [3000, 4000, 5000]) expect(profilWert("temperatur", z)).toBeGreaterThan(profilWert("schmelzen", z));
    for (const z of [5300, 6000, 6371]) expect(profilWert("temperatur", z)).toBeLessThan(profilWert("schmelzen", z));
  });

  it("die Asthenosphäre liegt näher am Schmelzpunkt als der untere Mantel", () => {
    const abstand = (z: number) => profilWert("schmelzen", z) - profilWert("temperatur", z);
    expect(abstand(150)).toBeLessThan(100);
    expect(abstand(1500)).toBeGreaterThan(500);
  });

  it("S-Wellen fehlen im flüssigen Kern", () => {
    expect(profilWert("vs", 4000)).toBe(0);
    expect(profilWert("vs", 6000)).toBeGreaterThan(3);
  });
});

describe("Strahlen", () => {
  it("ein senkrechter Strahl geht durch die Mitte und kommt gegenüber an", () => {
    const s = verfolge("P", 0, schalen("P", "innenkern"));
    expect(s.entfernung).toBeCloseTo(180, 0);
    // PKIKP braucht rund 20 Minuten durch die Erde.
    expect(s.laufzeit! / 60).toBeGreaterThan(19);
    expect(s.laufzeit! / 60).toBeLessThan(21);
  });

  it("P bei 60° kommt nach rund 10 Minuten an", () => {
    const liste = schalen("P", "innenkern");
    const fan = faecher("P", "innenkern", 400).filter(s => s.entfernung && Math.abs(s.entfernung - 60) < 2 && !s.durchKern);
    expect(fan.length).toBeGreaterThan(0);
    const t = fan[0].laufzeit! / 60;
    expect(t).toBeGreaterThan(9);
    expect(t).toBeLessThan(11);
    expect(liste.length).toBeGreaterThan(200);
  });

  it("S-Schatten: jenseits von etwa 105° kommen keine S-Wellen an", () => {
    const s = ankunft("S", "innenkern");
    expect(bereich(s, 20, 95).every(Boolean)).toBe(true);
    expect(bereich(s, 106, 180).some(Boolean)).toBe(false);
  });

  it("P-Schatten zwischen etwa 103° und 142° — bis auf die Innenkern-Wellen", () => {
    const ohne = ankunft("P", "kern");
    expect(bereich(ohne, 20, 95).every(Boolean)).toBe(true);
    expect(bereich(ohne, 106, 140).some(Boolean)).toBe(false);
    expect(bereich(ohne, 150, 180).some(Boolean)).toBe(true);
    // Lehmanns Befund: mit festem Innenkern tauchen im Schatten Wellen auf.
    const mit = ankunft("P", "innenkern");
    expect(bereich(mit, 112, 140).some(Boolean)).toBe(true);
  });

  it("in einer gleichförmigen Erde gibt es keinen Schatten", () => {
    const p = ankunft("P", "homogen");
    const s = ankunft("S", "homogen");
    expect(bereich(p, 2, 178).every(Boolean)).toBe(true);
    expect(bereich(s, 2, 178).every(Boolean)).toBe(true);
  });
});
