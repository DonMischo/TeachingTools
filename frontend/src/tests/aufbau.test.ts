import { describe, expect, it } from "vitest";
import { erzeuge } from "@/lib/gelaende/gelaende";
import { besterPunkt, baubar } from "@/lib/stadt/hilfen";
import { flussAbstand } from "@/lib/stadt/standort";
import { BAUPLAENE } from "@/lib/stadt/bauen";
import { BAU, baue, bruecken, FREI, fussabdruck, HAUPT, HAUS, hausMitte, nasseAue, neueWelt, pruefePlatz, reichweite, schritt, STRASSE, strassenKetten, stufe, trockenlegen, versorgungBei, mitteVon } from "@/lib/stadt/aufbau";

const g = erzeuge({ art: "flusstal", seed: 12, fluss: true, relief: 1 });
const m = besterPunkt(g, 600, p => (baubar(g, p, 4) ? -Math.abs(flussAbstand(g, p) - 250) : -1e9))!;
const zelle = (p: { x: number; y: number }) => [Math.floor(p.x / g.zelle), Math.floor(p.y / g.zelle)] as const;

describe("Aufbau auf dem Raster", () => {
  it("Gebäude belegen ihre Felder, doppelt bauen geht nicht", () => {
    const w = neueWelt(g, "europaeisch", 1);
    const [i, j] = zelle(m);
    const b = baue(g, w, "markt", i, j)!;
    expect(b).toBeTruthy();
    const { w: fw, h: fh } = fussabdruck("markt");
    expect(w.feld[(j + fh - 1) * w.n + i + fw - 1]).toBe(BAU);
    expect(pruefePlatz(g, w, "kirche", i, j).ok).toBe(false);
  });

  it("Häuser wachsen feldgenau im Einzugsbereich an Straßen, Land wird freigeschaltet", () => {
    const w = neueWelt(g, "europaeisch", 1);
    const [i, j] = zelle(m);
    baue(g, w, "markt", i, j);
    // vor dem ersten Gebäude war alles frei, jetzt nur noch der Kreis
    expect(w.frei.reduce((a, x) => a + x, 0)).toBeLessThan(w.n * w.n / 4);
    for (let t = 0; t < 120; t++) schritt(g, w);
    expect(w.haeuser.length).toBeGreaterThan(30);
    const markt = mitteVon(w, w.bauten[0]);
    for (const h of w.haeuser) {
      const hm = hausMitte(w, h);
      expect(Math.hypot(hm.x - markt.x, hm.y - markt.y)).toBeLessThanOrEqual(reichweite("markt") + 1);
      expect(h.s).toBe(3); // europäisch: Höfe
      for (const [a, c] of [[0, 0], [2, 2]]) expect(w.feld[(h.j + c) * w.n + h.i + a]).toBe(HAUS);
      // nicht in der nassen Aue
      for (const [a, c] of [[0, 0], [2, 2]]) expect(nasseAue(g, w, (h.j + c) * w.n + h.i + a)).toBe(false);
    }
    expect(w.einwohner).toBeGreaterThan(0);
    expect(w.feld.some(f => f === FREI)).toBe(true);
  });

  it("mit allen Pflichtbauten erreicht die Stadt die nächste Stufe, versorgte Häuser sind größer", () => {
    const w = neueWelt(g, "europaeisch", 2);
    let [i, j] = zelle(m);
    for (let y = j - 80; y < j + 80; y += 2) for (let x = i - 80; x < i + 80; x += 2) if (pruefePlatz(g, w, "markt", x, y).faktor === 1) { i = x; j = y; y = 1e9; break; }
    expect(pruefePlatz(g, w, "markt", i, j).faktor).toBe(1);
    baue(g, w, "markt", i, j);
    // bester erlaubter Platz für die Burg in der Nähe
    let best: [number, number, number] | null = null;
    for (let y = j - 60; y < j + 60; y += 2) for (let x = i - 60; x < i + 60; x += 2) {
      const pr = pruefePlatz(g, w, "burg", x, y);
      if (pr.ok && (!best || pr.faktor > best[2])) best = [x, y, pr.faktor];
    }
    expect(best).toBeTruthy();
    expect(baue(g, w, "burg", best![0], best![1])).toBeTruthy();
    for (let t = 0; t < 600 && stufe(w) === 0; t++) schritt(g, w);
    expect(stufe(w)).toBe(1);
    expect(BAUPLAENE.europaeisch.stufen[1].ab).toBeLessThanOrEqual(w.einwohner);
    const gut = w.haeuser.filter(h => h.versorgt === 1), schlecht = w.haeuser.filter(h => h.versorgt < 1);
    if (gut.length && schlecht.length) expect(Math.max(...gut.map(h => h.ziel))).toBeGreaterThan(Math.min(...schlecht.map(h => h.ziel)));
    expect(versorgungBei(w, i, j)).toBeGreaterThan(0);
  });

  it("gedrehte Gebäude tauschen Breite und Tiefe", () => {
    const a = fussabdruck("kirche", 0), b = fussabdruck("kirche", 1);
    expect([b.w, b.h]).toEqual([a.h, a.w]);
    const w = neueWelt(g, "europaeisch", 3);
    const [i, j] = zelle(m);
    const o = baue(g, w, "markt", i, j, 1)!;
    expect(o.dreh).toBe(1);
    expect([o.w, o.h]).toEqual([fussabdruck("markt", 1).w, fussabdruck("markt", 1).h]);
  });

  it("Straßenketten verbinden Kreuzungen, Treppen werden geglättet", () => {
    const w = neueWelt(g, "europaeisch", 1);
    const [i, j] = zelle(m);
    baue(g, w, "markt", i, j);
    for (let t = 0; t < 80; t++) schritt(g, w);
    const { ketten, knoten } = strassenKetten(w);
    expect(ketten.length).toBeGreaterThan(5);
    expect(knoten.length).toBeGreaterThan(2);
    // geglättet: es gibt Kettenpunkte, die nicht auf Feldmitten liegen
    expect(ketten.some(k => k.punkte.some(p => Math.abs(((p.x / g.zelle) % 1) - 0.5) > 0.05))).toBe(true);
  });

  it("Trockenlegen macht Aue bebaubar, nur erschlossene", () => {
    const w = neueWelt(g, "europaeisch", 4);
    const k = g.aue.findIndex((a, kk) => a === 1 && !g.wasser[kk]);
    const x = (k % g.n + 0.5) * g.zelle, y = (Math.floor(k / g.n) + 0.5) * g.zelle;
    expect(nasseAue(g, w, k)).toBe(true);
    expect(trockenlegen(g, w, x, y)).toBeGreaterThan(0);
    expect(nasseAue(g, w, k)).toBe(false);
    expect(trockenlegen(g, w, x, y)).toBe(0);
  });

  it("eine Straße am Ufer bekommt eine Brücke, wenn das andere Ufer nah ist", () => {
    const w = neueWelt(g, "europaeisch", 5);
    // schmale Flussstelle suchen: Land – Wasser (≤ 8 Felder) – Land in x-Richtung
    let start = -1;
    for (let k = g.n * 100; k < g.n * (g.n - 100) && start < 0; k++) {
      const i = k % g.n;
      if (i < 20 || i > g.n - 30 || g.wasser[k] || !g.wasser[k + 1]) continue;
      let l = 1; while (l <= 8 && g.wasser[k + l]) l++;
      if (l <= 8 && !g.wasser[k + l]) start = k;
    }
    expect(start).toBeGreaterThan(0);
    w.feld[start] = STRASSE;
    bruecken(g, w);
    expect(g.wasser[start + 1] > 0 && (w.feld[start + 1] === STRASSE || w.feld[start + 1] === HAUPT)).toBe(true);
    expect(w.bruecken.length).toBe(1);
  });
});
