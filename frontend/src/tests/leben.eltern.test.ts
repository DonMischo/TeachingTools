import { describe, expect, it } from "vitest";
import { neuesSpiel } from "@/lib/leben/motor";
import { ELTERN_ORTE, elternOrt } from "@/lib/leben/wohnungen";

const start = (eltern: string) => neuesSpiel({
  name: "Kim", geburtstag: "2010-03-15", avatar: "🧑", farbe: "#f59e0b", kirche: false, seed: 1,
  zeugnis: { abschluss: "RSA", noten: { Deutsch: 2, Mathematik: 2, Englisch: 2 } },
  herkunft: { eltern, elternEinkommen: "mittel", kindergeld: "weiter" },
});

describe("Elternhaus in Erfurt", () => {
  it("kennt alle Stadtteile und Außenorte", () => {
    const orte = Object.values(ELTERN_ORTE);
    expect(orte.filter((o) => o.art === "stadt").length).toBeGreaterThanOrEqual(19);
    expect(orte.filter((o) => o.art === "dorf").length).toBeGreaterThanOrEqual(32);
    expect(ELTERN_ORTE.Stotternheim.extraMin).toBeGreaterThan(ELTERN_ORTE.Altstadt.extraMin);
  });
  it("startet im gewählten Ort, alte Schlüssel bleiben gültig", () => {
    expect(start("Stotternheim").wohnung.stadtteil).toBe("Stotternheim");
    expect(start("erfurt").wohnung.stadtteil).toBe("Herrenberg");
    expect(start("land").wohnung.stadtteil).toBe("Kölleda");
    expect(elternOrt({ herkunft: { eltern: "gibtsnicht" } }).stadtteil).toBe("Herrenberg");
  });
});
