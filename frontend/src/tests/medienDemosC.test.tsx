import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { TonbandDemo, istSauber } from "@/components/medien/demos/Tonband";
import { OverheadDemo } from "@/components/medien/demos/Overhead";

const ziel = ["Das", "Radio", "bringt"];
const seg = (w: string[], gekl = true) => w.map(wort => ({ wort, gekl }));

describe("Medien-Demos C", () => {
  it("rendert beide Demos", () => {
    expect(render(<TonbandDemo />).container.textContent).toContain("Bandschnitt");
    expect(render(<OverheadDemo />).container.textContent).toContain("Overheadprojektor");
  });
  it("istSauber", () => {
    expect(istSauber(seg(ziel), ziel)).toBe(true);
    expect(istSauber(seg(["Das", "ähm", "Radio", "bringt"]), ziel)).toBe(false);
    expect(istSauber([...seg(["Das"]), ...seg(["Radio", "bringt"], false)], ziel)).toBe(false);
  });
});
