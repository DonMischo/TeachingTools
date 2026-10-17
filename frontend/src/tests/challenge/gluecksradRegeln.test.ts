import { describe, it, expect } from "vitest";
import { maskiere, verdeckte, zaehle } from "@/lib/challenge/gluecksrad";

describe("Glücksrad: Rätselwand", () => {
  it("verdeckt Buchstaben inkl. Umlaute und ß, lässt Satzzeichen und Ziffern offen", () => {
    const wand = maskiere("Größe: 3 Äpfel!", []);
    expect(wand.map((w) => w.map((k) => (k.verdeckt ? "_" : k.zeichen)).join(""))).toEqual(["_____:", "3", "_____!"]);
  });
  it("deckt ohne Beachtung der Groß-/Kleinschreibung auf", () => {
    const wand = maskiere("Äpfel Anna", ["ä", "a"]);
    expect(wand.flat().filter((k) => !k.verdeckt).map((k) => k.zeichen).join("")).toBe("ÄAa");
    expect(zaehle("Anna", "A")).toBe(2);
    expect(verdeckte("Anna", ["a"])).toBe(2);
  });
  it("alles = true zeigt den ganzen Text", () => {
    expect(verdeckte("Hallo Welt", [], true)).toBe(0);
  });
});
