/**
 * Das Wortnetz ohne Oberfläche.
 *
 * Der wichtigste Test ist der letzte: er läuft hunderte Wege durch jedes Netz
 * und prüft, dass keiner davon in einem ungrammatischen Satz endet. Solange
 * er grün ist, kann ein neues Thema (siehe Bauanleitung in `netze.ts`)
 * gefahrlos dazukommen — ein Tippfehler oder eine Sackgasse fällt hier auf
 * und nicht vor der Klasse.
 */
import { describe, it, expect } from "vitest";
import {
  baueNetz, kandidaten, lockvoegel, maschinenwahl, erwartbarkeit, textAus,
  anzahlAuswahl, ERLAUBT, NetzFehler, type NetzRoh, type Wort,
} from "@/lib/ki/wortnetz";
import { NETZE, netzMit } from "@/lib/ki/netze";
import { rng, signatur, seedAusSignatur } from "@/lib/ki/rng";

const katze = netzMit("katze");

/** Ein Minimalnetz zum Kaputtmachen — jeder Test verbiegt genau eine Sache. */
function roh(aenderung: Partial<NetzRoh> = {}): NetzRoh {
  return {
    slug: "test", titel: "Test", icon: "🧪", prompt: "Prompt",
    woerter: { artikel: ["die"], nomen: ["Katze"], verb: ["schläft"], punkt: ["."] },
    start: { die: 1 },
    folgt: { die: { Katze: 1 }, Katze: { schläft: 1 }, "schläft": { ".": 1 } },
    ...aenderung,
  };
}

describe("Netz bauen", () => {
  it("baut jedes mitgelieferte Thema", () => {
    expect(NETZE.length).toBeGreaterThan(0);
    for (const netz of NETZE) {
      expect(netz.woerter.length).toBeGreaterThan(10);
      expect(netz.prompt).not.toBe("");
    }
  });

  it("normiert jede Wahrscheinlichkeitsverteilung auf 1", () => {
    for (const netz of NETZE) {
      const summe = (ks: { p: number }[]) => ks.reduce((s, k) => s + k.p, 0);
      expect(summe(netz.start)).toBeCloseTo(1, 10);
      for (const [id, ks] of netz.folgt) {
        expect(summe(ks), `${netz.slug}/${id}`).toBeCloseTo(1, 10);
      }
    }
  });

  it("sortiert die Fortsetzungen absteigend", () => {
    for (const netz of NETZE) {
      for (const ks of netz.folgt.values()) {
        const ps = ks.map(k => k.p);
        expect([...ps].sort((a, b) => b - a)).toEqual(ps);
      }
    }
  });

  it("meldet ein Wort, das in keiner Liste steht", () => {
    expect(() => baueNetz(roh({ folgt: { die: { Hund: 1 }, Katze: { schläft: 1 }, "schläft": { ".": 1 } } })))
      .toThrow(NetzFehler);
  });

  it("meldet eine Kante gegen den Satzbauplan", () => {
    expect(() => baueNetz(roh({ folgt: { die: { schläft: 1 }, Katze: { schläft: 1 }, "schläft": { ".": 1 } } })))
      .toThrow(/Satzbauplan/);
  });

  it("meldet eine Sackgasse", () => {
    expect(() => baueNetz(roh({ folgt: { die: { Katze: 1 }, Katze: { schläft: 1 } } })))
      .toThrow(/keine Fortsetzung/);
  });

  it("meldet ein unerreichbares Wort", () => {
    expect(() => baueNetz(roh({
      woerter: { artikel: ["die"], nomen: ["Katze", "Maus"], verb: ["schläft"], punkt: ["."] },
      folgt: { die: { Katze: 1 }, Katze: { schläft: 1 }, Maus: { schläft: 1 }, "schläft": { ".": 1 } },
    }))).toThrow(/unerreichbar/);
  });

  it("meldet ein Gewicht von 0", () => {
    expect(() => baueNetz(roh({ start: { die: 0 } }))).toThrow(/größer als 0/);
  });

  it("meldet einen Artikel, der nicht zum Geschlecht des Nomens passt", () => {
    // »die Kater« besteht den Satzbauplan (Artikel → Nomen) und ist trotzdem
    // falsch. Nur die Merkmale fangen das ab.
    expect(() => baueNetz(roh({
      woerter: { artikel: ["die"], nomen: ["Kater"], verb: ["schläft"], punkt: ["."] },
      merkmale: { die: ["nom.f"], Kater: ["nom.m"] },
      folgt: { die: { Kater: 1 }, Kater: { schläft: 1 }, "schläft": { ".": 1 } },
    }))).toThrow(/Fall oder Geschlecht/);
  });

  it("lässt eine Kante zu, sobald sich die Merkmale überschneiden", () => {
    // »dem« passt zu Maskulinum *und* Neutrum — eines davon muss reichen.
    expect(() => baueNetz(roh({
      woerter: { artikel: ["dem"], nomen: ["Kissen"], punkt: ["."] },
      merkmale: { dem: ["dat.m", "dat.n"], Kissen: ["dat.n"] },
      start: { dem: 1 },
      folgt: { dem: { Kissen: 1 }, Kissen: { ".": 1 } },
    }))).not.toThrow();
  });

  it("prüft nichts, wo keine Merkmale stehen", () => {
    // Verben, Adverbien und das Bindewort tragen keine — sie bleiben ungeprüft.
    expect(() => baueNetz(roh())).not.toThrow();
  });

  it("meldet ein Merkmal für ein Wort, das es nicht gibt", () => {
    expect(() => baueNetz(roh({ merkmale: { Hund: ["nom.m"] } }))).toThrow(/merkmale/);
  });

  it("gibt jedem Wort der mitgelieferten Themen Fall und Geschlecht, wo es zählt", () => {
    for (const netz of NETZE) {
      for (const w of netz.woerter) {
        if (w.art === "artikel" || w.art === "adjektiv" || w.art === "nomen" || w.art === "praeposition") {
          expect(w.merkmale.length, `${netz.slug}: »${w.text}« hat keine Merkmale`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("Vorschläge", () => {
  it("zeigt bei Mut 0 genau einen Vorschlag und steigert sich bis sechs", () => {
    expect(anzahlAuswahl(0)).toBe(1);
    expect(anzahlAuswahl(5)).toBe(6);
    expect(kandidaten(katze, [], 0)).toHaveLength(1);
    expect(kandidaten(katze, [], 5).length).toBeLessThanOrEqual(6);
  });

  it("fängt nach dem Punkt einen neuen Satz an", () => {
    const punkt = katze.woerter.find(w => w.art === "punkt")!;
    expect(kandidaten(katze, [punkt], 5).map(k => k.wort.text))
      .toEqual(kandidaten(katze, [], 5).map(k => k.wort.text));
  });

  it("schlägt nur grammatisch mögliche Wörter vor", () => {
    for (const netz of NETZE) {
      for (const wort of netz.woerter) {
        for (const k of kandidaten(netz, [wort], 5)) {
          const erlaubt = wort.art === "punkt"
            ? ["artikel", "adverb", "nomen"]
            : ERLAUBT[wort.art];
          expect(erlaubt, `${wort.text} → ${k.wort.text}`).toContain(k.wort.art);
        }
      }
    }
  });

  it("zeigt Lockvögel mit Begründung — und nie ein erlaubtes Wort", () => {
    for (const netz of NETZE) {
      for (const wort of netz.woerter) {
        for (const l of lockvoegel(netz, wort)) {
          expect(ERLAUBT[wort.art]).not.toContain(l.wort.art);
          expect(l.grund.length).toBeGreaterThan(10);
        }
      }
    }
  });
});

describe("Würfeln und Rechnen", () => {
  it("wählt immer eines der angebotenen Wörter", () => {
    const ks = kandidaten(katze, [], 5);
    const wuerfel = rng(7);
    for (let i = 0; i < 200; i++) {
      expect(ks).toContain(maschinenwahl(ks, wuerfel));
    }
  });

  it("würfelt mit demselben Startwert dieselbe Folge", () => {
    const ks = kandidaten(katze, [], 5);
    const lauf = (seed: number) => {
      const wuerfel = rng(seed);
      return Array.from({ length: 20 }, () => maschinenwahl(ks, wuerfel).wort.text);
    };
    expect(lauf(42)).toEqual(lauf(42));
    expect(lauf(42)).not.toEqual(lauf(43));
  });

  it("misst die Erwartbarkeit als geometrisches Mittel, unabhängig von der Länge", () => {
    expect(erwartbarkeit([0.5, 0.5])).toBeCloseTo(0.5, 10);
    expect(erwartbarkeit([0.5, 0.5, 0.5, 0.5])).toBeCloseTo(0.5, 10);
    expect(erwartbarkeit([0.9, 0.1])).toBeCloseTo(0.3, 10);
    expect(erwartbarkeit([0.9])).toBeGreaterThan(erwartbarkeit([0.1]));
  });

  it("gibt derselben Wortwahl dieselbe Signatur", () => {
    expect(signatur([1, 2, 3])).toBe(signatur([1, 2, 3]));
    expect(signatur([1, 2, 3])).not.toBe(signatur([3, 2, 1]));
    expect(signatur([1, 2, 3])).toMatch(/^[0-9A-Z]{3}-[0-9A-Z]{3}$/);
    expect(seedAusSignatur(signatur([1, 2, 3]))).toBe(seedAusSignatur(signatur([1, 2, 3])));
  });
});

describe("Text schreiben", () => {
  it("schreibt Satzanfänge groß und klebt den Punkt an", () => {
    const w = (text: string, art: Wort["art"]): Wort => ({ id: 0, text, art, merkmale: [] });
    expect(textAus([
      w("die", "artikel"), w("Katze", "nomen"), w("schläft", "verb"), w(".", "punkt"),
      w("die", "artikel"), w("Maus", "nomen"), w("wartet", "verb"), w(".", "punkt"),
    ])).toBe("Die Katze schläft. Die Maus wartet.");
  });

  it("läuft viele Wege durch jedes Netz, ohne aus dem Satzbauplan zu fallen", () => {
    // Verstöße werden gesammelt statt einzeln behauptet: eine Zusicherung je
    // Schritt kostet bei drei Netzen mehr Zeit als der ganze Test darf.
    const fehler: string[] = [];
    for (const netz of NETZE) {
      const wuerfel = rng(1234);
      for (let lauf = 0; lauf < 400; lauf++) {
        let vorher: Wort | null = null;
        let saetze = 0;
        // 120 Schritte sind reichlich für drei Sätze (im Mittel gut 25 Wörter).
        // Wer die Grenze reißt, hat eine Schleife gebaut, aus der das Netz
        // nicht mehr zum Punkt findet.
        for (let schritt = 0; schritt < 120 && saetze < 3; schritt++) {
          const ks = kandidaten(netz, vorher ? [vorher] : [], 5);
          if (!ks.length) { fehler.push(`${netz.slug}: Sackgasse hinter »${vorher?.text}«`); break; }
          const gewaehlt = maschinenwahl(ks, wuerfel).wort;
          if (vorher && vorher.art !== "punkt" && !ERLAUBT[vorher.art].includes(gewaehlt.art)) {
            fehler.push(`${netz.slug}: ${vorher.text} → ${gewaehlt.text}`);
          }
          if (gewaehlt.art === "punkt") saetze++;
          vorher = gewaehlt;
        }
        if (saetze < 3) fehler.push(`${netz.slug}: kam in 120 Schritten nicht zu drei Sätzen`);
      }
    }
    expect(fehler.slice(0, 5)).toEqual([]);
  });
});
