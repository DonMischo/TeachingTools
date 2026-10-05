/**
 * Formen des Meeresbodens — eigene, schematische Darstellung (wie in
 * Schulatlanten): Tiefseegräben mit größter Tiefe, mittelozeanische Rücken.
 * Punkte als [Länge, Breite]; über die Datumsgrenze zweiteilig.
 * Wird von fetch-karten.mjs (Schritt »meeresboden«) zur Ebene verarbeitet.
 */

export const GRAEBEN = [
  { id: "marianengraben", name: "Marianengraben", tiefe: 11034, info: "tiefste Stelle der Erde (Challengertief)",
    linie: [[142.5, 11], [143.5, 11.4], [145, 12.5], [146.5, 14], [147.5, 16], [147.8, 19], [146.5, 22], [143, 24.5], [142.5, 27]] },
  { id: "tongagraben", name: "Tongagraben", tiefe: 10882, info: "zweittiefster Graben (Horizon-Tief)",
    linie: [[-176, -15.5], [-173.2, -17], [-173, -19], [-173.6, -21], [-174.6, -23.3], [-175.6, -25.5]] },
  { id: "kermadecgraben", name: "Kermadecgraben", tiefe: 10047, info: "südliche Fortsetzung des Tongagrabens",
    linie: [[-175.8, -26], [-176.4, -29], [-177, -32], [-178, -35]] },
  { id: "philippinengraben", name: "Philippinengraben", tiefe: 10540, info: "östlich der Philippinen (Galathea-Tief)",
    linie: [[127, 6], [127.3, 8.5], [127.2, 10.5], [126.3, 13]] },
  { id: "kurilengraben", name: "Kurilen-Kamtschatka-Graben", tiefe: 9600, info: "Pazifische Platte taucht unter die Ochotskische Platte",
    linie: [[163, 55], [161, 51.5], [157, 48.5], [153.5, 45.5], [150, 43], [146.5, 41.5]] },
  { id: "japangraben", name: "Japangraben", tiefe: 8412, info: "Ursprung des Tōhoku-Bebens 2011",
    linie: [[145.5, 41], [144.3, 38.5], [143.5, 36], [142, 34]] },
  { id: "aleutengraben", name: "Aleutengraben", tiefe: 7679, info: "Bogen der Aleuten-Inseln",
    linie: [[[-150, 57], [-160, 54.5], [-170, 51.5], [-180, 50.8]], [[180, 50.8], [172, 50.5]]] },
  { id: "atacamagraben", name: "Atacamagraben (Peru-Chile-Graben)", tiefe: 8065, info: "Nazca-Platte taucht unter Südamerika — Anden",
    linie: [[-81.5, -6], [-79.5, -10], [-77, -14], [-73, -18.5], [-71.5, -23], [-71.8, -28], [-73, -33], [-74.5, -37]] },
  { id: "mittelamerikagraben", name: "Mittelamerikagraben", tiefe: 6669, info: "Cocos-Platte taucht unter Mittelamerika",
    linie: [[-105, 19], [-100, 16], [-95, 14.5], [-91, 12.5], [-87, 11]] },
  { id: "puertoricograben", name: "Puerto-Rico-Graben", tiefe: 8376, info: "tiefste Stelle des Atlantiks (Milwaukee-Tief)",
    linie: [[-70, 20], [-67, 19.8], [-64, 19.6], [-61, 18.7]] },
  { id: "suedsandwichgraben", name: "Südsandwichgraben", tiefe: 8265, info: "im Südatlantik vor der Antarktis",
    linie: [[-27, -55], [-25.5, -57], [-25.2, -59], [-26.5, -61]] },
  { id: "sundagraben", name: "Sundagraben (Javagraben)", tiefe: 7192, info: "tiefste Stelle des Indischen Ozeans — Sumatra-Beben 2004",
    linie: [[94, 4], [96, 0], [99, -4], [103, -7.5], [108, -10], [113, -10.8], [118, -11]] },
  { id: "hellenischer-graben", name: "Hellenischer Graben", tiefe: 5267, info: "tiefste Stelle des Mittelmeers, südlich von Griechenland",
    linie: [[20, 37.5], [22, 36], [25, 35], [28, 35.5]] },
];

export const RUECKEN = [
  { id: "mittelatlantischer-ruecken", name: "Mittelatlantischer Rücken", info: "Europa/Afrika und Amerika driften auseinander (ca. 2–5 cm im Jahr); taucht in Island auf",
    linie: [[-8, 71], [-17, 66.5], [-24, 62], [-30, 57], [-35, 52], [-30, 45], [-36, 40], [-43, 30], [-45, 20], [-46, 15], [-40, 10], [-30, 3],
      [-17, 0], [-13, -5], [-13, -15], [-14, -25], [-12, -35], [-16, -45], [-12, -52], [-2, -55]] },
  { id: "ostpazifischer-ruecken", name: "Ostpazifischer Rücken", info: "schnellster Rücken der Erde (bis 15 cm im Jahr)",
    linie: [[-108, 23], [-104, 15], [-102, 5], [-104, -5], [-110, -15], [-112, -25], [-115, -35], [-112, -45], [-115, -55], [-125, -62]] },
  { id: "zentralindischer-ruecken", name: "Zentralindischer Rücken", info: "trennt die Indische von der Afrikanischen Platte",
    linie: [[57, 15], [60, 10], [66, 4], [70, -5], [68, -15], [67, -25]] },
  { id: "suedwestindischer-ruecken", name: "Südwestindischer Rücken", info: "langsamer Rücken zwischen Afrika und Antarktis",
    linie: [[67, -25], [57, -32], [45, -38], [32, -43], [15, -52]] },
  { id: "suedostindischer-ruecken", name: "Südostindischer Rücken", info: "trennt Australien von der Antarktis",
    linie: [[70, -27], [80, -35], [95, -42], [110, -48], [130, -50], [145, -56]] },
];

export function formenObjekte() {
  const geo = (l) => (Array.isArray(l[0][0]) ? { type: "MultiLineString", coordinates: l } : { type: "LineString", coordinates: l });
  return [
    ...GRAEBEN.map((g) => ({ type: "Feature", geometry: geo(g.linie),
      properties: { id: g.id, name: g.name, art: "graben", tiefe: g.tiefe,
        info: `Tiefseegraben, bis ${g.tiefe.toLocaleString("de-DE")} m tief — ${g.info}` } })),
    ...RUECKEN.map((r) => ({ type: "Feature", geometry: geo(r.linie),
      properties: { id: r.id, name: r.name, art: "ruecken", info: `mittelozeanischer Rücken — ${r.info}` } })),
  ];
}
