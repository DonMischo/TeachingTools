/**
 * Holt Fotos ganzer Bäume (Habitus) für »Bäume bestimmen« (Baumleben) von Wikimedia Commons
 * nach public/baum/habitus/ und schreibt src/lib/baum/habitus.json (Urheber, Lizenz, Commons-Seite).
 * Nur für Arten, deren Hauptfoto eine Nahaufnahme (Blatt, Blüte, Frucht, Stamm) oder ein
 * besonderer Einzelbaum ist; das alte Foto bleibt als Nahaufnahme im Steckbrief.
 *
 * Aufruf:  node scripts/fetch-baum-habitus.mjs  [--force]
 */
import { holeGalerie } from "./commons-galerie.mjs";

/** Baum-id (src/lib/baum/trees.ts) → Dateiname auf Commons */
export const BILDER = {
  "feldahorn": "Field Maple - geograph.org.uk - 433718.jpg",
  "spitzahorn": "Acer platanoides Marki 2.JPG",
  "traubeneiche": "Sessile Oak (Quercus petraea) - geograph.org.uk - 650268.jpg",
  "vogelkirsche": "Prunus avium - geograph.org.uk - 6973404.jpg",
  "bergahorn": "2018-06-07 Sycamore Gap Tree (Acer pseudoplatanus), next to Hadrian’s Wall UK.jpg",
  "sommerlinde": "Tilia platyphyllos - geograph.org.uk - 6483594.jpg",
  "walnuss": "Juglans regia autumn 2009.jpg",
  "tanne": "Abies alba Tree.jpg",
  "edelkastanie": "Sweet Chestnut tree in Carshalton Park - geograph.org.uk - 1534352.jpg",
};

if (process.argv[1] && process.argv[1].endsWith("fetch-baum-habitus.mjs")) {
  await holeGalerie({
    bilder: BILDER, ziel: "public/baum/habitus", nachweise: "src/lib/baum/habitus.json",
    url: "/baum/habitus", force: process.argv.includes("--force"), breite: 1000,
  });
}
