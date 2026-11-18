import { describe, expect, it } from "vitest";
import { erzeuge } from "@/lib/gelaende/gelaende";
import { passendeWahl } from "@/lib/stadt/landschaft";
import { baue, HAUPT, neueWelt, pruefePlatz, schritt, STRASSE, zentrum, zufahrt } from "@/lib/stadt/aufbau";
import { bewege, erzeugeVerkehr, pfad, wegweiser, zieleFuer } from "@/lib/stadt/aufbauVerkehr";

const g = erzeuge(passendeWahl("europaeisch", 12));

function stadt() {
  const w = neueWelt(g, "europaeisch", 12);
  const d = w.doerfer[0];
  outer: for (let r = 0; r < 40; r += 2) for (let a = -r; a <= r; a += 2) for (const [x, y] of [[d.i + a, d.j - r], [d.i + a, d.j + r]]) {
    if (pruefePlatz(g, w, "markt", x, y).ok) { baue(g, w, "markt", x, y); break outer; }
  }
  const z = zentrum(w)!;
  outer2: for (let r = 0; r < 20; r += 1) for (let a = -r; a <= r; a++) for (const [x, y] of [[z.i + a, z.j - r], [z.i + a, z.j + r]]) {
    if (pruefePlatz(g, w, "brunnen", x, y).ok) { baue(g, w, "brunnen", x, y); break outer2; }
  }
  for (let t = 0; t < 60; t++) schritt(g, w);
  return w;
}

describe("Aufbau: Verkehr", () => {
  const w = stadt();

  it("der Wegweiser führt über Straßen zum Markt", () => {
    const ziele = zieleFuer(w, "nahrung");
    const next = wegweiser(w, ziele);
    const hof = w.haeuser.find(h => h.bauer && next[h.tor] !== -1)!;
    expect(hof).toBeTruthy();
    const p = pfad(next, hof.tor);
    expect(p.length).toBeGreaterThan(2);
    expect(ziele).toContain(p[p.length - 1]);
    for (const k of p) expect([STRASSE, HAUPT]).toContain(w.feld[k]);
    // jeder Schritt geht zu einem Nachbarfeld
    for (let i = 1; i < p.length; i++) expect([1, w.n]).toContain(Math.abs(p[i] - p[i - 1]));
  });

  it("Karren fahren von Höfen zum Markt, Fußgänger von Stadthäusern, und sie bewegen sich", () => {
    const v = erzeugeVerkehr(w);
    expect(v.some(f => f.art === "karren")).toBe(true);
    expect(v.some(f => f.art === "fuss")).toBe(true);
    const m = zentrum(w)!, tor = zufahrt(m.i, m.j, m.w, m.h, m.dreh);
    expect(v.filter(f => f.art === "karren").every(f => f.pfad[f.pfad.length - 1] === tor.j * w.n + tor.i)).toBe(true);
    const vorher = v.map(f => f.pos);
    bewege(v, 5);
    expect(v.some((f, i) => f.pos !== vorher[i])).toBe(true);
    expect(v.every(f => f.pos >= 0 && f.pos <= f.pfad.length - 1)).toBe(true);
  });

  it("gleicher Stand, gleiche Figuren", () => {
    expect(JSON.stringify(erzeugeVerkehr(w).map(f => f.pfad[0]))).toBe(JSON.stringify(erzeugeVerkehr(w).map(f => f.pfad[0])));
  });
});
