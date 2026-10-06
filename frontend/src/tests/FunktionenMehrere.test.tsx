/**
 * Mehrere Funktionen: Auswahl für die Wertetabelle und Schnittpunkte.
 */
import { describe, it, expect } from "vitest";
import { render, fireEvent, screen } from "@testing-library/react";
import Funktionen from "@/components/simulationen/Funktionen";

/** Zeilenköpfe der Wertetabelle, in Reihenfolge. */
const zeilen = (c: HTMLElement) => [...c.querySelectorAll("table th")].map(th => th.textContent);

function mitG(term: string) {
  const r = render(<Funktionen />);
  fireEvent.click(screen.getByText(/weitere Funktion/));
  fireEvent.change(screen.getByLabelText("Funktionsterm g"), { target: { value: term } });
  return r;
}

describe("Mehrere Funktionen", () => {
  it("g kommt dazu, die Tabelle bleibt zunächst die volle von f", () => {
    const { container } = mitG("-x + 4");
    expect(zeilen(container)).toEqual(["x", "f(x)", "Punkt", "Rechnung", ""]);
  });

  it("nur g angehakt: volle Tabelle für g", () => {
    const { container } = mitG("-x + 4");
    fireEvent.click(screen.getByRole("checkbox", { name: "f(x)" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "g(x)" }));
    expect(zeilen(container)).toEqual(["x", "g(x)", "Punkt", "Rechnung", ""]);
  });

  it("f und g angehakt: nur x und die Werte, ohne Rechnung und Punkt", () => {
    const { container } = mitG("-x + 4");
    fireEvent.click(screen.getByRole("checkbox", { name: "g(x)" }));
    expect(zeilen(container)).toEqual(["x", "f(x)", "g(x)"]);
    // x = 1: f = 2·1 + 1 = 3, g = −1 + 4 = 3
    const g = [...container.querySelectorAll("table tr")][2];
    expect([...g.querySelectorAll("td")].map(td => td.textContent)).toEqual(["7", "6", "5", "4", "3", "2", "1"]);
  });

  it("Schnittpunkt wird berechnet und im Graphen markiert", () => {
    const { container } = mitG("-x + 4");
    // 2x + 1 = −x + 4 ⇒ x = 1, y = 3
    expect(screen.getByText(/Schnittpunkte:/).parentElement!.textContent).toContain("S1(1 | 3)");
    const svg = container.querySelector('svg[aria-label^="Graph von"]')!;
    expect(svg.textContent).toContain("S1(1 | 3)");
  });

  it("entfernen nimmt g aus Graph und Tabelle", () => {
    const { container } = mitG("-x + 4");
    fireEvent.click(screen.getByRole("checkbox", { name: "g(x)" }));
    fireEvent.click(screen.getByLabelText("g entfernen"));
    expect(zeilen(container)).toEqual(["x", "f(x)", "Punkt", "Rechnung", ""]);
    expect(screen.queryByText(/Schnittpunkte:/)).toBeNull();
  });
});

describe("Einrasten am Schnittpunkt", () => {
  it("hat Vorrang vor einem näheren Tabellenpunkt", () => {
    // f = 2x + 1 und g = x² − 1 schneiden sich bei x = 1 ± √3 — keine Tabellenstellen.
    // Geprüft wird S1 bei 1 − √3 ≈ −0,732; der nächste Tabellenpunkt ist (−1 | −1).
    const { container } = mitG("x^2 - 1");
    const svg = container.querySelector('svg[aria-label^="Graph von"]')!;
    svg.getBoundingClientRect = () => ({
      x: 0, y: 0, left: 0, top: 0, right: 640, bottom: 460, width: 640, height: 460, toJSON: () => ({}),
    }) as DOMRect;

    const ring = [...svg.querySelectorAll("circle")].find(c => c.getAttribute("r") === "6")!;
    const s = { x: Number(ring.getAttribute("cx")), y: Number(ring.getAttribute("cy")) };
    const punkte = [...svg.querySelectorAll('circle[r="4"]')]
      .map(c => ({ x: Number(c.getAttribute("cx")), y: Number(c.getAttribute("cy")) }));
    const p = punkte.reduce((a, b) => (Math.hypot(b.x - s.x, b.y - s.y) < Math.hypot(a.x - s.x, a.y - s.y) ? b : a));

    // Zeiger zwischen beide, näher am Tabellenpunkt — beide im Einrastabstand.
    const z = { x: s.x + 0.6 * (p.x - s.x), y: s.y + 0.6 * (p.y - s.y) };
    expect(Math.hypot(z.x - p.x, z.y - p.y)).toBeLessThan(Math.hypot(z.x - s.x, z.y - s.y));
    expect(Math.hypot(z.x - s.x, z.y - s.y)).toBeLessThan(14);

    fireEvent.pointerMove(svg, { clientX: z.x, clientY: z.y });
    // Die Beschriftung am Zeiger (beginnt mit »(«) — nicht die Legende.
    const amZeiger = [...svg.querySelectorAll("text")].map(t => t.textContent).filter(t => t?.startsWith("("));
    expect(amZeiger).toEqual(["(-0,732 | -0,464)"]);
  });
});

describe("Vorlagen als Menü je Funktion", () => {
  it("die Vorlage für g setzt nur g, f bleibt", () => {
    mitG("");
    fireEvent.change(screen.getByLabelText("Vorlage für g"), { target: { value: "parabel" } });
    expect((screen.getByLabelText("Funktionsterm g") as HTMLInputElement).value).toMatch(/\^2/);
    expect((screen.getByLabelText("Funktionsterm") as HTMLInputElement).value).toBe("2x + 1");
  });

  it("alle gültigen Terme stehen gesetzt nebeneinander", () => {
    const { container } = mitG("x^2 - 1");
    expect(container.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryAllByRole("button", { name: /^Parabel/ })).toHaveLength(0);
  });
});
