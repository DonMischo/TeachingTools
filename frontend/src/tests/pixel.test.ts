import { describe, expect, it } from "vitest";
import { ausDaten, dekodiere, kodiere, neuesProjekt, zuDaten, zusammensetzen } from "@/lib/pixel/dokument";
import { bildEinfuegen, bildLoeschen, drehenProjekt, ebeneVerschmelzen, ellipse, farbeEntfernen, fuellen, leinwandGroesse, linie, quantisieren, rechteck, schatten, skalieren, spiegelnH, umriss, verschieben } from "@/lib/pixel/werkzeuge";
import { gif, spriteSheet } from "@/lib/pixel/export";

/** GIF-Bilddaten zurücklesen (nur was gif() schreibt: globale Palette, Bilder ohne lokale Palette) */
function gifBilder(b: Uint8Array) {
  const w = b[6] | (b[7] << 8), h = b[8] | (b[9] << 8), tiefe = (b[10] & 7) + 1;
  let i = 13 + 3 * (1 << tiefe);
  const bilder: number[][] = [];
  while (b[i] !== 0x3b) {
    if (b[i] === 0x21) { i += 2; while (b[i]) i += b[i] + 1; i++; continue; }
    expect(b[i]).toBe(0x2c);
    i += 10;
    const min = b[i++];
    const daten: number[] = [];
    while (b[i]) { daten.push(...b.slice(i + 1, i + 1 + b[i])); i += b[i] + 1; }
    i++;
    // LZW zurück
    const clear = 1 << min, ende = clear + 1;
    let breite = min + 1, tab: number[][] = [], prev: number[] | null = null, pos = 0;
    const aus: number[] = [];
    const reset = () => { tab = []; for (let k = 0; k < clear; k++) tab[k] = [k]; tab[clear] = []; tab[ende] = []; breite = min + 1; prev = null; };
    reset();
    for (;;) {
      let code = 0;
      for (let k = 0; k < breite; k++, pos++) code |= ((daten[pos >> 3] >> (pos & 7)) & 1) << k;
      if (code === clear) { reset(); continue; }
      if (code === ende) break;
      let eintrag: number[];
      if (code < tab.length) eintrag = tab[code];
      else eintrag = [...prev!, prev![0]];
      aus.push(...eintrag);
      if (prev) tab.push([...prev, eintrag[0]]);
      prev = eintrag;
      if (tab.length === (1 << breite) && breite < 12) breite++;
    }
    bilder.push(aus);
  }
  return { w, h, bilder };
}

describe("Pixel-Studio: Dokument", () => {
  it("kodiert Zellen verlustfrei und kurz", () => {
    const z = new Uint8Array(1024);
    z.fill(3, 10, 400); z[1000] = 7;
    const s = kodiere(z);
    expect(s.length).toBeLessThan(40);
    expect(dekodiere(s, 1024)).toEqual(z);
    expect(kodiere(new Uint8Array(64))).toBe("");
  });

  it("speichert und lädt ein Projekt mit Ebenen und Bildern", () => {
    const p = neuesProjekt(8, 8);
    const id = p.ebenen[0].id;
    p.zellen[id][0][9] = 2;
    bildEinfuegen(p, 0, true);
    p.zellen[id][1][10] = 5;
    const q = ausDaten(JSON.parse(JSON.stringify(zuDaten(p))));
    expect(q.bilder).toHaveLength(2);
    expect(q.zellen[id][0][9]).toBe(2);
    expect(q.zellen[id][1][9]).toBe(2);
    expect(q.zellen[id][1][10]).toBe(5);
  });

  it("legt Ebenen mit Deckkraft übereinander", () => {
    const p = neuesProjekt(2, 1, ["#ff0000", "#0000ff"]);
    p.ebenen.push({ id: "b", name: "oben", sichtbar: true, deckkraft: 0.5 });
    p.zellen.b = [new Uint8Array([2, 0])];
    p.zellen[p.ebenen[0].id][0].set([1, 1]);
    const rgba = zusammensetzen(p, 0);
    expect([rgba[0], rgba[2], rgba[3]]).toEqual([128, 128, 255]);
    expect([rgba[4], rgba[6]]).toEqual([255, 0]);
  });
});

describe("Pixel-Studio: Werkzeuge", () => {
  it("Linie, Rechteck, Ellipse", () => {
    expect(linie(0, 0, 3, 1)).toHaveLength(4);
    expect(rechteck(0, 0, 2, 2, false)).toHaveLength(8);
    expect(rechteck(0, 0, 2, 2, true)).toHaveLength(9);
    const e = ellipse(0, 0, 6, 6, false);
    expect(e.length).toBeGreaterThan(12);
    expect(e.some(([x, y]) => x === 3 && y === 3)).toBe(false);
  });

  it("füllt zusammenhängend und global", () => {
    const z = new Uint8Array([0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0]);
    const a = z.slice(); fuellen(a, 4, 4, 0, 0, 5);
    expect([...a.slice(0, 2)]).toEqual([5, 5]);
    expect(a[3]).toBe(0);
    const b = z.slice(); fuellen(b, 4, 4, 0, 0, 5, true);
    expect(b.filter(v => v === 5)).toHaveLength(11);
  });

  it("Umriss, Schatten, Spiegeln, Verschieben", () => {
    const z = new Uint8Array(9); z[4] = 1;
    expect(umriss(z, 3, 3, 2).filter(v => v === 2)).toHaveLength(4);
    expect(umriss(z, 3, 3, 2, true).filter(v => v === 2)).toHaveLength(8);
    expect(schatten(z, 3, 3, 2)[8]).toBe(2);
    const r = new Uint8Array([1, 2, 3]);
    expect([...spiegelnH(r, 3, 1)]).toEqual([3, 2, 1]);
    expect([...verschieben(r, 3, 1, 1, 0)]).toEqual([3, 1, 2]);
  });

  it("Projektbefehle: drehen, Leinwand, skalieren, Farbe entfernen, Bilder, Ebenen", () => {
    const p = neuesProjekt(3, 2);
    const id = p.ebenen[0].id;
    p.zellen[id][0][0] = 1;
    drehenProjekt(p);
    expect([p.breite, p.hoehe]).toEqual([2, 3]);
    expect(p.zellen[id][0][1]).toBe(1);
    leinwandGroesse(p, 4, 5);
    expect(p.zellen[id][0][1 * 4 + 2]).toBe(1);
    skalieren(p, 8, 10);
    expect(p.zellen[id][0].filter(v => v === 1)).toHaveLength(4);
    farbeEntfernen(p, 1);
    expect(p.zellen[id][0].some(v => v)).toBe(false);
    bildEinfuegen(p, 0, false); bildEinfuegen(p, 1, false);
    p.tags.push({ name: "laufen", von: 1, bis: 2 });
    bildLoeschen(p, 0);
    expect(p.tags[0]).toMatchObject({ von: 0, bis: 1 });
    p.ebenen.push({ id: "o", name: "o", sichtbar: true, deckkraft: 1 });
    p.zellen.o = p.bilder.map(() => { const z = new Uint8Array(80); z[0] = 2; return z; });
    ebeneVerschmelzen(p, 1);
    expect(p.ebenen).toHaveLength(1);
    expect(p.zellen[id][1][0]).toBe(2);
  });

  it("setzt Bilder auf eine Palette um", () => {
    const rgba = new Uint8ClampedArray([250, 0, 0, 255, 0, 0, 250, 255, 0, 0, 0, 0]);
    const neu = quantisieren(rgba, [], true);
    expect(neu.palette).toHaveLength(2);
    expect([...neu.zelle]).toEqual([1, 2, 0]);
    const alt = quantisieren(rgba, ["#0000ff", "#ff0000"], false);
    expect([...alt.zelle]).toEqual([2, 1, 0]);
  });
});

describe("Pixel-Studio: Ausgabe", () => {
  it("GIF lässt sich zurücklesen, auch mit vielen Farben und Tabellen-Reset", () => {
    const p = neuesProjekt(40, 40, Array.from({ length: 200 }, (_, k) => `#${(k * 1234567 % 0xffffff).toString(16).padStart(6, "0")}`));
    const id = p.ebenen[0].id;
    for (let i = 0; i < 1600; i++) p.zellen[id][0][i] = (i * 7919) % 201;
    bildEinfuegen(p, 0, false);
    p.zellen[id][1].fill(3);
    const g = gifBilder(gif(p, 2));
    expect([g.w, g.h]).toEqual([80, 80]);
    expect(g.bilder).toHaveLength(2);
    expect(g.bilder[0][0]).toBe(p.zellen[id][0][0]);
    expect(g.bilder[0][2 * 80 + 4]).toBe(p.zellen[id][0][40 + 2]);
    expect(g.bilder[1].every(v => v === 3)).toBe(true);
  });

  it("Sprite-Sheet-Raster", () => {
    const p = neuesProjekt(16, 8);
    for (let k = 0; k < 4; k++) bildEinfuegen(p, k, false);
    const s = spriteSheet(p, 2);
    expect([s.breite, s.hoehe]).toEqual([32, 24]);
    expect(s.bilder[3]).toMatchObject({ x: 16, y: 8 });
  });
});
