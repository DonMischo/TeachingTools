/**
 * Quellen und Lizenzen je Werkzeug — für die Admin-Seite /admin/quellen.
 *
 * Hier steht, was nicht schon maschinenlesbar anderswo liegt. Automatisch
 * dazu kommen: Kartenebenen (Katalog der Karten-API), Bildnachweise von
 * Sonnensystem und Küste (bilder.json), der Tux (tux.lizenz.json), die Studien
 * des Leviathan (quellen.ts) und die npm-Pakete (pakete.json).
 *
 * `pruefen: true` = Lizenz/Nutzungsrecht nicht geklärt — die Seite hebt das hervor.
 */
export type QuellenEintrag = {
  quelle: string;
  urheber?: string;
  lizenz: string;
  url?: string;
  verwendung: string;
  pruefen?: boolean;
};

export type WerkzeugQuellen = { slug: string; name: string; eintraege: QuellenEintrag[]; literatur?: string[] };

export const REGISTER: WerkzeugQuellen[] = [
  {
    slug: "karten", name: "🗺️ Karten",
    eintraege: [
      { quelle: "Noto Sans (Regular, Bold, Italic) als MapLibre-Glyphen", urheber: "Google / Noto-Projekt; Glyphen über demotiles.maplibre.org",
        lizenz: "SIL Open Font License 1.1", url: "https://openfontlicense.org", verwendung: "Beschriftungen der Karte (public/karten/schriften)" },
      { quelle: "MapLibre GL JS (Worker-Kopie)", urheber: "MapLibre-Beiträger", lizenz: "BSD-3-Clause",
        url: "https://github.com/maplibre/maplibre-gl-js", verwendung: "public/karten/maplibre — Lizenzkopf in der Datei" },
      { quelle: "PROJ (über pyproj)", urheber: "Gerald I. Evenden (frühe Arbeiten), Frank Warmerdam, Even Rouault und PROJ-Beiträger",
        lizenz: "MIT-artige Lizenz (PROJ), MIT (pyproj)", url: "https://github.com/OSGeo/PROJ",
        verwendung: "Kartennetze Robinson und Winkel-Tripel auf dem Server (api/karten_projektion.py)" },
      { quelle: "Openclipart (Tier- und Pflanzenbilder)", urheber: "Openclipart-Künstler·innen, je Bild in public/karten/kinderatlas/lizenzen.json",
        lizenz: "CC0 1.0 (gemeinfrei)", url: "https://openclipart.org",
        verwendung: "Kinderatlas »Robinson Crusoe«, Bildstil »Illustriert« (scripts/fetch-kinderatlas.mjs)" },
      { quelle: "proj4js", urheber: "proj4js-Beiträger (Portierung von PROJ)", lizenz: "MIT", url: "https://github.com/proj4js/proj4js",
        verwendung: "Robinson im Browser und in den Rasterkacheln (src/lib/karten/projektion.ts)" },
      { quelle: "Equal Earth", urheber: "Bojan Šavrič, Tom Patterson, Bernhard Jenny (2018)", lizenz: "Formel frei verwendbar",
        url: "https://doi.org/10.1080/13658816.2018.1504949", verwendung: "Standard-Kartennetz (Formel nachgerechnet)" },
      { quelle: "Atkinson Hyperlegible (Regular, Bold, Italic, Bold Italic)", urheber: "Braille Institute of America",
        lizenz: "SIL Open Font License 1.1", url: "https://github.com/google/fonts/tree/main/ofl/atkinsonhyperlegible",
        verwendung: "Schrift der PDF-Arbeitsblätter (api/fonts, im API-Image installiert; OFL.txt liegt dabei)" },
    ],
  },
  {
    slug: "verkehr", name: "🚦 GTA – Verkehr",
    eintraege: [
      { quelle: "OpenStreetMap", urheber: "© OpenStreetMap-Mitwirkende", lizenz: "ODbL 1.0", url: "https://www.openstreetmap.org/copyright",
        verwendung: "Straßen, Wege, Gebäude, Haltestellen, Linienwege (src/lib/verkehr/karte.json)" },
      { quelle: "EVAG-Haltestellenfahrplan Linie 9 (ab 17.08.2026)", urheber: "Erfurter Verkehrsbetriebe AG", lizenz: "Open Data (Fahrplandaten)",
        url: "https://www.evag-erfurt.de", verwendung: "Abfahrtszeiten (src/lib/verkehr/linie9.json) und Takte" },
      { quelle: "Luftbild zur Kontrolle der Schulumgebung (Esri)", lizenz: "nur angesehen, nicht übernommen", verwendung: "Abgleich beim Erstellen der Karte" },
    ],
  },
  {
    slug: "pse", name: "🧪 Periodensystem",
    eintraege: [
      { quelle: "Periodic Table of Elements (PubChem)", urheber: "National Center for Biotechnology Information (NCBI), NLM",
        lizenz: "gemeinfrei (Werk der US-Regierung)", url: "https://pubchem.ncbi.nlm.nih.gov/periodic-table/",
        verwendung: "Kenndaten aller 118 Elemente (src/lib/pse/daten.json, geholt mit scripts/fetch-pse.mjs)" },
    ],
  },
  {
    slug: "atommodelle", name: "⚛️ Atommodelle",
    eintraege: [
      { quelle: "Periodic Table of Elements (PubChem)", urheber: "National Center for Biotechnology Information (NCBI), NLM",
        lizenz: "gemeinfrei (Werk der US-Regierung)", url: "https://pubchem.ncbi.nlm.nih.gov/periodic-table/",
        verwendung: "Elektronenkonfiguration und Atommassen (src/lib/pse/daten.json) — daraus Schalen, Orbitale und Neutronenzahl" },
    ],
  },
  {
    slug: "strukturformeln", name: "⬡ Strukturformeln",
    eintraege: [
      { quelle: "Strukturformelzeichner (strukturformelzeichner.de)", lizenz: "nur als Vorbild angesehen, kein Code übernommen",
        url: "https://www.strukturformelzeichner.de", verwendung: "Vorbild für Bedienung und Darstellung; Parser, Layout und Zeichnung sind eigener Code" },
    ],
  },
  {
    slug: "snap", name: "🧱 Snap!",
    eintraege: [
      { quelle: "Snap! Build Your Own Blocks", urheber: "Jens Mönig, Bernat Romagosa u. a. (UC Berkeley, SAP)", lizenz: "AGPL-3.0",
        url: "https://snap.berkeley.edu", verwendung: "Eingebettet aus public/snap (Kopie per npm run fetch:snap; LICENSE liegt bei)" },
    ],
  },
  {
    slug: "leben", name: "🎸 Rock your Life",
    eintraege: [
      { quelle: "Echtpreise (src/lib/leben/laden.ts, ECHTPREISE)", urheber: "eigene Erhebung (Kassenbons, Prospekte)", lizenz: "Fakten, eigene Daten",
        verwendung: "Preise im Supermarkt; die Quelle steht je Eintrag dabei" },
    ],
  },
  {
    slug: "erdaufbau", name: "🌍 Aufbau der Erde",
    eintraege: [],
    literatur: ["Dziewonski, A. M. & Anderson, D. L. (1981): Preliminary Reference Earth Model. Phys. Earth Planet. Inter. 25, 297–356 — Zahlenwerte (Fakten) für Dichte, Druck, Wellengeschwindigkeiten."],
  },
  {
    slug: "schichten", name: "📶 Schichtenmodell",
    eintraege: [
      { quelle: "Reel »Your photo takes one second to reach Tokyo«", urheber: "rick.theengineer", lizenz: "Idee/Anregung, nichts übernommen", url: "https://www.instagram.com/rick.theengineer/", verwendung: "Idee und Geschichte (Lenas Katzenfoto nach Tokio, sieben Schichten, Hop für Hop); Umsetzung, Texte und Grafik eigen" },
      { quelle: "Natural Earth ne_10m_land", lizenz: "Gemeinfrei (Public Domain)", url: "https://www.naturalearthdata.com/", verwendung: "Küstenlinien der Karte »Weg« (vereinfacht per scripts/schichten-land.mjs)" },
    ],
    literatur: [
      "ISO/IEC 7498-1:1994 — OSI-Referenzmodell.",
      "RFC 791 (IPv4), RFC 9293 (TCP), RFC 8446 (TLS 1.3), RFC 8439 (ChaCha20-Poly1305), RFC 1035 (DNS), RFC 1071 (Internet-Prüfsumme), RFC 5737 (Dokumentationsadressen); IEEE 802.3 (Ethernet).",
    ],
  },
  {
    slug: "stadt", name: "🏘️ Stadtentwicklung",
    eintraege: [
      { quelle: "MapGenerator", urheber: "Keir (ProbableTrain)", lizenz: "LGPL-3.0", url: "https://github.com/ProbableTrain/MapGenerator", verwendung: "Idee: Straßen als Feldlinien eines Tensorfelds (Raster + Radial gemischt), Häuser entlang der Straßen; neu in TypeScript geschrieben, kein Code übernommen" },
      { quelle: "VoxelSpace", urheber: "Sebastian Macke", lizenz: "MIT", url: "https://github.com/s-macke/VoxelSpace", verwendung: "Algorithmus für den 3D-Flug (Spalten von vorn nach hinten, Y-Puffer); neu geschrieben, die Comanche-Karten des Repos werden nicht benutzt" },
      { quelle: "terrain-erosion-3-ways", urheber: "Daniel Andrino", lizenz: "MIT", url: "https://github.com/dandrino/terrain-erosion-3-ways", verwendung: "Erosions-Simulation (Konstanten und Ablauf je Schritt) für den Knopf »Erosion«; neu geschrieben" },
    ],
    literatur: [
      "Chen, G., Esch, G., Wonka, P., Müller, P. & Zhang, E. (2008): Interactive Procedural Street Modeling. ACM Transactions on Graphics 27(3).",
      "Burgess, E. W. (1925): The Growth of the City. In: Park, R. E. & Burgess, E. W.: The City. University of Chicago Press.",
      "Heineberg, H. (2017): Stadtgeographie. 5. Aufl., Schöningh (UTB).",
    ],
  },
  {
    slug: "diagramme", name: "🔀 Diagramm-Werkstatt",
    eintraege: [
      { quelle: "D2 (d2lang)", urheber: "Terrastruct, Inc.", lizenz: "MPL-2.0", url: "https://github.com/d2lang/d2", verwendung: "Diagrammsprache, Layout und SVG-Ausgabe; unverändert als npm-Paket @d2lang/d2 (WASM) eingebunden" },
    ],
  },
  {
    slug: "erosion", name: "🌧️ Erosion",
    eintraege: [
      { quelle: "terrain-erosion-3-ways", urheber: "Daniel Andrino", lizenz: "MIT", url: "https://github.com/dandrino/terrain-erosion-3-ways", verwendung: "Vorbild der gitterbasierten Wassererosion mit Rutschungen (Ablauf und Konstanten); neu in TypeScript geschrieben" },
      { quelle: "VoxelSpace", urheber: "Sebastian Macke", lizenz: "MIT", url: "https://github.com/s-macke/VoxelSpace", verwendung: "Algorithmus für den 3D-Flug; neu geschrieben" },
    ],
  },
  {
    slug: "vulkan", name: "🌋 Vulkane",
    eintraege: [
      { quelle: "VoxelSpace", urheber: "Sebastian Macke", lizenz: "MIT", url: "https://github.com/s-macke/VoxelSpace", verwendung: "Algorithmus für den 3D-Flug; neu geschrieben (geteilt mit der Erosion)" },
      { quelle: "Sandspiel", urheber: "Max Bittker", lizenz: "MIT", url: "https://github.com/MaxBittker/sandspiel", verwendung: "Vorbild für die Ausbruchswolke als fallender Sand (Teilchenregeln, Farbstreuung je Teilchen); neu in TypeScript geschrieben, kein Code übernommen" },
      { quelle: "Wikimedia Commons", urheber: "verschiedene (Nachweis an jedem Bild)", lizenz: "gemeinfrei, CC BY, CC BY-SA", url: "https://commons.wikimedia.org/", verwendung: "40 Fotos der Galerie »Echte Vulkane«, verkleinert; Urheber und Lizenz in src/lib/vulkan/bilder.json und unter jedem Bild" },
    ],
    literatur: [
      "Miyamoto, H. & Sasaki, S. (1997): Simulating lava flows by an improved cellular automata method. Computers & Geosciences 23, 283–292.",
      "Del Negro, C. et al. (2008): Lava flow simulations using discharge rates from thermal infrared satellite imagery during the 2006 Etna eruption (MAGFLOW). Natural Hazards 49, 43–58.",
    ],
  },
  {
    slug: "dla", name: "🪸 Fraktales Wachstum",
    eintraege: [
      { quelle: "dlaf (Diffusion-limited aggregation)", urheber: "Michael Fogleman", lizenz: "MIT", url: "https://github.com/fogleman/dlaf", verwendung: "Vorbild für Parameter (Abstand, Anziehung, Mindestschritt, Haftung) und den Sprung im leeren Raum; neu in TypeScript geschrieben, kein Code übernommen" },
    ],
    literatur: ["Witten, T. A. & Sander, L. M. (1981): Diffusion-Limited Aggregation, a Kinetic Critical Phenomenon. Phys. Rev. Lett. 47, 1400–1403."],
  },
  {
    slug: "wilson", name: "🌋 Wilson-Zyklus",
    eintraege: [],
    literatur: [
      "Wilson, J. T. (1966): Did the Atlantic close and then re-open? Nature 211, 676–681.",
      "Vine, F. J. & Matthews, D. H. (1963): Magnetic anomalies over oceanic ridges. Nature 199, 947–949.",
      "Parsons, B. & Sclater, J. G. (1977): JGR 82, 803–827.",
      "Frisch, W., Meschede, M. & Blakey, R.: Plattentektonik (Primus, 2009).",
      "Nance, R. D. et al. (2014): Gondwana Research 25, 4–29.",
    ],
  },
  {
    slug: "challenge", name: "🐉 Bosskampf und TaskCrawler-Monster",
    eintraege: [
      { quelle: "Ultimate Monsters", urheber: "Quaternius", lizenz: "CC0 1.0", url: "https://quaternius.com/packs/ultimatemonsters.html",
        verwendung: "21 animierte Monster: Bosse der 3D-Arena, ein Gegner je Element, Verlies-Monster (public/modelle/monster)" },
      { quelle: "Universal Animation Library", urheber: "Quaternius", lizenz: "CC0 1.0", url: "https://quaternius.com/packs/universalanimationlibrary.html",
        verwendung: "Bewegungen der 14 Menschen-Avatare (Idle, Gehen, Joggen, Schwert, Zauber, Schlag, Treffer, Tanz, Tod), auf die Chibi-Skelette übertragen (scripts/avatare/retarget.py)" },
      { quelle: "Draco-Decoder (three.js)", urheber: "Google / three.js-Autoren", lizenz: "Apache-2.0", url: "https://github.com/google/draco",
        verwendung: "Entpacken der komprimierten Monster-Modelle (public/draco)" },
    ],
  },
];

/** Lizenzen, die eine Namensnennung verlangen — Hinweis auf der Seite. */
export const NENNUNG_PFLICHT = /CC BY|dl-de\/by|ODbL|ODC-BY|Attribution|Namensnennung/i;
