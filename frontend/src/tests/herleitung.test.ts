/**
 * Die Herleitungs-Filme müssen geometrisch aufgehen: am Ende liegen die
 * Teile lückenlos im Zielrechteck — sonst lügt das Bild an der Tafel.
 */
import { describe, it, expect } from "vitest";
import { herleitung, filmBounds, total, type Piece } from "@/lib/herleitung";
import type { Pt } from "@/lib/vierecke";

const flaeche = (pts: Pt[]) =>
  Math.abs(pts.reduce((s, p, i) => {
    const q = pts[(i + 1) % pts.length];
    return s + p.x * q.y - q.x * p.y;
  }, 0)) / 2;

const box = (ps: Piece[]) => {
  const all = ps.flatMap(p => p.pts);
  const xs = all.map(p => p.x), ys = all.map(p => p.y);
  return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};

function ende(key: Parameters<typeof herleitung>[0], v: Record<string, number>) {
  const H = herleitung(key, v)!;
  return H.frame(total(H.steps)).pieces.filter(p => p.alpha > 0);
}

describe("Herleitung", () => {
  it("Quadrat und Rechteck haben keine (sie werden ausgelegt)", () => {
    expect(herleitung("quadrat", { a: 5 })).toBeNull();
    expect(herleitung("rechteck", { a: 5, b: 3 })).toBeNull();
  });

  it("Parallelogramm wird zum Rechteck a × h", () => {
    const p = ende("parallelogramm", { a: 7, b: 4, h: 3 });
    expect(p.reduce((s, x) => s + flaeche(x.pts), 0)).toBeCloseTo(21);
    const b = box(p);
    expect(b.w).toBeCloseTo(7);
    expect(b.h).toBeCloseTo(3);
  });

  it("sehr schiefes Parallelogramm: Kartenstapel wird zum Rechteck a × h", () => {
    const p = ende("parallelogramm", { a: 2, b: 8, h: 1 });
    expect(p.reduce((s, x) => s + flaeche(x.pts), 0)).toBeCloseTo(2);
    const b = box(p);
    expect(b.w).toBeCloseTo(2);
    expect(b.h).toBeCloseTo(1);
  });

  it.each([
    { a: 8, c: 4, h: 3 },
    { a: 3, c: 10, h: 2 }, // c länger als a: das Dreieck kippt zur anderen Seite
    { a: 5, c: 5, h: 4 },
  ])("Trapez %o: zwei Trapeze ergeben das Rechteck (a + c) × h", v => {
    const p = ende("trapez", v);
    const b = box(p);
    expect(b.w).toBeCloseTo(v.a + v.c);
    expect(b.h).toBeCloseTo(v.h);
    expect(p.reduce((s, x) => s + flaeche(x.pts), 0)).toBeCloseTo((v.a + v.c) * v.h);
  });

  it("Trapez startet ohne Kopie — das Startbild zeigt nur das Trapez", () => {
    const H = herleitung("trapez", { a: 8, c: 4, h: 3 })!;
    const f = H.frame(0);
    expect(f.pieces.filter(p => p.alpha > 0).map(p => p.kind)).toEqual(["orig"]);
  });

  it.each([
    ["raute", { e: 8, f: 6 }],
    ["drachen", { e: 6, f: 9, m: 3 }],
  ] as const)("%s: die Eckdreiecke landen genau im Inneren", (key, v) => {
    const p = ende(key, v);
    const form = p.find(x => x.kind === "orig")!;
    const ecken = p.filter(x => x.kind === "outer");
    expect(ecken).toHaveLength(4);
    expect(ecken.reduce((s, x) => s + flaeche(x.pts), 0)).toBeCloseTo(flaeche(form.pts));
    // Jede Ecke fällt auf den Diagonalenschnitt.
    const m = key === "raute" ? v.f / 2 : (v as { m: number }).m;
    for (const t of ecken) expect(t.pts[0].x).toBeCloseTo(v.e / 2), expect(t.pts[0].y).toBeCloseTo(m);
  });

  it("die Bühne fasst den ganzen Film", () => {
    const H = herleitung("trapez", { a: 8, c: 4, h: 3 })!;
    const b = filmBounds(H);
    expect(b.width).toBeGreaterThanOrEqual(12);
    expect(b.minY).toBeLessThan(0); // die Kopie schwebt anfangs über dem Trapez
  });
});
