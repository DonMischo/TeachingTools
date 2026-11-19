/**
 * Erfolge der Minispiele in der 3D-Welt des TaskCrawlers (Kämpfe, Bosse,
 * Sammelspiele). Gezählt wird auf dem Gerät, für alle TaskCrawler zusammen;
 * die Übersicht /erfolge liest denselben Stand (lib/erfolge/register.ts).
 */
import type { KampfArt, Stufe } from "./kampf";

export const ERFOLG_SCHLUESSEL = "hp_frei_erfolge";

export interface KampfStand {
  /** gewonnene Kämpfe je Art (Stationen und Bosse, ohne Sammelspiele) */
  siege: Partial<Record<KampfArt, number>>;
  /** gelungene Sammelspiele an Info-Stationen */
  gesammelt: number;
  serie: number;
  besteSerie: number;
  besteReaktion: number | null;
  /** Siege auf Stufe »schwer« */
  schwer: number;
  /** Siege direkt nach einer Niederlage */
  comeback: number;
  /** war das letzte Minispiel verloren? */
  verloren: boolean;
}

export const LEER: KampfStand = { siege: {}, gesammelt: 0, serie: 0, besteSerie: 0, besteReaktion: null, schwer: 0, comeback: 0, verloren: false };

const siege = (s: KampfStand) => Object.values(s.siege).reduce((a, b) => a + (b ?? 0), 0);
const art = (a: KampfArt) => (s: KampfStand) => s.siege[a] ?? 0;
const ARTEN: KampfArt[] = ["konter", "ausweichen", "folge", "block", "ziel", "runen", "kraft"];

export const ERFOLGE: { id: string; icon: string; name: string; text: string; ziel: number; wert: (s: KampfStand) => number }[] = [
  { id: "erster-sieg", icon: "🗡️", name: "Erster Sieg", text: "Gewinn deinen ersten Kampf in der 3D-Welt.", ziel: 1, wert: siege },
  { id: "konter", icon: "⚡", name: "Konterkönig", text: "Gewinn fünf Konter.", ziel: 5, wert: art("konter") },
  { id: "ausweichen", icon: "💨", name: "Ungreifbar", text: "Weich fünfmal erfolgreich aus.", ziel: 5, wert: art("ausweichen") },
  { id: "folge", icon: "✨", name: "Kombo-Künstler", text: "Schaff fünf Kombos.", ziel: 5, wert: art("folge") },
  { id: "block", icon: "🛡️", name: "Eiserner Schild", text: "Block fünf Angriffe ab.", ziel: 5, wert: art("block") },
  { id: "ziel", icon: "🎯", name: "Scharfes Auge", text: "Triff fünfmal alle Schwachstellen.", ziel: 5, wert: art("ziel") },
  { id: "runen", icon: "🔮", name: "Runenleser", text: "Brich dreimal den Runenbann eines Bosses.", ziel: 3, wert: art("runen") },
  { id: "kraft", icon: "💪", name: "Kraftprotz", text: "Gewinn dreimal das Kräftemessen gegen einen Boss.", ziel: 3, wert: art("kraft") },
  { id: "allrounder", icon: "🌈", name: "Allrounder", text: "Gewinn jede der sieben Kampfarten mindestens einmal.", ziel: ARTEN.length, wert: s => ARTEN.filter(a => (s.siege[a] ?? 0) > 0).length },
  { id: "serie", icon: "🔥", name: "In Serie", text: "Gewinn fünf Kämpfe hintereinander.", ziel: 5, wert: s => s.besteSerie },
  { id: "reflex", icon: "⏱️", name: "Blitzreflex", text: "Weich in weniger als 0,35 Sekunden aus.", ziel: 1, wert: s => (s.besteReaktion !== null && s.besteReaktion < 0.35 ? 1 : 0) },
  { id: "schwer", icon: "💀", name: "Hartgesotten", text: "Gewinn zehn Kämpfe auf »Schwer«.", ziel: 10, wert: s => s.schwer },
  { id: "comeback", icon: "🔁", name: "Nicht aufgeben", text: "Gewinn dreimal direkt nach einer Niederlage.", ziel: 3, wert: s => s.comeback },
  { id: "sammler", icon: "📜", name: "Splittersammler", text: "Birg zehn Info-Splitter mit einem Sammelspiel.", ziel: 10, wert: s => s.gesammelt },
  { id: "veteran", icon: "🏅", name: "Veteran", text: "Gewinn fünfzig Kämpfe.", ziel: 50, wert: siege },
];

export function erreichte(s: KampfStand): Set<string> {
  return new Set(ERFOLGE.filter(e => e.wert(s) >= e.ziel).map(e => e.id));
}

/** Stand nach einem Minispiel (rein, ohne Speicher) */
export function nachSpiel(s: KampfStand, e: { gut: boolean; art: KampfArt; reaktion: number | null; stufe: Stufe; sammeln: boolean }): KampfStand {
  const n: KampfStand = { ...s, siege: { ...s.siege } };
  if (e.gut) {
    if (s.verloren) n.comeback++;
    if (e.sammeln) n.gesammelt++;
    else {
      n.siege[e.art] = (n.siege[e.art] ?? 0) + 1;
      n.serie = s.serie + 1;
      n.besteSerie = Math.max(s.besteSerie, n.serie);
      if (e.stufe === "schwer") n.schwer++;
      if (e.reaktion !== null && (s.besteReaktion === null || e.reaktion < s.besteReaktion)) n.besteReaktion = e.reaktion;
    }
  } else if (!e.sammeln) n.serie = 0;
  n.verloren = !e.gut;
  return n;
}

export function ladeErfolge(): KampfStand {
  try {
    const roh = localStorage.getItem(ERFOLG_SCHLUESSEL);
    return roh ? { ...LEER, ...(JSON.parse(roh) as Partial<KampfStand>) } : LEER;
  } catch { return LEER; }
}

export function speichereErfolge(s: KampfStand) {
  try { localStorage.setItem(ERFOLG_SCHLUESSEL, JSON.stringify(s)); } catch { /* ohne Speicher */ }
}
