/**
 * Holt die Blatt-Tafeln für »Bäume bestimmen« (Baumleben) von Wikimedia Commons
 * nach public/baum/blatt/ und schreibt src/lib/baum/blaetter.json
 * (Urheber, Lizenz, Commons-Seite). Meist gemeinfreie Tafeln aus Thomé,
 * Sturm, Köhler und Lindman; wo es keine gibt, ein freies Blattfoto.
 *
 * Aufruf:  node scripts/fetch-baum-blaetter.mjs  [--force]
 */
import { holeGalerie } from "./commons-galerie.mjs";

/** Baum-id (src/lib/baum/trees.ts) → Dateiname auf Commons */
export const BILDER = {
  "buche": "Illustration Fagus sylvatica0.jpg",
  "stieleiche": "Illustration Quercus robur0.jpg",
  "traubeneiche": "Quercus petraea - Köhler’s Medizinal-Pflanzen in naturgetreuen Abbildungen mit kurz erläuterndem Texte (Plate 31) (6972239280) - clean.jpg",
  "hainbuche": "Illustration Carpinus betulus0.jpg",
  "birke": "Illustration Betula pendula0.jpg",
  "bergahorn": "Acer pseudoplatanus - Deutschlands Flora in Abbildungen nach der natur - vol. 7 t. 17 - clean, no legend.jpg",
  "spitzahorn": "Illustration Acer platanoides0.jpg",
  "feldahorn": "Acer campestre Sturm07018.jpg",
  "esche": "Illustration Fraxinus excelsior0.jpg",
  "winterlinde": "Tilia cordata Sturm62 cropped.jpg",
  "sommerlinde": "Tilia platyphyllos Sturm61.jpg",
  "schwarzerle": "Illustration Alnus glutinosa0.jpg",
  "zitterpappel": "Illustration Populus tremula0.jpg",
  "silberweide": "Illustration Salix alba0.jpg",
  "bergulme": "366 Ulmus scabra.jpg",
  "vogelkirsche": "Illustration Prunus avium0.jpg",
  "eberesche": "Illustration Sorbus aucuparia0.jpg",
  "rosskastanie": "Illustration Aesculus hippocastanum0.jpg",
  "edelkastanie": "Illustration Castanea sativa0.jpg",
  "walnuss": "Illustration Juglans regia0.jpg",
  "robinie": "Robinia pseudoacacia - American medicinal plants (Plate 50) (6025403949) - clean.jpg",
  "platane": "Platanus × hispanica Columbia single leaf.png",
  "elsbeere": "Sorbus torminalis leaves kz.jpg",
  "fichte": "Illustration Picea abies0.jpg",
  "tanne": "Illustration Abies alba0.jpg",
  "waldkiefer": "Illustration Pinus sylvestris0.jpg",
  "schwarzkiefer": "Pinus nigra - Köhler–s Medizinal-Pflanzen-242.jpg",
  "laerche": "Larix decidua - Köhler–s Medizinal-Pflanzen-216.jpg",
  "eibe": "Illustration Taxus baccata0.jpg",
  "zirbe": "Die Alpenpflanzen nach der Natur gemalt (Plate 86) (7348877070).jpg",
};

if (process.argv[1] && process.argv[1].endsWith("fetch-baum-blaetter.mjs")) {
  await holeGalerie({
    bilder: BILDER, ziel: "public/baum/blatt", nachweise: "src/lib/baum/blaetter.json",
    url: "/baum/blatt", force: process.argv.includes("--force"), breite: 900,
  });
}
