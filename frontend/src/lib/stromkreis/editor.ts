/**
 * Was man mit einer Schaltung tun kann — der gemeinsame Raster-Editor
 * (`lib/raster/editor.ts`) mit den Regeln der Stromkreise.
 *
 * Bei Falstad verbindet nur ein Endpunkt — für Schüler·innen sieht ein
 * Anschluss auf dem Draht aber verbunden aus, also ist er es hier auch.
 * Umschalter und Trafo haben zwischen a und b keine Leitung (dort darf ein
 * Draht liegen), bleiben gerade und haben keine greifbaren Enden.
 */
import { rasterEditor } from "../raster/editor";
import { anschluesse, type BauteilArt, type Schaltung } from "./modell";

export { gleich, type Auswahl } from "../raster/editor";

export const LEER: Schaltung = { version: 1, bauteile: [], draehte: [] };

const sonderform = (art: BauteilArt) => art === "umschalter" || art === "trafo";

export const {
  neueId, normalisiere, fuegeBauteilHinzu, fuegeDrahtHinzu, verschiebe, verschiebeEnde, drehe, loesche, setzeWert, treffer,
} = rasterEditor<BauteilArt>({
  anschluesse,
  leitetZwischen: art => !sonderform(art),
  starr: sonderform,
  koerperAbstand: (t, p, strecke) => {
    const pins = anschluesse(t);
    if (t.art === "trafo") return Math.min(strecke(p, pins[0], pins[1]), strecke(p, pins[2], pins[3]));
    if (t.art === "umschalter") return strecke(p, t.a, pins[2]);
    return Infinity;
  },
});
