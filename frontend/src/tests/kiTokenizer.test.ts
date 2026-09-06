/**
 * Der Zerleger. Die wichtigste Eigenschaft steht ganz oben: was zerlegt wurde,
 * muss sich wieder zusammensetzen lassen — sonst zeigt das Minispiel einen
 * anderen Satz an als den, der dasteht.
 */
import { describe, it, expect } from "vitest";
import { zerlege, schnitte, bewerte, VOKABULAR } from "@/lib/ki/tokenizer";

const text = (s: string) => zerlege(s).map(t => t.text);

describe("Zerlegen", () => {
  it("setzt sich wieder zum Original zusammen", () => {
    for (const s of [
      "Schreibe einen kurzen Text über eine Katze.",
      "Die kleine Katze schläft auf dem warmen Kissen.",
      "Xylophon-Ölfässer, 42 Stück!",
      "",
    ]) {
      expect(zerlege(s).map(t => t.text).join("")).toBe(s);
    }
  });

  it("nimmt an jeder Stelle das längste passende Stück", () => {
    expect(text("Schreibe einen kurzen Text über eine Katze.")).toEqual([
      "Schreib", "e", " einen", " kurz", "en", " Text", " über", " eine", " Katze", ".",
    ]);
  });

  it("hängt das Leerzeichen an das Wort dahinter", () => {
    const tokens = zerlege("Die Katze");
    expect(tokens.map(t => t.text)).toEqual(["Die", " Katze"]);
    expect(tokens[1].text.startsWith(" ")).toBe(true);
  });

  it("unterscheidet den Satzanfang vom selben Wort mitten im Satz", () => {
    const [gross] = zerlege("Die");
    const [klein] = zerlege(" die");
    expect(gross.id).not.toBe(klein.id);
  });

  it("gibt bekannten Stücken eine Listennummer, unbekannten ihren Zeichencode", () => {
    const [bekannt] = zerlege(" Katze");
    expect(bekannt.bekannt).toBe(true);
    expect(bekannt.id).toBeGreaterThanOrEqual(1000);

    const [unbekannt] = zerlege("Ψ");
    expect(unbekannt.bekannt).toBe(false);
    expect(unbekannt.id).toBe("Ψ".charCodeAt(0));
  });

  it("vergibt jede Nummer nur einmal", () => {
    expect(new Set(VOKABULAR).size).toBe(VOKABULAR.length);
  });

  it("zählt den Anfang nicht als Schnittstelle", () => {
    const s = schnitte(zerlege(" Katze schläft"));
    expect(s).not.toContain(0);
    expect(s.length).toBe(zerlege(" Katze schläft").length - 1);
  });
});

describe("Wertung des Minispiels", () => {
  it("trennt Treffer, Verpasstes und Danebengesetztes", () => {
    const w = bewerte([2, 5, 9], [2, 5, 7]);
    expect(w.treffer).toEqual([2, 5]);
    expect(w.verpasst).toEqual([7]);
    expect(w.daneben).toEqual([9]);
    expect(w.quote).toBe(50);
  });

  it("gibt volle Punkte, wenn beide Seiten gar nichts schneiden", () => {
    expect(bewerte([], []).quote).toBe(100);
  });

  it("straft übereifriges Schneiden", () => {
    expect(bewerte([1, 2, 3, 4], [1]).quote).toBe(25);
  });
});
