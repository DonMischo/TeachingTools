import { describe, it, expect } from "vitest";
import { start, feed, werte, erwartet, schwacheZeichen } from "@/lib/tippen/engine";
import { zeichenZuTaste, umschaltFuer, REIHEN, REIHENBREITE } from "@/lib/tippen/layout";

describe("Tipp-Engine", () => {
  it("rückt bei richtigem Zeichen vor", () => {
    const s = feed(start("ab"), "a", 0);
    expect(s.pos).toBe(1);
    expect(s.fehler).toBe(0);
    expect(erwartet(s)).toBe("b");
  });

  it("sperrt bei falschem Zeichen — der Cursor bleibt stehen", () => {
    const s = feed(start("ab"), "x", 0);
    expect(s.pos).toBe(0);
    expect(s.fehler).toBe(1);
    expect(s.anschlaege).toBe(1);
    expect(erwartet(s)).toBe("a");
    expect(s.fehlerJeZeichen).toEqual({ a: 1 });
  });

  it("zählt Anschläge pro Minute aus den richtigen Anschlägen", () => {
    // 3 richtige Zeichen in 6 Sekunden = 30 Anschläge/Minute.
    let s = start("abc");
    s = feed(s, "a", 0);
    s = feed(s, "b", 3000);
    s = feed(s, "c", 6000);
    const w = werte(s, 99999); // "jetzt" darf das Ergebnis nicht mehr ändern
    expect(w.fertig).toBe(true);
    expect(w.dauer).toBe(6);
    expect(w.anschlaegeProMinute).toBe(30);
  });

  it("lässt Fehlanschläge die Anschläge pro Minute nicht aufblähen", () => {
    let sauber = start("ab");
    sauber = feed(sauber, "a", 0);
    sauber = feed(sauber, "b", 6000);

    let gehaemmert = start("ab");
    gehaemmert = feed(gehaemmert, "a", 0);
    for (let i = 1; i <= 20; i++) gehaemmert = feed(gehaemmert, "x", i * 100);
    gehaemmert = feed(gehaemmert, "b", 6000);

    expect(werte(gehaemmert, 6000).anschlaegeProMinute).toBe(werte(sauber, 6000).anschlaegeProMinute);
  });

  it("rechnet die Fehlerquote auf alle Anschläge", () => {
    let s = start("ab");
    s = feed(s, "x", 0);
    s = feed(s, "a", 1000);
    s = feed(s, "y", 2000);
    s = feed(s, "b", 3000);
    expect(s.anschlaege).toBe(4);
    expect(werte(s, 3000).fehlerquote).toBe(0.5);
  });

  it("nennt die schwächsten Zeichen, häufigster Fehler zuerst", () => {
    let s = start("ab");
    s = feed(s, "x", 0);
    s = feed(s, "x", 1);
    s = feed(s, "a", 2);
    s = feed(s, "x", 3);
    expect(schwacheZeichen(s)).toEqual([{ zeichen: "a", fehler: 2 }, { zeichen: "b", fehler: 1 }]);
  });

  it("läuft ohne Fehlersperre über den Fehler hinweg, zählt ihn aber", () => {
    // Hochgeladenes Material darf die Sperre abschalten (lock_on_error: false).
    let s = start("ab");
    s = feed(s, "x", 0, false);
    expect(s.pos).toBe(1);              // rückt trotzdem vor
    expect(s.fehler).toBe(1);
    expect(s.fehlerJeZeichen).toEqual({ a: 1 });
    s = feed(s, "b", 1000, false);
    expect(werte(s, 1000).fertig).toBe(true);
  });

  it("nimmt nach dem Ende keine Anschläge mehr an", () => {
    let s = feed(start("a"), "a", 0);
    s = feed(s, "b", 1000);
    expect(s.anschlaege).toBe(1);
    expect(s.fehler).toBe(0);
  });

  it("bleibt vor dem ersten Anschlag bei null", () => {
    const w = werte(start("abc"), 12345);
    expect(w.dauer).toBe(0);
    expect(w.anschlaegeProMinute).toBe(0);
    expect(w.fehlerquote).toBe(0);
  });
});

describe("Tastaturbelegung (deutsch)", () => {
  it("findet die physische Taste zu einem Zeichen", () => {
    expect(zeichenZuTaste("ö")).toMatchObject({ code: "Semicolon", shift: false });
    expect(zeichenZuTaste("ä")).toMatchObject({ code: "Quote", shift: false });
    expect(zeichenZuTaste("ü")).toMatchObject({ code: "BracketLeft", shift: false });
    expect(zeichenZuTaste("ß")).toMatchObject({ code: "Minus", shift: false });
    expect(zeichenZuTaste(" ")).toMatchObject({ code: "Space", shift: false });
  });

  it("kennt QWERTZ — z und y liegen nicht wie im Englischen", () => {
    expect(zeichenZuTaste("z")).toMatchObject({ code: "KeyZ", finger: "r2" });
    expect(zeichenZuTaste("y")).toMatchObject({ code: "KeyY", finger: "l5" });
  });

  it("verlangt für Großbuchstaben die Umschalttaste", () => {
    expect(zeichenZuTaste("A")).toMatchObject({ code: "KeyA", shift: true });
  });

  it("wählt die Umschalttaste der anderen Hand", () => {
    expect(umschaltFuer("l5")).toBe("ShiftRight");
    expect(umschaltFuer("r5")).toBe("ShiftLeft");
  });

  it("lässt Tottasten aus der Zuordnung heraus", () => {
    // ^ und ´ erzeugen erst mit dem nächsten Zeichen etwas — sie dürfen nie
    // als "diese Taste jetzt drücken" auftauchen.
    expect(zeichenZuTaste("^")).toBeUndefined();
    expect(zeichenZuTaste("´")).toBeUndefined();
  });

  it("hält jede Reihe innerhalb der Reihenbreite", () => {
    // Läuft eine Reihe über, verschieben sich die Spalten gegeneinander und
    // die Tastatur zeigt nicht mehr, wo der Finger wirklich hin muss.
    for (const reihe of REIHEN) {
      const breite = reihe.reduce((s, t) => s + (t.width ?? 1), 0);
      expect(breite).toBeLessThanOrEqual(REIHENBREITE);
    }
  });

  it("vergibt jeden Tastencode nur einmal", () => {
    const codes = REIHEN.flat().map(t => t.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("hat acht Tasten in der Grundstellung", () => {
    const home = REIHEN.flat().filter(t => t.home).map(t => t.label);
    expect(home).toEqual(["a", "s", "d", "f", "j", "k", "l", "ö"]);
  });
});
