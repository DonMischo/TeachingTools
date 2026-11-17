/**
 * Fortschritt und Erfolge der Sim »Daten und Stochastik«.
 *
 * Der Stand liegt im Browser unter `hp_stochastik_stand` (ohne Konto
 * nutzbar, auch an TaskCrawler-Stationen). Jeder Erfolg liest nur Zahlen
 * aus dem Stand – die Übersicht /erfolge liest denselben Schlüssel.
 */
import type { LektionId } from "./lektionen";
import type { SpielId } from "./spiele";

export const SPEICHER = "hp_stochastik_stand";

export interface Stand {
  /** Beim ersten Versuch ohne Tipp gelöste Übungen je Lektion. */
  geloest: Partial<Record<LektionId, number>>;
  /** Bester Punktestand je Spiel. */
  best: Partial<Record<SpielId, number>>;
  /** Gespielte Runden je Spiel. */
  runden: Partial<Record<SpielId, number>>;
  /** Simulierte Versuche im Zufallslabor und bei den Experimenten. */
  versuche: number;
  /** Ausgewertete eigene Erhebungen oder übernommene Umfragen. */
  umfragen: number;
  /** Lektionen, die schon einmal geöffnet wurden. */
  besucht: LektionId[];
  /** Längste Reihe richtiger Übungen am Stück. */
  serie: number;
}

export const leer = (): Stand => ({ geloest: {}, best: {}, runden: {}, versuche: 0, umfragen: 0, besucht: [], serie: 0 });

/** Was aus dem Speicher kommt, ist ungeprüft: fehlende oder kaputte Teile auffüllen. */
export function sauber(roh: unknown): Stand {
  const s = (roh && typeof roh === "object" ? roh : {}) as Partial<Stand>;
  const obj = <T>(x: unknown): T => (x && typeof x === "object" && !Array.isArray(x) ? x : {}) as T;
  const zahl = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : 0);
  return {
    geloest: obj(s.geloest), best: obj(s.best), runden: obj(s.runden),
    versuche: zahl(s.versuche), umfragen: zahl(s.umfragen), serie: zahl(s.serie),
    besucht: Array.isArray(s.besucht) ? s.besucht.filter(x => typeof x === "string") : [],
  };
}

export function lade(): Stand {
  try {
    const roh = localStorage.getItem(SPEICHER);
    return sauber(roh ? JSON.parse(roh) : null);
  } catch {
    return leer();
  }
}

/** Liest, ändert, speichert – und meldet, welche Erfolge dadurch neu dazukamen. */
export function melde(aendern: (s: Stand) => Stand): Erfolg[] {
  const vorher = lade();
  const nachher = aendern(sauber(JSON.parse(JSON.stringify(vorher))));
  try { localStorage.setItem(SPEICHER, JSON.stringify(nachher)); } catch { /* privates Fenster */ }
  return ERFOLGE.filter(e => e.wert(vorher) < e.ziel && e.wert(nachher) >= e.ziel);
}

export const geloestGesamt = (s: Stand) => Object.values(s.geloest).reduce((a, b) => a + (b ?? 0), 0);
const lektionen = (s: Stand, ids: LektionId[]) => ids.filter(i => (s.geloest[i] ?? 0) > 0).length;

export type Gruppe = "Entdecken" | "Üben" | "Spielen";

export interface Erfolg { id: string; gruppe: Gruppe; icon: string; name: string; text: string; ziel: number; wert: (s: Stand) => number }

export const ERFOLGE: Erfolg[] = [
  { id: "erste-schritte", gruppe: "Entdecken", icon: "👣", name: "Erste Schritte", text: "Öffne fünf verschiedene Lektionen.", ziel: 5, wert: s => s.besucht.length },
  { id: "alle-lektionen", gruppe: "Entdecken", icon: "🗺️", name: "Rundgang", text: "Öffne alle zwölf Lektionen.", ziel: 12, wert: s => s.besucht.length },
  { id: "tausend", gruppe: "Entdecken", icon: "🎲", name: "Tausend Würfe", text: "Simuliere 1 000 Versuche.", ziel: 1000, wert: s => s.versuche },
  { id: "grosse-zahlen", gruppe: "Entdecken", icon: "📈", name: "Gesetz der großen Zahlen", text: "Simuliere 100 000 Versuche.", ziel: 100000, wert: s => s.versuche },
  { id: "forscher", gruppe: "Entdecken", icon: "🗳️", name: "Meinungsforscher·in", text: "Werte eine eigene Erhebung oder eine Umfrage aus.", ziel: 1, wert: s => s.umfragen },

  { id: "erste-aufgabe", gruppe: "Üben", icon: "✏️", name: "Angefangen", text: "Löse eine Übung beim ersten Versuch.", ziel: 1, wert: geloestGesamt },
  { id: "fuenfzig", gruppe: "Üben", icon: "📚", name: "Fleißig", text: "Löse 50 Übungen beim ersten Versuch.", ziel: 50, wert: geloestGesamt },
  { id: "serie-10", gruppe: "Üben", icon: "🔥", name: "Zehn am Stück", text: "Löse zehn Übungen hintereinander richtig.", ziel: 10, wert: s => s.serie },
  { id: "daten-profi", gruppe: "Üben", icon: "📊", name: "Daten-Profi", text: "Löse Übungen in allen Lektionen aus Kl. 5/6.", ziel: 4, wert: s => lektionen(s, ["erfassen", "diagramme", "kenngroessen", "experimente"]) },
  { id: "zufalls-profi", gruppe: "Üben", icon: "🎯", name: "Zufalls-Profi", text: "Löse Übungen in allen Lektionen aus Kl. 7/8.", ziel: 4, wert: s => lektionen(s, ["labor", "laplace", "baum", "venn"]) },
  { id: "stochastik-profi", gruppe: "Üben", icon: "🎓", name: "Stochastik-Profi", text: "Löse Übungen in allen Lektionen aus Kl. 9/10.", ziel: 3, wert: s => lektionen(s, ["vierfelder", "kombinatorik", "zufallsgroessen"]) },

  { id: "blitz-100", gruppe: "Spielen", icon: "⚡", name: "Blitzrechner·in", text: "Schaffe 100 Punkte im Kenngrößen-Blitz.", ziel: 100, wert: s => s.best.blitz ?? 0 },
  { id: "diagramm-10", gruppe: "Spielen", icon: "🖼️", name: "Diagramm-Auge", text: "Ordne zehn Diagramme in einer Runde richtig zu.", ziel: 10, wert: s => s.best.diagramm ?? 0 },
  { id: "schaetz-400", gruppe: "Spielen", icon: "🔮", name: "Bauchgefühl", text: "Hol 400 von 500 Punkten beim Schätzen.", ziel: 400, wert: s => s.best.schaetzen ?? 0 },
  { id: "baum-5", gruppe: "Spielen", icon: "🌳", name: "Baumpfleger·in", text: "Löse fünf Baum-Puzzles in einer Runde.", ziel: 5, wert: s => s.best.baum ?? 0 },
  { id: "tafel-5", gruppe: "Spielen", icon: "▦", name: "Tafel-Sprinter·in", text: "Fülle fünf Vierfeldertafeln in einer Runde.", ziel: 5, wert: s => s.best.vierfelder ?? 0 },
  { id: "alle-spiele", gruppe: "Spielen", icon: "🏆", name: "Spielesammlung", text: "Spiele jedes der fünf Spiele einmal.", ziel: 5, wert: s => Object.values(s.runden).filter(n => (n ?? 0) > 0).length },
];
