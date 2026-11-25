/**
 * Lückentext in der gemeinsamen Auswertung (lib/sitzung): die Review-Daten
 * (/lueckentexte/sessions/{code}/review) werden zu Sitzungszeilen, die Lücken
 * zu Aufgaben. Der Lückentext behält seine eigenen Tabellen — nur ein Adapter.
 */
import type { LueckentextReviewEntry, SitzungZeile } from "@/lib/api";
import { liste, zahl, type SitzungAnsicht } from "@/lib/sitzung/typen";

export function lueckentextZeilen(eintraege: LueckentextReviewEntry[], jetzt = Date.now()): SitzungZeile[] {
  return eintraege.map(e => {
    const zeiten = e.gaps.map(g => g.time_spent_seconds).filter((t): t is number => t != null);
    const sekunden = zeiten.reduce((a, b) => a + b, 0);
    const geloest = e.gaps.filter(g => g.solved);
    return {
      name: e.name, klasse: null, gast: false,
      daten: {
        geloest: geloest.map(g => g.gap_id),
        versuche: e.gaps.reduce((s, g) => s + g.attempts, 0),
        hinweise: e.gaps.reduce((s, g) => s + g.hints_used, 0),
        aufgedeckt: e.gaps.filter(g => g.revealed).length,
        sekunden: zeiten.length ? sekunden : null,
      },
      aktuell: null,
      beigetreten_am: new Date(jetzt - sekunden * 1000).toISOString(),
      aktualisiert_am: new Date(jetzt).toISOString(),
      fertig_am: e.gaps.length > 0 && e.gaps.every(g => g.solved || g.revealed) ? new Date(jetzt).toISOString() : null,
    };
  });
}

export function lueckentextAnsicht(eintraege: LueckentextReviewEntry[]): SitzungAnsicht {
  const luecken = eintraege[0]?.gaps.map(g => g.gap_id) ?? [];
  return {
    spalten: [
      { id: "geloest", titel: "Gelöst", icon: "✅", art: "anteil", max: luecken.length, wert: d => liste(d, "geloest").length },
      { id: "versuche", titel: "Versuche", art: "zahl", wert: d => zahl(d, "versuche") },
      { id: "hinweise", titel: "Hinweise", icon: "💡", art: "zahl", wert: d => zahl(d, "hinweise") },
      { id: "aufgedeckt", titel: "Aufgedeckt", art: "zahl", wert: d => zahl(d, "aufgedeckt") },
      { id: "zeit", titel: "Zeit", icon: "⏱", art: "zeit", wert: d => { const s = zahl(d, "sekunden"); return s == null ? null : s * 1000; } },
    ],
    aufgaben: luecken.map((id, i) => ({ id, titel: `Lücke ${i + 1}` })),
    geschafft: (d, id) => liste(d, "geloest").includes(id),
  };
}
