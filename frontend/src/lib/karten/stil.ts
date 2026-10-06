/**
 * Kartentool: baut aus dem Ebenen-Katalog und der Auswahl der Lehrkraft einen
 * MapLibre-Stil. Alles kommt vom eigenen Server — Ebenen über /api/karten,
 * Höhenkacheln und Schriften aus /public/karten (keine fremden Anfragen).
 *
 * Nur eingeschaltete Ebenen bekommen eine Quelle; MapLibre lädt sonst jedes
 * GeoJSON, auch unsichtbare. Beim Umschalten reicht `map.setStyle(neu)`,
 * MapLibre rechnet den Unterschied selbst aus.
 *
 * Deutschland- und Weltebenen teilen sich die Darstellung über ihre ROLLE
 * (Flüsse, Seen, Städte …). Stil-Ebenen heißen »<ebene>:<teil>«, so findet
 * ein Klick zurück zur Daten-Ebene.
 */
import type {
  ExpressionSpecification,
  FilterSpecification,
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from "maplibre-gl";
import { spreizen } from "./nummern";
import { erdUmriss, vor, type Projektion } from "./projektion";

export type Geometrie = "flaeche" | "linie" | "punkt" | "raster" | "gemischt";
export type Bereich = "de" | "welt";
/** Hochgeladene Ebenen gehören zu keiner Region */
export type EbenenBereich = Bereich | "eigen";

export type Ebene = {
  id: string;
  name: string;
  gruppe: Gruppe;
  bereich: EbenenBereich;
  geometrie: Geometrie;
  quiz: boolean;
  anzahl?: number;
  bytes: number;
  quelle: { name: string; lizenz: string; url: string };
  /** Deutschland-Höhen: vier Bilder mit Eckkoordinaten */
  kacheln?: { datei: string; ecken: [number, number][] }[];
  /** Welt-Relief: XYZ-Kacheln */
  kachelUrl?: string;
  maxzoom?: number;
  stufen?: { ab: number; farbe: string }[];
  darstellung?: Darstellung;
  /** Filter nach einem Feld (Siedlungen: Größenklasse); `vorhanden` = Werte in dieser Datei */
  filter?: { feld: string; werte: { wert: string; text: string; standard: boolean }[]; vorhanden: string[] };
  /** Je Monat andere Objekte (Wind, Strömungen): Eigenschaft »monate« = ",6,7," oder »alle« */
  monate?: boolean;
  /** Nur bei hochgeladenen Ebenen (api/routers/karten.py::_eigen_eintrag) */
  eigen?: { id: number; eigen: boolean; geteilt: boolean; namensfeld: string; felder: string[]; dateiname: string };
};

export type Katalog = { stand: string; ebenen: Ebene[] };

export type Gruppe = "politisch" | "topographisch" | "wirtschaft" | "bevoelkerung" | "stadt" | "eigen";
export const GRUPPEN: { id: Gruppe; name: string }[] = [
  { id: "politisch", name: "Politisch" },
  { id: "topographisch", name: "Topographisch" },
  { id: "wirtschaft", name: "Wirtschaft" },
  { id: "bevoelkerung", name: "Bevölkerung" },
  { id: "stadt", name: "Stadt" },
];

/**
 * Themenkarte: Farbe nach einem Feld — Kategorien (Energieträger, Nutzung)
 * oder Stufen (Dichte, BIP; `wert` = Untergrenze, aufsteigend).
 */
export type Darstellung = {
  feld: string;
  art: "kategorie" | "stufen";
  werte: { wert: string | number; text: string; farbe: string }[];
  /** Punkte: Kreisgröße nach einem Zahlenfeld (Fläche ∝ Wert) */
  groesse?: { feld: string; max: number };
  /** Einheit für die Legende, z. B. »Einw./km²« */
  einheit?: string;
  /** Färbt die Landfläche darunter (Bodennutzung: Ackerland ist der Normalfall, keine eigenen Flächen) */
  grundfarbe?: string;
};

export type Kartenart = "politisch" | "topographisch" | "stumm";

export type Auswahl = {
  ebenen: string[];
  /** Namen auf der Karte zeigen (aus für stumme Karten und Arbeitsblätter) */
  beschriftung: boolean;
  /** Je Ebene die gezeigten Filterwerte (fehlt = Voreinstellung `standard`) */
  filter?: Record<string, string[]>;
  /** Kartennetz (fehlt = Equal Earth) */
  projektion?: Projektion;
  /** Partikelfluss läuft: Strömungslinien treten zurück (blass, ohne Lauflicht) */
  partikel?: boolean;
};

/** Welche Filterwerte einer Ebene gerade gezeigt werden. */
export function erlaubteWerte(e: Ebene, filter: Record<string, string[]> | undefined): string[] {
  if (!e.filter) return [];
  const { vorhanden } = e.filter;
  const standard = e.filter.werte.filter((w) => w.standard && vorhanden.includes(w.wert)).map((w) => w.wert);
  // Ohne Vorgabe: die Standardklassen — hat die Datei keine (kleine Orte), dann alle ihre Klassen
  const gewaehlt = filter?.[e.id] ?? (standard.length ? standard : vorhanden);
  return gewaehlt.filter((w) => vorhanden.includes(w));
}

// ── Regionen ─────────────────────────────────────────────────────────

/** `extra`: Ebenen, die mit der Region angehen (Stadtmodelle) */
export type Region = { id: string; name: string; bereich: Bereich; ausschnitt: [number, number, number, number]; extra?: string[] };

/** Ausschnitt als [West, Süd, Ost, Nord]. Der Bereich entscheidet, welche Ebenen passen. */
export const REGIONEN: Region[] = [
  { id: "deutschland", name: "Deutschland", bereich: "de", ausschnitt: [5.6, 47.2, 15.3, 55.1] },
  { id: "thueringen", name: "Thüringen", bereich: "de", ausschnitt: [9.8, 50.15, 12.7, 51.7] },
  { id: "europa", name: "Europa", bereich: "welt", ausschnitt: [-25, 34, 45, 71] },
  { id: "welt", name: "Welt", bereich: "welt", ausschnitt: [-170, -58, 178, 78] },
  { id: "afrika", name: "Afrika", bereich: "welt", ausschnitt: [-20, -36, 55, 38] },
  { id: "asien", name: "Asien", bereich: "welt", ausschnitt: [25, -11, 150, 78] },
  { id: "nordamerika", name: "Nordamerika", bereich: "welt", ausschnitt: [-170, 7, -50, 75] },
  { id: "suedamerika", name: "Südamerika", bereich: "welt", ausschnitt: [-85, -56, -33, 13] },
  { id: "ozeanien", name: "Australien und Ozeanien", bereich: "welt", ausschnitt: [110, -48, 180, 2] },
  { id: "berlin", name: "Stadtmodell Berlin", bereich: "welt", ausschnitt: [13.08, 52.33, 13.77, 52.68], extra: ["berlin-zonen", "berlin-bezirke"] },
  { id: "paris", name: "Stadtmodell Paris", bereich: "welt", ausschnitt: [2.12, 48.71, 2.62, 49.02], extra: ["paris-zonen"] },
  { id: "newyork", name: "Stadtmodell New York", bereich: "welt", ausschnitt: [-74.26, 40.49, -73.69, 40.92], extra: ["newyork-zonen", "newyork-boroughs"] },
];
export const region = (id: string | null | undefined) => REGIONEN.find((r) => r.id === id) ?? REGIONEN[0];

export const KARTENARTEN: { id: Kartenart; icon: string; name: string; ebenen: Record<Bereich, string[]> }[] = [
  {
    id: "politisch", icon: "🏛️", name: "Politisch",
    ebenen: {
      de: ["welt-staaten", "de-laender", "de-gewaesser", "de-seen", "de-fluesse", "welt-staedte", "de-staedte"],
      welt: ["welt-staaten", "welt-gewaesser", "welt-seen", "welt-fluesse", "welt-meere", "welt-staedte"],
    },
  },
  {
    id: "topographisch", icon: "⛰️", name: "Topographisch",
    ebenen: {
      de: ["welt-staaten", "welt-hoehen", "de-hoehen", "de-laender", "de-gewaesser", "de-seen", "de-fluesse", "de-fluesse-klein",
        "de-gebirge", "de-landschaften", "de-gipfel", "welt-staedte", "de-staedte"],
      welt: ["welt-hoehen", "welt-staaten", "welt-gewaesser", "welt-seen", "welt-fluesse", "welt-meere", "welt-gebirge",
        "welt-landschaften", "welt-gipfel", "welt-staedte"],
    },
  },
  {
    id: "stumm", icon: "🔢", name: "Stumme Karte",
    ebenen: {
      // Ohne Namen bleiben von den Städten nur die Punkte
      de: ["welt-staaten", "de-laender", "de-gewaesser", "de-seen", "de-fluesse", "welt-staedte", "de-staedte"],
      welt: ["welt-staaten", "welt-gewaesser", "welt-seen", "welt-fluesse", "welt-staedte"],
    },
  },
];

export function auswahlFuer(art: Kartenart, bereich: Bereich = "de"): Auswahl {
  const vorlage = KARTENARTEN.find((k) => k.id === art)!;
  return { ebenen: [...vorlage.ebenen[bereich]], beschriftung: art !== "stumm" };
}

// ── Farben ───────────────────────────────────────────────────────────

export const FARBE = {
  meer: "#bcd9ee",
  wasser: "#9cc6e6",
  fluss: "#3a7fc1",
  ausland: "#efece6",
  auslandRand: "#a8a29a",
  grenze: "#8c4a6b",
  schrift: "#262626",
  wasserSchrift: "#1f5f99",
  gebirgeSchrift: "#6b3f1d",
  hervor: "#e11d48",
  /** Equal Earth: um das Erd-Oval herum */
  weltraum: "#f3f1ec",
  eigen: "#7c3aed",
};

/** Sechs Pastelltöne, so verteilt, dass Nachbarländer verschieden sind. */
const LAND_FARBE: Record<string, string> = {
  SH: "#cfe6b8", HH: "#f4c2c2", HB: "#f4c2c2", NI: "#f1e3a0", MV: "#dccbe8", NW: "#cfe6b8",
  HE: "#f4c2c2", RP: "#f1e3a0", SL: "#c9d7f0", BW: "#cfe6b8", BY: "#c9d7f0", TH: "#f6d7a7",
  ST: "#cfe6b8", SN: "#f1e3a0", BB: "#f6d7a7", BE: "#f4c2c2",
};
const landFarbe = ["match", ["get", "kurz"], ...Object.entries(LAND_FARBE).flat(), "#eeeeee"] as unknown as ExpressionSpecification;

/** Natural Earth MAPCOLOR7: 1–7, Nachbarn haben verschiedene Werte. */
const STAAT_FARBE = ["#f6d7a7", "#cfe6b8", "#f4c2c2", "#c9d7f0", "#f1e3a0", "#dccbe8", "#c8e6e0"];
const staatFarbe = ["match", ["get", "farbe"], ...STAAT_FARBE.flatMap((f, i) => [i + 1, f]), "#eeeeee"] as unknown as ExpressionSpecification;

const KONTINENT_FARBE: Record<string, string> = {
  europa: "#c9d7f0", asien: "#f6d7a7", afrika: "#f1e3a0", nordamerika: "#cfe6b8", suedamerika: "#f4c2c2",
  ozeanien: "#dccbe8", antarktis: "#f2f2f2",
};
const kontinentFarbe = ["match", ["get", "id"], ...Object.entries(KONTINENT_FARBE).flat(), "#eeeeee"] as unknown as ExpressionSpecification;

/** Farbe einer Themenebene: Kategorie per match, Stufen per step. */
export function themaFarbe(d: Darstellung): ExpressionSpecification {
  if (d.art === "stufen") {
    const [erste, ...rest] = d.werte;
    return ["step", ["to-number", ["get", d.feld], 0], erste.farbe, ...rest.flatMap((w) => [w.wert, w.farbe])] as unknown as ExpressionSpecification;
  }
  return ["match", ["to-string", ["get", d.feld]], ...d.werte.flatMap((w) => [String(w.wert), w.farbe]), "#bbbbbb"] as unknown as ExpressionSpecification;
}

// ── Stil ─────────────────────────────────────────────────────────────

const SCHRIFT = { normal: ["Noto Sans Regular"], fett: ["Noto Sans Bold"], kursiv: ["Noto Sans Italic"] };

/** Wo die Ebene geladen wird. Für Quizze tauscht der Aufrufer die Adresse (Gäste, ohne Namen). */
export type Quelle = (ebene: Ebene) => string;
// Eigene Ebenen: das Namensfeld in der Adresse, damit MapLibre nach dem Umstellen neu lädt
export const quelleAusApi: Quelle = (e) =>
  `/api/karten/ebenen/${e.id}${e.eigen ? `?namen=${encodeURIComponent(e.eigen.namensfeld)}` : ""}`;

type Rolle = "staaten" | "kontinente" | "laender" | "hoehen" | "wasserflaeche" | "meere" | "seen" | "fluesse"
  | "gebirge" | "landschaften" | "gipfel" | "staedte" | "eigen" | "thema" | "zirkulation";

/** Monat für Wind und Strömungen, solange niemand den Regler bewegt hat (Juli, wie im Atlas) */
export const MONAT_STANDARD = "7";
export const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
/** Gewählter Monat (»1« … »12«) einer monatsabhängigen Ebene */
export const monatVon = (filter: Record<string, string[]> | undefined, ebene: string) => filter?.[ebene]?.[0] ?? MONAT_STANDARD;
/** Druckgürtel und ITC sind Grenzen, keine Strömung: ohne Pfeile und Lauflicht */
const GURT = ["itc", "hoch", "tief"];

const ROLLE: Record<string, Rolle> = {
  "welt-staaten": "staaten", "welt-kontinente": "kontinente", "de-laender": "laender",
  // Stadtbezirke: Umriss und Name wie Bundesländer
  "berlin-bezirke": "laender", "newyork-boroughs": "laender",
  "welt-hoehen": "hoehen", "de-hoehen": "hoehen",
  "de-gewaesser": "wasserflaeche", "welt-gewaesser": "wasserflaeche", "welt-meere": "meere",
  "de-seen": "seen", "welt-seen": "seen",
  "de-fluesse": "fluesse", "de-fluesse-klein": "fluesse", "welt-fluesse": "fluesse",
  "de-gebirge": "gebirge", "welt-gebirge": "gebirge",
  "de-landschaften": "landschaften", "welt-landschaften": "landschaften",
  "de-gipfel": "gipfel", "welt-gipfel": "gipfel",
  "de-staedte": "staedte", "de-orte": "staedte", "welt-staedte": "staedte",
};

/** Städte nach Rang: die kleinen erst ab einer Zoomstufe. */
const STADT_STUFEN: Record<string, { raenge: string[]; minzoom: number }[]> = {
  "de-staedte": [{ raenge: ["hauptstadt", "landeshauptstadt", "grossstadt"], minzoom: 0 }, { raenge: ["mittelstadt"], minzoom: 6 },
    { raenge: ["kleinstadt"], minzoom: 7.5 }],
  "de-orte": [{ raenge: ["landgemeinde"], minzoom: 8.5 }, { raenge: ["ortsteil"], minzoom: 9.5 }],
  "welt-staedte": [{ raenge: ["hauptstadt", "weltstadt"], minzoom: 0 }, { raenge: ["millionenstadt"], minzoom: 3 }, { raenge: ["grossstadt"], minzoom: 4.5 }],
};

/** Teil-Namen, deren Objekte ein Klick findet (auch unsichtbare Flächen, z. B. Gebirge über dem Relief). */
const KLICK_TEILE = new Set(["flaeche", "linie", "linie-klein", "gurt", "symbol", "symbol-1", "symbol-2", "symbol-3", "punkt"]);
/** Stil-Ebenen mit Lauflicht (KartenAnsicht schiebt das Strichmuster weiter) */
export const istLauflicht = (id: string) => id.endsWith(":fluss");
export const ebeneVonStilEbene = (id: string) => id.split(":")[0];
export const istKlickbar = (id: string) => KLICK_TEILE.has(id.split(":")[1] ?? "");

/** Rasterkacheln gibt es je Kartennetz: Equal Earth liegt unter »<ebene>-ee« */
const kachelnFuer = (url: string, id: string, p: Projektion) => (p === "equalearth" ? url.replace(`/karten/${id}/`, `/karten/${id}-ee/`) : url);

export function baueStil(katalog: Katalog, auswahl: Auswahl, art: Kartenart, quelleRoh: Quelle = quelleAusApi): StyleSpecification {
  const projektion = auswahl.projektion ?? "equalearth";
  // Vektordaten rechnet der Server um (api/karten_projektion.py)
  const quelle: Quelle = (e) => {
    const url = quelleRoh(e);
    return projektion === "equalearth" ? `${url}${url.includes("?") ? "&" : "?"}projektion=equalearth` : url;
  };
  const rolle = (e: Ebene): Rolle | undefined =>
    ROLLE[e.id] ?? (e.monate ? "zirkulation" : e.darstellung ? "thema" : e.bereich === "eigen" ? "eigen" : undefined);
  const an = katalog.ebenen.filter((e) => auswahl.ebenen.includes(e.id) && rolle(e));
  const mit = (r: Rolle) => an.filter((e) => rolle(e) === r);
  const sources: Record<string, SourceSpecification> = {};
  const layers: LayerSpecification[] = [{ id: "meer", type: "background", paint: { "background-color": projektion === "equalearth" ? FARBE.weltraum : FARBE.meer } }];
  if (projektion === "equalearth") {
    // Equal Earth ist ein Oval: Meer nur innerhalb des Erdumrisses
    sources["erde"] = { type: "geojson", data: { type: "FeatureCollection", features: [erdUmriss()] } };
    layers.push({ id: "erde", type: "fill", source: "erde", paint: { "fill-color": FARBE.meer } },
      { id: "erde-rand", type: "line", source: "erde", paint: { "line-color": "#8aa9c2", "line-width": 1 } });
  }
  const text = auswahl.beschriftung;
  const hatRelief = mit("hoehen").length > 0;
  const hatLaender = mit("laender").length > 0;
  for (const e of an) if (e.geometrie !== "raster") sources[e.id] = { type: "geojson", data: quelle(e), promoteId: "id" };
  // Flächennamen aus einem Punkt je Objekt — sonst beschriftet MapLibre jedes Teilstück
  // (Inseln, Kachelgrenzen) und Kanada oder Europa stehen mehrfach auf der Weltkarte
  const namen = (e: Ebene) => {
    if (e.geometrie !== "flaeche") return e.id;
    const id = `${e.id}:namen`;
    const url = quelle(e);
    sources[id] ??= { type: "geojson", data: `${url}${url.includes("?") ? "&" : "?"}punkte=1`, promoteId: "id" };
    return id;
  };
  const schrift = (farbe: string, halo = "#ffffffcc") => ({ "text-color": farbe, "text-halo-color": halo, "text-halo-width": 1.2 });

  // Welt-Relief ganz unten
  for (const e of mit("hoehen")) if (e.kachelUrl) {
    sources[e.id] = { type: "raster", tiles: [kachelnFuer(e.kachelUrl, e.id, projektion)], tileSize: 256, maxzoom: e.maxzoom ?? 5 };
    layers.push({ id: `${e.id}:raster`, type: "raster", source: e.id, paint: { "raster-fade-duration": 0 } });
  }

  for (const e of mit("staaten")) {
    layers.push({ id: `${e.id}:flaeche`, type: "fill", source: e.id, paint: {
      // Politische Weltkarte: bunt; um Deutschland: neutral; über Relief: durchsichtig
      "fill-color": art === "politisch" && !hatLaender ? staatFarbe : FARBE.ausland,
      "fill-opacity": hatRelief ? 0 : 1,
    } });
  }
  for (const e of mit("kontinente")) {
    layers.push({ id: `${e.id}:flaeche`, type: "fill", source: e.id, paint: { "fill-color": kontinentFarbe, "fill-opacity": hatRelief ? 0.35 : 0.8 } });
  }

  // Deutschland-Höhen (vier Bilder) über dem Weltrelief
  for (const e of mit("hoehen")) e.kacheln?.forEach((k, i) => {
    // Ecken umrechnen: bei Equal Earth leicht verzerrt, für Deutschland unsichtbar
    sources[`${e.id}-${i}`] = { type: "image", url: `/karten/hoehen/${k.datei}`, coordinates: k.ecken.map((q) => vor(q, projektion)) as never };
    layers.push({ id: `${e.id}-${i}:bild`, type: "raster", source: `${e.id}-${i}`, paint: { "raster-fade-duration": 0 } });
  });

  const grundfarbe = mit("thema").find((e) => e.darstellung?.grundfarbe)?.darstellung?.grundfarbe;
  for (const e of mit("laender")) {
    layers.push({ id: `${e.id}:flaeche`, type: "fill", source: e.id, paint: {
      "fill-color": grundfarbe ?? (art === "politisch" ? landFarbe : "#f7f4ee"), "fill-opacity": hatRelief && !grundfarbe ? 0 : 1 } });
  }

  for (const e of mit("thema")) if (e.geometrie === "raster" && e.kachelUrl) {
    // Raster-Themenkarte (Klimazonen): fertig eingefärbte Kacheln, Legende aus der Darstellung
    sources[e.id] = { type: "raster", tiles: [kachelnFuer(e.kachelUrl, e.id, projektion)], tileSize: 256, maxzoom: e.maxzoom ?? 5 };
    // Meeresboden deckt nur das Meer (Land ist durchsichtig) — dort voll; Klimazonen leicht durchscheinend
    layers.push({ id: `${e.id}:raster`, type: "raster", source: e.id,
      paint: { "raster-opacity": e.id === "welt-meeresboden" ? 1 : 0.85, "raster-fade-duration": 0 } });
  } else if (e.geometrie === "flaeche") {
    layers.push(
      { id: `${e.id}:flaeche`, type: "fill", source: e.id, paint: { "fill-color": themaFarbe(e.darstellung!), "fill-opacity": 0.8 } },
      { id: `${e.id}:rand`, type: "line", source: e.id, paint: { "line-color": "#ffffff", "line-width": 0.4, "line-opacity": 0.6 } },
    );
  }

  for (const e of [...mit("wasserflaeche"), ...mit("seen")]) {
    layers.push({ id: `${e.id}:flaeche`, type: "fill", source: e.id, paint: { "fill-color": FARBE.wasser } });
  }
  // Meere: nur zum Anklicken und Beschriften (das Meer ist der Hintergrund)
  for (const e of mit("meere")) layers.push({ id: `${e.id}:flaeche`, type: "fill", source: e.id, paint: { "fill-opacity": 0 } });

  const breite = (dick: number): ExpressionSpecification =>
    ["interpolate", ["linear"], ["zoom"], 2, ["match", ["get", "klasse"], 1, 0.9 * dick, 2, 0.5 * dick, 0.4 * dick],
      5, ["match", ["get", "klasse"], 1, 1.4 * dick, 2, 0.8 * dick, 0.5 * dick],
      10, ["match", ["get", "klasse"], 1, 3.5 * dick, 2, 2.2 * dick, 1.2 * dick]];
  const linie = { "line-join": "round", "line-cap": "round" } as const;
  for (const e of mit("fluesse")) {
    // Kleine Flüsse erst beim Heranzoomen: Deutschland-Bäche ab 7, Welt-Nebenflüsse ab 3,5
    const klein = e.id === "de-fluesse-klein";
    if (klein) {
      layers.push({ id: `${e.id}:linie`, type: "line", source: e.id, minzoom: 7, layout: linie, paint: { "line-color": FARBE.fluss, "line-width": breite(1) } });
    } else {
      layers.push(
        { id: `${e.id}:linie`, type: "line", source: e.id, filter: ["<=", ["get", "klasse"], 2], layout: linie,
          paint: { "line-color": FARBE.fluss, "line-width": breite(1) } },
        { id: `${e.id}:linie-klein`, type: "line", source: e.id, filter: [">", ["get", "klasse"], 2], minzoom: e.bereich === "welt" ? 3.5 : 0,
          layout: linie, paint: { "line-color": FARBE.fluss, "line-width": breite(1) } },
      );
    }
  }

  for (const e of mit("gebirge")) {
    layers.push(
      { id: `${e.id}:flaeche`, type: "fill", source: e.id, paint: { "fill-opacity": 0 } },
      { id: `${e.id}:rand`, type: "line", source: e.id,
        paint: { "line-color": FARBE.gebirgeSchrift, "line-opacity": hatRelief ? 0.35 : 0.7, "line-width": 1, "line-dasharray": [2, 2] } },
    );
  }
  for (const e of mit("landschaften")) layers.push({ id: `${e.id}:flaeche`, type: "fill", source: e.id, paint: { "fill-opacity": 0 } });

  for (const e of mit("staaten")) {
    layers.push({ id: `${e.id}:rand`, type: "line", source: e.id,
      paint: { "line-color": hatLaender ? FARBE.auslandRand : FARBE.grenze, "line-width": ["interpolate", ["linear"], ["zoom"], 1, 0.4, 5, 0.9, 9, 1.6] } });
  }
  for (const e of mit("kontinente")) {
    layers.push({ id: `${e.id}:rand`, type: "line", source: e.id, paint: { "line-color": "#57534e", "line-width": 1.6 } });
  }
  for (const e of mit("laender")) {
    layers.push({ id: `${e.id}:rand`, type: "line", source: e.id,
      paint: { "line-color": FARBE.grenze, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.8, 9, 2] } });
  }

  // ── Beschriftungen (später = obenauf) ──
  if (text) {
    for (const e of mit("landschaften")) {
      layers.push({ id: `${e.id}:name`, type: "symbol", source: namen(e), minzoom: e.bereich === "de" ? 7 : 2,
        layout: { "text-field": ["get", "name"], "text-font": SCHRIFT.kursiv, "text-size": 11, "text-max-width": 8,
          ...(e.bereich === "welt" ? { "symbol-sort-key": ["get", "rang"] } : {}) },
        paint: schrift("#5b5b5b", "#ffffffaa") });
    }
    for (const e of mit("meere")) {
      layers.push({ id: `${e.id}:name`, type: "symbol", source: namen(e),
        layout: { "text-field": ["get", "name"], "text-font": SCHRIFT.kursiv, "symbol-sort-key": ["get", "rang"], "text-max-width": 7,
          "text-size": ["match", ["get", "art"], "ozean", 15, "meer", 12.5, 11], "text-letter-spacing": ["match", ["get", "art"], "ozean", 0.25, 0.05] },
        paint: schrift(FARBE.wasserSchrift, "#ffffff88") });
    }
    for (const e of mit("fluesse")) {
      const klein = e.id === "de-fluesse-klein";
      layers.push({ id: `${e.id}:name`, type: "symbol", source: namen(e), minzoom: klein ? 8 : e.bereich === "welt" ? 3 : 5.5,
        layout: { "symbol-placement": "line", "text-field": ["get", "name"], "text-font": SCHRIFT.kursiv,
          "text-size": ["match", ["get", "klasse"], 1, 13, 2, 11.5, 10.5], "symbol-spacing": 400, "symbol-sort-key": ["get", "klasse"] },
        paint: schrift(FARBE.wasserSchrift) });
    }
    for (const e of mit("seen")) {
      layers.push({ id: `${e.id}:name`, type: "symbol", source: namen(e), minzoom: e.bereich === "de" ? 7 : 3.5,
        layout: { "text-field": ["get", "name"], "text-font": SCHRIFT.kursiv, "text-size": 11 }, paint: schrift(FARBE.wasserSchrift) });
    }
    for (const e of mit("gebirge")) {
      layers.push({ id: `${e.id}:name`, type: "symbol", source: namen(e),
        layout: { "text-field": ["upcase", ["get", "name"]], "text-font": SCHRIFT.kursiv, "text-letter-spacing": 0.15, "text-max-width": 7,
          "text-size": ["interpolate", ["linear"], ["zoom"], 2, 9, 5, 10, 9, 15],
          ...(e.bereich === "welt" ? { "symbol-sort-key": ["get", "rang"] } : {}) },
        paint: schrift(FARBE.gebirgeSchrift, "#ffffffaa") });
    }
    for (const e of mit("staaten")) {
      layers.push({ id: `${e.id}:name`, type: "symbol", source: namen(e),
        // Neben Deutschland-Ländern nur die Nachbarn beschriften
        ...(hatLaender ? { filter: ["!=", ["get", "id"], "DEU"] as FilterSpecification } : {}),
        layout: { "text-field": ["get", "name"], "text-font": SCHRIFT.normal, "text-max-width": 7,
          "text-size": ["interpolate", ["linear"], ["zoom"], 2, 9.5, 5, 12], "text-transform": hatLaender ? "uppercase" : "none" },
        paint: { "text-color": hatLaender ? "#8a847c" : "#3f3a35", "text-halo-color": "#ffffffaa", "text-halo-width": 1 } });
    }
    for (const e of mit("kontinente")) {
      layers.push({ id: `${e.id}:name`, type: "symbol", source: namen(e),
        layout: { "text-field": ["upcase", ["get", "name"]], "text-font": SCHRIFT.fett, "text-size": 16, "text-letter-spacing": 0.3 },
        paint: schrift("#44403c") });
    }
    for (const e of mit("laender")) if (art === "politisch") {
      layers.push({ id: `${e.id}:name`, type: "symbol", source: namen(e),
        layout: { "text-field": ["get", "name"], "text-font": SCHRIFT.fett, "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10, 8, 15],
          // Stadtstaaten: der Stadtname steht schon auf dem Punkt — der Landesname weicht aus
          "text-max-width": 8, "text-padding": 6, "text-variable-anchor": ["center", "top", "bottom", "left", "right"], "text-radial-offset": 1.1 },
        paint: { "text-color": "#57534e", "text-opacity": 0.75 } });
    }
  }

  for (const e of mit("thema")) {
    const d = e.darstellung!;
    if (text && e.quiz && e.geometrie === "flaeche") {
      // Namen thematischer Flächen (Platten, Wüsten, Kreise) — Kreise erst nah
      layers.push({ id: `${e.id}:name`, type: "symbol", source: namen(e), minzoom: e.bereich === "de" ? 8 : 1.5,
        layout: { "text-field": ["get", "name"], "text-font": SCHRIFT.kursiv, "text-size": 11, "text-max-width": 8,
          ...(e.bereich === "welt" ? { "symbol-sort-key": ["coalesce", ["get", "rang"], 0] } : {}) },
        paint: schrift("#4a3b2a", "#ffffffaa") });
    }
    if (e.geometrie === "linie") {
      layers.push({ id: `${e.id}:linie`, type: "line", source: e.id, layout: linie,
        paint: { "line-color": themaFarbe(d), "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.2, 9, 3] } });
      if (text && e.quiz) {
        // Benannte Linien (Tiefseegräben, Rücken): Name entlang der Linie
        layers.push({ id: `${e.id}:name`, type: "symbol", source: namen(e),
          layout: { "symbol-placement": "line", "symbol-spacing": 400, "text-field": ["get", "name"], "text-font": SCHRIFT.kursiv,
            "text-size": 11, "text-offset": [0, -0.9] },
          paint: { "text-color": themaFarbe(d), "text-halo-color": "#ffffffdd", "text-halo-width": 1.4 } });
      }
    }
    if (e.geometrie === "punkt") {
      const r: ExpressionSpecification | number = d.groesse
        ? ["interpolate", ["linear"], ["sqrt", ["max", 0, ["to-number", ["get", d.groesse.feld], 0]]], 0, 2.5, Math.sqrt(d.groesse.max), 14]
        : 5;
      layers.push({ id: `${e.id}:punkt`, type: "circle", source: e.id,
        ...(d.groesse ? { layout: { "circle-sort-key": ["-", 0, ["to-number", ["get", d.groesse.feld], 0]] } } : {}),
        paint: { "circle-radius": r, "circle-color": themaFarbe(d), "circle-opacity": 0.9,
          "circle-stroke-color": "#ffffff", "circle-stroke-width": 1 } });
      if (text) {
        layers.push({ id: `${e.id}:name`, type: "symbol", source: namen(e), minzoom: 7,
          layout: { "text-field": ["get", "name"], "text-font": SCHRIFT.normal, "text-size": 10.5, "text-anchor": "left",
            "text-offset": [0.9, 0], "text-optional": true },
          paint: schrift("#333333") });
      }
    }
  }

  // Wind und Meeresströmungen: Linie, Lauflicht in Fließrichtung, Pfeile; je Monat (Regler in der Legende)
  // Strömungen über den Windpfeilen: dicker, und ein Klick soll zuerst sie treffen
  for (const e of mit("zirkulation").sort((x, y) => Number(x.id === "welt-stroemungen") - Number(y.id === "welt-stroemungen"))) {
    const zeit: FilterSpecification = ["any", ["==", ["get", "monate"], "alle"], ["in", `,${monatVon(auswahl.filter, e.id)},`, ["get", "monate"]]];
    const gurt: ExpressionSpecification = ["in", ["get", "art"], ["literal", GURT]];
    const fliesst: FilterSpecification = ["all", zeit, ["!", gurt]];
    const farbe = themaFarbe(e.darstellung!);
    const meer = e.id === "welt-stroemungen";
    const aktiv: ExpressionSpecification = ["boolean", ["feature-state", "aktiv"], false];
    const dicke = (a: number, b: number): ExpressionSpecification =>
      ["interpolate", ["linear"], ["zoom"], 1, ["case", aktiv, a * 2, a], 5, ["case", aktiv, b * 2, b]];
    layers.push(
      { id: `${e.id}:linie`, type: "line", source: e.id, filter: fliesst, layout: linie,
        paint: { "line-color": farbe, "line-opacity": auswahl.partikel ? 0.3 : 0.85, "line-width": meer ? dicke(2.6, 5) : dicke(1.6, 2.6) } },
      { id: `${e.id}:gurt`, type: "line", source: e.id, filter: ["all", zeit, gurt],
        paint: { "line-color": farbe, "line-width": dicke(1.8, 3), "line-opacity": 0.8, "line-dasharray": [3, 2] } },
      // Lauflicht nur ohne Partikel — sonst bewegt sich die Strömung doppelt
      ...(auswahl.partikel ? [] : [{ id: `${e.id}:fluss`, type: "line", source: e.id, filter: fliesst, layout: linie,
        paint: { "line-color": "#ffffff", "line-opacity": 0.9, "line-width": meer ? 1.6 : 1.1, "line-dasharray": [0, 4, 3] } } as LayerSpecification]),
      { id: `${e.id}:pfeil`, type: "symbol", source: e.id, filter: fliesst,
        layout: { "symbol-placement": meer ? "line" : "line-center", "symbol-spacing": 120, "icon-image": ["concat", "pfeil-", farbe],
          "icon-rotation-alignment": "map", "icon-allow-overlap": true, "icon-ignore-placement": true, "icon-size": meer ? 1 : 0.8 } },
    );
    if (text) {
      layers.push({ id: `${e.id}:name`, type: "symbol", source: namen(e), filter: meer ? fliesst : ["all", zeit, gurt],
        layout: { "symbol-placement": "line", "symbol-spacing": 500, "text-field": ["get", "name"], "text-font": SCHRIFT.kursiv,
          "text-size": 11, "text-offset": [0, -1] },
        paint: { "text-color": farbe, "text-halo-color": "#ffffffdd", "text-halo-width": 1.4 } });
    }
  }

  // Eigene Ebenen: violett, Flächen/Linien/Punkte gemischt möglich
  const typ = (t: string): FilterSpecification => ["==", ["geometry-type"], t];
  for (const e of mit("eigen")) {
    layers.push(
      { id: `${e.id}:flaeche`, type: "fill", source: e.id, filter: typ("Polygon"), paint: { "fill-color": FARBE.eigen, "fill-opacity": 0.18 } },
      { id: `${e.id}:rand`, type: "line", source: e.id, filter: typ("Polygon"), paint: { "line-color": FARBE.eigen, "line-width": 1.5 } },
      { id: `${e.id}:linie`, type: "line", source: e.id, filter: typ("LineString"), layout: linie,
        paint: { "line-color": FARBE.eigen, "line-width": 2.5 } },
      { id: `${e.id}:punkt`, type: "circle", source: e.id, filter: typ("Point"),
        paint: { "circle-radius": 5, "circle-color": FARBE.eigen, "circle-stroke-color": "#ffffff", "circle-stroke-width": 1.5 } },
    );
    if (text) {
      layers.push(
        { id: `${e.id}:name`, type: "symbol", source: namen(e), filter: ["!=", ["geometry-type"], "LineString"],
          layout: { "text-field": ["get", "name"], "text-font": SCHRIFT.fett, "text-size": 11.5, "text-anchor": "left", "text-offset": [0.8, 0],
            "text-optional": true },
          paint: schrift(FARBE.eigen) },
        { id: `${e.id}:name-linie`, type: "symbol", source: e.id, filter: typ("LineString"),
          layout: { "symbol-placement": "line", "text-field": ["get", "name"], "text-font": SCHRIFT.fett, "text-size": 11.5 },
          paint: schrift(FARBE.eigen) },
      );
    }
  }

  // Punkte immer zeigen (auf stummen Karten ohne Namen — Lage ist Teil der Frage)
  for (const e of mit("gipfel")) {
    // Welt: die höchsten Berge zuerst, der Rest beim Heranzoomen
    const stufen = e.bereich === "welt"
      ? [{ ab: 5000, minzoom: 0 }, { ab: 3000, minzoom: 3 }, { ab: -1000, minzoom: 4.5 }]
      : [{ ab: 1000, minzoom: 0 }, { ab: 500, minzoom: 7 }, { ab: -1000, minzoom: 9 }];
    stufen.forEach((stufe, i) => layers.push({ id: `${e.id}:symbol${i ? `-${i}` : ""}`, type: "symbol", source: e.id,
      ...(stufe.minzoom ? { minzoom: stufe.minzoom } : {}),
      filter: ["all", [">=", ["get", "hoehe"], stufe.ab], ["<", ["get", "hoehe"], stufen[i - 1]?.ab ?? 99999]],
      layout: {
        "icon-image": "gipfel", "icon-size": 0.9, "symbol-sort-key": ["-", 0, ["get", "hoehe"]],
        ...(text ? {
          "text-field": ["concat", ["get", "name"], "\n", ["to-string", ["get", "hoehe"]], " m"],
          "text-font": SCHRIFT.normal, "text-size": 10.5, "text-anchor": "top", "text-offset": [0, 0.6], "text-optional": true,
        } : {}),
      },
      paint: schrift(FARBE.gebirgeSchrift) }));
  }
  for (const e of mit("staedte")) {
    // Um Deutschland (Länder sichtbar) von der Welt nur die Hauptstädte der Nachbarn
    const alle = e.id === "welt-staedte" && hatLaender
      ? [{ raenge: ["hauptstadt"], minzoom: 0 }]
      : STADT_STUFEN[e.id] ?? [{ raenge: [], minzoom: 0 }];
    // Größenklassen-Filter aus der Legende: abgewählte Klassen fallen weg
    const erlaubt = e.filter ? erlaubteWerte(e, auswahl.filter) : null;
    const stufen = erlaubt
      ? alle.map((st) => ({ ...st, raenge: st.raenge.filter((r) => erlaubt.includes(r)) })).filter((st) => st.raenge.length)
      : alle;
    const GROSS = ["hauptstadt", "landeshauptstadt", "grossstadt", "weltstadt"];
    stufen.forEach((stufe, i) => {
      // Große Städte: fett und (in Deutschland) immer sichtbar
      const gross = stufe.raenge.length === 0 || stufe.raenge.some((r) => GROSS.includes(r));
      layers.push({
        id: `${e.id}:symbol${i ? `-${i}` : ""}`, type: "symbol", source: e.id,
        ...(stufe.minzoom ? { minzoom: stufe.minzoom } : {}),
        ...(stufe.raenge.length ? { filter: ["in", ["get", "rang"], ["literal", stufe.raenge]] as FilterSpecification } : {}),
        layout: {
          "icon-image": ["match", ["get", "rang"], "hauptstadt", "hauptstadt", ["landeshauptstadt", "weltstadt"], "landeshauptstadt", "stadt"],
          // Deutschland: große Städte immer zeigen; Welt: Symbole verdrängen sich, sonst ein Teppich aus Punkten
          "icon-allow-overlap": gross && e.bereich === "de",
          "icon-size": ["interpolate", ["linear"], ["zoom"], 1, 0.55, 4, 0.8, 6, 1],
          "symbol-sort-key": ["-", 0, ["coalesce", ["get", "ew"], 0]],
          ...(text ? {
            "text-field": ["get", "name"],
            "text-font": gross ? SCHRIFT.fett : SCHRIFT.normal,
            "text-size": ["match", ["get", "rang"], "hauptstadt", 13.5, ["landeshauptstadt", "weltstadt"], 12.5, "grossstadt", 11, 10.5],
            "text-anchor": "left", "text-offset": [0.7, 0], "text-optional": true,
          } : {}),
        },
        paint: { "text-color": FARBE.schrift, "text-halo-color": "#ffffff", "text-halo-width": 1.3 },
      });
    });
  }

  return {
    version: 8,
    glyphs: "/karten/schriften/{fontstack}/{range}.pbf",
    sources,
    layers,
  };
}

/** Kleine Symbole, die MapLibre beim ersten Bedarf anfordert (kein Sprite-Server nötig). */
export function zeichneSymbol(name: string): { width: number; height: number; data: Uint8ClampedArray } | null {
  if (name.startsWith("pfeil-")) {
    // Pfeilspitze nach rechts (= Linienrichtung), Farbe aus dem Namen
    const c = document.createElement("canvas");
    c.width = c.height = 16;
    const g = c.getContext("2d")!;
    g.fillStyle = name.slice(6); g.strokeStyle = "#ffffff"; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(15, 8); g.lineTo(3, 2); g.lineTo(6, 8); g.lineTo(3, 14); g.closePath(); g.stroke(); g.fill();
    return { width: 16, height: 16, data: g.getImageData(0, 0, 16, 16).data };
  }
  if (name.startsWith("marke-")) {
    // Nummernkreis: weiß mit farbigem Ring (»marke-#e11d48«)
    const c = document.createElement("canvas");
    c.width = c.height = 26;
    const g = c.getContext("2d")!;
    g.fillStyle = "#ffffff"; g.strokeStyle = name.slice(6); g.lineWidth = 2.2;
    g.beginPath(); g.arc(13, 13, 11, 0, Math.PI * 2); g.fill(); g.stroke();
    return { width: 26, height: 26, data: g.getImageData(0, 0, 26, 26).data };
  }
  const groesse = name === "hauptstadt" ? 18 : name === "landeshauptstadt" ? 14 : name === "stadt" ? 10 : name === "gipfel" ? 12 : 0;
  if (!groesse) return null;
  const c = document.createElement("canvas");
  c.width = c.height = groesse;
  const g = c.getContext("2d")!;
  const m = groesse / 2;
  if (name === "gipfel") {
    g.fillStyle = "#6b3f1d";
    g.beginPath(); g.moveTo(m, 1); g.lineTo(groesse - 1, groesse - 2); g.lineTo(1, groesse - 2); g.closePath(); g.fill();
  } else {
    g.fillStyle = "#ffffff"; g.strokeStyle = "#1f1f1f"; g.lineWidth = 1.6;
    g.beginPath(); g.arc(m, m, m - 1.5, 0, Math.PI * 2); g.fill(); g.stroke();
    if (name !== "stadt") { g.fillStyle = "#1f1f1f"; g.beginPath(); g.arc(m, m, m / 2.4, 0, Math.PI * 2); g.fill(); }
  }
  return { width: groesse, height: groesse, data: g.getImageData(0, 0, groesse, groesse).data };
}

// ── Kartensatz: Auswahl, Nummern, Hervorhebung ───────────────────────

export type SatzAnsicht = {
  auswahl: Record<string, { zeigen: "alle" | "auswahl"; objekte: string[] }>;
  /** ebene → (id → Marke), siehe lib/karten/nummern.ts */
  nummern: Record<string, Record<string, string>>;
  /** Punkte für die Marken: Feature-Eigenschaften { marke, geometrie } */
  anker: GeoJSON.FeatureCollection;
  /** Im Bearbeiten-Modus: alles zeigen und Ausgewähltes rot hervorheben */
  bearbeiten: boolean;
  /** Außerhalb des Bearbeitens rot umranden (Quiz: aufgedeckte Lösung) — Filter bleiben */
  hervor?: Record<string, string[]>;
  /** Kartennetz: Anker kommen in echten Koordinaten und werden hier umgerechnet */
  projektion?: Projektion;
};

const inListe = (ids: string[]): ExpressionSpecification => ["in", ["get", "id"], ["literal", ids]];

/**
 * Legt einen Kartensatz über einen fertigen Stil. Die Ebenen bleiben dabei
 * vollständig geladen; ausgeblendet wird per Filter, nicht durch Kürzen der Daten.
 */
export function wendeSatzAn(stil: StyleSpecification, katalog: Katalog, satz: SatzAnsicht): StyleSpecification {
  const layers = stil.layers.map((l) => {
    if (!("source" in l) || typeof l.source !== "string") return l;
    const ebene = ebeneVonStilEbene(l.source); // »x:namen« (Beschriftungspunkte) gehört zu x
    const wahl = satz.auswahl[ebene];
    const nummern = satz.nummern[ebene];
    let neu: LayerSpecification = l;
    if (wahl?.zeigen === "auswahl" && !satz.bearbeiten) {
      const nur = inListe(wahl.objekte);
      neu = { ...neu, filter: ("filter" in neu && neu.filter ? ["all", neu.filter, nur] : nur) as never };
    }
    // Nummerierte Objekte tragen ihre Marke statt des Namens
    if (nummern && neu.type === "symbol" && neu.layout?.["text-field"]) {
      neu = { ...neu, layout: { ...neu.layout,
        "text-field": ["case", inListe(Object.keys(nummern)), "", neu.layout["text-field"]] as never } };
    }
    return neu;
  });

  const zusatz: LayerSpecification[] = [];
  const markiert = satz.bearbeiten
    ? Object.fromEntries(Object.entries(satz.auswahl).map(([k, w]) => [k, w.objekte]))
    : satz.hervor ?? {};
  {
    for (const [ebeneId, objekte] of Object.entries(markiert)) {
      const e = katalog.ebenen.find((x) => x.id === ebeneId);
      if (!e || !stil.sources[ebeneId] || !objekte.length) continue;
      const filter = inListe(objekte);
      const id = `wahl-${ebeneId}`;
      if (e.geometrie === "punkt" || e.geometrie === "gemischt") {
        zusatz.push({ id: `${id}-punkt`, type: "circle", source: ebeneId, filter: ["all", filter, ["==", ["geometry-type"], "Point"]],
          paint: { "circle-radius": 9, "circle-color": "transparent", "circle-stroke-color": FARBE.hervor, "circle-stroke-width": 2.5 } });
      }
      if (e.geometrie !== "punkt") {
        zusatz.push({ id, type: "line", source: ebeneId, filter,
          paint: { "line-color": FARBE.hervor, "line-width": e.geometrie === "linie" ? 4 : 2.5, "line-opacity": 0.8 } });
      }
    }
  }
  // Hervorhebung unter die Beschriftungen, Marken ganz nach oben
  const ersteSchrift = layers.findIndex((l) => l.type === "symbol");
  const mitHervor = ersteSchrift < 0 ? [...layers, ...zusatz] : [...layers.slice(0, ersteSchrift), ...zusatz, ...layers.slice(ersteSchrift)];

  const sources = { ...stil.sources };
  if (satz.anker.features.length) {
    // Marken nah beieinander (Berlin Stadt + Land) auseinanderrücken; Punkt-Ebenen bleiben stehen
    const geo = (f: GeoJSON.Feature) => katalog.ebenen.find((x) => x.id === f.properties?.ebene)?.geometrie;
    const versatz = spreizen(satz.anker.features.map((f) => ({
      p: (f.geometry as GeoJSON.Point).coordinates, vorrang: geo(f) === "punkt" })));
    const daten: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: satz.anker.features.map((f, i) => ({
      ...f, geometry: { type: "Point", coordinates: vor((f.geometry as GeoJSON.Point).coordinates, satz.projektion ?? "equalearth") },
      properties: { ...f.properties, versatz: versatz[i], versatzEm: versatz[i].map((v) => v / 14),
        verschoben: versatz[i][0] !== 0 || versatz[i][1] !== 0 } })) };
    sources["nummern"] = { type: "geojson", data: daten };
    const farbe: ExpressionSpecification = ["coalesce", ["get", "farbe"], FARBE.hervor];
    mitHervor.push(
      // Ausgewichene Marken: kleiner Punkt am eigentlichen Ort
      { id: "nummern-ort", type: "circle", source: "nummern", filter: ["==", ["get", "verschoben"], true],
        paint: { "circle-radius": 2.5, "circle-color": farbe } },
      { id: "nummern-text", type: "symbol", source: "nummern",
        layout: { "icon-image": ["concat", "marke-", farbe], "icon-size": ["interpolate", ["linear"], ["zoom"], 5, 0.75, 9, 1],
          "icon-offset": ["get", "versatz"], "icon-allow-overlap": true,
          "text-field": ["get", "marke"], "text-font": SCHRIFT.fett, "text-size": ["interpolate", ["linear"], ["zoom"], 5, 11, 9, 14],
          "text-offset": ["get", "versatzEm"], "text-allow-overlap": true },
        paint: { "text-color": farbe } },
    );
  }
  return { ...stil, sources, layers: mitHervor };
}
