import { describe, expect, it } from "vitest";
import { alsMarkdown, eintragAlsMarkdown, filtern, KI_VORSPANN, type Bereich } from "@/lib/featureListe";

const B: Bereich[] = [
  { id: "aktivitaeten", name: "Aktivitäten", eintraege: [
    { id: "caputh", name: "Caputh", typ: "Quiz", kann: ["Live-Sitzung mit Code", "Bilder in Fragen"], faehigkeiten: { use: [true, true], host: [true, false] } },
  ] },
  { id: "simulationen", name: "Simulationen", eintraege: [
    { id: "waage", name: "Gleichungswaage", typ: null, kann: ["Reaktionsgleichungen ausgleichen"], faehigkeiten: {} },
    { id: "pse", name: "Periodensystem", typ: null, kann: ["Steckbrief mit Foto"], faehigkeiten: {} },
  ] },
];

describe("filtern", () => {
  it("findet über Punkte, alle Wörter müssen passen, ohne Akzente", () => {
    expect(filtern(B, "reaktionsgleichungen").map(b => b.eintraege.map(e => e.id))).toEqual([["waage"]]);
    expect(filtern(B, "bilder fragen")[0].eintraege[0].id).toBe("caputh");
    expect(filtern(B, "bilder chemie")).toEqual([]);
    expect(filtern(B, "AKTIVITATEN")[0].id).toBe("aktivitaeten");
  });
  it("grenzt auf einen Bereich ein und lässt leere Bereiche weg", () => {
    const r = filtern(B, "", "simulationen");
    expect(r.map(b => b.id)).toEqual(["simulationen"]);
    expect(r[0].eintraege).toHaveLength(2);
  });
});

describe("Markdown für die KI", () => {
  const d = { name: "TT", beschreibung: "Plattform" };
  it("enthält Vorspann, Bereiche, Einträge und Freigaben", () => {
    const md = alsMarkdown(d, B);
    expect(md.startsWith(KI_VORSPANN)).toBe(true);
    expect(md).toContain("## Simulationen");
    expect(md).toContain("### Caputh (Quiz)");
    expect(md).toContain("Standard: öffnen: Lehrkräfte und Schüler·innen; hosten: Lehrkräfte");
    expect(md).toContain("- Reaktionsgleichungen ausgleichen");
  });
  it("ohne Vorspann für den Download, einzeln je Eintrag", () => {
    expect(alsMarkdown(d, B, false).startsWith("# TT")).toBe(true);
    const e = eintragAlsMarkdown(B[1], B[1].eintraege[1]);
    expect(e).toContain("### Periodensystem");
    expect(e).not.toContain("Caputh");
  });
});
