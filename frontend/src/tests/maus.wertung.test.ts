import { describe, it, expect } from "vitest";
import { minuten, wertung, zeitgrenzeS } from "@/lib/maus/wertung";
import { sterne } from "@/lib/maus/ergebnis";
import { jpegAlsPdf } from "@/lib/maus/pdf";

const w = (dauerS: number, fehler: number, geloest = 10, anzahl = 10) =>
  wertung({ stufe: "fenster", geloest, anzahl, dauerMs: dauerS * 1000, fehler });

describe("Wertung Teil 2/3", () => {
  it("setzt die Zeitgrenze auf das Fünffache der Richtzeit", () => {
    expect(zeitgrenzeS("fenster")).toBe(900);
    expect(zeitgrenzeS("scrollen")).toBe(300);
  });

  it("gibt die volle Punktzahl für alles gelöst, in der Zeit, ohne Fehler", () => {
    expect(w(120, 0).punkte).toBe(1000);
  });

  it("stimmt mit den Beispielen aus der Tabelle überein", () => {
    // alles gelöst, 1,5-fache Grenze, 2 Fehler → 600 + 125 + 100
    expect(w(1350, 2).punkte).toBe(825);
    expect(sterne("fenster", w(1350, 2).punkte)).toBe(3);
    // sehr langsam, ohne Fehler → 750, zwei Sterne
    expect(w(5000, 0).punkte).toBe(750);
    expect(sterne("fenster", w(5000, 0).punkte)).toBe(2);
    // ab sechs Fehlern bleibt vom Fehlerbonus nichts
    expect(w(100, 6).punkte).toBe(850);
    expect(w(100, 9).punkte).toBe(850);
  });

  it("kürzt die Boni anteilig, wenn Aufgaben fehlen", () => {
    expect(w(100, 0, 5, 10).punkte).toBe(500);
    expect(w(100, 0, 0, 10).punkte).toBe(0);
  });

  it("schreibt Zeit und Fehlversuche fürs Blatt", () => {
    expect(w(185, 1).details).toEqual(["10 von 10 Aufgaben", "Zeit 3:05 (Ziel bis 15:00) · 1 Fehlversuch"]);
    expect(minuten(59.6)).toBe("1:00");
  });
});

describe("PDF aus einem JPEG", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
  const pdf = jpegAlsPdf(jpeg, 1240, 1754);
  const text = Array.from(pdf, b => String.fromCharCode(b)).join("");

  it("beginnt und endet wie ein PDF", () => {
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("bettet das JPEG unverändert als Bild ein", () => {
    expect(text).toContain("/Filter /DCTDecode");
    expect(text).toContain(`/Width 1240 /Height 1754`);
    expect(text).toContain(`/Length ${jpeg.length}`);
  });

  it("zeigt in der xref-Tabelle auf die richtigen Objekte", () => {
    const start = Number(text.match(/startxref\n(\d+)/)![1]);
    expect(text.slice(start, start + 4)).toBe("xref");
    const zeilen = text.slice(start).split("\n").slice(3, 8);
    zeilen.forEach((zeile, i) => {
      const versatz = Number(zeile.slice(0, 10));
      expect(text.slice(versatz, versatz + `${i + 1} 0 obj`.length)).toBe(`${i + 1} 0 obj`);
    });
  });
});
