import { describe, expect, it } from "vitest";
import { erzeuge, hoeheBei, istWasser } from "@/lib/gelaende/gelaende";
import { schwerpunkt } from "@/lib/stadt/geometrie";
import { haeuser } from "@/lib/stadt/haeuser";
import { passendeWahl } from "@/lib/stadt/landschaft";
import { OEPNV } from "@/lib/stadt/modell";
import { erschliessung, jahrVon } from "@/lib/stadt/oepnv";
import { flaeche, flussAbstand, PROFILE } from "@/lib/stadt/standort";
import { wachse } from "@/lib/stadt/wachstum";

const mitteVon = (bauten: { x: number; y: number }[]) => schwerpunkt(bauten);

describe("Standorte passen zum Gelände", () => {
  it("die Residenz meidet im Hügelland die steilen Stellen", () => {
    const g = erzeuge({ art: "huegel", seed: 7, fluss: true, relief: 1.2 });
    const schloss = wachse("residenz", g, 7)[0].stadt.bauten.find(b => b.typ === "schloss")!;
    const hier = flaeche(g, schloss, PROFILE.residenz.r).neigung;
    // Vergleich: Mittel über die ganze Karte
    let summe = 0, n = 0;
    for (let x = 600; x < g.breite - 600; x += 300) for (let y = 600; y < g.breite - 600; y += 300) { summe += flaeche(g, { x, y }, PROFILE.residenz.r).neigung; n++; }
    expect(hier).toBeLessThan(summe / n);
  });

  it("Städte am Fluss liegen nahe am Fluss, aber nicht drin", () => {
    const g = erzeuge({ art: "flusstal", seed: 12, fluss: true, relief: 1 });
    for (const stil of ["europaeisch", "roemisch", "industrie"] as const) {
      const s = wachse(stil, g, 12)[1].stadt;
      const c = mitteVon(s.bauten.filter(b => b.typ !== "haltestelle"));
      const d = flussAbstand(g, c);
      expect(d, stil).toBeLessThan(900);
      expect(istWasser(g, c.x, c.y), stil).toBe(false);
    }
  });
});

describe("Gelände passend zum Stadttyp", () => {
  it("Quellsee liegt höher als das Tal und speist das Aquädukt", () => {
    const g = erzeuge(passendeWahl("roemisch", 5));
    expect(g.quelle).toBeTruthy();
    expect(hoeheBei(g, g.quelle!.x, g.quelle!.y)).toBeGreaterThan(hoeheBei(g, g.furt!.x, g.furt!.y) + 30);
    const s = wachse("roemisch", g, 5)[1].stadt;
    const aq = s.strassen.find(x => x.art === "aquaedukt");
    expect(aq).toBeTruthy();
    expect(Math.hypot(aq!.punkte[0].x - g.quelle!.x, aq!.punkte[0].y - g.quelle!.y)).toBeLessThan(1);
  });

  it("Bucht und Erzberg werden ins Gelände geplant", () => {
    const k = erzeuge(passendeWahl("hafen", 3));
    expect(k.bucht && istWasser(k, k.bucht.x, k.bucht.y)).toBe(true);
    const b = erzeuge(passendeWahl("bergmann", 3));
    expect(b.erz).toBeTruthy();
    const s = wachse("bergmann", b, 3)[0].stadt;
    expect(s.bauten.some(x => x.typ === "schacht" && Math.hypot(x.x - b.erz!.x, x.y - b.erz!.y) < 300)).toBe(true);
  });

  it("die neuen Stadttypen wachsen auf ihrem passenden Gelände", () => {
    for (const stil of ["bergmann", "industrie", "hafen", "tech"] as const) {
      const g = erzeuge(passendeWahl(stil, 11));
      const e = wachse(stil, g, 11);
      expect(e.length, stil).toBeGreaterThanOrEqual(4);
      expect(haeuser(e[1].stadt, g, 1).length, stil).toBeGreaterThan(50);
      expect(e[e.length - 1].stadt.zonen.length, stil).toBeGreaterThan(e[0].stadt.zonen.length);
    }
  });
});

describe("Nahverkehr", () => {
  it("Jahreszahlen werden gelesen", () => {
    expect(jahrVon("um 1870")).toBe(1870);
    expect(jahrVon("heute")).toBe(2025);
    expect(jahrVon("um 15 v. Chr.")).toBe(-15);
    expect(jahrVon("2. Jh. n. Chr.")).toBe(150);
  });

  it("vor 1880 gibt es keinen Nahverkehr, die heutige europäische Stadt hat Tram und Bus", () => {
    const g = erzeuge({ art: "flusstal", seed: 12, fluss: true, relief: 1 });
    const e = wachse("europaeisch", g, 12);
    expect(e[1].stadt.strassen.some(x => OEPNV.includes(x.art))).toBe(false);
    const heute = e[e.length - 1].stadt;
    expect(heute.strassen.some(x => x.art === "tram")).toBe(true);
    expect(heute.strassen.some(x => x.art === "bus")).toBe(true);
    const er = erschliessung(heute, haeuser(heute, g, 1));
    expect(er.anteil).toBeGreaterThan(0.2);
  });

  it("die amerikanische Autostadt hat die Straßenbahn abgebaut", () => {
    const g = erzeuge({ art: "ebene", seed: 4, fluss: true, relief: 0.5 });
    const e = wachse("amerikanisch", g, 4);
    const auto = e.find(x => jahrVon(x.jahr) >= 1950 && jahrVon(x.jahr) < 2000)!;
    expect(auto.stadt.strassen.some(x => x.art === "tram")).toBe(false);
    expect(auto.neu.some(n => n.includes("abgebaut"))).toBe(true);
  });
});
