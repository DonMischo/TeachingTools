import { describe, expect, it } from "vitest";
import { Stroemung } from "@/lib/stroemung/loeser";
import { G, P_LUFT, type Knoten, type Medium, type Teil } from "@/lib/stroemung/modell";

const netz = (knoten: Knoten[], teile: Teil[], medium: Medium = "wasser") => new Stroemung({ medium, knoten, teile });
const k = (id: string, z = 0): Knoten => ({ id, z });
const rohr = (id: string, a: string, b: string, durchmesser: number, laenge = 1, turbulent = false): Teil =>
  ({ id, art: "rohr", a, b, durchmesser, laenge, turbulent });
/** Hagen-Poiseuille, zum Nachrechnen. */
const rLaminar = (d: number, l: number, eta = 1e-3) => 128 * eta * l / (Math.PI * d ** 4);

describe("Druck & Strömung — Löser", () => {
  it("Schweredruck: im Wasser 10 m tiefer rund 1 bar mehr, in Luft fast nichts", () => {
    for (const [medium, rho] of [["wasser", 1000], ["luft", 1.2]] as const) {
      const s = netz([k("unten", 0), k("oben", 10)], [
        { id: "q", art: "druckquelle", a: "unten", druck: 2e5 },
        rohr("r", "unten", "oben", 0.02, 10),
      ], medium);
      s.schritt(0.01);
      expect(s.druck("unten")).toBeCloseTo(2e5, 0);
      expect(s.druck("oben")).toBeCloseTo(2e5 - rho * G * 10, 0);
      expect(s.fluss("r")).toBeCloseTo(0, 9);
    }
  });

  it("kommunizierende Röhren: die Spiegel gleichen sich aus, das Wasser bleibt erhalten", () => {
    const s = netz([k("l"), k("r")], [
      { id: "L", art: "behaelter", a: "l", flaeche: 0.01, hoehe: 2, fuellung: 1.0 },
      { id: "R", art: "behaelter", a: "r", flaeche: 0.01, hoehe: 2, fuellung: 0.2 },
      rohr("rohr", "l", "r", 0.01),
    ]);
    s.laufe(60, 0.05);
    expect(s.zustand("L")).toBeCloseTo(0.6, 3);
    expect(s.zustand("R")).toBeCloseTo(0.6, 3);
    expect(s.zustand("L") + s.zustand("R")).toBeCloseTo(1.2, 9);
  });

  it("Behälter füllt sich exponentiell mit τ = R·C (C = A/ρg)", () => {
    const d = 0.01, A = 0.01;
    const tau = rLaminar(d, 1) * A / (1000 * G);
    const s = netz([k("q"), k("t")], [
      { id: "quelle", art: "druckquelle", a: "q", druck: 1000 * G },   // 1 m Wassersäule
      rohr("r", "q", "t", d),
      { id: "tank", art: "behaelter", a: "t", flaeche: A, hoehe: 2, fuellung: 0 },
    ]);
    s.laufe(tau, tau / 2000);
    expect(s.zustand("tank")).toBeCloseTo(1 - Math.exp(-1), 2);
    s.laufe(20 * tau, tau / 200);
    expect(s.zustand("tank")).toBeCloseTo(1, 3);
  });

  it("Pascal: Kolben bewegen sich, bis F/A gleich ist — Volumen wandert von klein nach groß", () => {
    const A1 = 1e-4, A2 = 1e-2;
    const presse = (F2: number) => netz([k("a"), k("b")], [
      { id: "klein", art: "zylinder", a: "a", flaeche: A1, hub: 0.2, kraft: 100, weg: 0.1 },  // 10 bar
      { id: "gross", art: "zylinder", a: "b", flaeche: A2, hub: 0.2, kraft: F2, weg: 0.05 },
      rohr("r", "a", "b", 0.001, 1.2),
    ]);
    const s = presse(5000);  // 5 bar — der kleine Kolben gewinnt
    s.laufe(0.5, 0.001);
    const dx1 = s.zustand("klein") - 0.1, dx2 = s.zustand("gross") - 0.05;
    expect(dx1).toBeLessThan(-0.01);
    expect(A1 * dx1 + A2 * dx2).toBeCloseTo(0, 12);
    // Gleiches F/A: 100 N auf 1 cm² hält 10 000 N auf 100 cm²
    const gleich = presse(10000);
    gleich.laufe(0.5, 0.001);
    expect(gleich.zustand("klein")).toBeCloseTo(0.1, 9);
    expect(gleich.zustand("gross")).toBeCloseTo(0.05, 9);
  });

  it("Zylinder fährt nur aus, wenn der Druck die Last trägt", () => {
    const zyl = (kraft: number) => {
      const s = netz([k("q"), k("z")], [
        { id: "quelle", art: "druckquelle", a: "q", druck: 6e5 },
        { id: "v", art: "drossel", a: "q", b: "z", widerstand: 1e8 },
        { id: "zyl", art: "zylinder", a: "z", flaeche: 1e-3, hub: 0.1, kraft, weg: 0 },
      ]);
      s.laufe(2, 0.01);
      return s.zustand("zyl");
    };
    expect(zyl(500)).toBeCloseTo(0.1, 6);   // 5 bar Last < 6 bar: ganz aus
    expect(zyl(700)).toBe(0);               // 7 bar Last: bewegt sich nicht
  });

  it("Knotenregel, r⁴-Gesetz und Energiebilanz im Kreislauf mit Pumpe", () => {
    const s = netz([k("u"), k("o"), k("k1"), k("k2")], [
      { id: "pumpe", art: "pumpe", a: "u", b: "o", foerderdruck: 2e5, maxFluss: 1e-3 },
      rohr("zu", "o", "k1", 0.02),
      rohr("duenn", "k1", "k2", 0.01),
      rohr("dick", "k1", "k2", 0.02),
      rohr("rueck", "k2", "u", 0.02),
      { id: "system", art: "druckquelle", a: "u", druck: 1e5 },
    ]);
    s.schritt(0.01);
    const q = (id: string) => s.fluss(id);
    expect(q("zu")).toBeGreaterThan(0);
    expect(q("pumpe")).toBeCloseTo(q("zu"), 12);
    expect(q("duenn") + q("dick")).toBeCloseTo(q("zu"), 12);
    expect(q("rueck")).toBeCloseTo(q("zu"), 12);
    expect(q("dick") / q("duenn")).toBeCloseTo(16, 6);
    // Der Systemdruck hält nur das Niveau — durch ihn fließt (bis auf Rundung) nichts.
    expect(Math.abs(q("system"))).toBeLessThan(1e-5 * q("zu"));

    const dp = (a: string, b: string) => s.druck(a) - s.druck(b);
    const pumpLeistung = q("pumpe") * dp("o", "u");
    const reibung = q("zu") * dp("o", "k1") + q("duenn") * dp("k1", "k2") + q("dick") * dp("k1", "k2") + q("rueck") * dp("k2", "u");
    expect(reibung).toBeCloseTo(pumpLeistung, 6);
    // Pumpenkennlinie: Δp = p0·(1 − Q/qmax)
    expect(dp("o", "u")).toBeCloseTo(2e5 * (1 - q("pumpe") / 1e-3), 3);
  });

  it("turbulente Reibung: vierfacher Druck gibt nur etwa doppelten Durchfluss", () => {
    const fluss = (druck: number, turbulent: boolean) => {
      const s = netz([k("q"), k("o")], [
        { id: "quelle", art: "druckquelle", a: "q", druck },
        rohr("r", "q", "o", 0.02, 10, turbulent),
        { id: "hahn", art: "auslass", a: "o", widerstand: 1 },
      ]);
      s.schritt(0.01);
      return s.fluss("r");
    };
    const verh = fluss(4e5, true) / fluss(1e5, true);
    expect(verh).toBeGreaterThan(1.9);
    expect(verh).toBeLessThan(2.05);
    expect(fluss(4e5, false) / fluss(1e5, false)).toBeCloseTo(4, 4);
  });

  it("Rückschlagventil sperrt die Gegenrichtung", () => {
    const fluss = (a: string, b: string) => {
      const s = netz([k("q"), k("o")], [
        { id: "quelle", art: "druckquelle", a: "q", druck: 1e5 },
        { id: "rv", art: "rueckschlag", a, b, widerstand: 1e7 },
        { id: "hahn", art: "auslass", a: "o", widerstand: 1e7 },
      ]);
      s.schritt(0.01);
      return s.fluss("rv");
    };
    expect(fluss("q", "o")).toBeCloseTo(1e5 / 2e7, 9);
    expect(fluss("o", "q")).toBe(0);
  });

  it("Druckkessel (Luft) lädt sich monoton bis zum Netzdruck auf", () => {
    const s = netz([k("q"), k("k")], [
      { id: "netz", art: "druckquelle", a: "q", druck: 6e5 },
      { id: "v", art: "drossel", a: "q", b: "k", widerstand: 1e7 },
      { id: "kessel", art: "kessel", a: "k", volumen: 0.01, druck: 0 },
    ], "luft");
    let vorher = s.zustand("kessel");
    for (let i = 0; i < 400; i++) {
      s.laufe(0.5, 0.01);
      const p = s.zustand("kessel");
      expect(p).toBeGreaterThanOrEqual(vorher - 1e-6);
      expect(p).toBeLessThanOrEqual(6e5 + 1);
      vorher = p;
    }
    expect(vorher).toBeGreaterThan(0.99 * 6e5);
  });

  it("Gaspolster (Boyle): p·V der Luft bleibt gleich, unter dem Vordruck kommt kein Wasser hinein", () => {
    const polster = (druck: number) => {
      const s = netz([k("q"), k("p")], [
        { id: "netz", art: "druckquelle", a: "q", druck },
        rohr("r", "q", "p", 0.01),
        { id: "gefaess", art: "polster", a: "p", volumen: 0.01, vordruck: 1e5 },
      ]);
      let wasser = 0;
      for (let i = 0; i < 4000; i++) { s.schritt(0.01); wasser += s.fluss("gefaess") * 0.01; }
      return { s, wasser };
    };
    const { s, wasser } = polster(3e5);
    expect(s.zustand("gefaess")).toBeCloseTo(3e5, -1);
    // (1 bar + Luft)·V = (3 bar + Luft)·(V − Wasser)
    expect(wasser).toBeCloseTo(0.01 * (1 - (1e5 + P_LUFT) / (3e5 + P_LUFT)), 5);
    expect(polster(0.5e5).wasser).toBe(0);
  });
});
