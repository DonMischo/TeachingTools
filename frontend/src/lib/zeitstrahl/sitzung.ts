/**
 * Zeitstrahl-Üben in Dashboard und Auswertung (siehe lib/sitzung/typen.ts).
 *
 * Lernende im geteilten Zeitstrahl melden nach jeder Runde ihren Stand:
 * Zähler plus je Ereignis-Id, ob es zuletzt richtig lag. Die Ereignisse sind
 * die Aufgaben, so zeigen Matrix und »am schwersten«, welche Daten die Klasse
 * noch nicht kennt. Der Server prüft das in `_pruefe_zeitstrahl`
 * (api/routers/sitzungen.py).
 */
import type { TimelineSetDetail } from "@/components/timeline/types";
import { eventDateLabel } from "@/components/timeline/scale";
import { objekt, zahl, type Daten, type SitzungAnsicht } from "@/lib/sitzung/typen";

export interface ZeitstrahlStand {
  runden: number;
  richtig: number;
  gesamt: number;
  ereignisse: Record<string, boolean>;
}

export const LEER: ZeitstrahlStand = { runden: 0, richtig: 0, gesamt: 0, ereignisse: {} };

/** Unter der Servergrenze von 16 000 Bytes, mit Luft für die Zähler. */
const MAX_BYTES = 15000;

const bytes = (s: ZeitstrahlStand) => new TextEncoder().encode(JSON.stringify(s)).length;

/** Eine geprüfte Runde eintragen. Wird der Stand zu groß, fallen die am
 * längsten nicht mehr geübten Ereignisse heraus. */
export function rundeEintragen(stand: ZeitstrahlStand, ergebnisse: Record<string, boolean>): ZeitstrahlStand {
  const werte = Object.values(ergebnisse);
  const ereignisse = { ...stand.ereignisse };
  for (const [id, ok] of Object.entries(ergebnisse)) {
    delete ereignisse[id]; // neu einreihen: zuletzt geübt steht hinten
    ereignisse[id] = ok;
  }
  const neu: ZeitstrahlStand = {
    runden: stand.runden + 1,
    richtig: stand.richtig + werte.filter(Boolean).length,
    gesamt: stand.gesamt + werte.length,
    ereignisse,
  };
  const ids = Object.keys(ereignisse);
  while (ids.length && bytes(neu) > MAX_BYTES) delete ereignisse[ids.shift()!];
  return neu;
}

const sicher = (d: Daten) => Object.values(objekt(d, "ereignisse")).filter(v => v === true).length;

export function zeitstrahlAnsicht(set: TimelineSetDetail): SitzungAnsicht {
  return {
    spalten: [
      { id: "runden", titel: "Runden", icon: "🔁", art: "zahl", wert: d => zahl(d, "runden") },
      {
        id: "quote", titel: "Trefferquote", icon: "🎯", art: "zahl", einheit: "%",
        wert: d => { const g = zahl(d, "gesamt"); return g ? Math.round((100 * (zahl(d, "richtig") ?? 0)) / g) : null; },
      },
      { id: "sicher", titel: "Sicher eingeordnet", icon: "📏", art: "anteil", max: set.events.length, wert: sicher },
    ],
    aufgaben: set.events.map(e => ({ id: e.id, titel: `${e.label} (${eventDateLabel(e, set.axis)})` })),
    geschafft: (d, id) => objekt(d, "ereignisse")[id] === true,
    rang: { titel: "Sicher eingeordnet", art: "zahl", richtung: "max", wert: sicher },
  };
}
