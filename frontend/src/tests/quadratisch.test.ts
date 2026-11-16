/**
 * Quadratische Funktionen: Formen umrechnen, Rechenwege, gewürfelte Aufgaben,
 * Prüfungsaufgaben und das Spiel Korbwurf. Schreibweise wie im Tafelwerk:
 * y = a(x + d)² + e mit S(−d | e).
 */
import { describe, it, expect } from "vitest";
import {
  ABWURF, KORB_HOEHE, LEVELS, PRUEF_ARTEN, UEB_ARTEN, ausmultiplizieren, boegen, ergaenzen, erzeugePruefung,
  erzeugeUebung, feldStimmt, leseZahl, nfText, nfZuSpf, pqFormel, scheitel, schnitt, spfText, spfWert, spfZuNf,
  sprungHoehe, steckbrief, wert, wirf, wurfbahn, zahl, type Feld, type NF, type Stufe,
} from "@/lib/quadratisch";

describe("Zahlen", () => {
  it("deutsch mit echtem Minus, ohne −0", () => {
    expect(zahl(-2.5)).toBe("−2,5");
    expect(zahl(0.1 + 0.2)).toBe("0,3");
    expect(zahl(-0.0001)).toBe("0");
  });
  it("liest Komma, Minusvarianten und Brüche", () => {
    expect(leseZahl("−1,5")).toBe(-1.5);
    expect(leseZahl("-0.5")).toBe(-0.5);
    expect(leseZahl("3/4")).toBe(0.75);
    expect(leseZahl("abc")).toBeNull();
  });
});

describe("Scheitelpunktform wie im Tafelwerk", () => {
  it("S(−d | e)", () => {
    expect(scheitel({ a: 1, d: 3, e: -2 })).toEqual({ x: -3, y: -2 });
    expect(scheitel({ a: 2, d: -1, e: 4 })).toEqual({ x: 1, y: 4 });
  });
  it("Terme lesen sich wie im Heft", () => {
    expect(spfText({ a: 1, d: 3, e: -2 })).toBe("y = (x + 3)² − 2");
    expect(spfText({ a: -1, d: -1, e: 0 })).toBe("y = −(x − 1)²");
    expect(spfText({ a: 0.5, d: 0, e: 1 })).toBe("y = 0,5x² + 1");
    expect(nfText({ a: 1, b: -2, c: -3 })).toBe("y = x² − 2x − 3");
    expect(nfText({ a: 0, b: 1, c: 1 })).toBe("y = x + 1");
  });
  it("SPF ↔ Normalform hin und zurück", () => {
    for (const s of [{ a: 1, d: -1, e: -4 }, { a: 2, d: 1, e: -3 }, { a: -0.5, d: 2.5, e: 7 }]) {
      const f = spfZuNf(s);
      expect(nfZuSpf(f)).toEqual(s);
      for (const x of [-3, 0, 1.5]) expect(wert(f, x)).toBeCloseTo(spfWert(s, x), 9);
    }
    expect(spfZuNf({ a: 1, d: -1, e: -4 })).toEqual({ a: 1, b: -2, c: -3 });
  });
  it("Steckbrief aus a", () => {
    expect(steckbrief(-0.5)).toEqual({ oeffnung: "unten", form: "gestaucht" });
    expect(steckbrief(2)).toEqual({ oeffnung: "oben", form: "gestreckt" });
    expect(steckbrief(-1).form).toBe("normal");
  });
});

describe("Klammern quadrieren mit vier Bögen", () => {
  it("alle drei binomischen Formeln", () => {
    expect(boegen(3, 3)).toMatchObject({ ergebnis: { a: 1, b: 6, c: 9 }, formel: 1 });
    expect(boegen(-3, -3)).toMatchObject({ ergebnis: { a: 1, b: -6, c: 9 }, formel: 2 });
    expect(boegen(3, -3)).toMatchObject({ ergebnis: { a: 1, b: 0, c: -9 }, formel: 3 });
  });
  it("minus mal minus gibt plus", () => {
    expect(boegen(-3, -3).bg[3]).toMatchObject({ produkt: "(−3) · (−3)", ergebnis: { t: "+ 9" } });
  });
});

describe("Rechenwege", () => {
  it("Ausmultiplizieren endet in der Normalform", () => {
    const z = ausmultiplizieren({ a: 2, d: 1, e: -3 });
    expect(z.at(-1)).toContain("y = 2x² + 4x − 1");
    expect(z.join(" ")).toContain("1. binomische Formel");
  });
  it("Quadratische Ergänzung endet bei S", () => {
    expect(ergaenzen({ a: 1, b: -6, c: 5 }).at(-1)).toContain("S(3 | −4)");
    expect(ergaenzen({ a: 2, b: 8, c: 3 }).at(-1)).toContain("S(−2 | −5)");
  });
  it("p-q-Formel mit 2, 1 und 0 Nullstellen", () => {
    expect(pqFormel({ a: 2, b: -4, c: -6 }).xs).toEqual([-1, 3]);
    expect(pqFormel({ a: 1, b: -2, c: 1 }).xs).toEqual([1]);
    expect(pqFormel({ a: 1, b: -2, c: 3 }).xs).toEqual([]);
  });
  it("Schnittpunkte Parabel–Gerade und Gerade–Gerade", () => {
    expect(schnitt({ a: 1, b: 0, c: -1 }, { a: 0, b: 1, c: 1 }).punkte).toEqual([{ x: -1, y: 0 }, { x: 2, y: 3 }]);
    expect(schnitt({ a: 0, b: 2, c: 1 }, { a: 0, b: -1, c: 4 }).punkte).toEqual([{ x: 1, y: 3 }]);
    expect(schnitt({ a: 0, b: 2, c: 1 }, { a: 0, b: 2, c: 3 }).punkte).toEqual([]);
  });
});

/** Die eigene Lösung muss jedes Feld bestehen. */
function eigeneLoesung(f: Feld): string {
  if (f.art === "wahl") return String(f.richtig);
  return f.wert === null ? "" : String(f.wert).replace(".", ",");
}

describe("Üben: je Art und Stufe 60 gewürfelte Aufgaben", () => {
  for (const art of UEB_ARTEN) {
    for (const st of [1, 2, 3] as Stufe[]) {
      it(`${art.id} Stufe ${st}`, () => {
        for (let i = 0; i < 60; i++) {
          const a = erzeugeUebung(art.id, st);
          expect(a.felder.length).toBeGreaterThan(0);
          expect(a.weg.length).toBeGreaterThan(0);
          for (const f of a.felder) {
            if (f.art === "zahl" && f.wert !== null) expect(Number.isFinite(f.wert)).toBe(true);
            expect(feldStimmt(f, eigeneLoesung(f))).toBe(true);
          }
          expect(a.weg.join(" ")).not.toMatch(/NaN|undefined|Infinity/);
        }
      });
    }
  }

  const zahlen = (a: ReturnType<typeof erzeugeUebung>) =>
    Object.fromEntries(a.felder.map(f => [f.key, f.art === "zahl" ? f.wert : f.richtig]));

  it("Nullstellen ergeben wirklich f(x) = 0", () => {
    for (const st of [1, 2, 3] as Stufe[]) for (let i = 0; i < 80; i++) {
      const a = erzeugeUebung("nullstellen", st);
      const z = zahlen(a);
      for (const x of [z.x1, z.x2]) if (x !== null) expect(wert(a.f!, x as number)).toBeCloseTo(0, 6);
      expect(pqFormel(a.f!).xs.length).toBe(Number(["0", "1", "2"][z.n as number]));
    }
  });

  it("Schnittpunkte liegen auf beiden Graphen", () => {
    for (const st of [1, 2, 3] as Stufe[]) for (let i = 0; i < 80; i++) {
      const a = erzeugeUebung("schnitt", st);
      const z = zahlen(a);
      for (const [x, y] of [[z.x1, z.y1], [z.x2, z.y2]] as [number | null, number | null][]) {
        if (x === null) continue;
        expect(wert(a.f!, x)).toBeCloseTo(y!, 6);
        expect(wert(a.g!, x)).toBeCloseTo(y!, 6);
      }
    }
  });

  it("Quadratische Ergänzung: S ist wirklich der Scheitel", () => {
    for (const st of [1, 2, 3] as Stufe[]) for (let i = 0; i < 80; i++) {
      const a = erzeugeUebung("nfSpf", st);
      const z = zahlen(a) as Record<string, number>;
      expect(wert(a.f!, z.xs)).toBeCloseTo(z.ys, 6);
      // links und rechts gleich weit weg: gleiche Werte (Symmetrie)
      expect(wert(a.f!, z.xs - 1.3)).toBeCloseTo(wert(a.f!, z.xs + 1.3), 6);
    }
  });

  it("SPF → Normalform: gleiche Werte; Term zum Graphen: gleiche Kurve", () => {
    for (let i = 0; i < 80; i++) {
      const a = erzeugeUebung("spfNf", 3);
      const z = zahlen(a) as Record<string, number>;
      for (const x of [-2, 0, 3]) expect(wert({ a: z.a, b: z.b, c: z.c }, x)).toBeCloseTo(wert(a.f!, x), 9);
      const g = erzeugeUebung("graph", 3);
      const zg = zahlen(g) as Record<string, number>;
      expect(spfZuNf({ a: zg.a, d: zg.d, e: zg.e })).toEqual(g.graph!.kurven[0].f);
    }
  });
});

describe("Prüfungsaufgaben", () => {
  for (const art of PRUEF_ARTEN) {
    it(`${art.label}: 40 Würfe ohne Unsinn`, () => {
      for (let i = 0; i < 40; i++) {
        const p = erzeugePruefung(art.id);
        expect(p.teile.length).toBeGreaterThan(1);
        const alles = [p.kontext, ...p.teile.flatMap(t => [t.frage, ...t.loesung])].join(" ");
        expect(alles).not.toMatch(/NaN|undefined|Infinity/);
        for (const t of p.teile) for (const f of t.felder) expect(feldStimmt(f, eigeneLoesung(f))).toBe(true);
      }
    });
  }
  it("Springbrunnen-Düse liegt über dem Wasser", () => {
    for (let i = 0; i < 60; i++) expect(erzeugePruefung("brunnen").teile[0].felder[0]).toMatchObject({ art: "zahl" });
    for (let i = 0; i < 60; i++) {
      const f = erzeugePruefung("brunnen").teile[0].felder[0];
      expect(f.art === "zahl" && f.wert! > 0).toBe(true);
    }
  });
  it("Rampe schneidet den Strahl zweimal", () => {
    for (let i = 0; i < 40; i++) expect(erzeugePruefung("rampe").graph!.punkte!.length).toBe(2);
  });
});

describe("Korbwurf", () => {
  it("die Bahn geht durch die Hand des Werfers", () => {
    const s = wurfbahn({ x: 3, y: 4.5 })!;
    expect(spfWert(s, ABWURF.x)).toBeCloseTo(ABWURF.y, 9);
    expect(scheitel(s)).toEqual({ x: 3, y: 4.5 });
  });
  it("jedes Level ist lösbar", () => {
    LEVELS.forEach((lv, i) => {
      let geht = false;
      for (let x = 0.5; x < lv.korbX && !geht; x += 0.1) {
        for (let y = 2.2; y < 7 && !geht; y += 0.05) {
          const s = wurfbahn({ x, y });
          // nur Bahnen nahe am Ring durch die Physik schicken, sonst dauert der Test
          if (!s || Math.abs(spfWert(s, lv.korbX) - KORB_HOEHE) > 0.25) continue;
          if ([0, 0.7, 1.4].some(t0 => wirf(s, lv, t0).treffer)) geht = true;
        }
      }
      expect(geht, `Level ${i + 1}`).toBe(true);
    });
  });
  it("zu flach fällt unter den Ring, Decke stoppt", () => {
    const lv = LEVELS[0];
    expect(wirf(wurfbahn({ x: 1, y: 2.3 })!, lv).treffer).toBe(false);
    const decke = LEVELS[3];
    expect(wirf(wurfbahn({ x: 3, y: 8 })!, decke).grund).toBe("an die Decke");
    expect(KORB_HOEHE).toBe(3.05);
  });
  it("sichtbar durch den Ring zählt, auch wenn die Mitte f(korbX) nicht genau 3,05 ist", () => {
    // steile Bahn fällt knapp vor der Ringmitte durch 3,05 – früher wegen f(4) ≈ 2,8 kein Treffer
    const lv = LEVELS[0], S = { x: 2.1, y: 6.4 };
    const s = wurfbahn(S)!;
    const xKreuz = S.x + Math.sqrt((KORB_HOEHE - S.y) / s.a);
    expect(Math.abs(xKreuz - lv.korbX)).toBeLessThan(0.08);
    expect(Math.abs(spfWert(s, lv.korbX) - KORB_HOEHE)).toBeGreaterThan(0.18);
    expect(wirf(s, lv).grund).toBe("Korb!");
  });
  it("flache Würfe prallen ab, steile gehen rein", () => {
    const lv = LEVELS[0];
    let flach = 0, flachRein = 0;
    for (let x = 2.5; x < 4; x += 0.1) for (let y = 2.2; y < 3.6; y += 0.05) {
      const s = wurfbahn({ x, y });
      if (!s || Math.abs(spfWert(s, lv.korbX) - KORB_HOEHE) > 0.1) continue;
      flach++; if (wirf(s, lv).treffer) flachRein++;
    }
    expect(flach).toBeGreaterThan(5);
    expect(flachRein / flach).toBeLessThan(0.25);
  });
  it("springende Verteidiger: Höhe ist eine Zeit-Parabel, Abwurfzeit zählt", () => {
    const h = LEVELS[2].hindernisse[0];
    const dauer = 2 * Math.sqrt((2 * h.sprung!.hoehe) / 9.81);
    expect(sprungHoehe(h, 0)).toBe(0);
    expect(sprungHoehe(h, dauer / 2)).toBeCloseTo(h.sprung!.hoehe, 9);
    expect(sprungHoehe(h, dauer + 0.01)).toBe(0);
    expect(sprungHoehe(h, h.sprung!.periode + dauer / 2)).toBeCloseTo(h.sprung!.hoehe, 9);
    // eine flache Bahn über den stehenden Verteidiger wird im Sprung geblockt
    const s = wurfbahn({ x: 2.8, y: 2.6 })!;
    const grund = (t0: number) => wirf(s, LEVELS[2], t0).grund;
    const zeiten = Array.from({ length: 22 }, (_, i) => i / 10);
    expect(zeiten.some(t0 => grund(t0) === "vom Verteidiger geblockt")).toBe(true);
    expect(zeiten.some(t0 => wirf(s, LEVELS[2], t0).treffer)).toBe(true);
  });
});

// Typ-Import nicht wegoptimieren
export type _NF = NF;
