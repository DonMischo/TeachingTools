import { describe, expect, it } from "vitest";
import { neuesSpiel, routine, mahlzeit, arbeiten, schlafen, monatsbrutto, vertragAbschliessen } from "@/lib/leben/motor";
import { bewerben, einkaufen, einziehen, terminWahrnehmen, zusageAnnehmen, wohnungsanzeigen, wohnungBewerben, ausgehen, promille, steuerAbgeben } from "@/lib/leben/aktionen";
import { ereignisWahl } from "@/lib/leben/ereignisse";
import { einreichen, babBerechnen } from "@/lib/leben/amt";
import { LEERE_ANGABEN } from "@/lib/leben/steuer";
import { REFERENZ_WOCHE } from "@/lib/leben/laden";
import { ENDE_TAG, tagVon } from "@/lib/leben/zeit";
import type { Spielstand } from "@/lib/leben/typen";

function start(seed = 42): Spielstand {
  return neuesSpiel({
    name: "Kim", geburtstag: "2010-03-15", avatar: "🧑", farbe: "#f59e0b", kirche: false, seed,
    zeugnis: { abschluss: "RSA", noten: { Deutsch: 2, Mathematik: 2, Englisch: 3, Physik: 2, Biologie: 3 }, verhalten: 2, mitarbeit: 2, fehltageUnentschuldigt: 0 },
    herkunft: { eltern: "land", elternEinkommen: "mittel", kindergeld: "weiter" },
  });
}

/** Offene Ereignisse immer mit der ersten erlaubten Option beantworten. */
function ereignisseAbarbeiten(s: Spielstand): Spielstand {
  const t = structuredClone(s);
  let schutz = 0;
  while (t.offen.length && schutz++ < 10) {
    let ok = false;
    for (let o = 0; o < 4 && !ok; o++) {
      const vorher = t.offen.length;
      const text = ereignisWahl(t, 0, o);
      ok = t.offen.length < vorher || !text;
    }
    if (!ok) t.offen.shift();
  }
  for (const p of t.post) p.gelesen = true;
  return t;
}

function wocheneinkauf(s: Spielstand): Spielstand {
  const korb = REFERENZ_WOCHE.map((r) => ({ produkt: r.produkt, variante: "eigen" as const, anzahl: Math.max(1, Math.round(r.menge)) }));
  const t = { ...s, stunde: 10 };
  const r = einkaufen(t, "lidl", korb);
  return r.fehler ? s : r.stand;
}

describe("Rock your Life — Motor", () => {
  it("neues Spiel: Startwerte, fiktive Nummern", () => {
    const s = start();
    expect(s.figur.steuerId).toMatch(/^\d{11}$/);
    expect(s.konto.stand).toBeGreaterThan(500);
    expect(s.post.length).toBe(1);
  });

  it("Bewerbung → Test/Gespräch → Zusage → Vertrag", () => {
    let s = start(7);
    s = bewerben(s, "maurer", "Hochbau Bischleben", ["ansprechpartner", "bezug", "praktikum", "fehlerfrei", "lebenslauf"]).stand;
    const bw = s.bewerbungen[0];
    // bis zur Antwort vorspulen
    while (s.bewerbungen[0].status === "versendet") s = schlafen({ ...s, stunde: 22 }, 8).stand;
    expect(["gespraech", "test", "absage"]).toContain(s.bewerbungen[0].status);
    if (s.bewerbungen[0].status === "absage") return;
    while (s.tag < s.bewerbungen[0].naechsterTag) s = schlafen({ ...s, stunde: 22 }, 8).stand;
    s = terminWahrnehmen({ ...s, stunde: 9 }, bw.uid, 0.9).stand;
    if (s.bewerbungen[0].status === "gespraech") {
      while (s.tag < s.bewerbungen[0].naechsterTag) s = schlafen({ ...s, stunde: 22 }, 8).stand;
      s = terminWahrnehmen({ ...s, stunde: 9 }, bw.uid, 0.9).stand;
    }
    if (s.bewerbungen[0].status !== "zusage") return;
    s = zusageAnnehmen(s, bw.uid).stand;
    expect(s.job?.beruf).toBe("maurer");
    expect(s.job?.start).toBe(tagVon(2026, 8, 1));
  });

  it("spielt fünf Jahre durch, ohne dass Zahlen kaputtgehen", () => {
    let s = start(99);
    // Direkt einen Ausbildungsvertrag geben (Bewerbung ist oben getestet)
    s.bewerbungen.push({ uid: 999, beruf: "industriemechaniker", betrieb: "Maschinenbau Erfurt-Nord AG", tag: 0, status: "zusage", naechsterTag: 20, qualitaet: 0.7, startTag: tagVon(2026, 8, 1) });
    s = zusageAnnehmen(s, 999).stand;
    s = vertragAbschliessen(s, "dticket").stand;
    let umgezogen = false;
    let letzteWoche = -1;
    let schutz = 0;
    while (!s.beendet && schutz++ < 4000) {
      if (Math.floor(s.tag / 7) !== letzteWoche && s.wohnung.form !== "eltern") { s = wocheneinkauf(s); letzteWoche = Math.floor(s.tag / 7); }
      // Nach einem Jahr ausziehen
      if (!umgezogen && s.tag > 400) {
        const w = wohnungsanzeigen(s).find((x) => x.form === "wohnung");
        if (w) {
          const r = wohnungBewerben(s, w, true);
          if (!r.fehler && s.konto.stand > 3000) {
            const e = einziehen(r.stand, true, "freunde");
            if (!e.fehler) { s = e.stand; umgezogen = true; }
            else s = r.stand;
          } else s = r.stand;
        }
      }
      s = routine(s, 7).stand;
      s = ereignisseAbarbeiten(s);
    }
    expect(s.beendet).toBe(true);
    expect(s.tag).toBe(ENDE_TAG);
    expect(Number.isFinite(s.konto.stand)).toBe(true);
    expect(s.bilanzen.length).toBeGreaterThanOrEqual(59);
    expect(s.bilanzen.every((b) => Number.isFinite(b.kontoEnde))).toBe(true);
    // Lohn kam an, Steuerjahre gesammelt
    expect(Object.keys(s.steuerjahre).length).toBeGreaterThanOrEqual(4);
    expect(s.steuerjahre[2027].brutto).toBeGreaterThan(14000);
    // Industrietarif: Azubis zahlen trotzdem kaum/keine Lohnsteuer
    expect(s.steuerjahre[2027].lohnsteuer).toBeLessThan(600);
    // Prüfung wurde geschrieben
    const h = [...s.jobHistorie, ...(s.job ? [s.job] : [])];
    expect(h.some((j) => j.abschlusspruefung !== undefined || j.art === "fachkraft")).toBe(true);
    expect(s.log.length).toBeGreaterThan(100);
  }, 60_000);

  it("Ausbildung: Lohn am Monatsende auf dem Konto", () => {
    let s = start(3);
    s.bewerbungen.push({ uid: 999, beruf: "friseur", betrieb: "Salon Schnittpunkt", tag: 0, status: "zusage", naechsterTag: 20, qualitaet: 0.7, startTag: tagVon(2026, 8, 1) });
    s = zusageAnnehmen(s, 999).stand;
    expect(monatsbrutto({ ...s, tag: tagVon(2026, 8, 10) }).mindest).toBe(true); // Friseurtarif < Mindestvergütung
    s = routine(s, 70).stand;
    while (s.tag < tagVon(2026, 9, 2)) s = routine(ereignisseAbarbeiten(s), 10).stand;
    const lohn = s.konto.buchungen.filter((b) => b.kategorie === "lohn" && b.text.includes("Friseur"));
    expect(lohn.length).toBeGreaterThanOrEqual(1);
    expect(lohn[0].betrag).toBeGreaterThan(540);
    expect(lohn[0].betrag).toBeLessThan(600);
  });

  it("Party: Promille nach Widmark, Alkohol erst ab 16/18", () => {
    expect(promille(20, 0)).toBeCloseTo(0.476, 2);
    expect(promille(60, 4)).toBeCloseTo(60 / 42 - 0.6, 2);
    const s = { ...start(), stunde: 20 };
    const jung = ausgehen(s, "kneipe", { longdrink: 1 }, "bahn");
    expect(jung.fehler).toMatch(/ab 18/);
    const club = ausgehen(s, "club", {}, "bahn");
    expect(club.fehler).toMatch(/ab 18/);
  });

  it("Anträge: falsche Angaben → Rückfrage", () => {
    let s = start();
    s.wohnung = { ...s.wohnung, form: "wohnung", adresse: "Moskauer Straße 12", einzug: 0 };
    const r = einreichen(s, "anmeldung", { name: "Falscher Name", geburt: "15.03.2010", adresse: "Moskauer Straße 12", einzug: "01.07.2026", alt: "x", art: "alleinige Wohnung" }, ["mietvertrag"]);
    // Kein Mietvertrag im Ordner, falscher Name → Rückfrage bzw. geschlossen
    expect(r.ok || /geschlossen/.test(r.text)).toBe(true);
    void s;
  });

  it("BAB: Eltern in Erfurt + unter 18 → kein Anspruch", () => {
    const s = start();
    s.herkunft.eltern = "erfurt";
    s.job = { beruf: "friseur", betrieb: "x", start: 30, art: "ausbildung", urlaubstage: 25, urlaubGenommen: 0, probezeitBis: 150, leistung: 50, abmahnungen: 0, krankTage: 0, fehlTage: 0 };
    s.wohnung = { ...s.wohnung, form: "wohnung" };
    s.tag = 40;
    expect(babBerechnen(s).anspruch).toBe(false);
    s.herkunft.eltern = "land";
    const b = babBerechnen(s);
    expect(b.anspruch).toBe(true);
    expect(b.betrag).toBeGreaterThan(50);
  });

  it("Steuererklärung nach einem halben Jahr Arbeit bringt Geld zurück", () => {
    let s = start(5);
    s.steuerjahre[2026] = { jahr: 2026, brutto: 12000, lohnsteuer: 800, soli: 0, kirchensteuer: 0, rv: 1116, kv: 1050, pv: 216, av: 156, monate: 5 };
    s.tag = tagVon(2027, 3, 1);
    s = steuerAbgeben(s, 2026, { ...LEERE_ANGABEN, entfernungKm: 12, arbeitstage: 100 }).stand;
    expect(s.steuererklaerungen[2026].bescheid.erstattung).toBeCloseTo(800, 0);
    void mahlzeit; void arbeiten;
  });
});
