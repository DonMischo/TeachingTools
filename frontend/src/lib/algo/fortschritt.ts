/**
 * Fortschritt der Algorithmen-Werkstatt — im Browser und (in einer Sitzung) beim Server.
 * Je Level und je Aufgabe zählt das Beste: meiste Sterne, meiste Punkte,
 * wenigste Bausteine (jeweils für sich). `fluss` und `automat` sind die Ids
 * der gelösten Aufgaben, `wertung` ihre Sterne und Punkte ("automat:<id>",
 * "fluss:<id>").
 */
export interface LevelStand { sterne: number; bloecke: number; punkte?: number }
export interface WertungStand { sterne: number; punkte: number }
export interface AlgoStand {
  level: Record<string, LevelStand>;
  fluss: string[];
  automat: string[];
  wertung: Record<string, WertungStand>;
}

export const LEER_STAND: AlgoStand = { level: {}, fluss: [], automat: [], wertung: {} };

export function ladeStand(schluessel: string): AlgoStand {
  try {
    const roh = JSON.parse(localStorage.getItem(schluessel) ?? "null");
    if (!roh || typeof roh !== "object") return LEER_STAND;
    return {
      level: roh.level && typeof roh.level === "object" ? roh.level : {},
      fluss: Array.isArray(roh.fluss) ? roh.fluss : [],
      automat: Array.isArray(roh.automat) ? roh.automat : [],
      wertung: roh.wertung && typeof roh.wertung === "object" ? roh.wertung : {},
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
  const best: LevelStand = alt
    ? { sterne: Math.max(alt.sterne, neu.sterne), bloecke: Math.min(alt.bloecke, neu.bloecke), punkte: Math.max(alt.punkte ?? 0, neu.punkte ?? 0) }
    : neu;
  if (alt && best.sterne === alt.sterne && best.bloecke === alt.bloecke && best.punkte === (alt.punkte ?? 0)) return s;
  return { ...s, level: { ...s.level, [id]: best } };
}

export function mitErledigt(s: AlgoStand, feld: "fluss" | "automat", id: string, w?: WertungStand): AlgoStand {
  let neu = s[feld].includes(id) ? s : { ...s, [feld]: [...s[feld], id] };
  if (w) {
    const k = `${feld}:${id}`, alt = neu.wertung[k];
    if (!alt || w.sterne > alt.sterne || w.punkte > alt.punkte) {
      neu = { ...neu, wertung: { ...neu.wertung, [k]: { sterne: Math.max(w.sterne, alt?.sterne ?? 0), punkte: Math.max(w.punkte, alt?.punkte ?? 0) } } };
    }
  }
  return neu;
}

export function summen(s: AlgoStand): { punkte: number; sterne: number } {
  let punkte = 0, sterne = 0;
  for (const l of Object.values(s.level)) { punkte += l.punkte ?? 0; sterne += l.sterne; }
  for (const w of Object.values(s.wertung)) { punkte += w.punkte; sterne += w.sterne; }
  return { punkte, sterne };
}
