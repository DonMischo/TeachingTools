import { describe, it, expect } from "vitest";
import { GUELTIGE_SATZ_IDS, STUFEN, saetze } from "@/lib/kikompass/raster";
import { PHASEN, VORLAGEN } from "@/lib/kikompass/aktiv";
import { PROJEKTE } from "@/lib/kikompass/projekte";
import {
  DATENSCHUTZ_REGEL, OPERATOREN, materialPrompt, umbauHinweise, umbauPrompt, type Umbau,
} from "@/lib/kikompass/werkstatt";

describe("AKTIV(ER)-Weg", () => {
  it("hat alle acht Phasen in Reihenfolge, je mit Checkliste und gültigen Vorlagen", () => {
    expect(PHASEN.map(p => p.id)).toEqual(["analyse", "A", "K", "T", "I", "V", "E", "R"]);
    for (const p of PHASEN) {
      expect(p.checkliste.length).toBeGreaterThanOrEqual(3);
      for (const v of p.vorlagen) expect(VORLAGEN[v]).toBeDefined();
    }
  });

  it("baut jede Vorlage mit Titel", () => {
    for (const v of Object.values(VORLAGEN)) {
      const b = v.bloecke();
      expect(b[0].art).toBe("titel");
      expect(b.length).toBeGreaterThan(3);
    }
  });
});

describe("Material-Prompt", () => {
  it("enthält die Ziele des Feldes, Operatoren der Stufe und die Datenschutzregel", () => {
    const p = materialPrompt({ fach: "Deutsch", klasse: "7", thema: "Werbung", bereich: "reflektieren", stufe: "Ib", dimension: "ueber", art: "Fallbeispiel" });
    for (const k of saetze("reflektieren", "Ib")) expect(p).toContain(k.text);
    expect(p).toContain(OPERATOREN.Ib[0]);
    expect(p).toContain("Deutsch");
    expect(p).toContain(DATENSCHUTZ_REGEL);
  });

  it("hat Operatoren für jede Stufe", () => {
    for (const s of STUFEN) expect(OPERATOREN[s.id].length).toBeGreaterThan(0);
  });
});

describe("Aufgaben-Umbauer", () => {
  const basis: Umbau = { aufgabe: "Schreibe eine Erörterung.", fach: "Deutsch", klasse: "9", dimension: "trotz", einsatz: "punktuell", zuhause: true, resilienz: [] };

  it("warnt bei Hausaufgaben ohne Resilienz und bei KI ohne Reflexion", () => {
    const h = umbauHinweise(basis);
    expect(h.some(x => x.includes("Zu Hause"))).toBe(true);
    expect(h.some(x => x.includes("Reflexionsteil"))).toBe(true);
  });

  it("ist zufrieden, wenn Resilienz und Reflexion eingeplant sind", () => {
    expect(umbauHinweise({ ...basis, resilienz: ["persoenlich", "reflexion"] })).toEqual([]);
  });

  it("erkennt den Widerspruch »ohne KI« mit KI-Einsatz", () => {
    expect(umbauHinweise({ ...basis, dimension: "ohne", resilienz: ["persoenlich", "reflexion"] }).length).toBe(1);
  });

  it("übernimmt Aufgabe und Bausteine in den Prompt", () => {
    const p = umbauPrompt({ ...basis, resilienz: ["muendlich"] });
    expect(p).toContain("Schreibe eine Erörterung.");
    expect(p).toContain("mündliche Rückfrage");
    expect(p).toContain("Nutzungserklärung");
    expect(umbauPrompt({ ...basis, einsatz: "ohne", dimension: "ohne" })).toContain("ohne KI gearbeitet");
  });
});

describe("Projekte", () => {
  it("haben eindeutige Ids und verweisen nur auf vorhandene Kann-Sätze der Stufe II", () => {
    expect(new Set(PROJEKTE.map(p => p.id)).size).toBe(PROJEKTE.length);
    for (const p of PROJEKTE) {
      for (const k of p.kann) {
        expect(GUELTIGE_SATZ_IDS.has(k)).toBe(true);
        expect(k).toMatch(/-II-/);
      }
      expect(p.ablauf.length).toBeGreaterThanOrEqual(3);
      expect(p.kriterien.length).toBeGreaterThanOrEqual(3);
    }
  });
});
