import { describe, expect, it } from "vitest";
import { LEER, druckAn, editor, simulation, type Baukasten } from "@/lib/stroemung/baukasten";
import { BEISPIELE } from "@/lib/stroemung/baukastenBeispiele";
import { alsDatei, alsVorgabe, liesBaukasten, vorgabeAus } from "@/lib/stroemung/baukastenDatei";

const mitTeil = (bk: Baukasten, art: Parameters<typeof editor.fuegeBauteilHinzu>[1], ax: number, ay: number, bx: number, by: number, werte: Record<string, number> = {}) => {
  const r = editor.fuegeBauteilHinzu(bk, art, { x: ax, y: ay }, { x: bx, y: by });
  return editor.setzeWert(r.schaltung, r.id, Object.keys(werte)[0] ?? "x", Object.values(werte)[0] ?? 0);
};

describe("Baukasten → Löser", () => {
  it("senkrechte Leitung: unten mehr Druck als oben (1 Kästchen = 0,5 m)", () => {
    let bk: Baukasten = { ...LEER };
    bk = mitTeil(bk, "quelle", 0, 0, 0, -2, { druck: 2e5 });
    bk = editor.fuegeDrahtHinzu(bk, { x: 0, y: 0 }, { x: 0, y: 20 });   // 10 m nach unten
    bk = mitTeil(bk, "manometer", 0, 20, 2, 20);
    const s = simulation(bk);
    s.schritt(0.01);
    expect(druckAn(s, { x: 0, y: 20 }) - druckAn(s, { x: 0, y: 0 })).toBeCloseTo(1000 * 9.81 * 10, -1);
  });

  it("verbundene Behälter gleichen sich aus", () => {
    let bk: Baukasten = { ...LEER };
    bk = mitTeil(bk, "behaelter", 0, 0, 0, -4, { fuellung: 0.9 });
    bk = mitTeil(bk, "behaelter", 10, 0, 10, -4, { fuellung: 0.1 });
    bk = mitTeil(bk, "rohr", 0, 0, 10, 0, { durchmesser: 0.05 });
    const s = simulation(bk);
    s.laufe(600, 0.1);
    const [a, b] = bk.bauteile.filter(t => t.art === "behaelter").map(t => s.zustand(t.id));
    expect(a).toBeCloseTo(b, 3);
    expect(a + b).toBeCloseTo((0.9 + 0.1) * 2, 6);   // Behälter 4 Kästchen = 2 m hoch
  });

  it("Pumpe, Ventil, Durchflussmesser im Kreis: überall derselbe Durchfluss", () => {
    let bk: Baukasten = { ...LEER };
    bk = mitTeil(bk, "pumpe", 0, 4, 0, 0);
    bk = mitTeil(bk, "ventil", 0, 0, 6, 0, { oeffnung: 0.5 });
    bk = mitTeil(bk, "durchfluss", 6, 0, 6, 4);
    bk = editor.fuegeDrahtHinzu(bk, { x: 6, y: 4 }, { x: 0, y: 4 });
    bk = mitTeil(bk, "quelle", 0, 4, -2, 4, { druck: 1e5 });
    const s = simulation(bk);
    s.schritt(0.01);
    const [pumpe, ventil, messer] = ["pumpe", "ventil", "durchfluss"].map(a => s.fluss(bk.bauteile.find(t => t.art === a)!.id));
    expect(pumpe).toBeGreaterThan(0);
    expect(ventil / pumpe).toBeCloseTo(1, 6);
    expect(messer / pumpe).toBeCloseTo(1, 6);
  });
});

describe("Baukasten: Beispiele und Dateien", () => {
  it("jedes Beispiel rechnet ohne Fehler, und es fließt etwas (oder steht wie gewollt)", () => {
    for (const b of BEISPIELE) {
      const s = simulation(b.baukasten);
      s.laufe(5, 0.05);
      for (const t of b.baukasten.bauteile) expect(Number.isFinite(s.fluss(t.id)), `${b.id}/${t.id}`).toBe(true);
    }
  });

  it("Datei hin und zurück ergibt dasselbe Netz", () => {
    for (const b of BEISPIELE) {
      const r = liesBaukasten(JSON.parse(alsDatei(b.baukasten)));
      expect("baukasten" in r && r.baukasten.bauteile.length).toBe(b.baukasten.bauteile.length);
      expect("baukasten" in r && r.baukasten.medium).toBe(b.baukasten.medium);
    }
  });

  it("jede Vorgabe passt in die 4 kB der Sitzung und kommt heil zurück", () => {
    for (const b of BEISPIELE) {
      const settings = alsVorgabe(b.baukasten, "Baue das Netz um.");
      expect(JSON.stringify(settings).length, b.id).toBeLessThan(4000);
      const v = vorgabeAus(JSON.parse(JSON.stringify(settings)));
      expect(v?.baukasten.bauteile.length).toBe(b.baukasten.bauteile.length);
      expect(v?.aufgabe).toBe("Baue das Netz um.");
    }
  });

  it("Unsinn wird abgewiesen oder bereinigt", () => {
    expect("fehler" in liesBaukasten("hallo")).toBe(true);
    const r = liesBaukasten({ medium: "lava", bauteile: [{ art: "rakete", a: { x: 0, y: 0 }, b: { x: 1, y: 0 } }, { art: "quelle", a: { x: 0, y: 0 }, b: { x: 0, y: 2 }, werte: { druck: 1e9 } }], draehte: [] });
    expect("baukasten" in r).toBe(true);
    if ("baukasten" in r) {
      expect(r.baukasten.medium).toBe("wasser");
      expect(r.baukasten.bauteile).toHaveLength(1);
      expect(r.baukasten.bauteile[0].werte.druck).toBe(10e5);
    }
  });
});
