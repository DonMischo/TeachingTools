import { describe, it, expect } from "vitest";
import {
  gemischteReihenfolge, istNachNameSortiert, leistenAenderung, nachNameSortiert,
  startAngeheftet, zielAnheften, zielAusrichtung, zielLoesen,
} from "@/lib/maus/taskleiste";
import { begruessungGeaendert, zielProfilTier } from "@/lib/maus/einstellungen";
import { ALLE_APPS, STANDARD_AUSSEHEN, type AppId } from "@/lib/maus/windows";

describe("Maus-Führerschein: Taskleiste & Start (Logik)", () => {
  it("heftet bevorzugt Paint an, sonst die nächste freie App", () => {
    expect(zielAnheften(STANDARD_AUSSEHEN)).toBe("paint");
    expect(zielAnheften({ ...STANDARD_AUSSEHEN, taskleiste: ["paint"] })).toBe("vlc");
  });

  it("liefert null, wenn schon alle Apps angeheftet sind", () => {
    expect(zielAnheften({ ...STANDARD_AUSSEHEN, taskleiste: ALLE_APPS.map(a => a.id) })).toBeNull();
  });

  it("löst bevorzugt Word, nie Explorer oder Einstellungen", () => {
    expect(zielLoesen(STANDARD_AUSSEHEN)).toBe("word");
    expect(zielLoesen({ ...STANDARD_AUSSEHEN, taskleiste: ["explorer", "edge", "einstellungen"] })).toBe("edge");
    expect(zielLoesen({ ...STANDARD_AUSSEHEN, taskleiste: ["explorer", "einstellungen"] })).toBeNull();
  });

  it("verlangt immer die andere Ausrichtung", () => {
    expect(zielAusrichtung(STANDARD_AUSSEHEN)).toBe("links");
    expect(zielAusrichtung({ ...STANDARD_AUSSEHEN, ausrichtung: "links" })).toBe("mitte");
  });

  it("sortiert nach dem deutschen App-Namen, nicht nach der Id", () => {
    // Ids: dieserpc < papierkorb < zip — Namen: 7-Zip < Dieser PC < Papierkorb
    expect(nachNameSortiert(["papierkorb", "zip", "dieserpc"])).toEqual(["zip", "dieserpc", "papierkorb"]);
    expect(istNachNameSortiert(["zip", "dieserpc", "papierkorb"])).toBe(true);
    expect(istNachNameSortiert(["papierkorb", "zip"])).toBe(false);
  });

  it("mischt eine sortierte Liste sichtbar — und lässt kurze Listen in Ruhe", () => {
    const sortiert = nachNameSortiert(STANDARD_AUSSEHEN.desktop);
    const gemischt = gemischteReihenfolge(sortiert);
    expect(istNachNameSortiert(gemischt)).toBe(false);
    expect([...gemischt].sort()).toEqual([...sortiert].sort());
    expect(gemischteReihenfolge(["paint"] as AppId[])).toEqual(["paint"]);
  });

  it("zeigt das Anheften-Ziel immer im Startmenü", () => {
    expect(startAngeheftet("paint")).toContain("paint");
    expect(startAngeheftet("audacity")[0]).toBe("audacity");
  });

  it("erkennt, was an der Taskleiste dazukam oder wegfiel", () => {
    expect(leistenAenderung(["word", "edge"], ["edge", "paint"])).toEqual({ dazu: ["paint"], weg: ["word"] });
  });
});

describe("Maus-Führerschein: Profil (Logik)", () => {
  it("nimmt das eigene Tier — oder ein anderes, wenn es schon das Profilbild ist", () => {
    expect(zielProfilTier(STANDARD_AUSSEHEN, "cat", ["cat", "dog"])).toBe("cat");
    expect(zielProfilTier({ ...STANDARD_AUSSEHEN, profilTier: "cat" }, "cat", ["cat", "dog", "fox"], () => 0)).toBe("dog");
  });

  it("zählt nur eine neue, nicht leere Begrüßung", () => {
    const start = { ...STANDARD_AUSSEHEN, begruessung: "Hallo" };
    expect(begruessungGeaendert({ ...start, begruessung: "   " }, start)).toBe(false);
    expect(begruessungGeaendert(start, start)).toBe(false);
    expect(begruessungGeaendert({ ...start, begruessung: "Moin Mia" }, start)).toBe(true);
  });
});
