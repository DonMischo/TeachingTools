import { describe, expect, it } from "vitest";
import { Konvektion, viskositaetAusRa } from "@/lib/erde/konvektion";

const fest = () => { let s = 1; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };
const klein = { nx: 40, nz: 16, seiten: 2.5 };

describe("Mantelkonvektion", () => {
  it("heißes Gestein steigt auf, kaltes sinkt", () => {
    const k = new Konvektion({ ...klein, ra: 1e5, kernHeizt: false }, fest());
    k.T.fill(0.5);
    k.heizeFleck(1.25, 0.5, 0.5, 0.1);
    k.stokes();
    expect(k.geschwindigkeit(1.25, 0.5)[1]).toBeGreaterThan(0);
    k.T.fill(0.5);
    k.heizeFleck(1.25, 0.5, -0.5, 0.1);
    k.stokes();
    expect(k.geschwindigkeit(1.25, 0.5)[1]).toBeLessThan(0);
  });

  it("unter der kritischen Rayleigh-Zahl (≈ 657) bleibt es bei Wärmeleitung", () => {
    const k = new Konvektion({ ...klein, ra: 300 }, fest());
    for (let i = 0; i < 400; i++) k.schritt();
    expect(k.maxTempo()).toBeLessThan(0.5);
    expect(k.nusselt()).toBeCloseTo(1, 1);
  });

  it("darüber setzt Konvektion ein und transportiert mehr Wärme", () => {
    const k = new Konvektion({ ...klein, ra: 2e4 }, fest());
    for (let i = 0; i < 1500; i++) k.schritt();
    expect(k.maxTempo()).toBeGreaterThan(10);
    expect(k.nusselt()).toBeGreaterThan(2);
  });

  it("ein Kontinent als Deckel staut die Wärme unter sich", () => {
    const ohne = new Konvektion({ ...klein, ra: 2e4, kernHeizt: false, zerfall: 8 }, fest());
    const mit = new Konvektion({ ...klein, ra: 2e4, kernHeizt: false, zerfall: 8, deckel: [0.3, 0.7] }, fest());
    for (let i = 0; i < 1500; i++) { ohne.schritt(); mit.schritt(); }
    const unter = (k: Konvektion) => k.temperatur(1.25, 0.9);
    expect(unter(mit)).toBeGreaterThan(unter(ohne) + 0.05);
  });

  it("die Rayleigh-Zahl des echten Mantels passt zu 10²¹–10²² Pa·s", () => {
    expect(Math.log10(viskositaetAusRa(1e7))).toBeGreaterThan(21);
    expect(Math.log10(viskositaetAusRa(1e7))).toBeLessThan(22);
  });
});
