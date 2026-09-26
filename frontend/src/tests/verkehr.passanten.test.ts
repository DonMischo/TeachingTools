import { describe, expect, it } from "vitest";
import { schulStart, stadt } from "@/lib/verkehr/stadt";
import { Passanten } from "@/lib/verkehr/passanten";
import type { P } from "@/lib/verkehr/geometrie";

const s = stadt();
const start = schulStart(s);
const zufall = (n = 3) => () => ((n = (n * 9301 + 49297) % 233280) / 233280);

describe("Passanten", () => {
  it("füllt die Umgebung und bleibt auf Wegen", () => {
    const p = new Passanten(s, zufall());
    for (let t = 0; t < 60; t += 0.1) p.schritt(0.1, t, start, 15, [], null, null, null);
    expect(p.liste.length).toBe(15);
    const unterwegs = p.liste.map((x) => s.untergrund(x.x, x.y).art);
    // Fast alle auf Geh- und Fußwegen (am Bordstein mal auf der Fahrbahn)
    expect(unterwegs.filter((a) => a === "gehweg" || a === "gelaende").length).toBeGreaterThanOrEqual(11);
    expect(unterwegs.filter((a) => a === "haus").length).toBeLessThanOrEqual(1);
    for (const x of p.liste) expect(Math.hypot(x.x - start[0], x.y - start[1])).toBeLessThan(135);
  });

  it("sie laufen wirklich", () => {
    const p = new Passanten(s, zufall(5));
    for (let i = 0; i < 5; i++) p.schritt(0, 0, start, 10, [], null, null, null);
    const vorher = new Map(p.liste.map((x) => [x.id, [x.x, x.y] as P]));
    for (let t = 0.1; t < 10; t += 0.1) p.schritt(0.1, t, start, 10, [], null, null, null);
    const gelaufen = p.liste.filter((x) => vorher.has(x.id) && Math.hypot(x.x - vorher.get(x.id)![0], x.y - vorher.get(x.id)![1]) > 4);
    expect(gelaufen.length).toBeGreaterThanOrEqual(7);
  });

  it("weichen beim Klingeln aus und schimpfen, wenn ein Rad ohne Klingeln vorbeirast", () => {
    const p = new Passanten(s, zufall(7));
    p.schritt(0.1, 0, start, 5, [], null, null, null);
    const x = p.liste[0];
    p.schritt(0.1, 1, start, 5, [], { x: x.x + 3, y: x.y, t: 1 }, null, null);
    for (let t = 1.1; t < 2; t += 0.1) p.schritt(0.1, t, start, 5, [], null, null, null);
    expect(x.seite).toBeGreaterThan(0.5);
    const y = p.liste[1];
    const rufe = p.schritt(0.1, 20, start, 5, [], null, { x: y.x + 0.5, y: y.y, tempo: 5 }, null);
    expect(rufe.length).toBe(1);
    expect(y.ruf?.text).toBeTruthy();
  });

  it("warten am Bordstein, wenn ein Auto kommt", () => {
    const p = new Passanten(s, zufall(11));
    // Jemanden finden, der gleich auf die Fahrbahn tritt
    for (let t = 0; t < 200; t += 0.1) {
      p.schritt(0.1, t, start, 20, [], null, null, null);
      const x = p.liste.find((q) => s.untergrund(q.x, q.y).art !== "fahrbahn" && s.untergrund(q.x + Math.cos(q.winkel) * 0.3, q.y + Math.sin(q.winkel) * 0.3).art === "fahrbahn");
      if (!x) continue;
      const auto = { x: x.x + Math.cos(x.winkel) * 10 - 8, y: x.y + Math.sin(x.winkel) * 10, winkel: 0, tempo: 8 };
      auto.winkel = Math.atan2(x.y - auto.y, x.x - auto.x);
      const [ax, ay] = [x.x, x.y];
      for (let u = 0; u < 2; u += 0.1) p.schritt(0.1, t + u, start, 20, [auto], null, null, null);
      expect(Math.hypot(x.x - ax, x.y - ay)).toBeLessThan(0.2);
      return;
    }
    throw new Error("niemand am Bordstein gefunden");
  });
});
