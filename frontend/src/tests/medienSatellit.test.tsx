import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SatellitDemo } from "@/components/medien/demos/Satellit";

describe("SatellitDemo", () => {
  it("zeigt ohne WebGL den Ersatztext", async () => {
    render(<SatellitDemo />);
    expect(await screen.findByText(/3D-Ansicht nicht verfügbar/)).toBeTruthy();
  });
});
