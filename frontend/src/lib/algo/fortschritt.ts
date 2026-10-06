/**
 * Fortschritt der Algorithmen-Werkstatt — im Browser und (in einer Sitzung) beim Server.
 * Es zählt immer das beste Ergebnis je Level; Fluss- und Automaten-Aufgaben sind
 * nur »gelöst« oder nicht.
 */
export interface LevelStand { sterne: number; bloecke: number }
export interface AlgoStand {
  level: Record<string, LevelStand>;
  fluss: string[];
  automat: string[];
}

export const LEER_STAND: AlgoStand = { level: {}, fluss: [], automat: [] };

export function ladeStand(schluessel: string): AlgoStand {
  try {
    const roh = JSON.parse(localStorage.getItem(schluessel) ?? "null");
    if (!roh || typeof roh !== "object") return LEER_STAND;
    return {
      level: roh.level && typeof roh.level === "object" ? roh.level : {},
      fluss: Array.isArray(roh.fluss) ? roh.fluss : [],
      automat: Array.isArray(roh.automat) ? roh.automat : [],
    };
  } catch {
    return LEER_STAND;
  }
}

export function speichereStand(schluessel: string, s: AlgoStand) {
  try { localStorage.setItem(schluessel, JSON.stringify(s)); } catch { /* ohne Speicher geht es auch */ }
}

export function mitLevel(s: AlgoStand, id: string, neu: LevelStand): AlgoStand {
  const alt = s.level[id];
  const besser = !alt || neu.sterne > alt.sterne || (neu.sterne === alt.sterne && neu.bloecke < alt.bloecke);
  return besser ? { ...s, level: { ...s.level, [id]: neu } } : s;
}

export function mitErledigt(s: AlgoStand, feld: "fluss" | "automat", id: string): AlgoStand {
  return s[feld].includes(id) ? s : { ...s, [feld]: [...s[feld], id] };
}
