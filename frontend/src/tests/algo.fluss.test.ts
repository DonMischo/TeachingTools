import { describe, expect, it } from "vitest";
import { AUFGABEN, BEISPIELE, LUECKE, ausProgramm, baue, beispiel, geruestVon, hatSchleife, laufeDurch, pruefe, pruefeBau, rechne, vergleiche, type Diagramm } from "@/lib/algo/fluss";
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
  it("liest »3T« als 3 · T, % als mod und Namen ohne Groß-/Kleinschreibung", () => {
    expect(rechne("3T + m", { T: 14, M: 10 })).toBe(52);
    expect(rechne("2(x + 1)", { x: 2 })).toBe(6);
    expect(rechne("52 % 7", {})).toBe(3);
    expect(rechne("x MOD 7", { x: 52 })).toBe(3);
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

describe("Protokoll und Kippen", () => {
  it("schreibt Rechnungen mit eingesetzten Zahlen mit", async () => {
    const { startStand, weiter, brauchtAntwort } = await import("@/lib/algo/fluss");
    const d = beispiel("geburtstag")!.diagramm;
    let st = startStand(d);
    const ein = [14, 10];
    while (!st.fertig) st = weiter(d, st, brauchtAntwort(d, st)?.art === "zahl" ? ein.shift() : undefined);
    expect(st.protokoll).toEqual(["Eingabe: T = 14", "Eingabe: M = 10", "x = 3 · 14 + 10 = 52", "r = 52 mod 7 = 3", "Ausgabe: r = 3"]);
  });
  it("kippt hin und zurück ohne Verlust", async () => {
    const { kippe, zurueckKippen } = await import("@/lib/algo/fluss");
    const d = beispiel("lexikon")!.diagramm;
    const z = zurueckKippen(kippe(d));
    z.knoten.forEach((k, i) => { expect(k.x).toBeCloseTo(d.knoten[i].x); expect(k.y).toBeCloseTo(d.knoten[i].y); });
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
  it("rechnet auch, wenn die Rechnung nur im Kastentext steht (Aufgabe 6)", () => {
    const k = (id: string, typ: Diagramm["knoten"][number]["typ"], text: string, y: number) => ({ id, typ, text, x: 110, y });
    const d: Diagramm = {
      knoten: [k("s", "start", "Start", 0), k("a", "io", "Eingabe: t", 1), k("b", "io", "eingabe M", 2), k("c", "aktion", "x = 3T + M", 3),
        k("d", "aktion", "r = x mod 7", 4), k("f", "io", "ausgabe r", 5), k("e", "ende", "Ende", 6)],
      kanten: [["s", "a"], ["a", "b"], ["b", "c"], ["c", "d"], ["d", "f"], ["f", "e"]].map(([von, nach]) => ({ von, nach })),
    };
    expect(pruefeBau(AUFGABEN.find(x => x.id === "bauen-geburtstag")!, d)).toEqual([]);
  });
  it("Text-Ausgaben ohne Rechnung bleiben Text", () => {
    expect(laufeDurch(beispiel("teiler")!.diagramm, [4]).ausgaben).toEqual(["Ausgabe: gerade"]);
  });
  it("das Lexikon-Gerüst hat Lücken und fehlende Pfeile, ausgefüllt ist es gelöst", () => {
    const a = AUFGABEN.find(x => x.id === "bauen-lexikon")!;
    const g = geruestVon(a)!;
    expect(g.knoten.filter(k => k.text === LUECKE)).toHaveLength(3);
    expect(pruefeBau(a, g)[0]).toMatch(/3 Lücken/);
    const gefuellt = { ...g, knoten: g.knoten.map(k => (a.luecken![k.id] ? { ...k, text: a.luecken![k.id] } : k)) };
    expect(pruefeBau(a, gefuellt).length).toBeGreaterThan(0);
    const kanten = [...gefuellt.kanten, ...a.fehlendePfeile!.map(([von, nach]) => ({ von, nach, ...(von === "k3" ? { marke: "ja" as const } : {}) }))];
    expect(pruefeBau(a, { ...gefuellt, kanten })).toEqual([]);
  });
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

describe("D2-Ansicht", () => {
  it("übersetzt Formen, Marken und Hervorhebung in D2-Code", async () => {
    const { alsD2, d2Text } = await import("@/lib/algo/flussD2");
    const d = beispiel("teiler")!.diagramm;
    const code = alsD2(d, { theme: 3, skizze: true, quer: true, aktiv: d.knoten[1].id });
    expect(code).toContain("theme-id: 3");
    expect(code).toContain("sketch: true");
    expect(code).toContain("direction: right");
    expect(code).toContain("shape: diamond");
    expect(code).toContain("shape: parallelogram");
    expect(code).toMatch(/-> n_\w+: ja/);
    expect(code).toContain("stroke-width: 5");
    expect(d2Text('a "b" \\ c')).toBe('"a \\"b\\" \\\\ c"');
  });
});
