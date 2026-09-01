/**
 * Der Bruch im Rechenweg muss wirklich gesetzt werden.
 *
 * Beim ersten Anlauf stand im Quelltext `\frac` mit nur einem Backslash — in
 * einem TypeScript-Template ist `\f` aber ein Seitenvorschub. KaTeX bekam
 * dadurch ein Steuerzeichen statt des Befehls und zeigte den Quelltext rot an,
 * statt einen Bruch zu setzen. Von außen sah es aus wie ein KaTeX-Problem.
 * Diese Tests prüfen deshalb das Ergebnis, nicht die Absicht.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import katex from "katex";
import { Protokoll } from "@/components/waage/Balance";
import { equationToLatex, sideToLatex, type Side } from "@/lib/gleichung";

const halfX: Side = [{ t: "x", n: 1 / 2 }, { t: "n", n: -7 }];

describe("Bruch als LaTeX", () => {
  it("enthält keinen Seitenvorschub, sondern den Befehl \\frac", () => {
    const tex = sideToLatex(halfX);
    expect(tex).toContain("\\frac{1}{2}x");
    // \f wäre ein Steuerzeichen — genau der Fehler von vorher.
    expect(tex).not.toMatch(/[\f\v\b]/);
  });

  it("wird von KaTeX zu einem echten Bruch gesetzt", () => {
    const html = katex.renderToString(sideToLatex(halfX), { throwOnError: false, output: "html" });
    expect(html).toContain("mfrac");      // KaTeX setzt einen Bruch
    expect(html).not.toContain("katex-error");
  });

  it("steht auch in der ganzen Gleichung als Bruch", () => {
    const tex = equationToLatex({ left: halfX, right: [{ t: "n", n: -4 }] });
    const html = katex.renderToString(tex, { throwOnError: false, output: "html" });
    expect(html).toContain("mfrac");
    expect(html).not.toContain("katex-error");
  });

  it("erscheint im Rechenweg als Bruch, nicht als Quelltext", () => {
    const { container } = render(
      <Protokoll tex lines={[{ left: sideToLatex(halfX), right: "-4" }]} />,
    );
    expect(container.querySelectorAll(".mfrac").length).toBeGreaterThan(0);
    expect(container.textContent).not.toContain("frac{");
  });

  it("lässt ganze Faktoren unangetastet", () => {
    const html = katex.renderToString(sideToLatex([{ t: "x", n: 3 }]), {
      throwOnError: false, output: "html",
    });
    expect(html).not.toContain("mfrac");
    expect(html).not.toContain("katex-error");
  });
});
