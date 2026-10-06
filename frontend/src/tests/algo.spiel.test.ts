import { describe, expect, it } from "vitest";
import { bausteine, fuehreAus, type Programm } from "@/lib/algo/spiel";
import { LEVEL } from "@/lib/algo/level";
import { THEMEN, fuelle } from "@/lib/algo/themen";

const P = (...haupt: Programm["haupt"]): Programm => ({ haupt, fn: [] });

describe("Interpreter", () => {
  const gang = { zeilen: ["######", "#>..a#", "######"] };

  it("läuft, sammelt und gewinnt", () => {
    const lauf = fuehreAus(gang, P({ t: "wiederhole", n: 3, k: [{ t: "vor" }] }, { t: "nimm" }));
    expect(lauf.ergebnis.ok).toBe(true);
    expect(lauf.schritte.at(-1)).toMatchObject({ x: 4, y: 1 });
  });

  it("meldet die Wand als nicht ausführbar", () => {
    const lauf = fuehreAus(gang, P({ t: "links" }, { t: "links" }, { t: "vor" }));
    expect(lauf.ergebnis).toMatchObject({ ok: false, fehler: { art: "ausfuehrbar" } });
  });

  it("meldet leeres Nehmen als nicht ausführbar", () => {
    expect(fuehreAus(gang, P({ t: "nimm" })).ergebnis).toMatchObject({ ok: false, fehler: { art: "ausfuehrbar" } });
  });

  it("erkennt Endlosschleifen", () => {
    const lauf = fuehreAus(gang, P({ t: "bis", b: { art: "ziel" }, k: [{ t: "links" }] }));
    expect(lauf.ergebnis).toMatchObject({ ok: false, fehler: { art: "endlich" } });
  });

  it("erkennt endlose Selbstaufrufe", () => {
    const lauf = fuehreAus(gang, { haupt: [{ t: "rufe" }], fn: [{ t: "rufe" }] });
    expect(lauf.ergebnis).toMatchObject({ ok: false, fehler: { art: "endlich" } });
  });

  it("meldet ein unfertiges Programm", () => {
    expect(fuehreAus(gang, P({ t: "vor" })).ergebnis).toMatchObject({ ok: false, fehler: { art: "unfertig" } });
  });

  it("hält die Reihenfolge bei bZuletzt ein", () => {
    const karte = { zeilen: ["#####", "#>ba#", "#####"], bZuletzt: true };
    expect(fuehreAus(karte, P({ t: "vor" }, { t: "nimm" })).ergebnis).toMatchObject({ ok: false, fehler: { art: "reihenfolge" } });
  });

  it("lässt sich vom Gegner erwischen, auch beim Platztausch", () => {
    const karte = { zeilen: ["######", "#>..a#", "######"], gegner: [{ weg: [[3, 1], [2, 1]] as [number, number][] }] };
    expect(fuehreAus(karte, P({ t: "vor" })).ergebnis).toMatchObject({ ok: false, fehler: { art: "gegner" } });
  });
});

describe("Vorhersagen", () => {
  it("enden nicht alle auf dem Ziel — sonst wären sie zu leicht zu raten", async () => {
    const { ausgangVon } = await import("@/lib/algo/spiel");
    const ausgaenge = LEVEL.filter(l => l.vorhersage).map(l => ausgangVon(fuehreAus(l.karten[0], l.vorhersage!)));
    expect(ausgaenge).toContain("geschafft");
    expect(ausgaenge).toContain("leer");
    expect(ausgaenge).toContain("wand");
  });
});

describe("Jäger", () => {
  it("holt Trödler ein, aber nicht den schnellen Weg", async () => {
    const { levelById } = await import("@/lib/algo/level");
    const l = levelById("8-4")!;
    const troedeln: Programm = { ...l.loesung, fn: [{ t: "bis", b: { art: "frei", nicht: true }, k: [{ t: "wenn", b: { art: "ding" }, k: [{ t: "nimm" }] }, { t: "rechts" }, { t: "links" }, { t: "vor" }] }] };
    for (const k of l.karten) {
      expect(fuehreAus(k, l.loesung).ergebnis.ok).toBe(true);
      expect(fuehreAus(k, troedeln).ergebnis).toMatchObject({ ok: false, fehler: { art: "gegner" } });
    }
  });
  it("Viren im Gang erwischen, wer nicht aufs Radar hört", async () => {
    const { levelById } = await import("@/lib/algo/level");
    const l = levelById("8-2")!;
    const blind = P({ t: "bis", b: { art: "ziel" }, k: [{ t: "wenn", b: { art: "ding" }, k: [{ t: "nimm" }] }, { t: "vor" }] });
    for (const k of l.karten) expect(fuehreAus(k, blind).ergebnis.ok).toBe(false);
  });
});

describe("Level", () => {
  it("haben eindeutige Ids", () => {
    expect(new Set(LEVEL.map(l => l.id)).size).toBe(LEVEL.length);
  });

  for (const l of LEVEL) {
    describe(l.id, () => {
      it("Musterlösung löst jede Karte", () => {
        for (const k of l.karten) expect(fuehreAus(k, l.loesung).ergebnis).toEqual({ ok: true });
      });
      it("Musterlösung hat genau die Bestzahl an Bausteinen", () => {
        expect(bausteine(l.loesung)).toBe(l.optimal);
        if (l.maxBloecke) expect(l.maxBloecke).toBeGreaterThanOrEqual(l.optimal);
      });
      it("Musterlösung benutzt nur erlaubte Bausteine und Bedingungen", () => {
        const typen = new Set<string>(), bed = new Set<string>();
        const geh = (liste: Programm["haupt"]) => liste.forEach(b => {
          typen.add(b.t);
          if (b.t === "wiederhole" || b.t === "bis") geh(b.k);
          if (b.t === "bis" || b.t === "wenn") bed.add(b.b.art);
          if (b.t === "wenn") { geh(b.k); geh(b.sonst ?? []); }
        });
        geh(l.loesung.haupt); geh(l.loesung.fn);
        for (const t of typen) expect(l.bloecke).toContain(t);
        for (const b of bed) expect(l.bedingungen ?? []).toContain(b);
      });
      if (l.vorlage) it("die Vorlage ist wirklich kaputt", () => {
        expect(fuehreAus(l.karten[0], l.vorlage!).ergebnis.ok).toBe(false);
      });
      it("alle Platzhalter lassen sich füllen", () => {
        for (const t of THEMEN) {
          expect(fuelle(l.text + (l.tipp ?? "") + l.titel, t)).not.toMatch(/\{\w+\}/);
        }
      });
    });
  }
});

describe("Blockly-JSON", () => {
  it("übersteht den Hin- und Rückweg für jede Musterlösung", async () => {
    const { ausJson, zuJson } = await import("@/lib/algo/blocklyJson");
    for (const l of LEVEL) {
      const mitFn = l.bloecke.includes("rufe");
      expect(ausJson(JSON.parse(JSON.stringify(zuJson(l.loesung, mitFn))))).toEqual(mitFn ? l.loesung : { ...l.loesung, fn: [] });
    }
  });

  it("bewahrt »nicht« und »sonst«", async () => {
    const { ausJson, zuJson } = await import("@/lib/algo/blocklyJson");
    const p: Programm = { haupt: [{ t: "wenn", b: { art: "frei", nicht: true }, k: [{ t: "links" }], sonst: [{ t: "vor" }] }], fn: [] };
    expect(ausJson(zuJson(p, false))).toEqual(p);
  });
});
