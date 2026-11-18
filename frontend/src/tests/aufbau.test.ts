import { describe, expect, it } from "vitest";
import { erzeuge } from "@/lib/gelaende/gelaende";
import { besterPunkt, baubar } from "@/lib/stadt/hilfen";
import { flussAbstand } from "@/lib/stadt/standort";
import { BAUPLAENE } from "@/lib/stadt/bauen";
import { BAU, baue, FREI, fussabdruck, HAUS, neueWelt, pruefePlatz, reichweite, schritt, stufe, versorgungBei, mitteVon } from "@/lib/stadt/aufbau";

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
      expect(Math.hypot((h.i + 1) * g.zelle - markt.x, (h.j + 1) * g.zelle - markt.y)).toBeLessThanOrEqual(reichweite("markt") + 1);
      for (const [a, c] of [[0, 0], [1, 1]]) expect(w.feld[(h.j + c) * w.n + h.i + a]).toBe(HAUS);
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
});
