/**
 * Zugriff auf die Bilder samt Nachweis. Die JSON schreibt
 * scripts/fetch-sonnensystem.mjs — von Hand nichts eintragen, sonst fehlt
 * die Lizenz.
 */
import nachweise from "./bilder.json";

export interface Bildnachweis {
  datei: string;
  titel: string;
  seite: string;
  lizenz: string;
  urheber: string;
  /** Nur Fotos: Mitte und Durchmesser der Scheibe, als Anteil der Bildbreite/-höhe. */
  scheibe?: { x: number; y: number; d: number };
}

const alle = nachweise as Record<string, Bildnachweis>;

export const foto = (id: string): Bildnachweis | undefined => alle[`fotos/${id}`];
export const textur = (id: string): Bildnachweis | undefined => alle[`texturen/${id}`];
export const galerieBild = (id: string): Bildnachweis | undefined => alle[`galerie/${id}`];

export const ALLE_NACHWEISE = alle;
