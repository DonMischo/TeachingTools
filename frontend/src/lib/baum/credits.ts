// @ts-nocheck
/* eslint-disable */
// Baumleben: aus der eigenständigen Fassung übernommen, ungeprüftes JavaScript.
import { BL } from "./bl";
import blaetter from "./blaetter.json";
import habitus from "./habitus.json";
BL.CREDITS = {
"buche": {
"file": "buche.jpg",
"license": "CC BY-SA 3.0",
"artist": "Malene Thyssen",
"page": "https://commons.wikimedia.org/wiki/File:Grib_skov.jpg"
},
"stieleiche": {
"file": "stieleiche.jpg",
"license": "Public domain",
"artist": "Algirdas at Lithuanian Wikipedia",
"page": "https://commons.wikimedia.org/wiki/File:Paprastasis_azuolas.JPG"
},
"traubeneiche": {
"file": "traubeneiche.jpg",
"license": "CC BY-SA 2.5",
"artist": "Urheber siehe Commons",
"page": "https://commons.wikimedia.org/wiki/File:Quercus_petraea_02.jpg"
},
"hainbuche": {
"file": "hainbuche.jpg",
"license": "CC BY 2.5",
"artist": "Willow",
"page": "https://commons.wikimedia.org/wiki/File:Carpinus_betulus_-_Hunsr%C3%BCck_001.jpg"
},
"birke": {
"file": "birke.jpg",
"license": "CC BY-SA 2.0",
"artist": "Percita at Flickr",
"page": "https://commons.wikimedia.org/wiki/File:Betula_pendula_Finland.jpg"
},
"bergahorn": {
"file": "bergahorn.jpg",
"license": "CC BY-SA 3.0 at",
"artist": "Christian Pirkl",
"page": "https://commons.wikimedia.org/wiki/File:ID_1211_Bergahorn_0011.jpg"
},
"spitzahorn": {
"file": "spitzahorn.jpg",
"license": "CC BY 3.0",
"artist": "Rabensteiner",
"page": "https://commons.wikimedia.org/wiki/File:Ahornbluete.jpg"
},
"feldahorn": {
"file": "feldahorn.jpg",
"license": "CC BY 3.0",
"artist": "David Perez",
"page": "https://commons.wikimedia.org/wiki/File:Acer_campestre_02_by-dpc.jpg"
},
"esche": {
"file": "esche.jpg",
"license": "CC BY 2.5",
"artist": "Willow",
"page": "https://commons.wikimedia.org/wiki/File:Fraxinus_excelsior_001.jpg"
},
"winterlinde": {
"file": "winterlinde.jpg",
"license": "CC BY 3.0",
"artist": "ImreKiss",
"page": "https://commons.wikimedia.org/wiki/File:Tilia_cordata,_Lipa2009.jpg"
},
"sommerlinde": {
"file": "sommerlinde.jpg",
"license": "CC BY-SA 3.0",
"artist": "Chmee2",
"page": "https://commons.wikimedia.org/wiki/File:L%C3%ADpa_u_Horn%C3%ADho_Z%C3%A1blat%C3%AD_v_roce_2011_(1).JPG"
},
"schwarzerle": {
"file": "schwarzerle.jpg",
"license": "CC BY 2.5",
"artist": "Willow",
"page": "https://commons.wikimedia.org/wiki/File:Alnus_glutinosa_011.jpg"
},
"zitterpappel": {
"file": "zitterpappel.jpg",
"license": "CC BY-SA 4.0",
"artist": "Øyvind Holmstad",
"page": "https://commons.wikimedia.org/wiki/File:Ospeholt_i_Hurdal.JPG"
},
"silberweide": {
"file": "silberweide.jpg",
"license": "CC BY-SA 4.0",
"artist": "Burkhard Mücke",
"page": "https://commons.wikimedia.org/wiki/File:Salix_alba_an_der_Isar.jpg"
},
"bergulme": {
"file": "bergulme.jpg",
"license": "CC0",
"artist": "Ronnie Nijboer",
"page": "https://commons.wikimedia.org/wiki/File:RN_Ulmus_glabra_(alnarp_sweden).jpg"
},
"eberesche": {
"file": "eberesche.jpg",
"license": "CC BY-SA 3.0",
"artist": "Eeno11",
"page": "https://commons.wikimedia.org/wiki/File:Rowan_tree_20081002b.jpg"
},
"rosskastanie": {
"file": "rosskastanie.jpg",
"license": "CC BY-SA 4.0",
"artist": "Stephan van Helden",
"page": "https://commons.wikimedia.org/wiki/File:ND_678.N.59_Hofers_Kastanien_in_Wettringen.jpg"
},
"edelkastanie": {
"file": "edelkastanie.jpg",
"license": "CC BY 2.0",
"artist": "Miguel Angel Masegosa Martínez",
"page": "https://commons.wikimedia.org/wiki/File:Casta%C3%B1o_centenario_(Castanea_sativa)_(45032673662).jpg"
},
"walnuss": {
"file": "walnuss.jpg",
"license": "CC BY-SA 2.0",
"artist": "surrealpenguin",
"page": "https://commons.wikimedia.org/wiki/File:Walnut_forest_in_Arslanbab.jpg"
},
"robinie": {
"file": "robinie.jpg",
"license": "CC BY-SA 3.0",
"artist": "Wolfgang Moroder.  \n\nFeel free to use my photos, but please mention me as the author and send me",
"page": "https://commons.wikimedia.org/wiki/File:Villn%C3%B6%C3%9F_Robinie_beim_Mantinghof_Pardell.jpg"
},
"platane": {
"file": "platane.jpg",
"license": "CC BY-SA 3.0",
"artist": "Fanghong",
"page": "https://commons.wikimedia.org/wiki/File:PlatanusAcerifoliaTrunk.jpg"
},
"elsbeere": {
"file": "elsbeere.jpg",
"license": "CC BY-SA 2.0",
"artist": "Andrew Dunn",
"page": "https://commons.wikimedia.org/wiki/File:Sorbus_torminalis_Full_tree.jpg"
},
"fichte": {
"file": "fichte.jpg",
"license": "CC BY-SA 3.0 ee",
"artist": "Ivar Leidus",
"page": "https://commons.wikimedia.org/wiki/File:Kuusk_Keila-Paldiski_rdt_%C3%A4%C3%A4res.jpg"
},
"tanne": {
"file": "tanne.jpg",
"license": "CC BY-SA 2.0",
"artist": "Steve & Jemma Copley on Flickr",
"page": "https://commons.wikimedia.org/wiki/File:Abies_alba_Pyrenees-Orientales.jpg"
},
"waldkiefer": {
"file": "waldkiefer.jpg",
"license": "CC BY-SA 2.0",
"artist": "Hello, I am Bruce on Flickr",
"page": "https://commons.wikimedia.org/wiki/File:Pinus_sylvestris_Glenmuick.jpg"
},
"schwarzkiefer": {
"file": "schwarzkiefer.jpg",
"license": "CC BY-SA 3.0",
"artist": "Karl Gruber",
"page": "https://commons.wikimedia.org/wiki/File:Schwarzkiefer.jpg"
},
"laerche": {
"file": "laerche.jpg",
"license": "CC BY-SA 2.0",
"artist": "Sciadopitys from UK",
"page": "https://commons.wikimedia.org/wiki/File:Larix_decidua_Aletschwald.jpg"
},
"eibe": {
"file": "eibe.jpg",
"license": "CC BY-SA 2.0",
"artist": "Sitomon",
"page": "https://commons.wikimedia.org/wiki/File:Taxus_baccata_tree.jpg"
},
"zirbe": {
"file": "zirbe.jpg",
"license": "CC BY-SA 3.0",
"artist": "Tigerente at German Wikipedia",
"page": "https://commons.wikimedia.org/wiki/File:Zirbe01.jpg"
},
"vogelkirsche": {
"file": "vogelkirsche.jpg",
"license": "CC BY-SA 3.0",
"artist": "H. Zell",
"page": "https://commons.wikimedia.org/wiki/File:Prunus_avium_-_Hohenwettersbach_01.jpg"
}
};
// Blatt-Tafeln für »Bäume bestimmen«, geholt mit scripts/fetch-baum-blaetter.mjs
BL.BLAETTER = blaetter;
// Nachweis aus den Commons-Skripten (scripts/commons-galerie.mjs)
BL.commonsCredit = (c, was) => {
  const lic = c.lizenz === "Public domain" ? "gemeinfrei" : c.lizenzUrl ? `<a href="${c.lizenzUrl}" target="_blank" rel="noopener">${c.lizenz}</a>` : c.lizenz;
  return `${was ? was + ": " : ""}${c.urheber === "unbekannt" ? "" : c.urheber + " · "}${lic} · <a href="${c.seite}" target="_blank" rel="noopener">Wikimedia Commons</a>`;
};
BL.blattCredit = (id) => BL.BLAETTER[id] ? BL.commonsCredit(BL.BLAETTER[id]) : "";
// Fotos ganzer Bäume für Arten, deren Hauptfoto eine Nahaufnahme ist; geholt mit scripts/fetch-baum-habitus.mjs
BL.HABITUS = habitus;
