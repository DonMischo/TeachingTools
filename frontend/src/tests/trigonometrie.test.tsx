/**
 * Trigonometrie: Dreieckslöser für alle Fälle (auch SsW mit 0/1/2 Lösungen),
 * exakte Werte am Einheitskreis, gewürfelte Aufgaben und Szenarien sind
 * stimmig, jedes Blatt öffnet.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Trigonometrie from "@/components/trigonometrie/Trigonometrie";
import {
  AUFGABEN_ARTEN, SZENARIO_ARTEN, cosG, ecken, erzeugeAufgabe, erzeugeSzenario, exakt, fallVon, loese, loeseRechtwinklig, quadrant, sinG,
  type Dreieck,
} from "@/lib/trigonometrie";

function zufall(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/** Stimmen Winkelsumme, Sinussatz und Kosinussatz? */
function stimmig(d: Dreieck) {
  expect(d.alpha + d.beta + d.gamma).toBeCloseTo(180, 6);
  const k = d.a / sinG(d.alpha);
  expect(d.b / sinG(d.beta)).toBeCloseTo(k, 6);
  expect(d.c / sinG(d.gamma)).toBeCloseTo(k, 6);
  expect(d.c ** 2).toBeCloseTo(d.a ** 2 + d.b ** 2 - 2 * d.a * d.b * cosG(d.gamma), 6);
}

describe("Dreieckslöser", () => {
  it("erkennt die Fälle", () => {
    expect(fallVon({ a: 3, b: 4, c: 5 })).toBe("SSS");
    expect(fallVon({ a: 3, b: 4, gamma: 40 })).toBe("SWS");
    expect(fallVon({ a: 3, b: 4, alpha: 40 })).toBe("SSW");
    expect(fallVon({ c: 3, alpha: 40, beta: 60 })).toBe("WSW");
    expect(fallVon({ a: 3, alpha: 40, beta: 60 })).toBe("WWS");
    expect(fallVon({ alpha: 40, beta: 60, gamma: 80 })).toBeNull();
  });

  it("löst SSS, SWS, WSW und WWS stimmig", () => {
    for (const g of [{ a: 3, b: 4, c: 5 }, { a: 7, c: 4, beta: 120 }, { c: 6, alpha: 40, beta: 70 }, { b: 5, beta: 30, gamma: 100 }]) {
      const l = loese(g);
      expect(l.dreiecke).toHaveLength(1);
      stimmig(l.dreiecke[0]);
      for (const [k, v] of Object.entries(g)) expect(l.dreiecke[0][k as keyof Dreieck]).toBeCloseTo(v);
    }
    expect(loese({ a: 3, b: 4, c: 5 }).dreiecke[0].gamma).toBeCloseTo(90);
  });

  it("SsW: zwei, eine oder keine Lösung", () => {
    const zwei = loese({ alpha: 30, b: 10, a: 6 });
    expect(zwei.dreiecke).toHaveLength(2);
    zwei.dreiecke.forEach(stimmig);
    expect(zwei.dreiecke[0].beta + zwei.dreiecke[1].beta).toBeCloseTo(180);
    expect(loese({ alpha: 30, b: 10, a: 12 }).dreiecke).toHaveLength(1);
    expect(loese({ alpha: 30, b: 10, a: 5 }).dreiecke[0].beta).toBeCloseTo(90);
    const keine = loese({ alpha: 30, b: 10, a: 4 });
    expect(keine.dreiecke).toHaveLength(0);
    expect(keine.hinweis).toMatch(/kein Dreieck/);
  });

  it("meldet Unmögliches", () => {
    expect(loese({ a: 1, b: 2, c: 5 }).fehler).toMatch(/kürzer/);
    expect(loese({ a: 1, alpha: 100, beta: 90 }).fehler).toBeTruthy();
    expect(loese({ a: 1, b: 2 }).fehler).toBeTruthy();
  });

  it("rechtwinklig aus jedem Paar", () => {
    const voll = { a: 3, b: 4, c: 5, alpha: Math.atan(0.75) * 180 / Math.PI, beta: Math.atan(4 / 3) * 180 / Math.PI };
    for (const p of [["a", "b"], ["a", "c"], ["b", "c"], ["a", "alpha"], ["b", "beta"], ["c", "alpha"]] as const) {
      const l = loeseRechtwinklig({ [p[0]]: voll[p[0]], [p[1]]: voll[p[1]] });
      expect(l.dreiecke).toHaveLength(1);
      stimmig(l.dreiecke[0]);
      expect(l.dreiecke[0].c).toBeCloseTo(5);
    }
    expect(loeseRechtwinklig({ a: 6, c: 5 }).fehler).toMatch(/Hypotenuse/);
  });

  it("legt die Ecken so, dass die Seitenlängen stimmen", () => {
    const d = loese({ a: 5, b: 6, c: 7 }).dreiecke[0];
    for (const reihe of [["alpha", "beta", "gamma"], ["beta", "alpha", "gamma"], ["gamma", "beta", "alpha"]] as const) {
      const e = ecken(d, [...reihe]);
      const ab = Math.hypot(e.A.x - e.B.x, e.A.y - e.B.y), bc = Math.hypot(e.B.x - e.C.x, e.B.y - e.C.y);
      expect(ab).toBeCloseTo(7);
      expect(bc).toBeCloseTo(5);
    }
  });
});

describe("Einheitskreis", () => {
  it("exakte Werte mit Vorzeichen", () => {
    expect(exakt(30)).toEqual({ sin: "½", cos: "½√3", tan: "⅓√3" });
    expect(exakt(150)).toEqual({ sin: "½", cos: "−½√3", tan: "−⅓√3" });
    expect(exakt(225)?.tan).toBe("1");
    expect(exakt(270)).toEqual({ sin: "−1", cos: "0", tan: "nicht definiert" });
    expect(exakt(37)).toBeNull();
    expect(quadrant(200)).toBe(3);
    expect(quadrant(90)).toBe(0);
  });
});

describe("Aufgaben und Szenarien", () => {
  it("jede gewürfelte Aufgabe hat eine Lösung (SsW auch mal keine)", () => {
    const r = zufall(7);
    for (const { id } of AUFGABEN_ARTEN) for (let i = 0; i < 60; i++) {
      const a = erzeugeAufgabe(id, r);
      expect(a.loesung.fehler).toBeUndefined();
      if (id !== "SSW") expect(a.loesung.dreiecke).toHaveLength(1);
      a.loesung.dreiecke.forEach(stimmig);
    }
  });

  it("SsW würfelt alle drei Ausgänge", () => {
    const r = zufall(3), n = new Set<number>();
    for (let i = 0; i < 80; i++) n.add(erzeugeAufgabe("SSW", r).loesung.dreiecke.length);
    expect([...n].sort()).toEqual([0, 1, 2]);
  });

  it("Szenarien liefern endliche, positive Lösungen", () => {
    const r = zufall(11);
    for (const { id } of SZENARIO_ARTEN) for (let i = 0; i < 30; i++) {
      const s = erzeugeSzenario(id, r);
      for (const g of s.gesucht) {
        expect(Number.isFinite(g.wert)).toBe(true);
        expect(g.wert).toBeGreaterThan(0);
      }
    }
  });
});

describe("Oberfläche", () => {
  it("jedes Blatt öffnet", () => {
    render(<Trigonometrie />);
    for (const name of [/Einheitskreis/, /Sinusfunktion/, /Rechtwinklig/, /Dreiecke/, /Anwendungen/, /Küstenwache/]) {
      fireEvent.click(screen.getByRole("button", { name }));
    }
    expect(screen.getAllByText(/Küstenwache/).length).toBeGreaterThan(0);
  });
});
