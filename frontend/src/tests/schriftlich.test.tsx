/**
 * Schriftliche Rechenverfahren: Die Ergebniszeile jedes Ablaufs ergibt das
 * richtige Ergebnis (zufällige Aufgaben aller Stufen), Walzen drehen passend,
 * Fehlerdetektiv baut echte Fehler, und die Blätter öffnen.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Schriftlich, { neuerFall } from "@/components/schriftlich/Schriftlich";
import { Rechenpapier } from "@/components/schriftlich/Rechenpapier";
import { tickPlan } from "@/components/schriftlich/Rechenblatt";
import { addiere, aufgabe, dividiere, loesung, mitFehler, multipliziere, rechne, subtrahiere, type Ablauf, type Op } from "@/lib/schriftlich";

function zufall(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}

/** Ergebniszeile als Zahl lesen (größte Zeile mit Ergebnis-Zellen bzw. Zeile 0 beim Teilen) */
function ergebnisVon(ab: Ablauf): string {
  const z = ab.schritte[ab.schritte.length - 1].zellen.filter(x => x.art === "ergebnis" || (x.art === "zeichen" && x.t === "R"));
  return z.sort((a, b) => a.c - b.c).map(x => x.t).join("").replace(/R/, " R ");
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
      for (const st of ab.schritte) if (st.walze) expect(((st.walze.bis % 10) + 10) % 10).toBe(st.stand[st.walze.c] ?? ((st.walze.bis % 10) + 10) % 10);
    }
  });
  it("Übertrag fliegt beim Addieren", () => {
    const ab = addiere([478, 365]);
    expect(ab.schritte.some(s => s.flug?.t === "+1")).toBe(true);
    // der Übertrag erscheint erst nach dem Flug
    expect(ab.schritte.find(s => s.flug)!.zellen.find(z => z.art === "uebertrag" && z.neu)!.ab).toBe("flug");
  });
  it("4130 + 6453 = 10583: fünf Ergebnisstellen, Zehntausender sichtbar und tippbar", () => {
    const ab = addiere([4130, 6453]);
    expect(ergebnisVon(ab)).toBe("10583");
    const ergebnis = ab.schritte[ab.schritte.length - 1].zellen.filter(z => z.art === "ergebnis");
    expect(ergebnis).toHaveLength(5);
    expect(new Set(ergebnis.map(z => z.c)).size).toBe(5);
    expect(Math.min(...ergebnis.map(z => z.c))).toBeGreaterThanOrEqual(1); // Spalte 0 bleibt fürs Pluszeichen
    expect(ab.breite).toBe(6);
    render(<Rechenpapier ablauf={ab} />);
    for (const z of ergebnis) expect(screen.getByLabelText(`Ergebnis Spalte ${z.c}`)).toBeTruthy();
  });
  it("Teilen mit Nachkommastellen: Komma, angehängte Nullen, Periode mit Strich", () => {
    const dez = (ab: ReturnType<typeof dividiere>) => {
      const z = ab.schritte[ab.schritte.length - 1].zellen.filter(x => x.r === 0 && (x.art === "ergebnis" || x.art === "komma") && x.c > ab.schritte[0].zellen.find(y => y.t === "=")!.c);
      // Komma steht am linken Rand seines Kästchens, also vor der Ziffer derselben Spalte
      return z.sort((p, q) => p.c - q.c || (p.art === "komma" ? -1 : 1)).map(x => (x.strich ? `[${x.t}]` : x.t)).join("");
    };
    expect(dez(dividiere(3, 8, { nachkomma: 10 }))).toBe("0,375");
    expect(dividiere(3, 8, { nachkomma: 10 }).ergebnis).toBe("0,375");
    expect(dez(dividiere(7, 4, { nachkomma: 10 }))).toBe("1,75");
    expect(dez(dividiere(1, 3, { nachkomma: 10 }))).toBe("0,[3]");
    expect(dez(dividiere(5, 6, { nachkomma: 10 }))).toBe("0,8[3]");
    expect(dez(dividiere(1, 7, { nachkomma: 10 }))).toBe("0,[1][4][2][8][5][7]");
    expect(dividiere(5, 6, { nachkomma: 10 }).ergebnis).toBe("0,83 (Periode 3)");
    // ohne Nachkomma wie bisher mit Rest
    expect(dividiere(7, 4).ergebnis).toBe("1 R 3");
    // keine zwei Zellen im selben Kästchen (außer Komma-Überlagerung)
    const ab = dividiere(22, 7, { nachkomma: 10 });
    const zellen = ab.schritte[ab.schritte.length - 1].zellen.filter(z => z.art !== "komma");
    expect(new Set(zellen.map(z => `${z.r}:${z.c}`)).size).toBe(zellen.length);
  });
  it("Teilen mit Rest: »R« und jede Restziffer im eigenen Kästchen", () => {
    for (const [a, b] of [[4127, 7], [1000, 37], [5899, 10]]) {
      const ab = dividiere(a, b);
      const ende = ab.schritte[ab.schritte.length - 1].zellen.filter(z => z.r === 0);
      const plaetze = ende.map(z => z.c);
      expect(new Set(plaetze).size).toBe(plaetze.length); // keine zwei Zellen im selben Kästchen
      expect(ende.every(z => z.t.length === 1)).toBe(true); // jede Zelle genau ein Zeichen
      expect(Math.max(...plaetze)).toBeLessThan(ab.breite);
      expect(ergebnisVon(ab)).toBe(`${Math.floor(a / b)} R ${a % b}`);
    }
  });
  it("Fehlerdetektiv: falsches Ergebnis hat so viele Stellen wie das richtige, der Fehler liegt auf einer Ziffer", () => {
    for (let i = 0; i < 200; i++) {
      const f = neuerFall();
      const richtig = f.op === "+" ? f.a + f.b : f.a - f.b;
      expect(String(f.falsch).length).toBe(String(richtig).length);
      expect(f.exp).toBeLessThan(String(f.falsch).length);
    }
  });
  it("Borgen mit »−1« ist Standard, Ergänzen mit »+1 unten« Option", () => {
    const st = rechne("−", 5003, 1278);
    expect(ergebnisVon(st)).toBe("3725");
    expect(st.merkeMinus).toBe(true);
    expect(st.schritte.some(s => s.flug?.t === "−1")).toBe(true);
    expect(st.schritte.some(s => s.zellen.some(z => z.art === "hilfe"))).toBe(false);
    expect(ergebnisVon(rechne("−", 1000, 999))).toBe("1");
    const er = rechne("−", 5003, 1278, "ergaenzen");
    expect(ergebnisVon(er)).toBe("3725");
    expect(er.merkeMinus).toBeFalsy();
    expect(er.schritte.some(s => s.flug?.t === "+1")).toBe(true);
  });
  it("827 − 681 (Standard): Zehner 2 − 8 geht nicht → borgen, 12 − 8 = 4, bei den Hundertern »−1« merken", () => {
    const ab = rechne("−", 827, 681);
    expect(ergebnisVon(ab)).toBe("146");
    const zehner = ab.schritte.find(s => s.text.startsWith("Zehner"))!;
    expect(zehner.borgen).toEqual({ oben: 2, mit: 12, unten: 8, ziffer: 4 });
    expect(zehner.zerlegung).toBeUndefined();
    // die Walze dreht rückwärts: von 2 aus 8-mal zurück (über 0 hinaus = borgen) und steht dann auf 4
    expect(zehner.walze).toMatchObject({ von: 2, bis: -6 });
    expect(zehner.stand[zehner.walze!.c]).toBe(4);
    expect(zehner.text).toContain("2 − 8 geht nicht");
    expect(zehner.text).toContain("aus 2 wird 12");
    expect(zehner.text).toContain("12 − 8 = 4");
    expect(zehner.text).toContain("»−1« merken");
    // das −1 steht in der Spalte der Hunderter, in der Merkzeile unter dem Subtrahenden — wie der Übertrag beim Addieren
    const minus = zehner.zellen.find(z => z.art === "uebertrag" && z.neu)!;
    const acht = zehner.zellen.find(z => z.art === "zahl" && z.t === "8" && z.r === 0)!;
    const sechs = zehner.zellen.find(z => z.art === "zahl" && z.t === "6")!;
    expect(minus.t).toBe("−1");
    expect(minus.c).toBe(acht.c);
    expect(minus.r).toBe(sechs.r + 1);
    expect(ab.uebertragZeilen).toEqual([sechs.r + 1]);
    // Hunderter: 8 − 1 (gemerkt) = 7, 7 − 6 = 1; das −1 ist danach verbraucht
    const hunderter = ab.schritte.find(s => s.text.startsWith("Hunderter"))!;
    expect(hunderter.text).toContain("8 − 1 (gemerkt) = 7");
    expect(hunderter.walze).toMatchObject({ von: 8, bis: 1 }); // 8 → 7 (gemerkt) → … → 1
    expect(hunderter.zellen.find(z => z.t === "−1")!.durch).toBe(true);
    expect(rechne("−", 7, 1).schritte.find(s => s.walze)!.walze).toEqual({ c: 1, von: 7, bis: 6 });
    // Ergänzen behält sein +1 unten (Kern des Verfahrens), mit der passenden Erklärung
    const er = rechne("−", 827, 681, "ergaenzen");
    const ez = er.schritte.find(s => s.text.startsWith("Zehner"))!;
    expect(ez.text).toContain("8 + 4 = 12");
    expect(ez.text).toContain("Übertrag +1");
    expect(er.schritte.find(s => s.text.startsWith("Hunderter"))!.text).toContain("6 + 1 (Übertrag) = 7");
    // jede Spalte, beide Verfahren: die Walze endet auf der geschriebenen Ziffer
    const r = zufall(21);
    for (let i = 0; i < 150; i++) {
      const { a, b } = aufgabe("−", 3, r);
      for (const m of ["ergaenzen", "entbuendeln"] as const) {
        const x = rechne("−", a, b, m);
        expect(ergebnisVon(x)).toBe(String(a - b));
        for (const st of x.schritte) if (st.walze) {
          const geschrieben = st.zellen.find(z => z.art === "ergebnis" && z.neu && z.c === st.walze!.c);
          if (geschrieben) expect(String(((st.walze.bis % 10) + 10) % 10)).toBe(geschrieben.t);
        }
      }
    }
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
  it("Borgen über Nullen: die Null borgt selbst weiter (0 − 1 geht nicht → 9)", () => {
    const ab = subtrahiere(5003, 1278);
    expect(ab.schritte.filter(s => s.flug?.t === "−1").length).toBe(3);
    const zehner = ab.schritte.find(s => s.text.startsWith("Zehner"))!;
    expect(zehner.text).toContain("aus 0 wird 10, minus 1 gemerkt = 9");
    expect(zehner.text).not.toContain("-1");
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
