import { describe, expect, it } from "vitest";
import { BEGRUESSUNG, Ltb, PAUSE } from "@/lib/verkehr/ltb";
import { baueEimer, Muell, TRAGEN } from "@/lib/verkehr/muell";
import { stadt, schulStart } from "@/lib/verkehr/stadt";
import { LEER, verbuche, type Ereignis, type Fortschritt } from "@/lib/verkehr/missionen";

describe("LTB, der Pinguin", () => {
  it("stellt sich mit vollem Namen vor", () => {
    expect(BEGRUESSUNG[0]).toMatch(/Linus Torwa Biblebrox/);
  });

  it("hält Pausen zwischen Plaudereien, warnt bei Verstößen aber sofort", () => {
    const l = new Ltb();
    expect(l.sag({ typ: "naehe", was: "zebra" }, 0)).toBeTruthy();
    expect(l.sag({ typ: "naehe", was: "ampel" }, 2)).toBeNull();
    expect(l.sag({ typ: "meldung", id: "rot" }, 3)).toMatch(/Rot/);
    expect(l.sag({ typ: "naehe", was: "ampel" }, 3 + PAUSE + 0.1)).toBeTruthy();
  });

  it("sagt dasselbe nicht endlos", () => {
    const l = new Ltb();
    const saetze = [0, 1, 2, 3].map((i) => l.sag({ typ: "meldung", id: "nichtGeschaut" }, i * 100));
    expect(saetze.filter(Boolean).length).toBeLessThanOrEqual(2);
  });

  it("schweigt zu Anlässen ohne Satz", () => {
    expect(new Ltb().sag({ typ: "meldung", id: "ausgestiegen" }, 0)).toBeNull();
  });
});

describe("Müll", () => {
  const s = stadt();

  it("hat Eimer an der Schule, an Supermärkten und Haltestellen — nie im Haus", () => {
    const eimer = baueEimer(s);
    // Der Schul-Eimer steht direkt am Start vor der Schule — erreichbar.
    const [sx, sy] = schulStart(s);
    expect(eimer.some((e) => Math.hypot(e[0] - sx, e[1] - sy) < 3)).toBe(true);
    const lidl = s.karte.punkte.find((p) => p.name === "Lidl")!;
    expect(eimer.some((e) => Math.hypot(e[0] - lidl.p[0], e[1] - lidl.p[1]) < 45)).toBe(true);
    expect(eimer.length).toBeGreaterThan(10);
    for (const e of eimer) expect(s.untergrund(e[0], e[1]).art).not.toBe("haus");
    // Die Läden-Eimer stehen auf dem Gehweg.
    for (const laden of s.karte.punkte.filter((p) => p.shop === "supermarket")) {
      const nah = eimer.filter((e) => Math.hypot(e[0] - laden.p[0], e[1] - laden.p[1]) < 62);
      expect(nah.some((e) => s.untergrund(e[0], e[1]).art === "gehweg"), laden.name).toBe(true);
    }
  });

  it("liegt auf Gehwegen und Wiesen, nur wenig auf der Fahrbahn, und ist je Saat gleich", () => {
    const a = new Muell(s, 7), b = new Muell(s, 7);
    expect(a.stuecke.map((m) => m.p)).toEqual(b.stuecke.map((m) => m.p));
    const aufFahrbahn = a.stuecke.filter((m) => m.aufFahrbahn).length;
    expect(aufFahrbahn).toBeGreaterThan(0);
    expect(aufFahrbahn / a.stuecke.length).toBeLessThan(0.3);
    for (const m of a.stuecke) expect(["gehweg", "gelaende", "fahrbahn"]).toContain(s.untergrund(m.p[0], m.p[1]).art);
  });

  it("lässt sich aufheben und bekommt Nachschub", () => {
    const m = new Muell(s, 3, 10);
    const erstes = m.stuecke[0];
    expect(m.naechstes(erstes.p[0], erstes.p[1])).toBe(erstes);
    m.nimm(erstes.id);
    expect(m.stuecke).toHaveLength(9);
    for (let i = 0; i < 5; i++) m.nachschub(0, 0);
    expect(m.stuecke.length).toBeGreaterThan(9);
    expect(TRAGEN).toBe(3);
  });

  it("zählt für den Auftrag und die Erfolge", () => {
    const alle = (f: Fortschritt, ...e: Ereignis[]) => e.reduce((x, y) => verbuche(x, y).f, f);
    const f = alle(LEER, { typ: "muell", stueck: 3 }, { typ: "muell", stueck: 2 });
    expect(f.erledigt).toContain("muell");
    expect(alle(f, { typ: "muell", stueck: 5 }).erfolge).toContain("saubermann");
    expect(alle(LEER, { typ: "karmaGeheilt" }).erfolge).toContain("karmawende");
  });
});
