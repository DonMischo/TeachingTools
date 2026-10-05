import { describe, it, expect } from "vitest";
import { AUSWAHL_APPS, alternativen, ziehKarten } from "@/lib/maus/apps";
import { APPS, APP_AUFGABEN, DATEITYPEN, type AppId } from "@/lib/maus/windows";

describe("apps: ziehKarten", () => {
  it("zieht die gewünschte Anzahl", () => {
    const liste = [1, 2, 3, 4, 5];
    expect(ziehKarten(liste, 3, () => 0)).toHaveLength(3);
  });

  it("liefert höchstens so viele wie vorhanden sind", () => {
    const liste = [1, 2, 3];
    expect(ziehKarten(liste, 10, () => 0)).toHaveLength(3);
  });

  it("mischt deterministisch mit einer festen Zufallsfunktion", () => {
    const liste = [1, 2, 3, 4, 5];
    const a = ziehKarten(liste, 5, () => 0.5);
    const b = ziehKarten(liste, 5, () => 0.5);
    expect(a).toEqual(b);
  });

  it("verändert die Ausgangsliste nicht", () => {
    const liste = [1, 2, 3];
    ziehKarten(liste, 2, () => 0.9);
    expect(liste).toEqual([1, 2, 3]);
  });
});

describe("apps: alternativen", () => {
  it("nennt weitere richtige Apps ohne die gewählte", () => {
    const aufgabe = { richtig: ["word", "writer"] as AppId[] };
    expect(alternativen(aufgabe, "word")).toEqual(["writer"]);
  });

  it("ist leer, wenn nur eine Antwort richtig ist", () => {
    const aufgabe = { richtig: ["paint"] as AppId[] };
    expect(alternativen(aufgabe, "paint")).toEqual([]);
  });
});

describe("apps: Datengrundlage", () => {
  it("jede Aufgaben-Antwort ist eine echte App und hat mindestens eine wählbare (Nicht-System-)Antwort", () => {
    for (const a of APP_AUFGABEN) {
      for (const id of a.richtig) expect(APPS[id]).toBeDefined();
      expect(a.richtig.some(id => AUSWAHL_APPS.includes(id))).toBe(true);
    }
  });

  it("jede Dateityp-Antwort ist eine echte App und hat mindestens eine wählbare (Nicht-System-)Antwort", () => {
    for (const d of DATEITYPEN) {
      for (const id of d.richtig) expect(APPS[id]).toBeDefined();
      expect(d.richtig.some(id => AUSWAHL_APPS.includes(id))).toBe(true);
    }
  });

  it("AUSWAHL_APPS enthält keine System-Apps", () => {
    expect(AUSWAHL_APPS).not.toContain("papierkorb");
    expect(AUSWAHL_APPS).not.toContain("dieserpc");
    expect(AUSWAHL_APPS).not.toContain("einstellungen");
    expect(AUSWAHL_APPS).not.toContain("explorer");
  });
});

describe("Dateitypen und App-Infos", () => {
  it("jedes Beispiel hat eine bekannte Art, und jede Art kommt vor", async () => {
    const { DATEI_ARTEN, DATEI_BEISPIELE, artVon } = await import("@/lib/maus/apps");
    const arten = DATEI_BEISPIELE.map(artVon);
    expect(arten).not.toContain(null);
    for (const a of DATEI_ARTEN) expect(arten).toContain(a.id);
  });

  it("liest die Endung ohne Rücksicht auf Groß- und Kleinschreibung", async () => {
    const { artVon, endungVon } = await import("@/lib/maus/apps");
    expect(endungVon("Urlaub.JPG")).toBe(".jpg");
    expect(artVon("Mein.Referat.pptx")).toBe("praesentation");
    expect(artVon("ohne-endung")).toBeNull();
  });

  it("jede wählbare App hat eine Kurzinfo", async () => {
    const { APP_INFO, AUSWAHL_APPS } = await import("@/lib/maus/apps");
    for (const id of AUSWAHL_APPS) expect(APP_INFO[id]?.was, id).toBeTruthy();
  });
});
