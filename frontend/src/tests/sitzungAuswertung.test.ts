import { describe, it, expect } from "vitest";
import { alsCsv, auswerten } from "@/lib/sitzung/auswertung";
import type { SitzungAnsicht } from "@/lib/sitzung/typen";

const zeile = (name: string, daten: Record<string, unknown>, min: number, fertig = false) => ({
  name, klasse: "7a", gast: name === "Mia", daten, aktuell: null,
  beigetreten_am: "2026-11-25T10:00:00Z", aktualisiert_am: new Date(Date.parse("2026-11-25T10:00:00Z") + min * 60000).toISOString(),
  fertig_am: fertig ? "2026-11-25T10:30:00Z" : null,
});

const ansicht: SitzungAnsicht = {
  spalten: [{ id: "z", titel: "Bestzeit", art: "zeit", wert: d => (d.ms as number) ?? null }],
  aufgaben: [{ id: "a", titel: "Leicht" }, { id: "b", titel: "Schwer; mit Semikolon" }],
  geschafft: (d, id) => ((d.ok as string[]) ?? []).includes(id),
};

describe("auswerten", () => {
  const zeilen = [zeile("Ada", { ok: ["a", "b"], ms: 41000 }, 20, true), zeile("Mia", { ok: ["a"] }, 10)];

  it("berechnet Kennzahlen und die schwersten Aufgaben", () => {
    const a = auswerten(zeilen, ansicht);
    expect(a.kennzahlen).toEqual({ teilnehmende: 2, fertig: 1, fortschritt: 0.75, minuten: 15 });
    expect(a.schwerste[0]).toMatchObject({ id: "b", geschafft: 1, quote: 0.5 });
  });

  it("baut eine Tabelle mit Fortschritt, Spalten, Gast und fertig", () => {
    const a = auswerten(zeilen, ansicht);
    expect(a.kopf).toEqual(["Name", "Klasse", "Fortschritt", "Bestzeit", "Gerade", "Fertig"]);
    expect(a.tabelle[0]).toEqual(["Ada", "7a", "100 %", "41,0 s", "", "ja"]);
    expect(a.tabelle[1][0]).toBe("Mia (Gast)");
  });

  it("CSV mit BOM, Semikolon und Anführungszeichen bei Sonderzeichen", () => {
    const csv = alsCsv({ ...auswerten(zeilen, ansicht), kopf: ["A;B", "C"] });
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.split("\r\n")[0].slice(1)).toBe('"A;B";C');
  });

  it("ohne Ansicht nur Name, Klasse, Gerade, Fertig", () => {
    expect(auswerten(zeilen).kopf).toEqual(["Name", "Klasse", "Gerade", "Fertig"]);
  });
});
