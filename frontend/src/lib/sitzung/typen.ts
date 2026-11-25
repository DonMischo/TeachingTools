/**
 * Wie ein Werkzeug seinen Sitzungsstand in Dashboard und Auswertung zeigt.
 *
 * Der Server speichert je Teilnehmer nur `daten` (siehe api/routers/sitzungen.py).
 * Jedes Werkzeug legt neben sich eine `SitzungAnsicht` ab (z. B.
 * lib/markieren/sitzung.ts), und Dashboard, Auswertung und Downloads lesen
 * daraus Spalten, Aufgaben und Wertung — dieselbe Beschreibung für alles.
 * Ohne Ansicht zeigt das Dashboard nur, wer da ist und was er gerade tut.
 */
import type { SitzungZeile } from "@/lib/api";

export type Daten = Record<string, unknown>;

/**
 * Eigene Datenquelle für Werkzeuge mit eigenen Tabellen (TaskCrawler, Challenge …):
 * ein Adapter liefert Zeilen und Ansicht, Dashboard und Auswertung zeigen sie wie
 * den gemeinsamen Sitzungsstand.
 */
export interface SitzungQuelle {
  schluessel: unknown[];
  laden: () => Promise<{ zeilen: SitzungZeile[]; ansicht?: SitzungAnsicht }>;
}

export type Spalte = {
  id: string;
  titel: string;
  /** Kurzform für die Tabellenüberschrift; der Titel steht dann im Tooltip. */
  icon?: string;
} & (
  | { art: "zahl"; wert: (d: Daten) => number | null; einheit?: string }
  | { art: "zeit"; wert: (d: Daten) => number | null } // Millisekunden
  | { art: "anteil"; wert: (d: Daten) => number; max: number }
  | { art: "text"; wert: (d: Daten) => string | null }
);

export type Aufgabe = { id: string; titel: string; icon?: string };

export interface SitzungAnsicht {
  spalten: Spalte[];
  /** Aufgaben für Haken-Matrix und »am schwersten«. */
  aufgaben?: Aufgabe[];
  geschafft?: (d: Daten, aufgabe: string) => boolean;
  /** Fortschritt 0–1 für Balken und Kacheln; ohne Angabe: Anteil geschaffter Aufgaben. */
  fortschritt?: (d: Daten) => number;
  /** Wertung für die Ansicht »Rangliste«. */
  rang?: { titel: string; art: "zahl" | "zeit"; richtung: "min" | "max"; wert: (d: Daten) => number | null };
}

export function fortschrittVon(a: SitzungAnsicht | undefined, d: Daten): number | null {
  if (!a) return null;
  if (a.fortschritt) return a.fortschritt(d);
  if (a.aufgaben?.length && a.geschafft) return a.aufgaben.filter(x => a.geschafft!(d, x.id)).length / a.aufgaben.length;
  return null;
}

export const zahl = (d: Daten, k: string): number | null => (typeof d[k] === "number" ? (d[k] as number) : null);
export const liste = (d: Daten, k: string): unknown[] => (Array.isArray(d[k]) ? (d[k] as unknown[]) : []);
export const objekt = (d: Daten, k: string): Record<string, unknown> =>
  d[k] && typeof d[k] === "object" && !Array.isArray(d[k]) ? (d[k] as Record<string, unknown>) : {};

export const sekunden = (ms: number) =>
  (ms / 1000).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " s";

export function vor(iso: string, jetzt = Date.now()): string {
  const s = Math.max(0, Math.round((jetzt - new Date(iso).getTime()) / 1000));
  if (s < 60) return "gerade eben";
  const m = Math.round(s / 60);
  return m < 60 ? `vor ${m} Min.` : `vor ${Math.round(m / 60)} Std.`;
}

/** Wert einer Spalte als Text — für Tabelle, CSV, PDF und DOCX gleich. */
export function zelle(s: Spalte, d: Daten): string {
  switch (s.art) {
    case "zahl": { const v = s.wert(d); return v == null ? "" : `${v.toLocaleString("de-DE")}${s.einheit ? ` ${s.einheit}` : ""}`; }
    case "zeit": { const v = s.wert(d); return v == null ? "" : sekunden(v); }
    case "anteil": return `${s.wert(d)}/${s.max}`;
    case "text": return s.wert(d) ?? "";
  }
}
