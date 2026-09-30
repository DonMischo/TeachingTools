import { describe, expect, it } from "vitest";
import { RICHTUNG, festlegen, gegen, loese, muster, neueWelle, schritt, type Welle } from "@/lib/wfc/kern";
import { KACHELSAETZE, kachelModell, varianten } from "@/lib/wfc/kacheln";
import { VORLAGEN, lerneMuster } from "@/lib/wfc/ueberlappend";

const satz = (id: string) => KACHELSAETZE.find(s => s.id === id)!;

/** Passen alle Nachbarn im fertigen Bild zueinander? */
function stimmig(w: Welle): boolean {
  for (let i = 0; i < w.b * w.h; i++) {
    const p = muster(w, i);
    if (p < 0) return false;
    const x = i % w.b, y = (i - x) / w.b;
    for (let d = 0; d < 4; d++) {
      const nx = x + RICHTUNG[d][0], ny = y + RICHTUNG[d][1];
      if (nx < 0 || ny < 0 || nx >= w.b || ny >= w.h) continue;
      if (!w.modell.erlaubt[d][p].includes(muster(w, ny * w.b + nx))) return false;
    }
  }
  return true;
}

describe("Kacheln (Simple Tiled Model)", () => {
  it.each(KACHELSAETZE.map(s => [s.id] as const))("%s: löst ein 16×16-Feld stimmig", id => {
    const v = varianten(satz(id));
    const m = kachelModell(v);
    // die Nachbarschaft ist symmetrisch — Voraussetzung fürs Ausbreiten
    for (let d = 0; d < 4; d++) for (let p = 0; p < m.anzahl; p++) {
      for (const q of m.erlaubt[d][p]) expect(m.erlaubt[gegen(d)][q]).toContain(p);
    }
    const { welle } = loese(s => neueWelle(m, 16, 16, s), 3);
    expect(welle).not.toBeNull();
    expect(stimmig(welle!)).toBe(true);
  });

  it("Rohre: Drehungen werden erzeugt, Kanten passen", () => {
    const v = varianten(satz("rohre"));
    expect(v.filter(x => x.kachel.name === "kurve")).toHaveLength(4);
    expect(v.filter(x => x.kachel.name === "gerade")).toHaveLength(2);
    expect(v.filter(x => x.kachel.name === "kreuz")).toHaveLength(1);
  });

  it("Landschaft mit Rand = Wasser wird eine Insel mit Wiese, nie Wasser direkt neben Wiese", () => {
    const s = satz("landschaft");
    const v = varianten(s);
    const m = kachelModell(v);
    const wasser = s.pinsel[0].passt;
    const { welle } = loese(seed => {
      const w = neueWelle(m, 14, 14, seed);
      for (let i = 0; i < 14 * 14; i++) {
        const x = i % 14, y = Math.floor(i / 14);
        if ((x === 0 || y === 0 || x === 13 || y === 13) && !festlegen(w, i, p => wasser(v[p]))) return null;
      }
      return w;
    }, 5);
    expect(welle).not.toBeNull();
    expect(stimmig(welle!)).toBe(true);
    let wiese = 0;
    for (let i = 0; i < 14 * 14; i++) wiese += v[muster(welle!, i)].kachel.ecken!.filter(c => c === 2).length;
    expect(wiese).toBeGreaterThan(0);
    for (let i = 0; i < 14 * 14; i++) {
      const e = v[muster(welle!, i)].kachel.ecken!;
      const x = i % 14, y = Math.floor(i / 14);
      if (x === 0 || y === 0 || x === 13 || y === 13) expect(e.every(c => c === 0)).toBe(true);
      // entlang einer Kante nie Wasser neben Wiese (über Kreuz ist erlaubt)
      const [nw, ne, se, sw] = e;
      for (const [a, b] of [[nw, ne], [ne, se], [se, sw], [sw, nw]]) expect(Math.abs(a - b)).toBeLessThanOrEqual(1);
    }
  });

  it("widersprüchliche Randbedingungen werden erkannt", () => {
    const s = satz("strassen");
    const v = varianten(s);
    const m = kachelModell(v);
    const w = neueWelle(m, 4, 1, 1);
    // links nur Wiese, rechts daneben nur eine Brücke (braucht links eine Straße) — geht nicht
    expect(festlegen(w, 0, p => v[p].kachel.name === "wiese")).toBe(true);
    expect(festlegen(w, 1, p => v[p].kachel.name === "bruecke" && v[p].seiten[2] === "S")).toBe(false);
    expect(schritt(w)).toBe("widerspruch");
  });
});

describe("Vorlage (Overlapping Model)", () => {
  it("lernt ein Schachbrett und erzeugt wieder ein Schachbrett", () => {
    const m = lerneMuster(["BW", "WB"], 2, false);
    expect(m.modell.anzahl).toBe(2);
    const { welle } = loese(s => neueWelle(m.modell, 10, 10, s), 1);
    const farbe = (i: number) => m.pixel[muster(welle!, i)][0];
    for (let y = 0; y < 10; y++) for (let x = 0; x < 9; x++) expect(farbe(y * 10 + x)).not.toBe(farbe(y * 10 + x + 1));
  });

  it.each(VORLAGEN.map(v => [v.id, v] as const))("%s: lässt sich lernen und lösen", (_id, vorlage) => {
    const m = lerneMuster(vorlage.zeilen, 3, true);
    expect(m.modell.anzahl).toBeGreaterThan(1);
    const { welle } = loese(s => neueWelle(m.modell, 24, 24, s), 7, 30);
    expect(welle).not.toBeNull();
    expect(stimmig(welle!)).toBe(true);
  });

  it("Inseln: festgelegte Farbe wird eingehalten", () => {
    const v = VORLAGEN.find(x => x.id === "insel")!;
    const m = lerneMuster(v.zeilen, 3, true);
    const { welle } = loese(s => {
      const w = neueWelle(m.modell, 20, 20, s);
      return festlegen(w, 10 * 20 + 10, p => m.pixel[p][0] === "G") ? w : null;
    }, 11, 30);
    expect(welle).not.toBeNull();
    expect(m.pixel[muster(welle!, 10 * 20 + 10)][0]).toBe("G");
  });
});
