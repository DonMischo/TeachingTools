/**
 * Prüft die übergreifende Erfolgsübersicht: dass sie jedes Werkzeug liest,
 * ohne Stand nichts behauptet, mehrere Profile zusammenfasst und sich nicht
 * an fremden Schlüsseln verschluckt.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { lieseAlle, WERKZEUGE } from "@/lib/erfolge/register";

const werkzeug = (slug: string) => lieseAlle().find(w => w.slug === slug)!;

beforeEach(() => localStorage.clear());

describe("Aufbau", () => {
  it("listet jedes Werkzeug mit Name, Symbol und Bereich", () => {
    expect(WERKZEUGE.length).toBeGreaterThanOrEqual(7);
    expect(new Set(WERKZEUGE.map(w => w.slug)).size).toBe(WERKZEUGE.length);
    for (const w of WERKZEUGE) {
      expect(w.name.length).toBeGreaterThan(3);
      expect(w.icon.length).toBeGreaterThan(0);
      expect(["Simulationen", "Werkzeuge", "Spiele"]).toContain(w.bereich);
    }
  });

  it("zeigt ohne jeden Stand alle Erfolge als offen", () => {
    const alle = lieseAlle();
    expect(alle.reduce((a, w) => a + w.gesamt, 0)).toBeGreaterThan(60);
    expect(alle.reduce((a, w) => a + w.erreicht, 0)).toBe(0);
    for (const w of alle) {
      expect(w.erfolge.length, w.slug).toBeGreaterThan(0);
      for (const e of w.erfolge) {
        expect(e.name.length, `${w.slug}/${e.id}`).toBeGreaterThan(3);
        expect(e.text.length, `${w.slug}/${e.id}`).toBeGreaterThan(5);
        if (e.ziel !== undefined) expect(e.wert).toBe(0);
      }
    }
  });

  it("gibt jedem Werkzeug eindeutige Erfolgs-Kennungen", () => {
    for (const w of lieseAlle()) {
      expect(new Set(w.erfolge.map(e => e.id)).size, w.slug).toBe(w.erfolge.length);
    }
  });
});

describe("Lesen der Werkzeuge", () => {
  it("liest den Stand des Periodensystems", () => {
    localStorage.setItem("hp_pse_rallye", JSON.stringify({
      punkte: 120, sterne: 0, runden: 2, richtig: {}, sofort: 0, serie: 0,
      serieJetzt: 0, dreiSterne: {}, gefunden: [], erfolge: [],
    }));
    const w = werkzeug("pse");
    expect(w.erfolge.find(e => e.id === "erste-runde")!.erreicht).toBe(true);
    expect(w.erfolge.find(e => e.id === "hundert")!.erreicht).toBe(true);
    expect(w.erfolge.find(e => e.id === "fuenfhundert")!.erreicht).toBe(false);
    expect(w.erfolge.find(e => e.id === "fuenfhundert")!.wert).toBe(120);
  });

  it("liest die freigeschalteten Erfolge des Schichtenmodells", () => {
    localStorage.setItem("hp_schichten_erfolge", JSON.stringify({ freigeschaltet: ["erste"] }));
    const w = werkzeug("schichten");
    expect(w.erreicht).toBe(1);
    expect(w.erfolge.find(e => e.id === "erste")!.erreicht).toBe(true);
  });

  it("leitet die Erfolge der Algorithmen-Werkstatt aus dem Fortschritt ab", () => {
    localStorage.setItem("hp_algo_stand_konto-teacher-1", JSON.stringify({
      level: { a: { sterne: 3, bloecke: 4 }, b: { sterne: 2, bloecke: 9 } },
      fluss: ["f1"], automat: [], wertung: {},
    }));
    const w = werkzeug("algo");
    expect(w.erfolge.find(e => e.id === "erstes-level")!.erreicht).toBe(true);
    expect(w.erfolge.find(e => e.id === "zehn-level")!.wert).toBe(2);
    expect(w.erfolge.find(e => e.id === "sterne-30")!.wert).toBe(5);
  });

  it("leitet die Erfolge des Koordinaten-Laufs aus den Sternen ab", () => {
    localStorage.setItem("hp_koordinaten_stand", JSON.stringify({ "w1-1": 3, "w1-2": 2 }));
    const w = werkzeug("funktionen");
    expect(w.erfolge.find(e => e.id === "erstes")!.erreicht).toBe(true);
    expect(w.erfolge.find(e => e.id === "sterne")!.wert).toBe(5);
    expect(w.erfolge.find(e => e.id === "dreisterne")!.wert).toBe(1);
  });

  it("zählt die gelösten Rätsel des Regel-Labors", () => {
    localStorage.setItem("hp_regeln_geloest", JSON.stringify(["r1", "r2"]));
    const w = werkzeug("regeln");
    expect(w.erfolge.find(e => e.id === "erstes")!.erreicht).toBe(true);
    expect(w.erfolge.find(e => e.id === "alle")!.wert).toBe(2);
  });
});

describe("Mehrere Profile", () => {
  it("nimmt beim Sonnensystem je Erfolg das beste Profil", () => {
    localStorage.setItem("sonnensystem-forschung-v1:gast", JSON.stringify({ erforscht: ["mars"], erledigt: [] }));
    localStorage.setItem("sonnensystem-forschung-v1:konto-1", JSON.stringify({ erforscht: ["mars", "venus", "io"], erledigt: [] }));
    const w = werkzeug("sonnensystem");
    // Drei Himmelskörper aus dem besseren Profil, nicht einer aus dem ersten.
    expect(w.erfolge.find(e => e.id === "erster-scan")!.erreicht).toBe(true);
    expect(w.erfolge.find(e => e.id === "alles")!.wert).toBe(3);
  });

  it("fasst beim Verkehr mehrere Stände zusammen", () => {
    localStorage.setItem("hp_verkehr_gast-anna", JSON.stringify({ erledigt: [], schilder: [], schwere: 0, erfolge: ["schritte"] }));
    localStorage.setItem("hp_verkehr_konto-7", JSON.stringify({ erledigt: [], schilder: [], schwere: 0, erfolge: ["spaziergang"] }));
    const w = werkzeug("verkehr");
    expect(w.erfolge.find(e => e.id === "schritte")!.erreicht).toBe(true);
    expect(w.erfolge.find(e => e.id === "spaziergang")!.erreicht).toBe(true);
    expect(w.erfolge.find(e => e.id === "wanderer")!.erreicht).toBe(false);
  });

  it("hält die Einstellungen des Verkehrs für keinen Fortschritt", () => {
    // Diese Schlüssel beginnen genauso, sind aber bloße Einstellungen.
    localStorage.setItem("hp_verkehr_ton", "true");
    localStorage.setItem("hp_verkehr_alter", "12");
    localStorage.setItem("hp_verkehr_aussehen", JSON.stringify({ haare: "blond" }));
    expect(() => werkzeug("verkehr")).not.toThrow();
    expect(werkzeug("verkehr").erreicht).toBe(0);
  });
});

describe("Kaputter Speicher", () => {
  it("stürzt bei Unsinn nicht ab, sondern zeigt nichts erreicht", () => {
    for (const k of ["hp_pse_rallye", "hp_schichten_erfolge", "hp_regeln_geloest",
      "hp_koordinaten_stand", "hp_algo_stand_x", "hp_verkehr_x",
      "sonnensystem-forschung-v1:x"]) {
      localStorage.setItem(k, "{kein json");
    }
    const alle = lieseAlle();
    expect(alle.reduce((a, w) => a + w.erreicht, 0)).toBe(0);
    expect(alle.every(w => w.erfolge.length > 0)).toBe(true);
  });
});
