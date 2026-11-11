/**
 * Fortschritt der Zeitreise: welche Stationen geschafft sind (schaltet
 * Galerie-Fotos und die nächste Station frei) und die Bestwerte der Spiele.
 *
 * Wo gespeichert wird, entscheidet components/medien/Medien.tsx: mit Konto
 * oder Gast-Zugang am Server (wie beim TaskCrawler, api/routers/medien.py),
 * sonst — Offline-Datei, TaskCrawler-Station — hier im Browser. Die beiden
 * Wege mischen sich nie: An Schul-PCs teilen sich viele Konten einen Browser.
 */
import { MEDIEN } from "./medien";
import { ERPROBT_IDS, type ErprobtId } from "./erprobt";

const SCHLUESSEL = "hp_medien_fortschritt";

/** `erprobt`: gelöste Mitmach-Demos (lib/medien/erprobt.ts), für die Erfolge */
export interface Fortschritt { geschafft: string[]; erprobt: string[]; eilbote: number; sortieren: number }
export const leer = (): Fortschritt => ({ geschafft: [], erprobt: [], eilbote: 0, sortieren: 0 });

/** Nur bekannte Stationen, Zahlen als Zahlen */
export function sauber(roh: unknown): Fortschritt {
  if (!roh || typeof roh !== "object") return leer();
  const r = roh as Record<string, unknown>;
  const ids = new Set(MEDIEN.map(m => m.id));
  return {
    geschafft: Array.isArray(r.geschafft) ? [...new Set(r.geschafft.filter((x): x is string => typeof x === "string" && ids.has(x)))] : [],
    erprobt: Array.isArray(r.erprobt) ? [...new Set(r.erprobt.filter((x): x is string => typeof x === "string" && ERPROBT_IDS.has(x)))] : [],
    eilbote: Number(r.eilbote) || 0,
    sortieren: Number(r.sortieren) || 0,
  };
}

export function lies(): Fortschritt {
  try { return sauber(JSON.parse(localStorage.getItem(SCHLUESSEL) ?? "null")); } catch { return leer(); }
}

export function schreibe(f: Fortschritt): Fortschritt {
  try { localStorage.setItem(SCHLUESSEL, JSON.stringify(f)); } catch { /* privates Fenster */ }
  return f;
}

/** Zwei Stände zusammenlegen: Stationen vereinigen, Bestwerte behalten (wie der Server) */
export function vereinige(a: Fortschritt, b: Fortschritt): Fortschritt {
  return {
    geschafft: [...a.geschafft, ...b.geschafft.filter(id => !a.geschafft.includes(id))],
    erprobt: [...a.erprobt, ...b.erprobt.filter(id => !a.erprobt.includes(id))],
    eilbote: Math.max(a.eilbote, b.eilbote),
    sortieren: Math.max(a.sortieren, b.sortieren),
  };
}

/** Änderungen beschreiben die Komponenten als Funktion vom alten Stand */
export type Aenderung = (alt: Fortschritt) => Fortschritt;
export const mitStation = (id: string): Aenderung => a => (a.geschafft.includes(id) ? a : { ...a, geschafft: [...a.geschafft, id] });
export const mitErprobt = (id: ErprobtId): Aenderung => a => (a.erprobt.includes(id) ? a : { ...a, erprobt: [...a.erprobt, id] });

/** Bis zu welcher Station (Index in MEDIEN) darf man reisen? Alle geschafften plus die nächste. */
export function erreichbarBis(geschafft: string[]): number {
  const i = MEDIEN.findIndex(m => !geschafft.includes(m.id));
  return i === -1 ? MEDIEN.length - 1 : i;
}
