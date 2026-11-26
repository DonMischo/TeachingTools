/**
 * TaskCrawler in der gemeinsamen Auswertung (lib/sitzung): der Bericht
 * (/exitgame-sessions/{code}/report) wird zu Sitzungszeilen, die Folien zu Aufgaben.
 * Der TaskCrawler behält seine eigenen Tabellen — das hier ist nur der Adapter.
 */
import { api, type ExitGameReport, type SitzungZeile } from "@/lib/api";
import { liste, zahl, type SitzungAnsicht, type SitzungQuelle } from "@/lib/sitzung/typen";

export function taskcrawlerZeilen(r: ExitGameReport, jetzt = Date.now()): SitzungZeile[] {
  return r.attempts.map(a => ({
    name: a.student_name,
    klasse: a.student_class || null,
    gast: a.student_id == null,
    daten: {
      geloest: a.slides_solved, gesamt: a.slides_total, fehler: a.errors_total, hinweise: a.hints_total,
      erleichtert: a.easier_taken_total, sekunden: a.elapsed_seconds, boss: a.boss_ergebnis ?? null,
      folien: a.solved_slide_ids ?? [], versuch: a.attempt_id,
    },
    aktuell: a.status === "finished" ? null : `Folie ${Math.min(a.slides_solved + 1, a.slides_total)}/${a.slides_total}`,
    beigetreten_am: new Date(jetzt - a.elapsed_seconds * 1000).toISOString(),
    aktualisiert_am: new Date(jetzt).toISOString(),
    fertig_am: a.status === "finished" ? new Date(jetzt).toISOString() : null,
  }));
}

export function taskcrawlerAnsicht(r: ExitGameReport): SitzungAnsicht {
  const gesamt = r.attempts[0]?.slides_total ?? 0;
  return {
    spalten: [
      { id: "geloest", titel: "Gelöst", icon: "✅", art: "anteil", max: gesamt, wert: d => zahl(d, "geloest") ?? 0 },
      { id: "fehler", titel: "Fehler", icon: "❌", art: "zahl", wert: d => zahl(d, "fehler") },
      { id: "hinweise", titel: "Hinweise", icon: "💡", art: "zahl", wert: d => zahl(d, "hinweise") },
      { id: "erleichtert", titel: "Erleichterte Aufgaben", icon: "🪜", art: "zahl", wert: d => zahl(d, "erleichtert") },
      { id: "dauer", titel: "Dauer", icon: "⏱", art: "zeit", wert: d => (zahl(d, "sekunden") ?? 0) * 1000 },
    ],
    aufgaben: r.slides?.map(s => ({ id: s.id, titel: s.title || s.id })),
    geschafft: (d, id) => liste(d, "folien").includes(id),
    fortschritt: d => (gesamt ? (zahl(d, "geloest") ?? 0) / gesamt : 0),
    rang: { titel: "Fehler", art: "zahl", richtung: "min", wert: d => zahl(d, "fehler") },
  };
}

/** Datenquelle für Dashboard und Auswertung (Host-Seite, Sitzungsmenü). */
export function taskcrawlerQuelle(code: string): SitzungQuelle {
  return {
    schluessel: ["taskcrawler", code],
    laden: async () => { const r = await api.exitgame.sessions.report(code); return { zeilen: taskcrawlerZeilen(r), ansicht: taskcrawlerAnsicht(r) }; },
  };
}
