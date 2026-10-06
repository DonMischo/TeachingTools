import { describe, expect, it } from "vitest";
import { AUFGABEN, BEISPIELE, ausProgramm, baue, beispiel, hatSchleife, laufeDurch, pruefe, pruefeBau, rechne, vergleiche } from "@/lib/algo/fluss";
import { LEVEL } from "@/lib/algo/level";

describe("Rechensprache", () => {
  it("rechnet mit Punkt vor Strich, mod und Klammern", () => {
    expect(rechne("3*T + M", { T: 14, M: 10 })).toBe(52);
    expect(rechne("52 mod 7", {})).toBe(3);
    expect(rechne("(2 + 3) · 4", {})).toBe(20);
    expect(rechne("7 : 2", {})).toBe(3.5);
  });
  it("vergleicht", () => {
    expect(vergleiche("z mod 2 = 0", { z: 4 })).toBe(true);
    expect(vergleiche("x >= 7", { x: 6 })).toBe(false);
    expect(vergleiche("x ≠ 3", { x: 6 })).toBe(true);
  });
  it("meldet unbekannte Namen", () => {
    expect(() => rechne("y + 1", {})).toThrow(/y/);
  });
});

describe("Beispiele", () => {
  for (const b of BEISPIELE) it(`${b.id} ist ein gültiges Diagramm`, () => expect(pruefe(b.diagramm)).toEqual([]));
  it("Geburtstagsrechnung rechnet", () => {
    expect(laufeDurch(beispiel("geburtstag")!.diagramm, [14, 10]).ausgaben).toEqual(["3"]);
  });
  it("gerade/ungerade entscheidet", () => {
    expect(laufeDurch(beispiel("teiler")!.diagramm, [7]).ausgaben).toEqual(["Ausgabe: ungerade"]);
  });
  it("Schleifen werden erkannt", () => {
    expect(hatSchleife(beispiel("lexikon")!.diagramm)).toBe(true);
    expect(hatSchleife(beispiel("geburtstag")!.diagramm)).toBe(false);
  });
});

describe("Prüfung", () => {
  it("findet fehlende Pfeile und Endlosschleifen", () => {
    const d = baue([{ typ: "aktion", text: "A" }]);
    expect(pruefe({ ...d, kanten: [] }).length).toBeGreaterThan(0);
    const kreis = { knoten: [{ id: "s", typ: "start" as const, text: "Start", x: 0, y: 0 }, { id: "a", typ: "aktion" as const, text: "A", x: 0, y: 0 }, { id: "e", typ: "ende" as const, text: "Ende", x: 0, y: 0 }],
      kanten: [{ von: "s", nach: "a" }, { von: "a", nach: "a" }] };
    expect(pruefe(kreis).some(p => /nicht endlich/.test(p.text))).toBe(true);
  });
});

describe("Aufgaben", () => {
  it("die Musterlösung der Geburtstags-Aufgabe besteht ihre Tests", () => {
    const a = AUFGABEN.find(x => x.id === "bauen-geburtstag")!;
    expect(pruefeBau(a, beispiel("geburtstag")!.diagramm)).toEqual([]);
  });
  it("das Lexikon-Beispiel erfüllt die Lexikon-Aufgabe", () => {
    expect(pruefeBau(AUFGABEN.find(x => x.id === "bauen-lexikon")!, beispiel("lexikon")!.diagramm)).toEqual([]);
  });
  it("die Fehler-Aufgabe verbiegt wirklich einen Pfeil", () => {
    const a = AUFGABEN.find(x => x.id === "fehler")!;
    const { diagramm, falsch } = a.kaputt!(beispiel(a.beispiel!)!.diagramm);
    expect(falsch).toBeGreaterThanOrEqual(0);
    expect(pruefe(diagramm).length).toBeGreaterThan(0);
  });
});

describe("Programm als Flussdiagramm", () => {
  for (const l of LEVEL) it(`${l.id} ergibt ein gültiges Diagramm`, () => expect(pruefe(ausProgramm(l.loesung))).toEqual([]));
});
