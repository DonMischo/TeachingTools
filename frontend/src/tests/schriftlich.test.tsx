/**
 * Schriftliche Rechenverfahren: Die Ergebniszeile jedes Ablaufs ergibt das
 * richtige Ergebnis (zufällige Aufgaben aller Stufen), Walzen drehen passend,
 * Fehlerdetektiv baut echte Fehler, und die Blätter öffnen.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Schriftlich from "@/components/schriftlich/Schriftlich";
import { Rechenpapier } from "@/components/schriftlich/Rechenpapier";
import { tickPlan } from "@/components/schriftlich/Rechenblatt";
import { addiere, aufgabe, dividiere, loesung, mitFehler, multipliziere, rechne, subtrahiere, type Ablauf, type Op } from "@/lib/schriftlich";

function zufall(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}

/** Ergebniszeile als Zahl lesen (größte Zeile mit Ergebnis-Zellen bzw. Zeile 0 beim Teilen) */
function ergebnisVon(ab: Ablauf): string {
  const z = ab.schritte[ab.schritte.length - 1].zellen.filter(x => x.art === "ergebnis");
  return z.sort((a, b) => a.c - b.c).map(x => x.t).join("").replace(/R /, " R ");
}

describe("Abläufe", () => {
  it("Beispiele", () => {
    expect(ergebnisVon(addiere([478, 365]))).toBe("843");
    expect(ergebnisVon(subtrahiere(5003, 1278))).toBe("3725");
    expect(ergebnisVon(multipliziere(345, 23))).toBe("7935");
    expect(ergebnisVon(dividiere(9876, 7))).toBe("1410 R 6");
    expect(ergebnisVon(dividiere(806, 2))).toBe("403");
  });
  it("zufällige Aufgaben aller Arten und Stufen", () => {
    const r = zufall(12);
    for (const op of ["+", "−", "·", ":"] as Op[]) for (const s of [1, 2, 3] as const) for (let i = 0; i < 40; i++) {
      const { a, b } = aufgabe(op, s, r);
      const ab = rechne(op, a, b);
      const l = loesung(op, a, b);
      expect(ergebnisVon(ab)).toBe(op === ":" ? `${l.wert}${l.rest ? ` R ${l.rest}` : ""}` : String(l.wert));
      for (const st of ab.schritte) if (st.walze && !st.walze.zaehle) expect(((st.walze.bis % 10) + 10) % 10).toBe(st.stand[st.walze.c] ?? ((st.walze.bis % 10) + 10) % 10);
    }
  });
  it("Übertrag fliegt beim Addieren", () => {
    const ab = addiere([478, 365]);
    expect(ab.schritte.some(s => s.flug?.t === "+1")).toBe(true);
    // der Übertrag erscheint erst nach dem Flug
    expect(ab.schritte.find(s => s.flug)!.zellen.find(z => z.art === "uebertrag" && z.neu)!.ab).toBe("flug");
  });
  it("Ergänzen mit Übertrag ist Standard, Entbündeln Option", () => {
    const er = rechne("−", 5003, 1278);
    expect(ergebnisVon(er)).toBe("3725");
    expect(er.schritte.some(s => s.flug?.t === "+1")).toBe(true);
    expect(er.schritte.some(s => s.zellen.some(z => z.art === "hilfe"))).toBe(false);
    expect(ergebnisVon(rechne("−", 1000, 999))).toBe("1");
  });
  it("Multiplizieren zerlegt das Produkt in Zehner (Übertrag) und Einer", () => {
    const ab = multipliziere(47, 3);
    const z = ab.schritte.find(s => s.zerlegung)!;
    expect(z.zerlegung).toEqual({ zahl: 21, zehner: 2, einer: 1 });
    expect(ab.schritte.some(s => s.text.startsWith("Übertrag dazu: 12 + 2 = 14"))).toBe(true);
  });
  it("Dividieren hat Bögen und eine Probe", () => {
    const ab = dividiere(9876, 7);
    expect(ab.schritte[1].ketten![0].boegen[0]).toEqual({ text: ": 7", art: "durch" });
    expect(ab.schritte[ab.schritte.length - 1].ketten![0].kaesten).toEqual(["1410", "9870", "9876"]);
  });
  it("Entbündeln über Nullen", () => {
    const ab = subtrahiere(5003, 1278);
    expect(ab.schritte.some(s => s.zellen.some(z => z.art === "hilfe" && z.t === "9"))).toBe(true);
  });
  it("Fehlerdetektiv baut einen echten Fehler", () => {
    const r = zufall(3);
    for (let i = 0; i < 100; i++) {
      const { a, b } = aufgabe("+", 2, r);
      const f = mitFehler("+", a, b);
      if (f) { expect(f.falsch).not.toBe(a + b); expect(f.exp).toBeGreaterThanOrEqual(0); }
      const s = aufgabe("−", 2, r);
      const g = mitFehler("−", s.a, s.b);
      if (g) { expect(g.falsch).not.toBe(s.a - s.b); expect(g.exp).toBeGreaterThanOrEqual(0); }
    }
  });
});

describe("Oberfläche", () => {
  it("Zeitlupe nur beim Sprung über die Zehnergrenze", () => {
    const plan = tickPlan(7, 12);
    expect(plan).toHaveLength(5);
    expect(plan.filter(d => d > plan[0]).length).toBe(1);
    expect(plan[2]).toBeGreaterThan(plan[0]); // 9 → 10
  });

  it("Rechenpapier: Ziffern eintippen, Überträge merken, prüfen", () => {
    let ok: boolean | null = null;
    render(<Rechenpapier ablauf={addiere([478, 365])} onErgebnis={x => { ok = x; }} />);
    const felder = ["Ergebnis Spalte 3", "Ergebnis Spalte 2", "Ergebnis Spalte 1"];
    ["3", "4", "8"].forEach((v, i) => fireEvent.change(screen.getByLabelText(felder[i]), { target: { value: v } }));
    fireEvent.click(screen.getByRole("button", { name: "Übertrag Spalte 2: leer" }));
    expect(screen.getByRole("button", { name: "Übertrag Spalte 2: +1" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Prüfen" }));
    expect(ok).toBe(true);
    fireEvent.change(screen.getByLabelText("Ergebnis Spalte 1"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Prüfen" }));
    expect(ok).toBe(false);
  });

  it("Rechenpapier beim Teilen: Quotient und Rest als Felder", () => {
    let ok: boolean | null = null;
    render(<Rechenpapier ablauf={dividiere(29, 4)} onErgebnis={x => { ok = x; }} />);
    fireEvent.click(screen.getByRole("button", { name: "Lösung eintragen" }));
    fireEvent.click(screen.getByRole("button", { name: "Prüfen" }));
    expect(ok).toBe(true);
  });

  it("öffnet Vorführen, Üben, Spiel", () => {
    render(<Schriftlich />);
    fireEvent.click(screen.getByRole("button", { name: "Alle Schritte" }));
    expect(screen.getByText(/Ergebnis:/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Üben/ }));
    expect(screen.getByRole("button", { name: "Prüfen" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Fehlerdetektiv/ }));
    expect(screen.getByRole("button", { name: "▶ Los" })).toBeTruthy();
  });
});
