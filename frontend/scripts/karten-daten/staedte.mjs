/**
 * Stadtmodelle Berlin, Paris, New York: Zonen kuratiert aus den amtlichen Bezirken
 * (Zentrum/City, Innenstadt, Stadtrand/Vororte). Wird von fetch-karten.mjs
 * (Schritt »stadtmodelle«) auf die Bezirksflächen gelegt.
 */

export const ZONEN_LEGENDE = [
  { wert: "zentrum", text: "Zentrum / City (Geschäfte, Büros, Regierung)", farbe: "#b2182b" },
  { wert: "innenstadt", text: "Innenstadt (dicht bebaut, Altbau, gemischt)", farbe: "#f4a582" },
  { wert: "buerostadt", text: "Bürostadt am Rand (La Défense)", farbe: "#762a83" },
  { wert: "rand", text: "Stadtrand / Vororte (lockerer, mehr Wohnen)", farbe: "#d1e5f0" },
  { wert: "gruen", text: "Parks, Friedhöfe, Flughäfen", farbe: "#a6dba0" },
];

/** Berlin: City Ost (Mitte) und West (Tiergarten); Innenstadt ≈ innerhalb des S-Bahn-Rings. */
export const BERLIN = {
  zentrum: ["Mitte", "Tiergarten"],
  innenstadt: ["Moabit", "Hansaviertel", "Wedding", "Gesundbrunnen", "Prenzlauer Berg", "Friedrichshain", "Kreuzberg",
    "Schöneberg", "Neukölln", "Charlottenburg", "Wilmersdorf"],
};

/** Paris: Zentrum = 1.–4. (Paris Centre) und 8./9. Arrondissement (Geschäftsviertel); Rest der Stadt = Innenstadt. */
export const PARIS = {
  zentrum: ["1", "2", "3", "4", "8", "9"],
  buerostadt: ["Puteaux", "Courbevoie"],
};

/** New York: Zentrum = Manhattan südlich der 59. Straße (Midtown, Downtown); Innenstadt = übriges Manhattan
 *  und die angrenzenden Viertel in Brooklyn und Queens (bis ~6 km von Midtown). */
export const NEW_YORK = { mitte: [-73.985, 40.755], cbdNordgrenze: 40.768, innenstadtKm: 6 };
