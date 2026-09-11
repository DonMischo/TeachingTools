import { describe, it, expect } from "vitest";
import {
  DESKTOP, TASKLEISTE_HOEHE, MINDEST_BREITE, MINDEST_HOEHE, ZIEL_GROESSE, ZIEL_POSITION,
  altTabGeschafft, amZiel, groesseAendern, groesseErreicht, klemmePosition, maximieren,
  minimieren, schliessen, verschieben, wiederherstellen, zurueckholen, type FensterZustand,
} from "@/lib/maus/fenster";

const FLAECHE_H = DESKTOP.h - TASKLEISTE_HOEHE;

describe("Fenster: Position und Größe klemmen", () => {
  it("lässt ein Fenster innerhalb der Fensterfläche unverändert", () => {
    const pos = { x: 100, y: 50, w: 300, h: 200 };
    expect(klemmePosition(pos)).toEqual(pos);
  });

  it("schiebt ein zu weit rechts/unten liegendes Fenster zurück auf den Rand", () => {
    const pos = { x: DESKTOP.w, y: FLAECHE_H, w: 300, h: 200 };
    const r = klemmePosition(pos);
    expect(r.x).toBe(DESKTOP.w - 300);
    expect(r.y).toBe(FLAECHE_H - 200);
  });

  it("lässt kein Fenster ins Negative rutschen", () => {
    const r = klemmePosition({ x: -50, y: -20, w: 300, h: 200 });
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });
});

describe("Fenster: Verschieben", () => {
  it("bewegt das Fenster um dx/dy", () => {
    const pos = { x: 100, y: 50, w: 300, h: 200 };
    expect(verschieben(pos, 20, -10)).toEqual({ x: 120, y: 40, w: 300, h: 200 });
  });

  it("stoppt am Bildschirmrand statt darüber hinauszuziehen", () => {
    const pos = { x: 100, y: 50, w: 300, h: 200 };
    const r = verschieben(pos, 9999, 0);
    expect(r.x).toBe(DESKTOP.w - 300);
  });
});

describe("Fenster: Größe ändern", () => {
  it("vergrößert von der Ecke aus, Position bleibt", () => {
    const pos = { x: 100, y: 50, w: 300, h: 200 };
    const r = groesseAendern(pos, 50, 30);
    expect(r).toEqual({ x: 100, y: 50, w: 350, h: 230 });
  });

  it("schrumpft nie unter die Mindestgröße", () => {
    const pos = { x: 100, y: 50, w: 300, h: 200 };
    const r = groesseAendern(pos, -1000, -1000);
    expect(r.w).toBe(MINDEST_BREITE);
    expect(r.h).toBe(MINDEST_HOEHE);
  });

  it("wächst nicht über den Bildschirmrand hinaus", () => {
    const pos = { x: 100, y: 50, w: 300, h: 200 };
    const r = groesseAendern(pos, 9999, 9999);
    expect(r.w).toBe(DESKTOP.w - 100);
    expect(r.h).toBe(FLAECHE_H - 50);
  });
});

describe("Fenster: Zielzone und Zielgröße", () => {
  it("erkennt eine Position nah am Ziel", () => {
    const pos = { x: ZIEL_POSITION.x + 10, y: ZIEL_POSITION.y - 5, w: 300, h: 200 };
    expect(amZiel(pos, ZIEL_POSITION)).toBe(true);
  });

  it("verlangt im Normalmodus mehr Genauigkeit als im Hilfsmodus", () => {
    const pos = { x: ZIEL_POSITION.x + 35, y: ZIEL_POSITION.y, w: 300, h: 200 };
    expect(amZiel(pos, ZIEL_POSITION, false)).toBe(false);
    expect(amZiel(pos, ZIEL_POSITION, true)).toBe(true);
  });

  it("prüft, ob die verlangte Mindestgröße erreicht ist", () => {
    expect(groesseErreicht({ x: 0, y: 0, w: ZIEL_GROESSE.w, h: ZIEL_GROESSE.h })).toBe(true);
    expect(groesseErreicht({ x: 0, y: 0, w: ZIEL_GROESSE.w - 1, h: ZIEL_GROESSE.h })).toBe(false);
  });
});

describe("Fenster: Alt+Tab", () => {
  it("zählt nur, wer lange genug weg war", () => {
    expect(altTabGeschafft(499)).toBe(false);
    expect(altTabGeschafft(500)).toBe(true);
    expect(altTabGeschafft(1200)).toBe(true);
  });
});

describe("Fenster: Zustandswechsel", () => {
  const pos = { x: 10, y: 10, w: 300, h: 200 };
  const start: FensterZustand = { modus: "normal", pos };

  it("maximiert und stellt wieder her, ohne die gemerkte Position zu verlieren", () => {
    const max = maximieren(start);
    expect(max.modus).toBe("maximiert");
    expect(max.pos).toEqual(pos);
    const wieder = wiederherstellen(max);
    expect(wieder.modus).toBe("normal");
    expect(wieder.pos).toEqual(pos);
  });

  it("minimiert und holt zurück", () => {
    const min = minimieren(start);
    expect(min.modus).toBe("minimiert");
    expect(zurueckholen(min).modus).toBe("normal");
  });

  it("schließt", () => {
    expect(schliessen(start).modus).toBe("geschlossen");
  });
});
