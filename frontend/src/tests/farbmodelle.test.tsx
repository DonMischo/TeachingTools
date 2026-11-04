/**
 * Farbmodelle: Umrechnungen hin und zurück, Hex lesen, Farbmischer-Logik,
 * und die Blätter hängen an derselben Farbe.
 */
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Farbmodelle from "@/components/farbmodelle/Farbmodelle";
import {
  ausHex, cmykZuRgb, farbAbstand, farbSterne, hexFarbe, hslZuRgb, hsvZuRgb, kurzHex, rgbZuCmyk, rgbZuHsl, rgbZuHsv, zielFarbe, type Rgb,
} from "@/lib/farbmodelle";

function zufall(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

describe("Umrechnen", () => {
  it("kennt die Grundfarben", () => {
    expect(rgbZuHsv([255, 0, 0])).toEqual([0, 100, 100]);
    expect(rgbZuHsl([0, 0, 255])).toEqual([240, 100, 50]);
    expect(rgbZuCmyk([255, 255, 0])).toEqual([0, 0, 100, 0]);
    expect(rgbZuCmyk([0, 0, 0])).toEqual([0, 0, 0, 100]);
    expect(hsvZuRgb(120, 100, 100)).toEqual([0, 255, 0]);
    expect(hslZuRgb(60, 100, 50)).toEqual([255, 255, 0]);
    expect(hslZuRgb(0, 0, 100)).toEqual([255, 255, 255]);
  });
  it("kommt über jedes Modell zur selben Farbe zurück", () => {
    const r = zufall(7);
    for (let i = 0; i < 300; i++) {
      const c = [0, 0, 0].map(() => Math.floor(r() * 256)) as Rgb;
      expect(hsvZuRgb(...rgbZuHsv(c))).toEqual(c);
      expect(hslZuRgb(...rgbZuHsl(c))).toEqual(c);
      expect(cmykZuRgb(rgbZuCmyk(c))).toEqual(c);
    }
  });
  it("liest Hex lang, kurz und mit Fehlern", () => {
    expect(ausHex("#C80F3A")).toEqual([200, 15, 58]);
    expect(ausHex("f80")).toEqual([255, 136, 0]);
    expect(ausHex("#12345")).toBeNull();
    expect(ausHex("#GG0000")).toBeNull();
    expect(hexFarbe([255, 136, 0])).toBe("#FF8800");
    expect(kurzHex([255, 136, 0])).toBe("#F80");
    expect(kurzHex([255, 128, 0])).toBeNull();
  });
});

describe("Farbmischer", () => {
  it("Stufe 2 hat 0 als Einerstelle, Abstand und Sterne passen", () => {
    const r = zufall(5);
    for (let i = 0; i < 50; i++) expect(hexFarbe(zielFarbe(2, r))).toMatch(/^#([0-9A-F]0){3}$/);
    expect(farbAbstand([0, 0, 0], [255, 255, 255])).toBeCloseTo(1);
    expect(farbSterne(0)).toBe(3);
  });
});

describe("Simulation", () => {
  it("jedes Modell und jedes Blatt öffnet, die Farbe bleibt dieselbe", () => {
    render(<Farbmodelle />);
    for (const m of [/CMYK/, /HSV/, /HSL/, /RGB/]) fireEvent.click(screen.getByRole("button", { name: m }));
    fireEvent.change(screen.getByLabelText("Blau als Zahl"), { target: { value: "200" } });
    expect(screen.getByText("rgb(255, 128, 200)")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Hex ↔ Dez/ }));
    expect((screen.getByLabelText("Farbcode") as HTMLInputElement).value).toBe("#FF80C8");
    fireEvent.change(screen.getByLabelText("Farbcode"), { target: { value: "#0a0" } });
    expect((screen.getByLabelText("Grün dezimal") as HTMLInputElement).value).toBe("170");
    fireEvent.change(screen.getByLabelText("Rot Regler"), { target: { value: "200" } });
    expect((screen.getByLabelText("Farbcode") as HTMLInputElement).value).toBe("#C8AA00");
    expect((screen.getByLabelText("Rot dezimal") as HTMLInputElement).value).toBe("200");
    fireEvent.change(screen.getByLabelText("Zahl hexadezimal"), { target: { value: "FF" } });
    expect((screen.getByLabelText("Zahl dezimal") as HTMLInputElement).value).toBe("255");

    fireEvent.click(screen.getByRole("button", { name: /Farbmischer/ }));
    expect(screen.getByRole("button", { name: /Fertig gemischt/ })).toBeTruthy();
  });
});
