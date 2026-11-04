/**
 * Das Zählen. Hier fällt auf, wenn ein gelerntes Netz Wahrscheinlichkeiten
 * erfindet, über Satzgrenzen hinweg zählt oder in eine Sackgasse führt —
 * alles drei würde in der Klasse als »die KI spinnt« durchgehen.
 */
import { describe, it, expect } from "vitest";
import { woerterAus, trainiere, wegeAnzahl, zahlwort } from "@/lib/ki/trainieren";
import { KORPORA } from "@/lib/ki/korpora";
import { fortsetzungen, kandidaten, maschinenwahl, schluessel, textAus, type Wort } from "@/lib/ki/wortnetz";
import { netzMit } from "@/lib/ki/netze";
import { rng } from "@/lib/ki/rng";

const text = "Die Katze schläft. Die Katze frisst. Der Hund schläft.";

describe("Text in Wörter zerlegen", () => {
  it("macht aus jedem Satzzeichen ein eigenes Wort", () => {
    expect(woerterAus("Die Katze schläft.")).toEqual(["Die", "Katze", "schläft", "."]);
    expect(woerterAus("Wirklich? Ja!")).toEqual(["Wirklich", ".", "Ja", "."]);
    // zerlegte Umlaute (aus macOS/PDF kopiert) zählen als dasselbe Wort
    expect(woerterAus("Mädchen ".normalize("NFD") + "Mädchen")).toEqual(["Mädchen", "Mädchen"]);
  });

  it("wirft Anführungszeichen und Klammern weg", () => {
    // Sonst wären »Katze« und Katze zwei verschiedene Wörter — das Netz
    // zerfiele an Stellen, die niemand sieht.
    expect(woerterAus('Er sagte: "Katze" (leise).')).toEqual(["Er", "sagte", "Katze", "leise", "."]);
  });

  it("verträgt leere und wirre Eingaben", () => {
    expect(woerterAus("")).toEqual([]);
    expect(woerterAus("   \n  ")).toEqual([]);
    expect(woerterAus("...")).toEqual(["."]);
  });
});

describe("Zählen", () => {
  it("nimmt die Häufigkeit als Wahrscheinlichkeit", () => {
    const netz = trainiere(text, 2);
    const katze = netz.woerter.find(w => w.text === "Katze")!;
    const nach = netz.folgt.get(String(katze.id))!;
    // »Katze« kam zweimal, einmal mit »schläft«, einmal mit »frisst«.
    expect(nach.map(k => k.wort.text).sort()).toEqual(["frisst", "schläft"]);
    expect(nach[0].p).toBeCloseTo(0.5, 10);
  });

  it("zählt nicht über den Punkt hinweg", () => {
    const netz = trainiere(text, 2);
    const punkt = netz.woerter.find(w => w.text === ".")!;
    // Hinter dem Punkt geht es über die Startliste weiter, nicht über eine Kante.
    expect(netz.folgt.get(String(punkt.id))).toBeUndefined();
    expect(netz.start.map(k => k.wort.text)).toEqual(["Die", "Der"]);
  });

  it("sammelt die Satzanfänge mit ihrer Häufigkeit", () => {
    const netz = trainiere(text, 2);
    const die = netz.start.find(k => k.wort.text === "Die")!;
    expect(die.p).toBeCloseTo(2 / 3, 10);
  });

  it("legt für jeden Rückblick eine eigene Zählung an", () => {
    const netz = trainiere(text, 3);
    expect(netz.n).toBe(3);
    // Leerer Schlüssel = reine Worthäufigkeit, der Rückfall ganz unten.
    expect(netz.folgt.get("")).toBeTruthy();
    const die = netz.woerter.find(w => w.text === "Die")!;
    const katze = netz.woerter.find(w => w.text === "Katze")!;
    expect(netz.folgt.get(`${die.id},${katze.id}`)).toBeTruthy();
    expect(netz.folgt.get(String(katze.id))).toBeTruthy();
  });

  it("zählt jedes Wort nur einmal in die Wortliste", () => {
    const netz = trainiere(text, 2);
    expect(netz.woerter.filter(w => w.text === "Katze")).toHaveLength(1);
    expect(netz.statistik!.woerter).toBe(woerterAus(text).length);
    expect(netz.statistik!.verschiedene).toBe(netz.woerter.length);
  });

  it("markiert sich selbst als gelernt und nennt seine Quelle", () => {
    const netz = trainiere(text, 2, "Tafeltext");
    expect(netz.art).toBe("gelernt");
    expect(netz.quelle).toBe("Tafeltext");
    // Ohne Wortarten: geraten wird hier nichts.
    expect(netz.woerter.filter(w => w.art === "unbekannt").length).toBe(netz.woerter.length - 1);
  });

  it("überlebt einen Text ohne jeden Punkt", () => {
    const netz = trainiere("nur ein paar wörter ohne ende", 2);
    expect(netz.start).toHaveLength(1);
    expect(kandidaten(netz, [], 5).length).toBeGreaterThan(0);
  });
});

describe("Rückfallebene", () => {
  it("kürzt den Rückblick, wenn die Kombination unbekannt ist", () => {
    const netz = trainiere(text, 3);
    const wort = (t: string) => netz.woerter.find(w => w.text === t)!;
    // »Der Katze« stand nie im Text — das Trigramm weiß nichts, das Bigramm schon.
    const antwort = fortsetzungen(netz, [wort("Der"), wort("Katze")]);
    expect(antwort.rueckblick).toBe(2);
    expect(antwort.kandidaten.map(k => k.wort.text).sort()).toEqual(["frisst", "schläft"]);
  });

  it("nimmt den vollen Rückblick, wo er trägt", () => {
    const netz = trainiere(text, 3);
    const wort = (t: string) => netz.woerter.find(w => w.text === t)!;
    expect(fortsetzungen(netz, [wort("Die"), wort("Katze")]).rueckblick).toBe(3);
  });

  it("baut den Schlüssel aus den letzten n−1 Wörtern", () => {
    const w = (id: number): Wort => ({ id, text: `w${id}`, art: "unbekannt", merkmale: [] });
    expect(schluessel([w(1), w(2), w(3)], 1)).toBe("");
    expect(schluessel([w(1), w(2), w(3)], 2)).toBe("3");
    expect(schluessel([w(1), w(2), w(3)], 3)).toBe("2,3");
  });
});

describe("Die mitgelieferten Korpora", () => {
  it("ergeben Netze, die ohne Sackgasse zu Ende schreiben", () => {
    for (const korpus of KORPORA) {
      for (const n of [1, 2, 3]) {
        const netz = trainiere(korpus.text, n, korpus.titel);
        expect(netz.statistik!.woerter, korpus.slug).toBeGreaterThan(100);
        const wuerfel = rng(5);
        for (let lauf = 0; lauf < 50; lauf++) {
          const verlauf: Wort[] = [];
          let saetze = 0;
          for (let i = 0; i < 80 && saetze < 2; i++) {
            const ks = kandidaten(netz, verlauf, 5);
            expect(ks.length, `${korpus.slug}/n=${n}: Sackgasse`).toBeGreaterThan(0);
            const gewaehlt = maschinenwahl(ks, wuerfel).wort;
            verlauf.push(gewaehlt);
            if (gewaehlt.art === "punkt") saetze++;
          }
          expect(saetze, `${korpus.slug}/n=${n}: kein Satzende`).toBe(2);
        }
      }
    }
  });

  it("schreibt mit Rückblick 3 erkennbar den Korpus nach", () => {
    // Die Lehre der Station: viel Rückblick plus wenig Text = Auswendiglernen.
    const korpus = KORPORA[0];
    const netz = trainiere(korpus.text, 3, korpus.titel);
    const wuerfel = rng(3);
    const verlauf: Wort[] = [];
    for (let i = 0; i < 12; i++) {
      verlauf.push(maschinenwahl(kandidaten(netz, verlauf, 5), wuerfel).wort);
    }
    const satz = textAus(verlauf).split(".")[0].trim().toLowerCase();
    expect(korpus.text.toLowerCase()).toContain(satz.slice(0, 20));
  });
});

describe("Wie viele Texte sind möglich", () => {
  it("wächst mit jeder Länge und ist nie null", () => {
    const netz = netzMit("katze");
    const kurz = wegeAnzahl(netz, 3);
    const lang = wegeAnzahl(netz, 8);
    expect(kurz).toBeGreaterThan(0);
    expect(lang).toBeGreaterThan(kurz);
  });

  it("schreibt große Zahlen als Wort", () => {
    expect(zahlwort(42)).toBe("42");
    expect(zahlwort(2_500)).toBe("2,5 Tausend");
    expect(zahlwort(3_400_000)).toBe("3,4 Millionen");
    expect(zahlwort(1e13)).toContain("Billionen");
    expect(zahlwort(1e30)).toBe("10 hoch 30");
  });
});
