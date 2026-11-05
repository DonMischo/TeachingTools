/**
 * Fortschritt der Zeitreise im Browser: welche Stationen geschafft sind
 * (schaltet Galerie-Fotos und die nächste Station frei) und die Bestwerte
 * der Spiele. Jede Änderung liest frisch und schreibt sofort — kein
 * Speicher-Effekt, der unter StrictMode den Stand überschreiben könnte.
 */
import { MEDIEN } from "./medien";

const SCHLUESSEL = "hp_medien_fortschritt";

export interface Fortschritt { geschafft: string[]; eilbote: number; sortieren: number }
const leer = (): Fortschritt => ({ geschafft: [], eilbote: 0, sortieren: 0 });

export function lies(): Fortschritt {
  try {
    const roh = JSON.parse(localStorage.getItem(SCHLUESSEL) ?? "null");
    if (!roh || typeof roh !== "object") return leer();
    const ids = new Set(MEDIEN.map(m => m.id));
    return {
      geschafft: Array.isArray(roh.geschafft) ? roh.geschafft.filter((x: unknown) => typeof x === "string" && ids.has(x)) : [],
      eilbote: Number(roh.eilbote) || 0,
      sortieren: Number(roh.sortieren) || 0,
    };
  } catch {
    return leer();
  }
}

export function aendere(f: (alt: Fortschritt) => Fortschritt): Fortschritt {
  const neu = f(lies());
  try { localStorage.setItem(SCHLUESSEL, JSON.stringify(neu)); } catch { /* privates Fenster */ }
  return neu;
}

export const schaffe = (id: string) => aendere(a => (a.geschafft.includes(id) ? a : { ...a, geschafft: [...a.geschafft, id] }));
export const zuruecksetzen = () => aendere(() => leer());

/** Bis zu welcher Station (Index in MEDIEN) darf man reisen? Alle geschafften plus die nächste. */
export function erreichbarBis(geschafft: string[]): number {
  const i = MEDIEN.findIndex(m => !geschafft.includes(m.id));
  return i === -1 ? MEDIEN.length - 1 : i;
}
