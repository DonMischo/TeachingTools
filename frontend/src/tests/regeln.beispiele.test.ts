import { describe, expect, it } from "vitest";
import {
  blockText, drehungen, laufeDurch, programm, programmText, regel, starte, zaehle, zusammenhaengend,
  type Raster,
} from "@/lib/regeln/maschine";
import { BEISPIELE } from "@/lib/regeln/beispiele";

const lauf = (id: string, seed = 1) => {
  const b = BEISPIELE.find(x => x.id === id)!;
  const p = programm(b.programm);
  const t0 = performance.now();
  const l = laufeDurch(p, starte(p, b.start, seed));
  return { l, r: l.raster, ms: performance.now() - t0 };
};

const zeile = (r: Raster, y: number) => r.z.slice(y * r.b, (y + 1) * r.b).join("");

describe("neue Bausteine der Maschine", () => {
  it("liest und schreibt Symmetrie, Chance, Gruppen, Pfad und Nachbarn", () => {
    const text = [
      "markov spiegel: U/P=P/E | UU/PU=UP/EE, U/G=P/G",
      "alle x1 p43: A=D",
      "pfad abstand: A → UG über E = G",
      "nachbarn x5: A=D bei 5-8 D, D=A bei 6 A",
      "eins fest: RB=WR",
    ].join("\n");
    const p = programm(text);
    expect(p.bloecke[0].sym).toBe("spiegel");
    expect(p.bloecke[0].regeln.map(r => !!r.oder)).toEqual([false, true, false]);
    expect(p.bloecke[1].p).toBeCloseTo(0.43);
    expect(p.bloecke[2].pfad).toEqual({ von: "A", nach: "UG", ueber: "E", male: "G", abstand: true });
    expect(p.bloecke[3].nachbarn?.[1]).toEqual({ aus: "D", ein: "A", min: 6, max: 6, zaehlt: "A" });
    expect(programm(programmText(p))).toEqual(p);
    expect(blockText(p.bloecke[4])).toBe("eins fest: RB=WR");
    expect(() => programm("eins quer: RB=WR")).toThrow();
  });

  it("Symmetrie: alle Lagen inkl. Spiegelbild, nur gespiegelt, oder fest", () => {
    const r = regel("RB/BB=GB/BB"); // Ecke — acht Lagen fallen auf vier zusammen
    expect(drehungen(r, "alle")).toHaveLength(4);
    // L-Form: vier Drehungen und deren Spiegelbilder sind alle verschieden
    const l = regel("RBB/BBB=GBB/BBB");
    expect(drehungen(l, "alle")).toHaveLength(8);
    const schief = regel("RB/BB/BB=GB/BB/BB");
    expect(drehungen(schief, "alle")).toHaveLength(8);
    expect(drehungen(schief, "spiegel")).toHaveLength(2);
    expect(drehungen(schief, "fest")).toHaveLength(1);
  });

  it("»fest« wächst nur in die angegebene Richtung", () => {
    const p = programm("eins fest: R/B=W/R");
    const l = starte(p, { b: 5, h: 5, grund: "B" }, 1);
    l.raster.z[2] = "R"; // oben Mitte
    laufeDurch(p, l);
    expect(l.raster.z.filter((c, i) => c !== "B" && i % 5 !== 2)).toHaveLength(0);
    expect(l.raster.z[4 * 5 + 2]).toBe("R");
  });

  it("markov-Gruppen: gleichrangige Regeln werden zufällig gemischt", () => {
    const p = programm("markov fest: RB=RG | BR=GR");
    const seiten = new Set<string>();
    for (let s = 1; s < 20; s++) {
      const l = starte(p, { b: 3, h: 1, grund: "B" }, s);
      l.raster.z[1] = "R";
      laufeDurch(p, l, 1);
      seiten.add(l.raster.z.join(""));
    }
    expect(seiten).toEqual(new Set(["BRG", "GRB"]));
  });

  it("Pfad verbindet über erlaubte Felder und färbt den Start in die Zielfarbe", () => {
    const p = programm("pfad: A → U über E = G");
    const l = starte(p, { b: 5, h: 3, grund: "E" }, 1);
    l.raster.z = [..."AEEEU" + "BBBBE" + "EEEEE"];
    laufeDurch(p, l);
    expect(zeile(l.raster, 0)).toBe("UGGGU");
  });

  it("Nachbarn: alle Zellen gleichzeitig (Blinker im Game of Life)", () => {
    const p = programm("nachbarn x1: B=W bei 3 W, W=B bei 0-1 W, W=B bei 4-8 W");
    const l = starte(p, { b: 5, h: 5, grund: "B" }, 1);
    for (const i of [11, 12, 13]) l.raster.z[i] = "W"; // waagerecht
    laufeDurch(p, l);
    expect([7, 12, 17].every(i => l.raster.z[i] === "W")).toBe(true);
    expect(zaehle(l.raster, "W")).toBe(3);
  });
});

describe("Beispielgalerie", () => {
  it("jedes Beispiel ist gültig und läuft zu Ende", () => {
    for (const b of BEISPIELE) {
      const { l, ms } = lauf(b.id);
      expect(l.fertig, b.id).toBe(true);
      expect(l.gesamt, b.id).toBeGreaterThan(0);
      expect(ms, `${b.id} zu langsam`).toBeLessThan(8000);
    }
  });

  it("Blumen: Erde, Rasen, Himmel, Stängel und Blüten", () => {
    const { r } = lauf("blumen");
    // Erde unten; die Stängel wurzeln eine Reihe tief (wie in MarkovJunior)
    expect(zeile(r, r.h - 1)).toBe("N".repeat(r.b));
    expect(zeile(r, r.h - 2)).toBe("N".repeat(r.b));
    expect(zeile(r, r.h - 3)).toMatch(/^[NE]+$/);
    expect(zeile(r, r.h - 4).replace(/E/g, "")).toMatch(/^G+$/);
    expect(zaehle(r, "E")).toBeGreaterThan(50);
    expect(zaehle(r, "Y")).toBeGreaterThan(8);
    expect(zeile(r, 0)).toMatch(/^[UYEP]+$/);
  });

  it("Höhle: große zusammenhängende Räume, Rand bleibt Fels", () => {
    const { r } = lauf("hoehle");
    expect(zeile(r, 0)).toBe("D".repeat(r.b));
    const hell = zaehle(r, "A") / r.z.length;
    expect(hell).toBeGreaterThan(0.25);
    expect(hell).toBeLessThan(0.8);
  });

  it("Platine: Chips, Leiterbahnen, angeschlossene und rote Anschlüsse", () => {
    const { r } = lauf("platine");
    expect(zaehle(r, "N")).toBe(7 * 16); // sieben Chips à 4×4
    expect(zaehle(r, "G")).toBeGreaterThan(40);
    expect(zaehle(r, "A")).toBeGreaterThan(8);
    expect(zaehle(r, "U")).toBe(0);
  });

  it("Verlies: Zimmer mit Türen, keine Sackgassen mehr", () => {
    const { r } = lauf("verlies");
    expect(zaehle(r, "U")).toBeGreaterThan(0);
    expect(zaehle(r, "Y")).toBeGreaterThan(0);
    // Ein Flurfeld mit drei Wänden, dessen offene Seite wieder Flur ist, gibt es nicht mehr.
    for (let y = 1; y < r.h - 1; y++) for (let x = 1; x < r.b - 1; x++) {
      if (r.z[y * r.b + x] !== "W") continue;
      const n = [r.z[(y - 1) * r.b + x], r.z[(y + 1) * r.b + x], r.z[y * r.b + x - 1], r.z[y * r.b + x + 1]];
      expect(n.filter(c => c === "B").length === 3 && n.includes("W")).toBe(false);
    }
    const flure = { ...r, z: r.z.map(c => (c === "W" || c === "U" || c === "Y" ? "W" : "B")) };
    expect(zusammenhaengend(flure, "W") || zaehle(r, "W") > 0).toBe(true);
  });
});
