import { describe, expect, it } from "vitest";
import { stadt, winkelVon } from "@/lib/verkehr/stadt";
import { autoLicht, baueAnlagen, fussGruen, UMLAUF, TASTER_WARTEN, FUSS_GRUEN } from "@/lib/verkehr/ampeln";
import { Strassenverkehr, type Fussgaenger } from "@/lib/verkehr/autos";
import { Regelwaechter } from "@/lib/verkehr/regeln";
import type { P } from "@/lib/verkehr/geometrie";

const s = stadt();
const anlagen = baueAnlagen(s);

describe("Ampeln", () => {
  it("bündelt die OSM-Ampeln zu Kreuzungen mit zwei Achsen und Fußgängerampeln", () => {
    expect(anlagen.length).toBeGreaterThanOrEqual(5);
    expect(anlagen.some((a) => a.achsen.length === 2)).toBe(true);
  });

  it("schaltet je Richtung etwa 30 s (Grün + Gelb + alles Rot)", () => {
    expect(UMLAUF).toBe(60);
    const a = anlagen.find((a) => a.achsen.length === 2)!;
    let gruen = 0;
    for (let t = 0; t < UMLAUF; t += 0.5) if (autoLicht(a, 0, t) === "gruen") gruen += 0.5;
    expect(gruen).toBe(25);
  });

  it("gibt nie beiden Achsen einer Kreuzung gleichzeitig Grün", () => {
    for (const a of anlagen.filter((a) => a.achsen.length === 2))
      for (let t = 0; t < UMLAUF; t += 0.25) expect(autoLicht(a, 0, t) === "gruen" && autoLicht(a, 1, t) === "gruen").toBe(false);
  });

  it("lässt Fußgänger nur gehen, wenn die Autos dieser Straße Rot haben", () => {
    for (const a of anlagen.filter((a) => a.achsen.length === 2))
      for (let t = 0; t < UMLAUF; t += 0.25)
        for (const achse of [0, 1]) if (fussGruen(a, achse, t)) expect(autoLicht(a, achse, t)).toBe("rot");
  });

  it("schaltet eine Fußgängerampel erst nach dem Taster und nur kurz", () => {
    const a = { id: 99, mitte: [0, 0] as P, achsen: [0], versatz: 0, signale: [] };
    expect(fussGruen(a, 0, 100)).toBe(false);
    expect(autoLicht(a, 0, 100)).toBe("gruen");
    const gedrueckt = 100;
    expect(fussGruen(a, 0, gedrueckt + 1, gedrueckt)).toBe(false);
    expect(autoLicht(a, 0, gedrueckt + TASTER_WARTEN - 1, gedrueckt)).toBe("gelb");
    expect(fussGruen(a, 0, gedrueckt + TASTER_WARTEN + 1, gedrueckt)).toBe(true);
    expect(autoLicht(a, 0, gedrueckt + TASTER_WARTEN + 1, gedrueckt)).toBe("rot");
    expect(fussGruen(a, 0, gedrueckt + TASTER_WARTEN + FUSS_GRUEN + 1, gedrueckt)).toBe(false);
    expect(autoLicht(a, 0, gedrueckt + 60, gedrueckt)).toBe("gruen");
  });
});

/** Eine gerade Wohnstraße fern von Überwegen und Ampeln, mit Gehweg auf beiden Seiten. */
function ruhigeStelle() {
  for (const st of s.strassen) {
    if (st.art !== "residential" || !st.gehwegBreite) continue;
    for (let i = 0; i + 1 < st.linie.length; i++) {
      const a = st.linie[i], b = st.linie[i + 1];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 20) continue;
      const m: P = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (s.karte.punkte.some((p) => ["zebra", "ampelUebergang", "querung", "ampel"].includes(p.art) && Math.hypot(p.p[0] - m[0], p.p[1] - m[1]) < 50)) continue;
      const w = winkelVon({ a, b }), qx = -Math.sin(w), qy = Math.cos(w);
      const d = st.breite / 2 + 1;
      const links: P = [m[0] - qx * d, m[1] - qy * d], rechts: P = [m[0] + qx * d, m[1] + qy * d];
      if (s.untergrund(...links).art === "gehweg" && s.untergrund(...rechts).art === "gehweg" && s.untergrund(...m).art === "fahrbahn")
        return { links, rechts, mitte: m };
    }
  }
  throw new Error("keine ruhige Stelle gefunden");
}

function laufe(w: Regelwaechter, von: P, nach: P, t0: number, schritte = 20) {
  const alle = [];
  for (let i = 0; i <= schritte; i++) {
    const f = i / schritte;
    alle.push(...w.pruefe(von[0] + (nach[0] - von[0]) * f, von[1] + (nach[1] - von[1]) * f, t0 + i * 0.3));
  }
  return alle.map((m) => m.id);
}

describe("Regeln beim Queren", () => {
  const stelle = ruhigeStelle();

  it("mahnt, wer ohne Umschauen auf die Fahrbahn geht", () => {
    const w = new Regelwaechter(s, anlagen);
    w.pruefe(...stelle.links, 0);
    expect(laufe(w, stelle.links, stelle.rechts, 1)).toContain("nichtGeschaut");
  });

  it("lobt, wer vorher geschaut hat und zügig quert", () => {
    const w = new Regelwaechter(s, anlagen);
    w.pruefe(...stelle.links, 0);
    w.geschaut(0.5);
    const ids = laufe(w, stelle.links, stelle.rechts, 1);
    expect(ids).not.toContain("nichtGeschaut");
    expect(ids).toContain("sicherGequert");
  });

  it("mahnt Bummeln auf der Fahrbahn", () => {
    const w = new Regelwaechter(s, anlagen);
    w.pruefe(...stelle.links, 0);
    w.geschaut(0.5);
    w.pruefe(...stelle.mitte, 1);
    expect(w.pruefe(...stelle.mitte, 30).map((m) => m.id)).toContain("troedeln");
  });
});

describe("Autos", () => {
  it("bremsen vor einem Menschen auf ihrer Spur", () => {
    const v = new Strassenverkehr(s, anlagen, 0);
    const i = v.kanten.findIndex((k) => k.laenge > 60 && k.strasse.art !== "living_street" && !k.halte.length);
    const k = v.kanten[i];
    v.setze({
      id: 1, art: "auto", farbe: 0, laenge: 4.4, breite: 1.8, kante: i, s: 0, tempo: 8, naechste: null,
      x: 0, y: 0, winkel: 0, hupe: 0, wartetBis: 0,
    });
    const c = Math.cos(k.winkel), sn = Math.sin(k.winkel);
    const mensch: Fussgaenger = {
      id: "kind", x: k.a[0] + c * 40 - sn * k.spur, y: k.a[1] + sn * 40 + c * k.spur, hand: -Infinity, karmaBis: -Infinity,
    };
    expect(s.untergrund(mensch.x, mensch.y).art).toBe("fahrbahn");
    let unfaelle = 0;
    for (let n = 0; n < 200; n++) unfaelle += v.schritt(0.05, n * 0.05, [mensch]).length;
    expect(unfaelle).toBe(0);
    expect(v.fahrzeuge[0].tempo).toBe(0);
    expect(v.fahrzeuge[0].s).toBeLessThan(40);
  });

  it("halten an einer roten Ampel", () => {
    const v = new Strassenverkehr(s, anlagen, 0);
    const i = v.kanten.findIndex((k) => k.halte.some((h) => h.art === "ampel" && h.anlage!.achsen.length === 2 && h.s > 25));
    expect(i).toBeGreaterThanOrEqual(0);
    const k = v.kanten[i];
    const h = k.halte.find((h) => h.art === "ampel" && h.s > 25)!;
    // Zeitpunkt suchen, zu dem die Achse lange Rot hat.
    let t0 = 0;
    while (autoLicht(h.anlage!, h.achse!, t0) !== "rot" || autoLicht(h.anlage!, h.achse!, t0 + 8) !== "rot") t0 += 0.5;
    v.setze({
      id: 1, art: "auto", farbe: 0, laenge: 4.4, breite: 1.8, kante: i, s: Math.max(0, h.s - 25), tempo: 8, naechste: null,
      x: 0, y: 0, winkel: 0, hupe: 0, wartetBis: 0,
    });
    for (let n = 0; n < 120; n++) v.schritt(0.05, t0 + n * 0.05, []);
    expect(v.fahrzeuge[0].s).toBeLessThanOrEqual(h.s + 0.01);
    expect(v.fahrzeuge[0].tempo).toBe(0);
  });
});
