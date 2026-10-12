/**
 * Rechnen-Modus der Waage (Grundschule): Dinge zählen und vergleichen,
 * das Zeichen in der Mitte folgt den Schalen.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Gleichungswaage from "@/components/waage/Gleichungswaage";
import { vergleich, wert } from "@/components/waage/RechnenModus";

describe("Rechnen-Modus", () => {
  it("rechnet Plus, Minus und einzelne Zahlen", () => {
    expect(wert({ a: 3, op: "+", b: 5 })).toBe(8);
    expect(wert({ a: 7, op: "−", b: 2 })).toBe(5);
    expect(wert({ a: 4, op: "", b: 9 })).toBe(4);
  });

  it("Krokodilmaul öffnet sich zur größeren Zahl", () => {
    expect(vergleich(3, 8)).toBe("<");
    expect(vergleich(8, 3)).toBe(">");
    expect(vergleich(5, 5)).toBe("=");
  });

  it("startet mit 3 Äpfel + 5 Äpfel = 8 Äpfel und zeigt < nach einem Apfel mehr rechts", () => {
    render(<Gleichungswaage />);
    fireEvent.click(screen.getByRole("button", { name: /🍎 Rechnen/ }));
    expect(screen.getByRole("img", { name: "Waage: 3 + 5 = 8" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Rechte Schale: erste Zahl größer" }));
    expect(screen.getByRole("img", { name: "Waage: 3 + 5 < 9" })).toBeInTheDocument();
  });

  it("hält die Waage im Rateteil fest, bis ein Zeichen gewählt ist", () => {
    render(<Gleichungswaage />);
    fireEvent.click(screen.getByRole("button", { name: /🍎 Rechnen/ }));
    fireEvent.click(screen.getByRole("button", { name: /Welches Zeichen/ }));
    expect(screen.getByRole("img", { name: /\?/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "=" }));
    expect(screen.queryByRole("img", { name: /\?/ })).not.toBeInTheDocument();
  });
});
