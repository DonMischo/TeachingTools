import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RohrpostDemo, ziel, weg } from "@/components/medien/demos/Rohrpost";
import { LitfassDemo } from "@/components/medien/demos/Litfass";

describe("Rohrpost", () => {
  it("rendert", () => {
    render(<RohrpostDemo />);
    expect(screen.getByRole("button", { name: /Druckluft/ })).toBeTruthy();
  });
  it("Weichen führen zum richtigen Amt", () => {
    expect(ziel([true, true, true, true])).toBe("alex");
    expect(ziel([true, true, true, false])).toBe("potsdamer");
    expect(ziel([true, false, true, true])).toBe("moabit");
    expect(ziel([false, true, true, true])).toBe("zoo");
    expect(ziel([false, true, false, true])).toBe("kreuzberg");
    expect(weg([false, true, true, true]).punkte.length).toBe(4);
  });
});

describe("Litfass", () => {
  it("zeigt ohne WebGL den Ersatz", async () => {
    render(<LitfassDemo />);
    expect(await screen.findByRole("img", { name: /Flache Litfaßsäule/ })).toBeTruthy();
    expect(screen.getByText(/Schichten: 0/)).toBeTruthy();
  });
});
