/**
 * Zugriff auf die Fotos der Stoffproben samt Nachweis. Die JSON schreibt
 * scripts/fetch-pse.mjs — von Hand nichts eintragen, sonst fehlt die Lizenz.
 */
import nachweise from "./bilder.json";

export interface Bildnachweis {
  datei: string;
  titel: string;
  seite: string;
  lizenz: string;
  urheber: string;
}

const alle = nachweise as Record<string, Bildnachweis>;

export const probe = (symbol: string): Bildnachweis | undefined => alle[symbol];

export const ALLE_PROBEN = alle;
