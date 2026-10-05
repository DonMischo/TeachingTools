/**
 * USA-Wirtschaft — schematisch wie im Schulatlas (vorherrschende Nutzung je
 * Bundesstaat, klassische Wirtschaftsräume, bekannte Industriestandorte).
 * Eigene Einordnung; die Grenzen kommen von Natural Earth (fetch-karten.mjs, Schritt »usa«).
 */

/** Vorherrschende Landwirtschaft und Viehhaltung je Bundesstaat (Postkürzel). */
export const LANDWIRTSCHAFT = {
  mais: ["IA", "IL", "IN", "OH", "NE", "MO"],
  weizen: ["KS", "ND", "SD", "MT", "OK"],
  milch: ["WI", "MN", "MI", "NY", "VT", "PA", "CT", "MA", "RI"],
  rinder: ["TX", "WY", "CO", "NM", "NV", "UT", "ID", "AZ"],
  baumwolle: ["MS", "AL", "GA", "AR", "LA", "SC"],
  sonderkultur: ["CA", "FL", "WA", "NJ", "HI"],
  misch: ["KY", "TN", "NC", "VA", "WV", "MD", "DE"],
  wald: ["OR", "ME", "NH", "AK"],
};

export const LANDWIRTSCHAFT_LEGENDE = [
  { wert: "mais", text: "Corn Belt: Mais, Soja, Schweinemast", farbe: "#e6c229" },
  { wert: "weizen", text: "Weizen (Great Plains)", farbe: "#f1e2a4" },
  { wert: "milch", text: "Milchvieh, Futterbau (Dairy Belt)", farbe: "#9ecae1" },
  { wert: "rinder", text: "Rinder-Weidewirtschaft (Ranching)", farbe: "#d9a066" },
  { wert: "baumwolle", text: "Baumwolle, Geflügel, Erdnüsse", farbe: "#f4a6a6" },
  { wert: "sonderkultur", text: "Obst, Gemüse, Wein (oft bewässert)", farbe: "#74c476" },
  { wert: "misch", text: "Mischbetriebe, Tabak", farbe: "#c7b9e2" },
  { wert: "wald", text: "Wald- und Holzwirtschaft", farbe: "#2e7d32" },
];

/** Klassische Wirtschaftsräume. */
export const RAEUME = {
  manufacturing: ["IL", "IN", "OH", "MI", "PA", "NY", "NJ", "WI", "MA", "CT", "RI"],
  sunbelt: ["CA", "AZ", "NM", "TX", "LA", "MS", "AL", "GA", "FL", "SC", "NC", "TN", "AR", "NV"],
};
export const RAEUME_LEGENDE = [
  { wert: "manufacturing", text: "Manufacturing Belt (heute »Rust Belt«): alte Schwerindustrie", farbe: "#8c6d62" },
  { wert: "sunbelt", text: "Sun Belt: Wachstum, High-Tech, Erdöl, Dienstleistungen", farbe: "#f6b26b" },
  { wert: "sonstige", text: "übrige Bundesstaaten", farbe: "#eeeeee" },
];

/** Bekannte Industriestandorte: [Länge, Breite]. */
export const INDUSTRIE = [
  ["Detroit", -83.05, 42.33, "auto"], ["Nashville", -86.78, 36.16, "auto"],
  ["Pittsburgh", -80.0, 40.44, "stahl"], ["Cleveland", -81.69, 41.5, "stahl"], ["Birmingham (Alabama)", -86.8, 33.52, "stahl"],
  ["Chicago", -87.63, 41.88, "maschinen"], ["Minneapolis", -93.27, 44.98, "maschinen"],
  ["Houston", -95.37, 29.76, "petrochemie"], ["New Orleans", -90.07, 29.95, "petrochemie"],
  ["San José (Silicon Valley)", -121.89, 37.34, "hightech"], ["Austin", -97.74, 30.27, "hightech"], ["Boston", -71.06, 42.36, "hightech"],
  ["Raleigh-Durham (Research Triangle)", -78.64, 35.78, "hightech"], ["Phoenix", -112.07, 33.45, "hightech"], ["Dallas", -96.8, 32.78, "hightech"],
  ["Seattle", -122.33, 47.61, "luftfahrt"], ["Wichita", -97.34, 37.69, "luftfahrt"], ["Huntsville", -86.59, 34.73, "luftfahrt"],
  ["Los Angeles", -118.24, 34.05, "luftfahrt"],
  ["New York", -74.0, 40.71, "dienstleistung"], ["Charlotte", -80.84, 35.23, "dienstleistung"], ["Atlanta", -84.39, 33.75, "dienstleistung"],
];
export const INDUSTRIE_LEGENDE = [
  { wert: "auto", text: "Autoindustrie", farbe: "#d62728" },
  { wert: "stahl", text: "Eisen und Stahl (teils stillgelegt)", farbe: "#555555" },
  { wert: "maschinen", text: "Maschinenbau, Lebensmittel", farbe: "#8c564b" },
  { wert: "petrochemie", text: "Erdöl und Petrochemie", farbe: "#000000" },
  { wert: "hightech", text: "High-Tech, Elektronik, Forschung", farbe: "#1f77b4" },
  { wert: "luftfahrt", text: "Luft- und Raumfahrt", farbe: "#9467bd" },
  { wert: "dienstleistung", text: "Finanzen und Dienstleistungen", farbe: "#2ca02c" },
];
