import { describe, it, expect } from "vitest";
import {
  DOPPEL_HOEHE, GEHEIM_UEBER_BEWEGER, STILE, baueAbschnitte, baueLevel, naheEdelstein, schritt, startSpieler,
  type Eingabe, type Level, type Spieler,
} from "@/lib/challenge/huepfen";

const DT = 1 / 60;
const nichts: Eingabe = { links: false, rechts: false, sprung: false };

/** Höchster Punkt der Füße über dem Boden: einfacher Sprung (gehalten) bzw. Doppelsprung (Loslassen, am Scheitel erneut). */
function scheitel(doppelt: boolean): number {
  const l: Level = { ...baueLevel(1, 3, 1), leisten: [], beweger: [], gegner: [], tueren: [], plattformen: [{ x: 0, y: 20, w: 40, cp: true }], hoehe: 40 };
  let s: Spieler = { ...startSpieler(l), x: 5, y: 20, auf: 0 };
  let min = s.y, zweiter = false;
  for (let t = 0; t < 2; t += DT) {
    const amScheitel = doppelt && !zweiter && s.vy >= 0 && s.auf < 0;
    if (amScheitel) { s = schritt(s, nichts, DT, l); s = schritt(s, { ...nichts, sprung: true }, DT, l); zweiter = true; }
    else s = schritt(s, { ...nichts, sprung: t < 0.4 || (zweiter && s.vy < 0) }, DT, l);
    min = Math.min(min, s.y);
  }
  return 20 - min;
}

const alle = () => STILE.flatMap((stil) => [1, 2, 3].flatMap((e) => [1, 2, 3, 4, 5, 6].map((seed) => baueLevel(e, 4, 1, seed * 977, stil))));

describe("Hüpfen: Geheimes", () => {
  it("Doppelsprung-Höhen: einfacher Sprung reicht nicht, Doppelsprung schon", () => {
    const einfach = scheitel(false), doppelt = scheitel(true);
    expect(einfach).toBeLessThan(DOPPEL_HOEHE - 1.7); // naheEdelstein: Füße höchstens 1,7 unter dem Kristall
    expect(doppelt).toBeGreaterThan(DOPPEL_HOEHE - 1.7 + 0.3);
    expect(doppelt).toBeGreaterThan(GEHEIM_UEBER_BEWEGER + 0.3);
    expect(einfach).toBeLessThan(GEHEIM_UEBER_BEWEGER);
  });

  it("Geheimleisten liegen über einem Beweger und sind von keiner anderen Fläche aus erreichbar", () => {
    let leisten = 0;
    for (const l of alle()) {
      for (const g of l.leisten.filter((p) => p.geheim)) {
        leisten++;
        const mitte = g.x + g.w / 2;
        const unter = l.beweger.find((m) => Math.abs(m.cx - mitte) < 0.01);
        expect(unter).toBeDefined();
        expect(unter!.cy - unter!.ay - g.y).toBeCloseTo(GEHEIM_UEBER_BEWEGER);
        const andere = [...l.plattformen, ...l.leisten.filter((p) => p !== g)];
        // nichts seitlich nah, das höher als 6,6 darunter liegt (Doppelsprung ~6,1) oder darüber (Hinunterfallen)
        const nah = andere.filter((q) => q.x < g.x + g.w + 5 && q.x + q.w > g.x - 5 && q.y < g.y + 6.6 && !q.geheim);
        expect(nah).toEqual([]);
        expect(l.edelsteine.filter((e) => e.geheim && Math.abs(e.y - (g.y - 0.7)) < 0.01 && e.x >= g.x && e.x <= g.x + g.w)).toHaveLength(3);
      }
    }
    expect(leisten).toBeGreaterThan(5);
  });

  it("Doppelsprung-Kristalle schweben frei über einer Plattform", () => {
    let n = 0;
    for (const l of alle()) {
      for (const e of l.edelsteine.filter((x) => x.geheim && !l.leisten.some((p) => p.geheim && Math.abs(x.y - (p.y - 0.7)) < 0.01))) {
        n++;
        const p = l.plattformen.find((q) => e.x >= q.x && e.x <= q.x + q.w && Math.abs(q.y - e.y - DOPPEL_HOEHE) < 0.01);
        expect(p).toBeDefined();
        const s = { ...startSpieler(l), x: e.x, y: p!.y - 3 }; // einfacher Sprung ~3,05: knapp darunter
        expect(naheEdelstein(s, e)).toBe(false);
      }
    }
    expect(n).toBeGreaterThan(5);
  });
});

describe("Hüpfen: hinter der Tür geht es weiter", () => {
  it("jeder Torabschnitt endet am Tor, der nächste beginnt an der offenen Tür", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const a = baueAbschnitte(2, 4, 3, seed);
      a.forEach((l, k) => {
        if (k < 3) {
          const t = l.tueren[0], letzte = l.plattformen.length - 1;
          expect(t.plat).toBe(letzte);
          expect(t.x).toBeGreaterThan(l.plattformen[letzte].x + l.plattformen[letzte].w / 2);
          expect(l.breite).toBe(l.plattformen[letzte].x + l.plattformen[letzte].w);
        }
        if (k === 0) expect(l.eingang).toBeUndefined();
        else {
          expect(l.eingang).toEqual({ x: l.plattformen[0].x + 1, y: l.plattformen[0].y });
          expect(startSpieler(l).x).toBeGreaterThan(l.eingang!.x);
        }
      });
    }
  });
});
