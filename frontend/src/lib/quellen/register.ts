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
];

/** Lizenzen, die eine Namensnennung verlangen — Hinweis auf der Seite. */
export const NENNUNG_PFLICHT = /CC BY|dl-de\/by|ODbL|ODC-BY|Attribution|Namensnennung/i;
