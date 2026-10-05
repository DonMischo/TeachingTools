/**
 * Meeresströmungen und Windsysteme — eigene, schematische Darstellung (wie in
 * Schulatlanten): Linien in Fließrichtung, Punkte als [Länge, Breite].
 * Wird von fetch-karten.mjs (Schritt »zirkulation«) zu Ebenen verarbeitet.
 *
 * Linien über die Datumsgrenze sind in zwei Teile geteilt (MultiLineString),
 * weil die Karte keine Weltkopien zeichnet.
 */

// ── Meeresströmungen ─────────────────────────────────────────────────

export const STROEMUNGEN = [
  // Atlantik
  { id: "golfstrom", name: "Golfstrom", art: "warm", info: "bringt warmes Wasser aus dem Golf von Mexiko nach Nordosten",
    linie: [[-85, 24.6], [-82.5, 23.9], [-80.6, 24.1], [-79.7, 25.3], [-79.6, 27.5], [-79.6, 30.5], [-77.4, 33], [-74.6, 35.4], [-70, 37.5],
      [-63, 39.5], [-55, 41], [-48, 42.5]] },
  { id: "nordatlantikstrom", name: "Nordatlantikstrom", art: "warm", info: "Fortsetzung des Golfstroms — »Warmwasserheizung« Europas",
    linie: [[-45, 44], [-38, 47], [-30, 50], [-22, 53], [-15, 56], [-10, 59], [-5, 61.5]] },
  { id: "norwegischer-strom", name: "Norwegischer Strom", art: "warm", info: "hält die Häfen Norwegens bis zum Nordkap eisfrei",
    linie: [[-3, 62.5], [3, 64], [9, 66.5], [13, 69], [17, 71], [25, 72], [35, 72.5]] },
  { id: "kanarenstrom", name: "Kanarenstrom", art: "kalt", info: "kühlt die Küste Nordwestafrikas — Küstenwüste, Nebel",
    linie: [[-14, 42], [-15, 38], [-15.5, 33], [-17, 28], [-18.5, 23], [-20, 18], [-23, 14]] },
  { id: "nordaequatorialstrom-atlantik", name: "Nordäquatorialstrom (Atlantik)", art: "warm", info: "vom Nordostpassat nach Westen getrieben",
    linie: [[-24, 14.5], [-32, 15], [-40, 15.5], [-48, 16], [-56, 16.5], [-62, 17]] },
  { id: "suedaequatorialstrom-atlantik", name: "Südäquatorialstrom (Atlantik)", art: "warm", info: "vom Südostpassat nach Westen getrieben",
    linie: [[8, -1], [0, -2], [-10, -3], [-20, -4], [-28, -5], [-33, -6]] },
  { id: "aequatorialer-gegenstrom-atlantik", name: "Äquatorialer Gegenstrom (Atlantik)", art: "warm", info: "fließt zwischen den Passaten zurück nach Osten",
    linie: [[-45, 6], [-35, 6.5], [-25, 7], [-15, 6], [-9, 4], [-3, 4.2], [3, 3.6]] },
  { id: "brasilstrom", name: "Brasilstrom", art: "warm", info: "warm entlang der Küste Brasiliens nach Süden",
    linie: [[-34.5, -9], [-35.5, -13], [-38, -18], [-40, -23], [-45, -27], [-50, -32], [-53, -37]] },
  { id: "benguelastrom", name: "Benguelastrom", art: "kalt", info: "kaltes Auftriebswasser — Namib-Küstenwüste, reiche Fischgründe",
    linie: [[16, -35], [15, -31], [13.5, -27], [12, -22], [10.5, -17], [8.5, -12], [6, -6]] },
  { id: "falklandstrom", name: "Falklandstrom", art: "kalt", info: "kaltes Wasser aus der Antarktis nach Norden",
    linie: [[-63, -55], [-61, -51], [-59, -47], [-57, -43], [-55, -39]] },
  { id: "labradorstrom", name: "Labradorstrom", art: "kalt", info: "bringt Eisberge bis vor Neufundland",
    linie: [[-60, 66], [-58, 61], [-55, 56], [-52, 51], [-50, 47], [-50, 44]] },
  { id: "ostgroenlandstrom", name: "Ostgrönlandstrom", art: "kalt", info: "Polarwasser und Treibeis entlang Grönlands",
    linie: [[-10, 79], [-15, 75], [-20, 71], [-27, 67], [-33, 64], [-40, 61]] },
  // Pazifik
  { id: "kuroshio", name: "Kuroshio", art: "warm", info: "»Schwarzer Strom« — der Golfstrom des Pazifiks vor Japan",
    linie: [[122, 22], [123, 25], [127, 28], [131, 31], [136, 33.5], [141, 35], [146, 36]] },
  { id: "nordpazifikstrom", name: "Nordpazifikstrom", art: "warm", info: "vom Westwind quer über den Pazifik getrieben",
    linie: [[[150, 38], [160, 40], [170, 41], [180, 42]], [[-180, 42], [-165, 43], [-150, 44], [-138, 45]]] },
  { id: "alaskastrom", name: "Alaskastrom", art: "warm", info: "hält den Golf von Alaska eisfrei",
    linie: [[-135, 50], [-138, 54], [-143, 57.5], [-148, 58.8], [-152, 57.2], [-155, 56], [-160, 54.2], [-165, 53]] },
  { id: "oyashio", name: "Oyashio", art: "kalt", info: "kaltes Wasser aus dem Beringmeer, trifft vor Japan auf den Kuroshio",
    linie: [[165, 58], [162, 54], [157, 50], [152, 46], [147, 42.5], [143, 40]] },
  { id: "kalifornienstrom", name: "Kalifornienstrom", art: "kalt", info: "kühlt Kalifornien — Nebel über San Francisco",
    linie: [[-128, 48], [-126, 43], [-124, 38], [-121, 33], [-117, 28], [-114, 23]] },
  { id: "nordaequatorialstrom-pazifik", name: "Nordäquatorialstrom (Pazifik)", art: "warm", info: "vom Nordostpassat nach Westen getrieben",
    linie: [[[-110, 14], [-125, 13], [-140, 13], [-155, 13], [-170, 13], [-180, 13.5]], [[180, 13.5], [165, 14], [150, 14.5], [135, 15], [125, 17]]] },
  { id: "suedaequatorialstrom-pazifik", name: "Südäquatorialstrom (Pazifik)", art: "warm", info: "vom Südostpassat nach Westen getrieben",
    linie: [[[-82, -3], [-95, -4], [-110, -5], [-125, -6], [-140, -7], [-155, -8], [-170, -9], [-180, -10]], [[180, -10], [170, -11], [160, -12], [152, -14]]] },
  { id: "aequatorialer-gegenstrom-pazifik", name: "Äquatorialer Gegenstrom (Pazifik)", art: "warm", info: "fließt zwischen den Passaten zurück nach Osten",
    linie: [[[130, 6], [145, 6.2], [160, 6.2], [175, 7], [180, 7]], [[-180, 7], [-160, 7], [-140, 7], [-120, 7], [-95, 6.5]]] },
  { id: "humboldtstrom", name: "Humboldtstrom", art: "kalt", info: "kaltes Auftriebswasser vor Chile und Peru — Atacama, Fischreichtum; bei El Niño schwach",
    linie: [[-76, -45], [-75, -40], [-74, -35], [-72.5, -30], [-72, -25], [-73, -20], [-76, -15], [-80, -10], [-82, -5]] },
  { id: "ostaustralstrom", name: "Ostaustralstrom", art: "warm", info: "warm an der Ostküste Australiens nach Süden",
    linie: [[154, -15], [154.5, -20], [154, -25], [153.5, -30], [152, -34], [151, -38]] },
  // Indischer Ozean
  { id: "agulhasstrom", name: "Agulhasstrom", art: "warm", info: "warm zwischen Madagaskar und Afrika nach Süden",
    linie: [[42.5, -12.5], [41.5, -16], [39, -20.5], [36.5, -25], [33.5, -29.5], [29.5, -33.5], [24, -36]] },
  { id: "westaustralstrom", name: "Westaustralstrom", art: "kalt", info: "kühlt die Westküste Australiens",
    linie: [[113, -34], [112, -30], [111, -26], [110, -22], [106, -17]] },
  { id: "suedaequatorialstrom-indik", name: "Südäquatorialstrom (Indischer Ozean)", art: "warm", info: "vom Südostpassat nach Westen getrieben",
    linie: [[105, -12], [95, -12], [85, -12], [75, -12], [65, -12.5], [57, -13.5], [51.5, -14.5]] },
  { id: "somalistrom", name: "Somalistrom", art: "warm", monate: [5, 6, 7, 8, 9], info: "Mai–September: vom Südwestmonsun nach Norden getrieben",
    linie: [[43, -2.5], [45.5, 0.5], [49, 4], [51.5, 8], [53.5, 11.5]] },
  { id: "somalistrom-winter", name: "Somalistrom", art: "warm", monate: [11, 12, 1, 2, 3], info: "November–März: mit dem Nordostmonsun nach Süden",
    linie: [[53.5, 11.5], [51.5, 8], [49, 4], [45.5, 0.5], [43, -2.5]] },
  // Südpolarmeer
  { id: "zirkumpolarstrom", name: "Antarktischer Zirkumpolarstrom (Westwinddrift)", art: "kalt",
    info: "größte Meeresströmung der Erde — vom Westwind ohne Unterbrechung um die Antarktis getrieben",
    linie: [[-180, -57], [-150, -58], [-120, -59], [-90, -59], [-70, -58.5], [-60, -58], [-40, -52], [-20, -50], [0, -50], [20, -48],
      [40, -48], [60, -48], [80, -48], [100, -49], [120, -50], [140, -52], [160, -54], [180, -57]] },
];

// ── Windsysteme ──────────────────────────────────────────────────────
// Gürtel im Jahresmittel; sie wandern mit dem Sonnenstand: im Juli nach Norden,
// im Januar nach Süden. Je Monat ein eigener Satz Objekte (Eigenschaft »monate«).

export const MONATE = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
/** 0 im Januar, 1 im Juli (Kosinus über das Jahr) */
const sommer = (m) => (1 - Math.cos((2 * Math.PI * (m - 1)) / 12)) / 2;
/** Verschiebung der Gürtel in Grad Breite: −4 im Januar … +4 im Juli */
const versatz = (m) => -4 + 8 * sommer(m);
/** »monate« als Text mit Kommas (",7," steckt in ",6,7,8,"), »alle« = ganzjährig */
export const monatsListe = (ms) => `,${ms.join(",")},`;

/** Richtung als [dx, dy] (Länge, Breite), wohin der Wind weht. */
export const GUERTEL = [
  { id: "nordostpassat", name: "Nordostpassat", art: "passat", von: 8, bis: 26, richtung: [-1, -0.45],
    info: "weht aus Nordost zur ITC — beständig, trocken über den Wüsten" },
  { id: "suedostpassat", name: "Südostpassat", art: "passat", von: -26, bis: -6, richtung: [-1, 0.45],
    info: "weht aus Südost zur ITC" },
  { id: "westwinde-nord", name: "Westwinde (Nordhalbkugel)", art: "westwind", von: 38, bis: 58, richtung: [1, 0.35],
    info: "wechselhaft mit Tiefs — unser Wetter in Mitteleuropa" },
  { id: "westwinde-sued", name: "Westwinde (Südhalbkugel)", art: "westwind", von: -58, bis: -38, richtung: [1, -0.35],
    info: "»Brüllende Vierziger«, kaum von Land gebremst" },
  { id: "polare-ostwinde-nord", name: "Polare Ostwinde (Nordhalbkugel)", art: "polarost", von: 66, bis: 78, richtung: [-1, -0.3],
    info: "kalte Luft aus dem Polarhoch" },
  { id: "polare-ostwinde-sued", name: "Polare Ostwinde (Südhalbkugel)", art: "polarost", von: -72, bis: -64, richtung: [-1, 0.3],
    info: "kalte Fallwinde vom antarktischen Eis" },
];

/** Monsun Südasiens: Südwestmonsun Juni–September, Nordostmonsun November–März; dort ersetzt er den Passat. */
export const MONSUN = [
  { id: "suedwestmonsun", name: "Südwestmonsun", art: "monsun", monate: [6, 7, 8, 9], richtung: [1, 0.7],
    info: "feuchte Meeresluft weht zum Hitzetief über Asien — Regenzeit in Indien",
    punkte: [[55, 6], [62, 10], [68, 14], [60, 16], [72, 8], [82, 8], [87, 14], [90, 18], [78, 3], [92, 8], [105, 12], [112, 15]] },
  { id: "nordostmonsun", name: "Nordostmonsun", art: "monsun", monate: [11, 12, 1, 2, 3], richtung: [-1, -0.6],
    info: "trockene Luft aus dem Kältehoch über Asien weht aufs Meer",
    punkte: [[70, 15], [64, 12], [87, 16], [84, 10], [92, 12], [110, 16], [116, 20], [105, 8], [76, 8], [60, 8]] },
];
const MONSUN_GEBIET = (lon, lat) => lon >= 45 && lon <= 120 && lat >= -2 && lat <= 30;

/** ITC im Januar und im Juli (Breite je Länge); dazwischen wird übergeblendet. */
export const ITC = {
  juli: [[-180, 8], [-150, 9], [-120, 10], [-100, 12], [-85, 10], [-60, 8], [-40, 8], [-20, 10], [0, 17], [20, 18], [40, 16],
    [60, 15], [75, 25], [90, 25], [105, 20], [120, 15], [140, 10], [160, 8], [180, 8]],
  januar: [[-180, 3], [-150, 4], [-120, 5], [-90, 3], [-70, -8], [-55, -12], [-40, -2], [-20, 2], [0, 5], [15, -5], [30, -12],
    [45, -15], [60, -10], [80, -5], [100, -8], [120, -12], [135, -15], [150, -10], [165, -3], [180, 3]],
};
/** Breite einer Linie [[lon, lat] …] an der Länge `lon` (linear zwischen den Stützstellen). */
function breiteBei(linie, lon) {
  for (let i = 1; i < linie.length; i++) {
    const [x0, y0] = linie[i - 1], [x1, y1] = linie[i];
    if (lon <= x1) return y0 + ((y1 - y0) * (lon - x0)) / (x1 - x0);
  }
  return linie.at(-1)[1];
}
const DRUCK = [
  { id: "hochdruck-nord", name: "Subtropischer Hochdruckgürtel (Rossbreiten, Nord)", art: "hoch", breite: 30,
    info: "absinkende, trockene Luft — Wüstengürtel; von hier wehen Passat und Westwind weg" },
  { id: "hochdruck-sued", name: "Subtropischer Hochdruckgürtel (Rossbreiten, Süd)", art: "hoch", breite: -30,
    info: "absinkende, trockene Luft — Wüstengürtel" },
  { id: "tiefdruck-nord", name: "Subpolare Tiefdruckrinne (Nord)", art: "tief", breite: 61,
    info: "hier treffen Westwinde und polare Ostwinde zusammen — Tiefdruckgebiete entstehen" },
  { id: "tiefdruck-sued", name: "Subpolare Tiefdruckrinne (Süd)", art: "tief", breite: -62,
    info: "rund um die Antarktis, sehr stürmisch" },
];

const MONATSNAME = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Ein Pfeil: kurze Linie um `p` herum in `richtung`, ~`laenge` Grad lang. */
function pfeil([lon, lat], [dx, dy], laenge = 7) {
  const n = Math.hypot(dx, dy), hx = ((dx / n) * laenge) / 2, hy = ((dy / n) * laenge) / 2;
  return [[lon - hx, lat - hy], [lon + hx, lat + hy]];
}

/**
 * Wind-Ebene: je Gürtel und Monat ein Objekt aus vielen Pfeilen (über dem Meer),
 * dazu Monsun, ITC und Druckgürtel. `istLand(lon, lat)` blendet Pfeile über Land aus.
 */
export function windObjekte(istLand) {
  const features = [];
  const f = (geometry, properties) => ({ type: "Feature", geometry, properties });
  for (const m of MONATE) {
    const v = versatz(m);
    const monsun = MONSUN.find((x) => x.monate.includes(m));
    for (const g of GUERTEL) {
      const linien = [];
      let reihe = 0;
      for (let lat = g.von + v + 3; lat <= g.bis + v - 3; lat += 7, reihe++) {
        for (let lon = -175 + (reihe % 2) * 10; lon < 180; lon += 20) {
          if (istLand(lon, lat)) continue;
          // Wo der Monsun weht, kein Passat (Südwestmonsun: beide, Nordostmonsun: der Nordostpassat)
          if (g.art === "passat" && monsun && MONSUN_GEBIET(lon, lat) && (monsun.id === "suedwestmonsun" || g.id === "nordostpassat")) continue;
          const l = pfeil([lon, lat], g.richtung);
          if (l.some(([x]) => x < -180 || x > 180)) continue;
          linien.push(l);
        }
      }
      if (linien.length) features.push(f({ type: "MultiLineString", coordinates: linien },
        { id: `${g.id}-m${m}`, name: g.name, art: g.art, monate: monatsListe([m]), info: g.info }));
    }
    if (monsun) features.push(f({ type: "MultiLineString", coordinates: monsun.punkte.map((p) => pfeil(p, monsun.richtung, 6)) },
      { id: `${monsun.id}-m${m}`, name: monsun.name, art: monsun.art, monate: monatsListe([m]), info: monsun.info }));
    const w = sommer(m);
    const itc = [];
    for (let lon = -180; lon <= 180; lon += 10) {
      itc.push([lon, Math.round((breiteBei(ITC.januar, lon) * (1 - w) + breiteBei(ITC.juli, lon) * w) * 10) / 10]);
    }
    features.push(f({ type: "LineString", coordinates: itc }, {
      id: `itc-m${m}`, name: "Innertropische Konvergenzzone (ITC)", art: "itc", monate: monatsListe([m]),
      info: `${MONATSNAME[m - 1]}: ${w > 0.5 ? "im Norden — Regenzeit in der Sahelzone und in Südasien" : w < 0.5 ? "im Süden — Regenzeit im südlichen Afrika und in Nordaustralien" : "auf dem Weg über den Äquator"}`,
    }));
    for (const d of DRUCK) {
      const breite = Math.round((d.breite + v * (Math.abs(d.breite) > 45 ? 0.5 : 1)) * 10) / 10;
      const linie = [];
      for (let lon = -180; lon <= 180; lon += 10) linie.push([lon, breite]);
      features.push(f({ type: "LineString", coordinates: linie }, { id: `${d.id}-m${m}`, name: d.name, art: d.art, monate: monatsListe([m]), info: d.info }));
    }
  }
  return features;
}

/** Strömungen als Features (ein- oder mehrteilige Linien). */
export function stroemungsObjekte() {
  return STROEMUNGEN.map((s) => ({
    type: "Feature",
    geometry: Array.isArray(s.linie[0][0]) ? { type: "MultiLineString", coordinates: s.linie } : { type: "LineString", coordinates: s.linie },
    properties: { id: s.id, name: s.name, art: s.art, monate: s.monate ? monatsListe(s.monate) : "alle",
      info: `${s.art === "warm" ? "warme" : "kalte"} Meeresströmung — ${s.info}` },
  }));
}
