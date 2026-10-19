import { describe, expect, it } from "vitest";
import { erzeuge } from "@/lib/gelaende/gelaende";
import { inPoly } from "@/lib/stadt/geometrie";
import { haeuser } from "@/lib/stadt/haeuser";
import { STILE } from "@/lib/stadt/modell";
import { quizFragen, trifft, zielOrt } from "@/lib/stadt/quiz";
import { AUFTRAEGE, pruefe, REGELSAETZE } from "@/lib/stadt/regeln";
import { wachse } from "@/lib/stadt/wachstum";

const g = erzeuge({ art: "flusstal", seed: 12, fluss: true, relief: 1 });
const epochen = Object.fromEntries(STILE.map(s => [s.id, wachse(s.id, g, 12)]));

describe("Wachstum", () => {
  it("jeder Stil wächst über mehrere Epochen, mit Häusern", () => {
    for (const s of STILE) {
      const e = epochen[s.id];
      expect(e.length).toBeGreaterThanOrEqual(4);
      expect(e.every(x => x.stadt.stil === s.id && x.neu.length > 0)).toBe(true);
      // die Stadt wird größer
      expect(e[e.length - 1].stadt.strassen.length).toBeGreaterThan(e[0].stadt.strassen.length);
      expect(haeuser(e[1].stadt, g, 1).length).toBeGreaterThan(50);
    }
  });

  it("Epochen sind unabhängige Kopien", () => {
    const e = epochen.europaeisch;
    expect(e[1].stadt.mauern.length).toBeGreaterThan(0);
    // Industrialisierung: Mauer weg, Ring da
    expect(e[3].stadt.mauern.length).toBe(0);
    expect(e[3].stadt.strassen.some(s => s.art === "ring")).toBe(true);
    expect(e[3].stadt.strassen.some(s => s.art === "bahn")).toBe(true);
  });

  it("der Bahnhof der Industriestadt liegt vor der Altstadt", () => {
    const e = epochen.europaeisch;
    const bhf = e[3].stadt.bauten.find(b => b.typ === "bahnhof")!;
    expect(bhf).toBeTruthy();
    expect(inPoly(bhf, e[1].stadt.mauern[0])).toBe(false);
  });
});

describe("Regeln", () => {
  it("die gewachsenen Städte erfüllen die Regeln ihres Stils fast alle", () => {
    const fall: [string, number, string][] = [["roemisch", 1, "roemisch"], ["europaeisch", 1, "mittelalter"], ["amerikanisch", 0, "eisenbahn"]];
    for (const [stil, i, rs] of fall) {
      const r = pruefe(REGELSAETZE.find(x => x.id === rs)!.regeln, epochen[stil][i].stadt, g, null);
      expect(r.filter(x => x.ok).length / r.length, `${stil}: ${r.filter(x => !x.ok).map(x => x.id)}`).toBeGreaterThanOrEqual(0.85);
    }
  });

  it("ein leerer Plan fällt durch, ohne dass eine Regel abstürzt", () => {
    for (const a of AUFTRAEGE) {
      const r = pruefe(a.regeln, { stil: a.stil, strassen: [], mauern: [], zonen: [], bauten: [] }, g, null);
      expect(r.every(x => !x.hinweis.startsWith("Konnte nicht"))).toBe(true);
      expect(r.filter(x => x.ok).length).toBeLessThan(r.length / 2);
    }
  });

  it("Erweiterungsaufträge: der Ausgangszustand ist noch nicht gelöst", () => {
    for (const a of AUFTRAEGE.filter(x => x.start)) {
      const start = epochen[a.stil][a.start!.epoche].stadt;
      const r = pruefe(a.regeln, start, g, start);
      expect(r.filter(x => x.ok).length).toBeLessThan(r.length * 0.6);
    }
  });
});

describe("Quiz", () => {
  it("Zeige-Fragen treffen an ihrem eigenen Zielort", () => {
    for (const s of STILE) {
      const e = epochen[s.id];
      for (let i = 0; i < e.length; i++) {
        for (const f of quizFragen(s.id, e, i, 3)) {
          if (f.art !== "zeige") { expect(f.optionen[f.richtig]).toBeTruthy(); continue; }
          const o = zielOrt(f, e[i].stadt);
          expect(o, f.text).not.toBeNull();
          expect(trifft(f, e[i].stadt, o!), f.text).toBe(true);
        }
      }
    }
  });
});
