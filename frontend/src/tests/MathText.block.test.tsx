import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MathText } from "@/components/MathText";

const anzeige = (text: string) => render(<MathText text={text} blockEquations />).container.querySelectorAll(".katex-display").length;

describe("MathText mit blockEquations", () => {
  it("Gleichung am Zeilenende oder allein in der Zeile steht abgesetzt", () => {
    expect(anzeige("Löse: $2x + 5 = 17$")).toBe(1);
    expect(anzeige("Löse:\n$2x + 5 = 17$\nWie groß ist $x$?")).toBe(1);
    expect(anzeige("Löse $2x + 5 = 17$.")).toBe(1);
  });

  it("mitten im Satz bleibt sie in der Zeile — und bloße Symbole sowieso", () => {
    expect(anzeige("Löse die Gleichung $3x + 4 = 19$. Wie groß ist $x$?")).toBe(0);
    expect(anzeige("Für $a = 3$ und $b = 4$ gilt …")).toBe(0);
  });
});
