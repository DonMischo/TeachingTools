/**
 * Caputh in der gemeinsamen Auswertung (lib/sitzung): der Bericht
 * (/sessions/{code}/report) wird zu Sitzungszeilen, die Fragen zu Aufgaben —
 * so zeigen Matrix und »am schwersten«, welche Frage die Klasse nicht konnte.
 * Caputh behält seine eigenen Tabellen — das hier ist nur der Adapter.
 */
import { api, type CaputhReport, type SitzungZeile } from "@/lib/api";
import { liste, zahl, type SitzungAnsicht, type SitzungQuelle } from "@/lib/sitzung/typen";

export function caputhZeilen(r: CaputhReport, jetzt = Date.now()): SitzungZeile[] {
  const zeit = new Date(jetzt).toISOString();
  return r.participants.map(p => {
    const richtig = r.questions.filter((_, i) => p.questions[i]?.correct === true).map(q => String(q.id));
    const beantwortet = p.questions.filter(q => q.answered).length;
    return {
      name: p.name, klasse: p.class_code === "–" ? null : p.class_code, gast: false,
      daten: { richtig, anzahl: p.correct, gesamt: p.total_scored, prozent: p.percent, beantwortet },
      aktuell: null, beigetreten_am: zeit, aktualisiert_am: zeit,
      fertig_am: r.status === "finished" ? zeit : null,
    };
  });
}

export function caputhAnsicht(r: CaputhReport): SitzungAnsicht {
  const gewertet = r.questions.filter(q => q.type !== "survey");
  return {
    spalten: [
      { id: "richtig", titel: "Richtig", art: "anteil", max: gewertet.length, wert: d => zahl(d, "anzahl") ?? 0 },
      { id: "prozent", titel: "Quote", art: "zahl", einheit: "%", wert: d => zahl(d, "prozent") },
    ],
    aufgaben: gewertet.map((q, i) => ({ id: String(q.id), titel: `F${r.questions.indexOf(q) + 1 || i + 1}: ${q.text.slice(0, 60)}` })),
    geschafft: (d, id) => liste(d, "richtig").includes(id),
    rang: { titel: "Richtig", art: "zahl", richtung: "max", wert: d => zahl(d, "anzahl") },
  };
}

/** Datenquelle für die Auswertung auf dem Host-Screen. */
export function caputhQuelle(code: string): SitzungQuelle {
  return {
    schluessel: ["caputh", code],
    laden: async () => { const r = await api.capuths.sessionReport(code); return { zeilen: caputhZeilen(r), ansicht: caputhAnsicht(r) }; },
  };
}
