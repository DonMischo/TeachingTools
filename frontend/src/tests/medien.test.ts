import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { EPOCHEN, MEDIEN, medium } from "@/lib/medien/medien";
import { BEREICHE, GALERIE, nachweisFuer } from "@/lib/medien/galerie";
import nachweise from "@/lib/medien/bilder.json";
import { AUFTRAEGE, gabEs, punkteFuer, richtigPlatziert, sortierRunde } from "@/lib/medien/spiele";
import { erreichbarBis, mitStation, sauber, vereinige } from "@/lib/medien/fortschritt";
import { ausLauflaengen, ausMorse, buchstabe, inHieroglyphen, lauflaengen, quipuWert, tippZahl, zeichenAusDauer, zuMorse } from "@/lib/medien/codes";
import { DEMOS } from "@/components/medien/demos";
import { t9Code, t9Vorschlaege } from "@/lib/medien/t9";
import { genauigkeit } from "@/components/medien/demos/Antike";
import { dauer, einzelBote, staffel, stand } from "@/lib/medien/boten";

describe("Stationen der Zeitreise", () => {
  it("eindeutige Ids, chronologisch, vollständige Inhalte", () => {
    expect(new Set(MEDIEN.map(m => m.id)).size).toBe(MEDIEN.length);
    for (let i = 1; i < MEDIEN.length; i++) expect(MEDIEN[i].jahr, MEDIEN[i].id).toBeGreaterThanOrEqual(MEDIEN[i - 1].jahr);
    for (const m of MEDIEN) {
      expect(EPOCHEN.some(e => e.id === m.epoche), m.id).toBe(true);
      expect(m.schritte.length, m.id).toBeGreaterThanOrEqual(3);
      for (const t of [m.kurz, m.geschichte, m.besser, m.haken, m.witz]) expect(t.length, m.id).toBeGreaterThan(20);
      expect(m.frage.optionen[m.frage.richtig], m.id).toBeDefined();
      expect(new Set(m.frage.optionen).size, m.id).toBe(m.frage.optionen.length);
      for (const w of Object.values(m.profil)) expect(w >= 1 && w <= 5, m.id).toBe(true);
      if (m.demo) expect(DEMOS[m.demo], m.id).toBeDefined();
    }
  });

  it("Flops haben Lebensdaten, Grund und Grabspruch", () => {
    const flops = MEDIEN.filter(m => m.flop);
    expect(flops.length).toBeGreaterThanOrEqual(8);
    for (const m of flops) for (const t of Object.values(m.flop!)) expect(t.length, m.id).toBeGreaterThan(3);
  });

  it("Fortschritt: unbekannte Stationen fliegen raus, Zusammenlegen verliert nichts", () => {
    expect(sauber({ geschafft: ["hoehle", "gibtsnicht", "hoehle", 3], eilbote: "40" })).toEqual({ geschafft: ["hoehle"], eilbote: 40, sortieren: 0 });
    expect(sauber(null).geschafft).toEqual([]);
    const a = { geschafft: ["hoehle", "signale"], eilbote: 300, sortieren: 1 };
    const b = { geschafft: ["hoehle", "keilschrift"], eilbote: 100, sortieren: 4 };
    expect(vereinige(a, b)).toEqual({ geschafft: ["hoehle", "signale", "keilschrift"], eilbote: 300, sortieren: 4 });
    expect(mitStation("signale")(a)).toBe(a);
    expect(mitStation("alphabet")(a).geschafft).toEqual(["hoehle", "signale", "alphabet"]);
  });

  it("Weiter geht's nur bis zur ersten offenen Station", () => {
    expect(erreichbarBis([])).toBe(0);
    expect(erreichbarBis([MEDIEN[0].id, MEDIEN[1].id])).toBe(2);
    expect(erreichbarBis(MEDIEN.map(m => m.id))).toBe(MEDIEN.length - 1);
  });
});

describe("TaskCrawler »Zeitreise der Medien« passt zur Simulation", () => {
  it.each(["TaskCrawler_Geschichte_der_Medien.json", "TaskCrawler_Geschichte_der_Medien_Meilensteine.json"])("jede verlinkte Station gibt es (%s)", datei => {
    const spiel = JSON.parse(readFileSync(join(process.cwd(), "..", "data", "taskcrawler_examples", datei), "utf8"));
    type Sim = { tool: string; config?: { station?: string } };
    const sims: Sim[] = spiel.slides.flatMap((s: { sim?: Sim; task?: { sim?: Sim } }) => [s.sim, s.task?.sim]).filter(Boolean);
    const stationen = sims.filter(x => x.tool === "medien").map(x => x.config?.station);
    expect(stationen.length).toBeGreaterThanOrEqual(20);
    for (const st of stationen) expect(medium(st!), st).toBeDefined();
  });
});

describe("Galerie »Echte Medien«", () => {
  it("jedes Bild hat Datei, freie Lizenz, Urheber und eine Station", () => {
    for (const b of GALERIE) {
      const n = nachweisFuer(b.id);
      expect(n, b.id).toBeDefined();
      expect(n!.lizenz).toMatch(/^(CC0|CC BY(-SA)? [0-9.]+( de| igo)?|Public domain|No restrictions)/i);
      expect(n!.urheber.length).toBeGreaterThan(0);
      expect(existsSync(join(process.cwd(), "public", n!.datei)), n!.datei).toBe(true);
      expect(medium(b.medium), b.id).toBeDefined();
      expect(BEREICHE.some(x => x.id === b.bereich), b.id).toBe(true);
      expect(medium(b.medium)!.epoche, b.id).toBe(b.bereich);
    }
  });

  it("keine Nachweise ohne Bild, jede Station schaltet mindestens ein Foto frei", () => {
    const ids = new Set(GALERIE.map(b => b.id));
    for (const id of Object.keys(nachweise)) expect(ids.has(id), id).toBe(true);
    expect(ids.size).toBe(GALERIE.length);
    for (const m of MEDIEN) expect(GALERIE.some(g => g.medium === m.id), m.id).toBe(true);
  });
});

describe("Spiele", () => {
  it("Eilbote: nur Medien, die es im Jahr des Auftrags schon gab; Rückmeldung für jede falsche Wahl", () => {
    for (const a of AUFTRAEGE) {
      expect(a.wahl).toContain(a.richtig);
      for (const id of a.wahl) {
        const m = medium(id);
        expect(m, `${a.id}: ${id}`).toBeDefined();
        expect(gabEs(m!, a.jahr), `${a.id}: ${id}`).toBe(true);
        if (id !== a.richtig) expect(a.daneben[id], `${a.id}: ${id}`).toBeTruthy();
      }
    }
    expect([punkteFuer(1), punkteFuer(2), punkteFuer(3)]).toEqual([100, 40, 0]);
  });

  it("Wer war zuerst? zieht fünf Medien mit Abstand und erkennt die richtige Reihenfolge", () => {
    let s = 1;
    const zufall = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const runde = sortierRunde(5, zufall);
    expect(runde).toHaveLength(5);
    expect(runde.every(m => !m.unsicher)).toBe(true);
    const sortiert = [...runde].sort((a, b) => a.jahr - b.jahr).map(m => m.id);
    expect(richtigPlatziert(sortiert).every(Boolean)).toBe(true);
    expect(richtigPlatziert([...sortiert].reverse()).every(Boolean)).toBe(false);
  });
});

describe("Codes der Demos", () => {
  it("Morse hin und zurück", () => {
    expect(zuMorse("SOS")).toBe("... --- ...");
    expect(ausMorse("... --- ...")).toBe("SOS");
    expect(ausMorse(zuMorse("Hallo Welt"))).toBe("HALLO WELT");
    expect(zuMorse("Bär")).toBe(zuMorse("BAER"));
    expect(zeichenAusDauer(100)).toBe(".");
    expect(zeichenAusDauer(400)).toBe("-");
  });

  it("Hieroglyphen nachmalen: Genauigkeitspunkte = getroffen × (1 − daneben)", () => {
    expect(genauigkeit(1, 0)).toBe(100);
    expect(genauigkeit(0.8, 0.25)).toBe(60);
    expect(genauigkeit(1, 1)).toBe(0); // alles vollgekritzelt
    expect(genauigkeit(0, 0)).toBe(0);
    expect(genauigkeit(1.4, -0.2)).toBe(100);
  });

  it("Boten: Staffel mit Herodots Stationen gut eine Woche, allein Wochen; Schlaf heißt Stillstand", () => {
    const tage = (h: number) => h / 24;
    expect(tage(dauer(staffel(111)))).toBeGreaterThan(6);
    expect(tage(dauer(staffel(111)))).toBeLessThan(10);
    expect(tage(dauer(einzelBote(6, 10)))).toBeCloseTo(2500 / 60, 0);
    expect(dauer(staffel(1))).toBeCloseTo(dauer(einzelBote(15, 6)), 5); // eine Staffel aus einem Reiter = Reiter allein
    expect(dauer(staffel(30))).toBeLessThan(dauer(staffel(5)));
    const lauf = einzelBote(6, 10);
    expect(stand(lauf, 5).tun).toBe("unterwegs");
    expect(stand(lauf, 12)).toEqual({ km: 60, tun: "pause" }); // nach 10 h: 60 km, Nachtruhe
    expect(stand(lauf, dauer(lauf) + 1).tun).toBe("angekommen");
  });

  it("Hieroglyphen-Namen", () => {
    const k = inHieroglyphen("Kleopatra");
    expect(k.map(g => g.laut).join("")).toBe("kleopatra");
    expect(k[0].zeichen.codePointAt(0)).toBe(0x133a1);
    expect(inHieroglyphen("Schmidt").map(g => g.laut)).toEqual(["sch", "m", "i", "d", "t"]);
    // doppelte Buchstaben nur einmal
    expect(inHieroglyphen("Anna").map(g => g.laut)).toEqual(["a", "n", "a"]);
  });

  it("T9: ein Druck pro Buchstabe, gleiche Folge = mehrere Wörter", () => {
    expect(t9Code("hallo")).toBe("42556");
    expect(t9Vorschlaege("42556")).toEqual(expect.arrayContaining(["hallo", "gallo"]));
    expect(t9Code("gut")).toBe(t9Code("hut"));
    expect(t9Code("schön")).toBe("72466");
    expect(t9Vorschlaege("99")[0]).toHaveLength(2); // unbekannt: Buchstaben geraten
  });

  it("Quipu, Handy-Tasten, Fax", () => {
    expect(quipuWert([7, 4, 3])).toBe(347);
    expect(tippZahl("hallo")).toBe(2 + 1 + 3 + 3 + 3);
    expect(buchstabe("2", 3)).toBe("c");
    expect(buchstabe("7", 5)).toBe("7");
    const zeile: (0 | 1)[] = [0, 0, 1, 1, 1, 0, 1];
    expect(lauflaengen(zeile)).toEqual([2, 3, 1, 1]);
    expect(lauflaengen([1, 1, 0])).toEqual([0, 2, 1]);
    expect(ausLauflaengen(lauflaengen(zeile))).toEqual(zeile);
  });
});
