/**
 * Zahlenbereiche: Einordnung (auch Fallen wie √16, 12/4, 0,9 periodisch),
 * Lesen getippter Zahlen, gewürfelte Zahlen liegen im verlangten Bereich,
 * jedes Blatt öffnet, und der Zahlen-Detektiv wertet eine Antwort aus.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Zahlenbereiche from "@/components/zahlenbereiche/Zahlenbereiche";
import { naeherung } from "@/components/zahlenbereiche/Zahlenstrahl";
import { innerstesFeld, PLAETZE } from "@/components/zahlenbereiche/Mengenbild";
import { BEREICHE, bereicheVon, FANGZIELE, kleinsterBereich, leseZahl, pruefeAuswahl, wert, wuerfleZahl, type Zahl } from "@/lib/zahlenbereiche";

function zufall(seed: number) {
  return () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
}
const lies = (t: string) => leseZahl(t) as Zahl;

describe("Einordnung", () => {
  it.each([
    ["7", ["N", "Z", "Q", "R"]], ["0", ["N", "Z", "Q", "R"]], ["-3", ["Z", "Q", "R"]], ["3/4", ["Q", "R"]],
    ["12/4", ["N", "Z", "Q", "R"]], ["-12/4", ["Z", "Q", "R"]], ["√16", ["N", "Z", "Q", "R"]], ["-√9", ["Z", "Q", "R"]],
    ["√2", ["R"]], ["pi", ["R"]], ["0,(3)", ["Q", "R"]], ["2,5", ["Q", "R"]], ["0,(9)", ["N", "Z", "Q", "R"]], ["4,0", ["N", "Z", "Q", "R"]],
  ])("%s liegt in %j", (t, soll) => {
    expect(bereicheVon(lies(t))).toEqual(soll);
  });
  it("liest Werte richtig", () => {
    expect(wert(lies("0,(3)"))).toBeCloseTo(1 / 3, 10);
    expect(wert(lies("1,1(6)"))).toBeCloseTo(7 / 6, 10);
    expect(wert(lies("−2,5"))).toBe(-2.5);
    expect(leseZahl("3/0")).toBeNull();
    expect(leseZahl("hallo")).toBeNull();
  });
  it("Antwort prüfen: fehlt / zu viel", () => {
    expect(pruefeAuswahl(lies("-3"), ["Z", "Q", "R"]).richtig).toBe(true);
    const p = pruefeAuswahl(lies("-3"), ["N", "Z"]);
    expect(p.richtig).toBe(false);
    expect(p.fehlt).toEqual(["Q", "R"]);
    expect(p.zuviel).toEqual(["N"]);
  });
});

describe("Würfeln", () => {
  it("jede gewürfelte Zahl liegt genau im verlangten kleinsten Bereich", () => {
    const r = zufall(7);
    for (const stufe of [1, 2, 3] as const) for (const b of BEREICHE) for (let i = 0; i < 80; i++) {
      const x = wuerfleZahl(r, stufe, b);
      expect(kleinsterBereich(x)).toBe(b);
      expect(Number.isFinite(wert(x))).toBe(true);
    }
  });
  it("jedes Fangziel passt auf manche Zahlen und auf andere nicht", () => {
    const r = zufall(3);
    const zahlen = Array.from({ length: 200 }, () => wuerfleZahl(r, 2));
    for (const f of FANGZIELE) {
      expect(zahlen.some(f.passt)).toBe(true);
      expect(zahlen.some(z => !f.passt(z))).toBe(true);
    }
  });
  it("√2 hat keinen Bruch als Wert, die Näherung wird besser", () => {
    expect(naeherung(Math.SQRT2, 10).abstand).toBeGreaterThan(naeherung(Math.SQRT2, 100).abstand);
    expect(naeherung(Math.SQRT2, 70)).toMatchObject({ z: 99, n: 70 });
  });
});

describe("Oberfläche", () => {
  it("öffnet jedes Blatt", () => {
    render(<Zahlenbereiche />);
    expect(screen.getByRole("img", { name: "Mengendiagramm der Zahlenbereiche" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Zahlenstrahl/ }));
    expect(screen.getByRole("img", { name: "Zahlenstrahl" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Steckbriefe/ }));
    expect(screen.getByText(/Bleibt das Ergebnis im Bereich/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Spiele/ }));
    expect(screen.getByRole("heading", { name: /Zahlen-Detektiv/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Zahlenregen/ }));
    expect(screen.getByRole("heading", { name: /Zahlenregen/ })).toBeTruthy();
  });

  it("Ellipsen: jeder Ring hat genug Plätze, jeder Platz liegt im richtigen Ring", () => {
    for (const b of BEREICHE) {
      expect(PLAETZE[b].length).toBeGreaterThanOrEqual(6);
      for (const p of PLAETZE[b]) expect(innerstesFeld(p.x, p.y)).toBe(b);
    }
  });

  it("Hover-Karte zeigt Beispiele und Begründung", () => {
    render(<Zahlenbereiche />);
    const zahl = document.querySelector("[aria-label=\"√16\"]")!.parentElement!;
    fireEvent.pointerEnter(zahl);
    expect(screen.getByRole("tooltip").textContent).toContain("4 · 4 = 16");
    fireEvent.pointerLeave(zahl);
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("trägt eine eigene Zahl ins Mengenbild ein und begründet", () => {
    render(<Zahlenbereiche />);
    fireEvent.change(screen.getByLabelText("Eigene Zahl"), { target: { value: "√49" } });
    fireEvent.click(screen.getByRole("button", { name: "Eintragen" }));
    expect(document.querySelector("[aria-label=\"√49\"]")).toBeTruthy();
    expect(screen.getByText(/7 · 7 = 49/)).toBeTruthy();
  });

  it("Zahlen-Detektiv: Antwort wird ausgewertet", () => {
    render(<Zahlenbereiche />);
    fireEvent.click(screen.getByRole("button", { name: /Spiele/ }));
    fireEvent.click(screen.getByRole("button", { name: "▶ Los" }));
    fireEvent.click(screen.getByRole("button", { name: "ℝ" }));
    fireEvent.click(screen.getByRole("button", { name: "Prüfen" }));
    expect(screen.getByText(/^[✔✘]/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Nächste Zahl/ })).toBeTruthy();
  });
});
