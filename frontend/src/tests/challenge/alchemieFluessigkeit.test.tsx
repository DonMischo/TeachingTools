import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import Fluessigkeit, { zuRgb } from "@/components/fluessigkeit/Fluessigkeit";

describe("Fluessigkeit", () => {
  it("zeigt ohne WebGL den statischen Verlauf", async () => {
    render(<Fluessigkeit farbe="#44aa66" fuellstand={0.5} breite={100} hoehe={150} form="kessel" />);
    expect(await screen.findByTestId("fluessigkeit-fallback")).toHaveStyle({ height: "50%" });
  });
  it("liest Hex, hsl und rgb", () => {
    expect(zuRgb("#ff0000")).toEqual([1, 0, 0]);
    expect(zuRgb("hsl(120 100% 50%)")[1]).toBeCloseTo(1);
    expect(zuRgb("rgb(0 255 0)")).toEqual([0, 1, 0]);
  });
});
