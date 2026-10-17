import { describe, it, expect } from "vitest";
import { aufgedeckt, galgenTeile, GALGEN_MAX, maskiere, verdeckte, verteile } from "@/lib/challenge/gluecksrad";

describe("Glücksrad: Rätselwand", () => {
  it("verdeckt Buchstaben inkl. Umlaute und ß, lässt Satzzeichen und Ziffern offen", () => {
    const wand = maskiere("Größe: 3 Äpfel!", []);
    expect(wand.map((w) => w.map((k) => (k.verdeckt ? "_" : k.zeichen)).join(""))).toEqual(["_____:", "3", "_____!"]);
  });
  it("deckt ohne Beachtung der Groß-/Kleinschreibung auf", () => {
    const wand = maskiere("Äpfel Anna", ["ä", "a"]);
    expect(wand.flat().filter((k) => !k.verdeckt).map((k) => k.zeichen).join("")).toBe("ÄAa");
    expect(verdeckte("Anna", ["a"])).toBe(2);
    expect(verdeckte("Hallo Welt", [], true)).toBe(0);
  });
});

describe("Glücksrad: Buchstaben je Frage", () => {
  const text = "Strom und Wellen";
  const ids = ["c3", "c1", "c2"];
  it("verteilt jeden Buchstaben genau einmal, fest je Text und unabhängig von der Reihenfolge der Fragen", () => {
    const a = verteile(text, ids);
    const alle = Object.values(a).flat();
    expect(new Set(alle)).toEqual(new Set("stromundwel"));
    expect(alle).toHaveLength(new Set(alle).size);
    expect(verteile(text, ["c1", "c2", "c3"])).toEqual(a);
    // gleichmäßig: höchstens ein Buchstabe Unterschied
    const n = Object.values(a).map((b) => b.length);
    expect(Math.max(...n) - Math.min(...n)).toBeLessThanOrEqual(1);
  });
  it("erst alle gelösten Fragen decken das ganze Wort auf; Teiltreffer die Hälfte des Anteils", () => {
    const a = verteile(text, ids);
    expect(verdeckte(text, aufgedeckt(a, ["c1", "c2"]))).toBeGreaterThan(0);
    expect(verdeckte(text, aufgedeckt(a, ids))).toBe(0);
    expect(aufgedeckt(a, [], ["c1"])).toEqual(a.c1.slice(0, Math.ceil(a.c1.length / 2)));
  });
  it("mehr Fragen als Buchstaben: manche Anteile sind leer", () => {
    const a = verteile("Ab", ["x", "y", "z"]);
    expect(Object.values(a).flat().sort()).toEqual(["a", "b"]);
  });
});

describe("Glücksrad: Galgen", () => {
  it("zwei Teile je verlorenem Leben, voll beim letzten", () => {
    expect(galgenTeile(3)).toBe(0);
    expect(galgenTeile(2)).toBe(2);
    expect(galgenTeile(1)).toBe(4);
    expect(galgenTeile(0)).toBe(GALGEN_MAX);
  });
});
