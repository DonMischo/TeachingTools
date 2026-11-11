import { describe, expect, it } from "vitest";
import { BEDARF, abgleich, rechneHeizung, waerme, type Heizung } from "@/lib/stroemung/heizung";

const offen: Heizung = { pumpe: 0.25e5, vorlauf: 55, stufen: [6, 6, 6], offen: [true, true, true] };

describe("Heizkreis", () => {
  it("mehr Durchfluss, mehr Wärme — aber mit abnehmendem Zuwachs", () => {
    const a = waerme(10 / 3600000 * 1000, 55).leistung;   // 10 L/h
    const b = waerme(40 / 3600000 * 1000, 55).leistung;   // 40 L/h
    const c = waerme(160 / 3600000 * 1000, 55).leistung;  // 160 L/h
    expect(b).toBeGreaterThan(a);
    expect(c).toBeGreaterThan(b);
    expect(c - b).toBeLessThan(b - a);
  });

  it("ohne Abgleich: der nahe Heizkörper bekommt am meisten, der ferne zu wenig", () => {
    const r = rechneHeizung(offen);
    expect(r.heizkoerper[0].q).toBeGreaterThan(2 * r.heizkoerper[2].q);
    expect(r.heizkoerper[2].leistung).toBeLessThan(BEDARF);
  });

  it("Abgleich: danach reicht es in allen Räumen", () => {
    const stufen = abgleich(offen);
    const r = rechneHeizung({ ...offen, stufen });
    expect(stufen[0]).toBeLessThan(stufen[2]);
    for (const k of r.heizkoerper) expect(k.leistung).toBeGreaterThan(BEDARF);
  });

  it("stärker pumpen hilft dem fernen Raum ohne Abgleich kaum", () => {
    const r = rechneHeizung({ ...offen, pumpe: 0.4e5 });
    expect(r.heizkoerper[2].leistung).toBeLessThan(BEDARF);
  });
});
