import { describe, expect, it } from "vitest";
import { neuesProjekt, zusammensetzen } from "@/lib/pixel/dokument";
import { bildEinfuegen, drehen90 } from "@/lib/pixel/werkzeuge";
import { gif } from "@/lib/pixel/export";
import { bewegungEinfuegen, bewegungsBild, gedreht, STANDARD_BEWEGUNG } from "@/lib/pixel/animation";
import { farbeAendern, farbrampe, modifierAnwenden, umrissMaske } from "@/lib/pixel/modifier";
import { aufPalette, bereichSchieben, einbacken, inseln, inselnOrdnen, inselnZuBildern, sheetZuBildern } from "@/lib/pixel/befehle";
import { gifLesen, gifZuProjekt } from "@/lib/pixel/gifLesen";

describe("Pixel-Studio: Bewegung aus einem Bild", () => {
  const punkt = () => { const z = new Uint8Array(64); z[3 * 8 + 3] = 1; return z; };

  it("verschieben mit und ohne Umlauf", () => {
    const o = { ...STANDARD_BEWEGUNG, art: "verschieben" as const, bilder: 4, dx: 8, dy: 0 };
    expect(bewegungsBild(punkt(), 8, 8, o, 1)[3 * 8 + 5]).toBe(1);
    expect(bewegungsBild(punkt(), 8, 8, o, 3)[3 * 8 + 1]).toBe(1);
    expect(bewegungsBild(punkt(), 8, 8, { ...o, umlauf: false }, 3).some(v => v)).toBe(false);
  });

  it("hüpfen hebt in der Mitte am höchsten", () => {
    const o = { ...STANDARD_BEWEGUNG, art: "huepfen" as const, bilder: 4, weite: 2 };
    expect(bewegungsBild(punkt(), 8, 8, o, 2)[1 * 8 + 3]).toBe(1);
  });

  it("drehen um 90° gleicht dem exakten Drehen", () => {
    const z = new Uint8Array(16); z[0] = 1; z[1] = 2; z[5] = 3;
    expect([...gedreht(z, 4, 4, 90)]).toEqual([...drehen90(z, 4, 4)]);
  });

  it("blinken, ausblenden, Farbzyklus", () => {
    const voll = new Uint8Array(16).fill(1);
    const o = { ...STANDARD_BEWEGUNG, bilder: 4 };
    expect(bewegungsBild(voll, 4, 4, { ...o, art: "blinken" }, 2).some(v => v)).toBe(false);
    expect(bewegungsBild(voll, 4, 4, { ...o, art: "ausblenden" }, 0).every(v => v)).toBe(true);
    expect(bewegungsBild(voll, 4, 4, { ...o, art: "ausblenden" }, 3).some(v => v)).toBe(false);
    expect(bewegungsBild(voll, 4, 4, { ...o, art: "ausblenden", bilder: 3 }, 1).filter(v => v)).toHaveLength(8);
    const bunt = new Uint8Array([1, 2, 3, 5]);
    expect([...bewegungsBild(bunt, 4, 1, { ...o, art: "farbzyklus", farbVon: 1, farbBis: 3, bilder: 3 }, 1)]).toEqual([2, 3, 1, 5]);
  });

  it("fügt Bilder ein, bewegt nur gewählte Ebenen und setzt einen Tag", () => {
    const p = neuesProjekt(8, 8);
    const fig = p.ebenen[0].id;
    p.ebenen.push({ id: "hg", name: "Hintergrund", sichtbar: true, deckkraft: 1 });
    p.zellen.hg = [new Uint8Array(64).fill(2)];
    p.zellen[fig][0][27] = 1;
    bildEinfuegen(p, 0, true);
    p.tags.push({ name: "alt", von: 1, bis: 1 });
    const n = bewegungEinfuegen(p, 0, [fig], { ...STANDARD_BEWEGUNG, art: "verschieben", bilder: 4, dx: 4, dy: 0 }, 80, "gleiten");
    expect(n).toBe(4);
    expect(p.bilder).toHaveLength(5);
    expect(p.zellen[fig][1][28]).toBe(1);
    expect(p.zellen.hg[3].every(v => v === 2)).toBe(true);
    expect(p.tags).toContainEqual({ name: "gleiten", von: 0, bis: 3 });
    expect(p.tags.find(t => t.name === "alt")).toMatchObject({ von: 4, bis: 4 });
    expect(p.bilder[2].dauer).toBe(80);
  });
});

describe("Pixel-Studio: Modifier", () => {
  it("Farbton um 180° macht aus Rot Cyan, Helligkeit −100 Schwarz", () => {
    const neutral = { farbton: 0, saettigung: 0, helligkeit: 0, kontrast: 0 };
    expect(farbeAendern(255, 0, 0, { ...neutral, farbton: 180 })).toEqual([0, 255, 255]);
    expect(farbeAendern(200, 100, 50, { ...neutral, helligkeit: -100 })).toEqual([0, 0, 0]);
  });

  it("Umriss außen und innen", () => {
    const b = new Uint8Array(25); b[12] = 1;
    expect(umrissMaske(b, 5, 5, 1, false).filter(v => v)).toHaveLength(8);
    expect(umrissMaske(b, 5, 5, 2, false).filter(v => v)).toHaveLength(24);
    const voll = new Uint8Array(25).fill(1);
    expect(umrissMaske(voll, 5, 5, 1, true).filter(v => v)).toHaveLength(16);
  });

  it("wirkt beim Zusammensetzen, ohne die Pixel zu ändern, und lässt sich einbacken", () => {
    const p = neuesProjekt(3, 3, ["#ff0000"]);
    const id = p.ebenen[0].id;
    p.zellen[id][0][4] = 1;
    p.ebenen[0].mods = [{ id: "u", art: "umriss", an: true, lage: "aussen", farbe: "#0000ff", breite: 1, deckkraft: 100 }];
    const rgba = zusammensetzen(p, 0);
    expect([rgba[0], rgba[2], rgba[3]]).toEqual([0, 255, 255]);
    expect(p.zellen[id][0].filter(v => v)).toHaveLength(1);
    einbacken(p, id);
    expect(p.palette).toEqual(["#ff0000", "#0000ff"]);
    expect(p.zellen[id][0].filter(v => v === 2)).toHaveLength(8);
    expect(p.ebenen[0].mods).toEqual([]);
  });

  it("Farbton und Deckkraft zusammen", () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255]);
    modifierAnwenden(rgba, 1, 1, [{ id: "f", art: "farbe", an: true, farbton: 120, saettigung: 0, helligkeit: 0, kontrast: 0, deckkraft: 50 }]);
    expect([...rgba]).toEqual([0, 255, 0, 128]);
  });

  it("Farbrampe: dunkel → hell, Mitte ist die Grundfarbe", () => {
    const r = farbrampe("#3b5dc9", 2);
    expect(r).toHaveLength(5);
    expect(r[2]).toBe("#3b5dc9");
    const hell = (h: string) => parseInt(h.slice(1, 3), 16) + parseInt(h.slice(3, 5), 16) + parseInt(h.slice(5, 7), 16);
    expect(hell(r[0])).toBeLessThan(hell(r[2]));
    expect(hell(r[4])).toBeGreaterThan(hell(r[2]));
  });
});

describe("Pixel-Studio: Befehle", () => {
  // drei Inseln: 2×2 oben links, 1×3 oben rechts, Punkt unten
  const bild = () => {
    const z = new Uint8Array(100);
    for (const i of [0, 1, 10, 11, 8, 18, 28, 75]) z[i] = 1;
    return z;
  };

  it("findet Inseln in Lesereihenfolge", () => {
    expect(inseln(bild(), 10, 10)).toEqual([{ x: 0, y: 0, w: 2, h: 2 }, { x: 8, y: 0, w: 1, h: 3 }, { x: 5, y: 7, w: 1, h: 1 }]);
  });

  it("ordnet Inseln in ein Raster", () => {
    const z = inselnOrdnen(bild(), 10, 10, 1)!;
    expect(inseln(z, 10, 10).map(r => [r.x, r.y])).toEqual([[0, 0], [3, 0], [6, 0]]);
    expect(z.filter(v => v)).toHaveLength(8);
  });

  it("Inseln und Sprite-Sheets werden Bilder", () => {
    const p = neuesProjekt(10, 10);
    p.zellen[p.ebenen[0].id][0] = bild();
    const q = inselnZuBildern(p, p.ebenen[0].id, 0)!;
    expect([q.breite, q.hoehe, q.bilder.length]).toEqual([2, 3, 3]);
    // der Punkt sitzt unten (mittig gerundet nach links)
    expect(q.zellen[q.ebenen[0].id][2][2 * 2]).toBe(1);
    expect(sheetZuBildern(bild(), 10, 10, p.palette, 5, 5)!.bilder).toHaveLength(3);
    expect(sheetZuBildern(bild(), 10, 10, p.palette, 5, 5, false)!.bilder).toHaveLength(4);
  });

  it("aufPalette nimmt neue Farben auf, bereichSchieben läuft im Bereich um", () => {
    const p = neuesProjekt(2, 1, ["#ff0000"]);
    expect([...aufPalette(p, new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255]))]).toEqual([1, 2]);
    expect(p.palette).toEqual(["#ff0000", "#00ff00"]);
    const r = new Uint8Array([1, 2, 3, 4, 9, 9]);
    bereichSchieben(r, 3, { x: 0, y: 0, w: 2, h: 2 }, 1, 0);
    expect([...r]).toEqual([2, 1, 3, 9, 4, 9]);
  });
});

describe("Pixel-Studio: GIF lesen", () => {
  it("liest das eigene GIF zurück (Bilder, Dauer, Durchsichtiges)", () => {
    const p = neuesProjekt(6, 4, ["#ff0000", "#00ff00", "#0000ff"]);
    const id = p.ebenen[0].id;
    p.zellen[id][0].set([1, 2, 3, 0, 1, 2]);
    bildEinfuegen(p, 0, false);
    p.zellen[id][1].fill(2, 6, 12);
    p.bilder[1].dauer = 250;
    const g = gifLesen(gif(p));
    expect([g.breite, g.hoehe, g.bilder.length]).toEqual([6, 4, 2]);
    expect(g.bilder[1].dauer).toBe(250);
    expect([...g.bilder[0].rgba.slice(0, 4)]).toEqual([255, 0, 0, 255]);
    expect(g.bilder[0].rgba[3 * 4 + 3]).toBe(0);
    // Entsorgung 2: Bild 2 zeigt nicht mehr den Inhalt von Bild 1
    expect(g.bilder[1].rgba[3]).toBe(0);
    const q = gifZuProjekt(g);
    expect(q.bilder).toHaveLength(2);
    expect(q.palette).toHaveLength(3);
  });

  it("liest auch größere GIFs mit vielen Farben", () => {
    const pal = Array.from({ length: 200 }, (_, k) => `#${((k * 2654435) & 0xffffff).toString(16).padStart(6, "0")}`);
    const p = neuesProjekt(60, 50, pal);
    const id = p.ebenen[0].id;
    for (let i = 0; i < 3000; i++) p.zellen[id][0][i] = 1 + ((i * 7919) % 200);
    const g = gifLesen(gif(p));
    const rgba = zusammensetzen(p, 0);
    expect([...g.bilder[0].rgba]).toEqual([...rgba]);
  });
});
