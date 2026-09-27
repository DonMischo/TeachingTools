import { describe, expect, it } from "vitest";
import { neuesSpiel, routine, monatsbrutto, kindergeldBerechtigt, minijobArbeiten, arbeitsweg } from "@/lib/leben/motor";
import { bewerben, fachkraftStellen, naechsterStart, terminWahrnehmen, zusageAnnehmen } from "@/lib/leben/aktionen";
import { wohngeldFormel } from "@/lib/leben/amt";
import { BERUF } from "@/lib/leben/berufe";
import { kleidungKaufen, TEILE } from "@/lib/leben/kleidung";
import { autoAngebote, autoKaufen, fahrschuleAnmelden, fahrschuleKosten } from "@/lib/leben/auto";
import { kurzDatum, tagVon } from "@/lib/leben/zeit";
import { waehle } from "@/lib/leben/ereignisse";
import type { Spielstand } from "@/lib/leben/typen";

function start(seed = 42, geburtstag = "2010-03-15"): Spielstand {
  return neuesSpiel({
    name: "Kim", geburtstag, avatar: "🧑", farbe: "#f59e0b", kirche: false, seed,
    zeugnis: { abschluss: "RSA", noten: { Deutsch: 2, Mathematik: 2, Englisch: 2, Biologie: 1, Geografie: 2 }, verhalten: 2, mitarbeit: 2, fehltageUnentschuldigt: 0 },
    herkunft: { eltern: "erfurt", elternEinkommen: "mittel", kindergeld: "weiter" },
  });
}

/** Bis zu einem Tag vorspulen; Ereignisse mit der ersten erlaubten Option beantworten. */
function bis(s: Spielstand, ziel: number, halt?: (s: Spielstand) => boolean): Spielstand {
  let x = s;
  let schutz = 0;
  while (x.tag < ziel && schutz++ < 500) {
    x = routine(x, Math.min(7, ziel - x.tag)).stand;
    if (halt && halt(x)) return x;
    while (x.offen.length) {
      if (halt && halt(x)) return x;
      let ok = false;
      for (let o = 0; o < 4 && !ok; o++) { const r = waehle(x, 0, o); if (!r.fehler) { x = r.stand; ok = true; } }
      if (!ok) x = { ...x, offen: x.offen.slice(1) };
    }
    for (const p of x.post) p.gelesen = true;
  }
  return x;
}

function mitZusage(s: Spielstand, beruf: string, startTag: number, extra: Partial<Spielstand["bewerbungen"][number]> = {}): Spielstand {
  s.bewerbungen.push({ uid: 900, beruf, betrieb: BERUF.get(beruf)!.betriebe[0], tag: s.tag, status: "zusage", naechsterTag: s.tag + 14, qualitaet: 0.8, startTag, ...extra });
  const r = zusageAnnehmen(s, 900);
  expect(r.fehler).toBeUndefined();
  return r.stand;
}

describe("Übergangsjahr: FSJ, FÖJ, Wehrdienst, Ausland", () => {
  it("FÖJ auf Sylt: Frist 15.2. verpasst → Bewerbung gilt für 2027 (außer Restplatz)", () => {
    const s = start();
    const b = BERUF.get("foej-sylt")!;
    const n = naechsterStart(s, b);
    expect(kurzDatum(n.tag)).toBe("01.08.2027");
    const r = bewerben(s, "foej-sylt", b.betriebe[0], ["bezug", "praktikum"]);
    const bw = r.stand.bewerbungen.at(-1)!;
    expect([2026, 2027]).toContain(bw.jahrgang);
    expect(r.meldung).toMatch(/frist|Platz frei/i);
  });

  it("FÖJ auf Sylt: Umzug in die Stations-WG am ersten Tag, danach zurück zu den Eltern", () => {
    let s = mitZusage(start(), "foej-sylt", tagVon(2026, 8, 1));
    expect(s.konto.buchungen.some((b) => b.text.includes("Westerland"))).toBe(true);
    s = bis(s, tagVon(2026, 8, 10));
    expect(s.wohnung.form).toBe("unterkunft");
    expect(s.wohnung.stadtteil).toBe("Sylt");
    expect(arbeitsweg(s)).toBe(10);
    expect(kindergeldBerechtigt(s)).toBe(true);
    expect(monatsbrutto(s).brutto).toBe(300);
    // 13 Monate später: Vertragsende → zurück
    s = bis(s, tagVon(2027, 10, 1), (x) => x.offen[0]?.id === "vertragsende");
    expect(s.offen[0]?.id).toBe("vertragsende");
    s = waehle(s, 0, 0).stand;
    expect(s.wohnung.form).toBe("eltern");
  });

  it("Wehrdienst: ab 18, ca. 2.600 € brutto ohne SV-Abzüge, kein Kindergeld", () => {
    const jung = start();
    jung.bewerbungen.push({ uid: 901, beruf: "wehrdienst", betrieb: "Bundeswehr", tag: 0, status: "zusage", naechsterTag: 14, qualitaet: 0.8, startTag: 30 });
    expect(zusageAnnehmen(jung, 901).fehler).toMatch(/18/);
    let s = mitZusage(start(42, "2008-02-01"), "wehrdienst", 31);
    s = bis(s, 63);
    const lohn = s.konto.buchungen.filter((b) => b.kategorie === "lohn");
    expect(lohn.length).toBeGreaterThanOrEqual(1);
    expect(lohn.at(-1)!.betrag).toBeGreaterThan(2250);
    expect(kindergeldBerechtigt(s)).toBe(false);
    expect(s.wohnung.form).toBe("unterkunft");
  });

  it("Work & Travel: ohne rund 3.700 € Erspartes keine Zusage", () => {
    const s = start(42, "2008-02-01");
    s.bewerbungen.push({ uid: 902, beruf: "worktravel", betrieb: "Working Holiday Visa (selbst organisiert)", tag: 0, status: "zusage", naechsterTag: 14, qualitaet: 0.8, startTag: 40 });
    expect(zusageAnnehmen(s, 902).fehler).toMatch(/Vorher fallen/);
  });
});

describe("Fachkraft-Stellen und Jobwechsel", () => {
  it("Nach dem Abschluss gibt es Fachkraft-Stellen; der Wechsel wartet die Kündigungsfrist ab", () => {
    let s = start();
    s.flags.abschluesse = "einzelhandel";
    s.flags.erstausbildungFertig = true;
    s.job = { beruf: "einzelhandel", betrieb: "Modehaus Anger 7", start: 0, art: "fachkraft", brutto: 2550, urlaubstage: 28, urlaubGenommen: 0,
      probezeitBis: 0, leistung: 60, abmahnungen: 0, krankTage: 0, fehlTage: 0 };
    s.jobHistorie.push({ ...s.job, art: "ausbildung", abschlusspruefung: 80 });
    const stellen = fachkraftStellen(s);
    expect(stellen.length).toBe(3);
    const beste = stellen.sort((a, b) => b.brutto - a.brutto)[0];
    s = bewerben(s, "einzelhandel", beste.betrieb, ["bezug", "fehlerfrei"], beste.brutto).stand;
    const bw = s.bewerbungen.at(-1)!;
    bw.status = "gespraech"; bw.naechsterTag = s.tag;
    s.kleidung.schick.zustand = 100; s.frisur = 100;
    let r = terminWahrnehmen({ ...s, stunde: 9 }, bw.uid, 1);
    let versuche = 0;
    while (r.stand.bewerbungen.at(-1)!.status !== "zusage" && versuche++ < 20) r = terminWahrnehmen({ ...s, rng: s.rng + versuche * 7919, stunde: 9 }, bw.uid, 1);
    s = r.stand;
    expect(s.bewerbungen.at(-1)!.status).toBe("zusage");
    const startTag = s.bewerbungen.at(-1)!.startTag!;
    expect(startTag).toBeGreaterThan(s.tag + 27);
    s = zusageAnnehmen(s, bw.uid).stand;
    expect(s.naechsterJob?.brutto).toBe(beste.brutto);
    expect(s.job?.ende).toBe(startTag - 1);
    s = bis(s, startTag + 1);
    expect(s.job?.betrieb).toBe(beste.betrieb);
    expect(s.job?.art).toBe("fachkraft");
  });
});

describe("Kleidung, Minijob, Führerschein, Wohngeld", () => {
  it("Kleidung verschleißt: billige Ware hält kürzer", () => {
    let s = start();
    s = kleidungKaufen(s, "billig", ["alltag"]).stand;
    const billig = s.kleidung.alltag;
    expect(billig.zustand).toBe(100);
    s = bis(s, s.tag + 120);
    expect(s.kleidung.alltag.zustand).toBeLessThan(100 - (120 * 100) / TEILE.alltag.tageBisLeer);
  });

  it("Minijob: samstags arbeiten, sonst kein Lohn", () => {
    const s = start();
    s.flags.minijob = "getraenke";
    const sa = tagVon(2026, 7, 4);
    expect(minijobArbeiten({ ...s, tag: sa - 1, stunde: 7 }).fehler).toMatch(/samstags/);
    const r = minijobArbeiten({ ...s, tag: sa, stunde: 7 });
    expect(r.fehler).toBeUndefined();
    expect(r.stand.flags.minijobTage).toBe(1);
  });

  it("Führerschein kostet rund 3.500–4.500 €, Auto nur mit Führerschein", () => {
    expect(fahrschuleKosten()).toBeGreaterThan(3400);
    expect(fahrschuleKosten()).toBeLessThan(4600);
    const s = start(42, "2008-02-01");
    s.konto.stand = 5000;
    expect(fahrschuleAnmelden(s).fehler).toBeUndefined();
    const a = autoAngebote(s)[0];
    expect(autoKaufen(s, a, false).fehler).toMatch(/Führerschein/);
  });

  it("Wohngeld nach § 19 WoGG", () => {
    // 1 Person, 1.000 € brutto, 400 € Bruttokaltmiete (unter dem Höchstbetrag Mietstufe III)
    expect(wohngeldFormel(400, 1000, true).betrag).toBeGreaterThan(340);
    expect(wohngeldFormel(400, 1000, true).betrag).toBeLessThan(390);
    // Vollzeit zum Mindestlohn: kein Wohngeld mehr
    expect(wohngeldFormel(400, 2400, true).betrag).toBe(0);
  });
});
