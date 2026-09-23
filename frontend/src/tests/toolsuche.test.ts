/**
 * Das Suchfeld über den Kachelseiten (Aktivitäten, Simulationen, Tools).
 *
 * Die Listen sind lang geworden; wer weiß, was er sucht, soll nicht scrollen
 * müssen.
 */
import { describe, it, expect } from "vitest";
import { passtZurSuche } from "@/components/ToolSuche";

const karte = {
  title: "Rechenregeln",
  description: "Punkt vor Strich am Obstkorb, Klammern sind Kisten. Für Klasse 5 und 6.",
};

describe("passtZurSuche", () => {
  it("zeigt ohne Eingabe alles", () => {
    expect(passtZurSuche(karte, "")).toBe(true);
    expect(passtZurSuche(karte, "   ")).toBe(true);
  });

  it("findet über den Titel, ohne Rücksicht auf Gross- und Kleinschreibung", () => {
    expect(passtZurSuche(karte, "RECHEN")).toBe(true);
    expect(passtZurSuche(karte, "regeln")).toBe(true);
  });

  it("findet auch, was nur in der Beschreibung steht", () => {
    // Sonst fände »Klammern« die Rechenregeln nicht — im Titel steht das Wort nicht.
    expect(passtZurSuche(karte, "klammern")).toBe(true);
  });

  it("verlangt bei mehreren Wörtern alle, auch verteilt", () => {
    // »rechnen klasse 5« darf greifen, obwohl die Angaben auseinanderstehen.
    expect(passtZurSuche(karte, "rechen klasse")).toBe(true);
    expect(passtZurSuche(karte, "rechen bruchrechnung")).toBe(false);
  });

  it("findet nichts, was nicht da ist", () => {
    expect(passtZurSuche(karte, "sonnensystem")).toBe(false);
  });
});
