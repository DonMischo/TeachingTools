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
    slug: "baum", name: "🌳 Baumleben",
    eintraege: [
      { quelle: "Wikimedia Commons", urheber: "verschiedene (Nachweis an jedem Bild)", lizenz: "gemeinfrei, CC0, CC BY, CC BY-SA", url: "https://commons.wikimedia.org/", verwendung: "30 Baumfotos (Wikidata-Hauptbild je Art), verkleinert; Urheber und Lizenz in src/lib/baum/credits.ts und unter jedem Bild" },
    ],
    literatur: [
      "Runions, A., Lane, B. & Prusinkiewicz, P. (2007): Modeling trees with a space colonization algorithm. Eurographics Workshop on Natural Phenomena.",
      "Pałubicki, W. et al. (2009): Self-organizing tree models for image synthesis. ACM Transactions on Graphics 28(3).",
      "Weber, J. & Penn, J. (1995): Creation and rendering of realistic trees. SIGGRAPH 1995.",
      "Renton, M., Guédon, Y., Godin, C. & Costes, E. (2006): Similarities and gradients in growth unit branching patterns during ontogeny in Fuji apple trees: a stochastic approach. Journal of Experimental Botany 57.",
      "Shinozaki, K. et al. (1964): A quantitative analysis of plant form — the pipe model theory. Japanese Journal of Ecology 14.",
    ],
  },
  {
    slug: "vulkan", name: "🌋 Vulkane",
    eintraege: [
      { quelle: "VoxelSpace", urheber: "Sebastian Macke", lizenz: "MIT", url: "https://github.com/s-macke/VoxelSpace", verwendung: "Algorithmus für den 3D-Flug; neu geschrieben (geteilt mit der Erosion)" },
      { quelle: "Sandspiel", urheber: "Max Bittker", lizenz: "MIT", url: "https://github.com/MaxBittker/sandspiel", verwendung: "Vorbild für die Ausbruchswolke als fallender Sand (Teilchenregeln, Farbstreuung je Teilchen); neu in TypeScript geschrieben, kein Code übernommen" },
      { quelle: "Wikimedia Commons", urheber: "verschiedene (Nachweis an jedem Bild)", lizenz: "gemeinfrei, CC BY, CC BY-SA", url: "https://commons.wikimedia.org/", verwendung: "57 Fotos der Galerie »Echte Vulkane« und des Wissens, verkleinert; Urheber und Lizenz in src/lib/vulkan/bilder.json und unter jedem Bild" },
    ],
    literatur: [
      "Miyamoto, H. & Sasaki, S. (1997): Simulating lava flows by an improved cellular automata method. Computers & Geosciences 23, 283–292.",
      "Del Negro, C. et al. (2008): Lava flow simulations using discharge rates from thermal infrared satellite imagery during the 2006 Etna eruption (MAGFLOW). Natural Hazards 49, 43–58.",
    ],
  },
  {
    slug: "medien", name: "📜 Geschichte der Medien",
    eintraege: [
      { quelle: "Wikimedia Commons", urheber: "verschiedene (Nachweis an jedem Bild)", lizenz: "gemeinfrei, CC0, CC BY, CC BY-SA", url: "https://commons.wikimedia.org/", verwendung: "93 Fotos der Galerie, verkleinert; Urheber und Lizenz in src/lib/medien/bilder.json und unter jedem Bild" },
      { quelle: "Egyptian Hieroglyphs (Unicode-Block U+13000)", lizenz: "Unicode-Zeichen, Darstellung über die Systemschrift (Segoe UI Historic bzw. Noto Sans Egyptian Hieroglyphs)", verwendung: "Namen in Hieroglyphen (Einkonsonantenzeichen nach Gardiner, vereinfacht)" },
      { quelle: "»Alle meine Entchen«", lizenz: "Volkslied, gemeinfrei", verwendung: "Melodie im Plattenspieler-Demo" },
      { quelle: "»News Breaks And Shortly After So Do I The Pop Song« (Wikimedia Commons)", urheber: "Steve Combs", lizenz: "CC BY 4.0", url: "https://commons.wikimedia.org/wiki/File:Steve_Combs_-_02_-_News_Breaks_And_Shortly_After_So_Do_I_The_Pop_Song.ogg", verwendung: "Musik auf der Kassette (als MP3, Tempo schwankt absichtlich)" },
      { quelle: "»Marching Through Georgia« (1904, Wikimedia Commons)", urheber: "Byron G. Harlan und Frank C. Stanley", lizenz: "gemeinfrei", url: "https://commons.wikimedia.org/wiki/File:%22Marching_Through_Georgia%22_by_Henry_C._Work_%E2%80%93_sung_by_Harlan_%26_Stanley_(1904).ogg", verwendung: "Schellackplatte im Plattenspieler-Demo" },
    ],
    literatur: [
      "Hörisch, J. (2004): Eine Geschichte der Medien. Von der Oblate zum Internet. Frankfurt a. M.: Suhrkamp.",
      "Standage, T. (1998): The Victorian Internet. New York: Walker.",
      "RFC 1149 (1990): A Standard for the Transmission of IP Datagrams on Avian Carriers.",
    ],
  },
  {
    slug: "kikompass", name: "🧭 KI-Kompass",
    eintraege: [
      { quelle: "KI-Kompetenzen für Lehrende und Lernende – eine adaptierbare Basis (DOI 10.5281/zenodo.15047793)", urheber: "Susanne Alles, Joscha Falck, Manuel Flick, Regina Schulz (VK:KIWA)", lizenz: "CC BY 4.0", url: "https://essen.taskcards.app/#/board/ba6226b4-e617-4134-8d6d-dc733dae8d9c/view?token=b490fc09-f845-4d6d-9ef7-9cc0ec548182", verwendung: "Kompetenzraster (4 Bereiche × Niveau I–III); verändert: »Ich kann …«-Sätze, Niveau I geteilt, Stufe 0 ergänzt" },
      { quelle: "Der Weg zur KI-Kompetenz in der Grundschule", urheber: "Kristin van der Meer, Jennifer Knellsen", lizenz: "CC BY 4.0", url: "https://vom-labor-ins-klassenzimmer.de/der-weg-zur-ki-kompetenz-in-der-grundschule/", verwendung: "Idee der Vorstufe unter Niveau I (Stufe 0 »Einstieg«)" },
      { quelle: "Das AKTIV-Framework", urheber: "Manuel Flick", lizenz: "alle Rechte vorbehalten (nur Gliederung übernommen, eigene Texte, verlinkt)", url: "https://www.manuelflick.de/blog/aktiv-framework", verwendung: "Gliederung des Lehrkräfte-Wegs A-K-T-I-V-E-R" },
      { quelle: "KI-Kompetenzen im Unterricht: Impulse für die Praxis (TaskCards)", urheber: "A. Fischer, U. Friese, K. Minner, S. Ricker, C. Zirwes; VK:KIWA Thinktank (Leitung Dr. M. Veggian)", lizenz: "keine Angabe (nur Themen als Anregung, eigene Aufgaben)", url: "https://www.taskcards.de/#/board/333906e3-30a1-4ebd-91a2-3e1847848f72/view?token=ae585604-8910-47f2-8f70-9d6b3adf5230", verwendung: "Themen der Führerschein-Stationen und Projekte" },
      { quelle: "CheckNews", urheber: "fög (Universität Zürich) und IQES online", lizenz: "alle Rechte vorbehalten (nur verlinkt)", url: "https://www.iqesonline.net/bildung-digital/checknews/", verwendung: "Link aus den Faktencheck-Stationen" },
    ],
    literatur: [
      "Falck, J. (2023): Lernen mit, über, durch, trotz und ohne KI (fünf Dimensionen). joschafalck.de.",
      "KMK (2024): Handlungsempfehlung für die Bildungsverwaltung zum Umgang mit Künstlicher Intelligenz in schulischen Bildungsprozessen.",
    ],
  },
  {
    slug: "stromkreis", name: "💡 Stromkreise",
    eintraege: [
      { quelle: "Circuit Simulator (circuitjs1)", urheber: "Paul Falstad, Iain Sharp", lizenz: "GPL-2.0", url: "https://github.com/pfalstad/circuitjs1", verwendung: "Vorbild für Bedienung und Darstellung (Strompunkte, Potenzialfarben); Löser, Zeichnung und Bedienung neu in TypeScript geschrieben, kein Code übernommen" },
    ],
    literatur: [
      "Ho, C.-W., Ruehli, A. & Brennan, P. (1975): The modified nodal approach to network analysis. IEEE Transactions on Circuits and Systems 22, 504–509.",
      "Nagel, L. W. (1975): SPICE2: A Computer Program to Simulate Semiconductor Circuits. UC Berkeley, ERL-M520 (Spannungsbegrenzung pnjlim).",
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
