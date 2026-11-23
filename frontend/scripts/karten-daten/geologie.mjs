/**
 * Geologische Karte Deutschlands — aus den Vektorkacheln von Macrostrat
 * (CC BY 4.0). Dort liegt für Mitteleuropa im Maßstab »medium« die EGDI-Karte
 * 1:1 Mio. der EuroGeoSurveys, deren deutscher Teil von der BGR stammt.
 * (Die BGR-Dienste selbst sind von hier aus nicht erreichbar.)
 *
 * Zwei Einteilungen wie im Schulatlas:
 *  - nach Erdzeitalter (System), Magmatite gesondert (Tiefen- und Ergussgestein)
 *  - nach Gesteinsart (Locker-, Sediment-, Tiefen-, Erguss-, Umwandlungsgestein)
 * Dazu die großen Störungen als Linien.
 */

export const QUELLE_GEOLOGIE = {
  name: "EuroGeoSurveys, EGDI 1:1 Million pan-european Surface Geology (deutscher Teil: BGR), über Macrostrat, bearbeitet",
  lizenz: "CC BY 4.0",
  url: "https://macrostrat.org/",
};

/** Kacheln (Zoom 7) über Deutschland: x 66–69, y 40–44 */
export const KACHELN = { z: 7, x: [66, 69], y: [40, 44] };
export const KACHEL_URL = (z, x, y) => `https://tiles.macrostrat.org/carto/${z}/${x}/${y}.mvt`;

/** Untergrenzen der Systeme in Mio. Jahren (ICS 2023), jung → alt. Farben angelehnt an die Internationale Stratigraphische Tabelle. */
export const ZEITALTER = [
  { wert: "quartaer", text: "Quartär (bis 2,6 Mio. J.)", bis: 2.58, farbe: "#fff3a8" },
  { wert: "tertiaer", text: "Tertiär (66–2,6 Mio. J.)", bis: 66, farbe: "#ffd23f" },
  { wert: "kreide", text: "Kreide (145–66 Mio. J.)", bis: 145, farbe: "#8fcf5a" },
  { wert: "jura", text: "Jura (201–145 Mio. J.)", bis: 201.4, farbe: "#42b6d0" },
  { wert: "trias", text: "Trias (252–201 Mio. J.)", bis: 251.9, farbe: "#a774b4" },
  { wert: "perm", text: "Perm (299–252 Mio. J.)", bis: 298.9, farbe: "#ef6a4c" },
  { wert: "karbon", text: "Karbon (359–299 Mio. J.)", bis: 358.9, farbe: "#6aa89c" },
  { wert: "devon", text: "Devon (419–359 Mio. J.)", bis: 419.2, farbe: "#c99a4e" },
  { wert: "altpalaeozoikum", text: "Silur bis Kambrium (539–419 Mio. J.)", bis: 538.8, farbe: "#7aa37a" },
  { wert: "praekambrium", text: "Präkambrium (älter als 539 Mio. J.)", bis: Infinity, farbe: "#c76a8a" },
];
export const MAGMATITE = [
  { wert: "plutonit", text: "Tiefengestein (z. B. Granit)", farbe: "#e33f8f" },
  { wert: "vulkanit", text: "Ergussgestein (z. B. Basalt)", farbe: "#6e2a63" },
];
export const GESTEINE = [
  { wert: "locker", text: "Lockergestein (Sand, Kies, Lehm, Moor)", farbe: "#fbefc0" },
  { wert: "sediment", text: "Sedimentgestein (Sand-, Kalk-, Tonstein)", farbe: "#9fc7e8" },
  { wert: "plutonit", text: "Tiefengestein (Granit, Diorit …)", farbe: "#e33f8f" },
  { wert: "vulkanit", text: "Ergussgestein (Basalt, Porphyr …)", farbe: "#6e2a63" },
  { wert: "metamorphit", text: "Umwandlungsgestein (Gneis, Schiefer …)", farbe: "#8c7a6b" },
];

/** Mittleres Alter einer Einheit (Mio. J.) — bei fehlenden Angaben die vorhandene. */
export function alterVon(p) {
  const oben = Number(p.best_age_top), unten = Number(p.best_age_bottom);
  if (Number.isFinite(oben) && Number.isFinite(unten)) return (oben + unten) / 2;
  return Number.isFinite(oben) ? oben : Number.isFinite(unten) ? unten : NaN;
}

const istPlutonit = (p) => p.lith_class1 === "igneous" && p.lith_type1 === "plutonic";
const istVulkanit = (p) => p.lith_class1 === "igneous" && p.lith_type1 !== "plutonic";

/** Erdzeitalter-Klasse einer Einheit; Magmatite gesondert. "" = nicht einzuordnen. */
export function zeitalterVon(p) {
  if (istPlutonit(p)) return "plutonit";
  if (istVulkanit(p)) return "vulkanit";
  const a = alterVon(p);
  if (!Number.isFinite(a)) return "";
  return ZEITALTER.find((z) => a < z.bis).wert;
}

/** Gesteinsart einer Einheit. Junge Sedimente (Quartär) gelten als Lockergestein. */
export function gesteinVon(p) {
  if (istPlutonit(p)) return "plutonit";
  if (istVulkanit(p)) return "vulkanit";
  if (p.lith_class1 === "metamorphic") return "metamorphit";
  if (p.lith_class1 === "sedimentary") return alterVon(p) < 2.58 ? "locker" : "sediment";
  return "";
}
