/**
 * Ziehen und Klicken auf der Zeichenfläche.
 *
 * Diese Wege hängen an echten Pixelmaßen, und die gibt es weder in jsdom noch
 * in einem versteckten Browserfenster von allein — dort ist jedes Element
 * 0 × 0 groß. Die Größe wird hier deshalb vorgetäuscht; ohne sie bricht die
 * Umrechnung absichtlich ab (siehe pxToUnits), und ein Test würde nur
 * bestätigen, dass nichts passiert.
 */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import Funktionen from "@/components/simulationen/Funktionen";

/** Größe vortäuschen und Pointer-Capture stumm schalten. */
function praepariere(svg: Element) {
  svg.getBoundingClientRect = () => ({
    x: 0, y: 0, left: 0, top: 0, right: 1280, bottom: 920,
    width: 1280, height: 920, toJSON: () => ({}),
  }) as DOMRect;
  Object.assign(svg, {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: () => true,
  });
}

const graph = (c: HTMLElement) => c.querySelector('svg[aria-label^="Graph von"]')!;

/**
 * Achsenbeschriftungen als Zahlen. Die Achsen werden am Textanker
 * auseinandergehalten: x-Striche stehen mittig unter der Achse, y-Striche
 * rechtsbündig daneben. Ohne diese Trennung mischt ein senkrechtes Ziehen
 * die y-Werte in die x-Liste — genau daran ist die erste Fassung dieses
 * Tests gescheitert.
 */
function labels(svg: Element, achse: "x" | "y"): number[] {
  const anker = achse === "x" ? "middle" : "end";
  return [...svg.querySelectorAll(`text[text-anchor="${anker}"]`)]
    .map(t => t.textContent ?? "")
    .filter(t => /^[−-]?[\d,]+$/.test(t))
    .map(t => Number(t.replace("−", "-").replace(",", ".")));
}
const xLabels = (svg: Element) => labels(svg, "x");
const yLabels = (svg: Element) => labels(svg, "y");

describe("Zeichenfläche ziehen", () => {
  it("verschiebt den Ausschnitt in Zugrichtung", () => {
    const { container } = render(<Funktionen />);
    const svg = graph(container);
    praepariere(svg);

    const vorher = xLabels(svg);
    fireEvent.pointerDown(svg, { button: 0, pointerId: 1, clientX: 640, clientY: 460 });
    fireEvent.pointerMove(svg, { button: 0, buttons: 1, pointerId: 1, clientX: 840, clientY: 460 });
    const nachher = xLabels(svg);

    // Nach rechts gezogen ⇒ das Fenster wandert nach links ⇒ kleinere Werte.
    expect(Math.min(...nachher)).toBeLessThan(Math.min(...vorher));
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 840, clientY: 460 });
  });

  it("verschiebt senkrecht, ohne die Breite zu ändern", () => {
    const { container } = render(<Funktionen />);
    const svg = graph(container);
    praepariere(svg);

    const vorherX = xLabels(svg);
    const vorherY = yLabels(svg);
    fireEvent.pointerDown(svg, { button: 0, pointerId: 1, clientX: 640, clientY: 460 });
    fireEvent.pointerMove(svg, { button: 0, buttons: 1, pointerId: 1, clientX: 640, clientY: 600 });

    // Nur y verschoben: die x-Beschriftung bleibt, die y-Werte wandern mit.
    expect(xLabels(svg)).toEqual(vorherX);
    // Nach unten gezogen ⇒ das Fenster wandert nach oben ⇒ größere y-Werte.
    expect(Math.max(...yLabels(svg))).toBeGreaterThan(Math.max(...vorherY));
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 640, clientY: 600 });
  });

  it("driftet nicht: zurückziehen stellt den Ausschnitt wieder her", () => {
    const { container } = render(<Funktionen />);
    const svg = graph(container);
    praepariere(svg);

    const vorher = xLabels(svg);
    fireEvent.pointerDown(svg, { button: 0, pointerId: 1, clientX: 640, clientY: 460 });
    for (const x of [700, 800, 900, 800, 700, 640]) {
      fireEvent.pointerMove(svg, { button: 0, buttons: 1, pointerId: 1, clientX: x, clientY: 460 });
    }
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 640, clientY: 460 });

    expect(xLabels(svg)).toEqual(vorher);
  });

  it("rührt sich nicht, solange die Maus nicht gedrückt ist", () => {
    const { container } = render(<Funktionen />);
    const svg = graph(container);
    praepariere(svg);

    const vorher = xLabels(svg);
    fireEvent.pointerMove(svg, { pointerId: 1, clientX: 900, clientY: 300 });
    expect(xLabels(svg)).toEqual(vorher);   // nur abgetastet, nicht geschoben
  });
});

describe("Ziehen und Klicken auseinanderhalten", () => {
  const rechenwegOffen = () => !!document.body.textContent?.includes("Woher kommt der Wert?");

  it("öffnet den Rechenweg bei einem Klick ohne Bewegung", () => {
    const { container } = render(<Funktionen />);
    const svg = graph(container);
    praepariere(svg);
    const punkt = svg.querySelectorAll("circle")[0];

    fireEvent.pointerDown(svg, { button: 0, pointerId: 1, clientX: 640, clientY: 460 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 640, clientY: 460 });
    fireEvent.click(punkt);

    expect(rechenwegOffen()).toBe(true);
  });

  it("öffnet ihn nicht, wenn davor gezogen wurde", () => {
    const { container } = render(<Funktionen />);
    const svg = graph(container);
    praepariere(svg);
    const punkt = svg.querySelectorAll("circle")[0];

    fireEvent.pointerDown(svg, { button: 0, pointerId: 1, clientX: 640, clientY: 460 });
    fireEvent.pointerMove(svg, { button: 0, buttons: 1, pointerId: 1, clientX: 800, clientY: 460 });
    fireEvent.pointerUp(svg, { pointerId: 1, clientX: 800, clientY: 460 });
    fireEvent.click(punkt);

    expect(rechenwegOffen()).toBe(false);
  });
});

describe("Formelsatz in der Oberfläche", () => {
  it("setzt jede Formel fehlerfrei — auch die Schnipsel aus der Komponente", () => {
    const { container } = render(<Funktionen />);
    // Ein einfacher Backslash im Quelltext (\t, \f) käme hier als
    // Steuerzeichen an und KaTeX würde die Quelle rot anzeigen.
    expect(container.querySelectorAll(".katex-error")).toHaveLength(0);
    expect(container.querySelectorAll(".katex").length).toBeGreaterThan(5);
  });

  it("enthält keine Steuerzeichen im gesetzten Text", () => {
    const { container } = render(<Funktionen />);
    const text = container.textContent ?? "";
    expect(text).not.toMatch(/[\f\v\b]/);
    expect(text).not.toContain("extcolor");   // Rest eines zerfallenen \textcolor
    expect(text).not.toContain("rac{");       // Rest eines zerfallenen \frac
  });

  it("schreibt die Punkte als P(x/y), gesetzt", () => {
    const { container } = render(<Funktionen />);
    const zeilen = [...container.querySelectorAll("tr")];
    const punktZeile = zeilen.find(tr => tr.querySelector("th")?.textContent === "Punkt");
    expect(punktZeile).toBeTruthy();
    const erste = punktZeile!.querySelector("td");
    expect(erste?.querySelector(".katex")).toBeTruthy();
    expect(erste?.textContent).toMatch(/^P\(/);
  });
});
