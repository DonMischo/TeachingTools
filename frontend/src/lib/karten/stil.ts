/**
 * Kartentool: baut aus dem Ebenen-Katalog und der Auswahl der Lehrkraft einen
 * MapLibre-Stil. Alles kommt vom eigenen Server — Ebenen über /api/karten,
 * Höhenkacheln und Schriften aus /public/karten (keine fremden Anfragen).
 *
 * Nur eingeschaltete Ebenen bekommen eine Quelle; MapLibre lädt sonst jedes
 * GeoJSON, auch unsichtbare. Beim Umschalten reicht `map.setStyle(neu)`,
 * MapLibre rechnet den Unterschied selbst aus.
 */
import type {
  ExpressionSpecification,
  LayerSpecification,
  SourceSpecification,
  StyleSpecification,
} from "maplibre-gl";

export type Geometrie = "flaeche" | "linie" | "punkt" | "raster";

export type Ebene = {
  id: string;
  name: string;
  gruppe: "politisch" | "topographisch";
  geometrie: Geometrie;
  quiz: boolean;
  anzahl?: number;
  bytes: number;
  quelle: { name: string; lizenz: string; url: string };
  kacheln?: { datei: string; ecken: [number, number][] }[];
  stufen?: { ab: number; farbe: string }[];
};

export type Katalog = { stand: string; ebenen: Ebene[] };

export type Kartenart = "politisch" | "topographisch" | "stumm";

export type Auswahl = {
  ebenen: string[];
  /** Namen auf der Karte zeigen (aus für stumme Karten und Arbeitsblätter) */
  beschriftung: boolean;
};

export const KARTENARTEN: { id: Kartenart; icon: string; name: string; ebenen: string[] }[] = [
  {
    id: "politisch", icon: "🏛️", name: "Politisch",
    ebenen: ["eu-staaten", "de-laender", "de-gewaesser", "de-seen", "de-fluesse", "de-staedte"],
  },
  {
    id: "topographisch", icon: "⛰️", name: "Topographisch",
    ebenen: ["eu-staaten", "de-hoehen", "de-laender", "de-gewaesser", "de-seen", "de-fluesse", "de-fluesse-klein",
      "de-gebirge", "de-landschaften", "de-gipfel", "de-staedte"],
  },
  {
    id: "stumm", icon: "🔢", name: "Stumme Karte",
    ebenen: ["eu-staaten", "de-laender", "de-gewaesser", "de-seen", "de-fluesse"],
  },
];

export function auswahlFuer(art: Kartenart): Auswahl {
  const vorlage = KARTENARTEN.find((k) => k.id === art)!;
  return { ebenen: [...vorlage.ebenen], beschriftung: art !== "stumm" };
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
};

/** Sechs Pastelltöne, so verteilt, dass Nachbarländer verschieden sind. */
const LAND_FARBE: Record<string, string> = {
  SH: "#cfe6b8", HH: "#f4c2c2", HB: "#f4c2c2", NI: "#f1e3a0", MV: "#dccbe8", NW: "#cfe6b8",
  HE: "#f4c2c2", RP: "#f1e3a0", SL: "#c9d7f0", BW: "#cfe6b8", BY: "#c9d7f0", TH: "#f6d7a7",
  ST: "#cfe6b8", SN: "#f1e3a0", BB: "#f6d7a7", BE: "#f4c2c2",
};

const landFarbe: ExpressionSpecification = [
  "match", ["get", "kurz"], ...Object.entries(LAND_FARBE).flat(), "#eeeeee",
] as unknown as ExpressionSpecification;

// ── Stil ─────────────────────────────────────────────────────────────

const SCHRIFT = { normal: ["Noto Sans Regular"], fett: ["Noto Sans Bold"], kursiv: ["Noto Sans Italic"] };

/** Wo die Ebene geladen wird. Für Quizze tauscht der Aufrufer die Adresse (Gäste, ohne Namen). */
export type Quelle = (ebene: Ebene) => string;
export const quelleAusApi: Quelle = (e) => `/api/karten/ebenen/${e.id}`;

export function baueStil(katalog: Katalog, auswahl: Auswahl, art: Kartenart, quelle: Quelle = quelleAusApi): StyleSpecification {
  const an = new Set(auswahl.ebenen);
  const ebene = (id: string) => (an.has(id) ? katalog.ebenen.find((e) => e.id === id) : undefined);
  const sources: Record<string, SourceSpecification> = {};
  const layers: LayerSpecification[] = [{ id: "meer", type: "background", paint: { "background-color": FARBE.meer } }];
  const text = auswahl.beschriftung;
  const geojson = (e: Ebene) => { sources[e.id] = { type: "geojson", data: quelle(e), promoteId: "id" }; return e.id; };

  // Nachbarstaaten (Deutschland selbst liegt darunter, die Länder decken es zu)
  const staaten = ebene("eu-staaten");
  if (staaten) {
    const s = geojson(staaten);
    layers.push(
      { id: "staaten-flaeche", type: "fill", source: s, paint: { "fill-color": FARBE.ausland } },
      { id: "staaten-rand", type: "line", source: s, paint: { "line-color": FARBE.auslandRand, "line-width": 0.8 } },
    );
  }

  const hoehen = ebene("de-hoehen");
  hoehen?.kacheln?.forEach((k, i) => {
    sources[`hoehen-${i}`] = { type: "image", url: `/karten/hoehen/${k.datei}`, coordinates: k.ecken as never };
    layers.push({ id: `hoehen-${i}`, type: "raster", source: `hoehen-${i}`, paint: { "raster-fade-duration": 0 } });
  });

  const laender = ebene("de-laender");
  if (laender) {
    const s = geojson(laender);
    layers.push({
      id: "laender-flaeche", type: "fill", source: s,
      paint: {
        "fill-color": art === "politisch" ? landFarbe : "#f7f4ee",
        // Topographisch scheinen die Höhenschichten durch
        "fill-opacity": hoehen ? 0 : 1,
      },
    });
  }

  const gewaesser = ebene("de-gewaesser");
  if (gewaesser) layers.push({ id: "gewaesser", type: "fill", source: geojson(gewaesser), paint: { "fill-color": FARBE.wasser } });
  const seen = ebene("de-seen");
  if (seen) layers.push({ id: "seen", type: "fill", source: geojson(seen), paint: { "fill-color": FARBE.wasser } });

  const breite = (dick: number): ExpressionSpecification =>
    ["interpolate", ["linear"], ["zoom"], 5, ["match", ["get", "klasse"], 1, 1.4 * dick, 2, 0.8 * dick, 0.5 * dick],
      10, ["match", ["get", "klasse"], 1, 3.5 * dick, 2, 2.2 * dick, 1.2 * dick]];
  const kleine = ebene("de-fluesse-klein");
  if (kleine) {
    layers.push({ id: "fluesse-klein", type: "line", source: geojson(kleine), minzoom: 7,
      layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": FARBE.fluss, "line-width": breite(1) } });
  }
  const fluesse = ebene("de-fluesse");
  if (fluesse) {
    layers.push({ id: "fluesse", type: "line", source: geojson(fluesse),
      layout: { "line-join": "round", "line-cap": "round" }, paint: { "line-color": FARBE.fluss, "line-width": breite(1) } });
  }

  const gebirge = ebene("de-gebirge");
  if (gebirge) {
    const s = geojson(gebirge);
    layers.push({ id: "gebirge-rand", type: "line", source: s,
      paint: { "line-color": FARBE.gebirgeSchrift, "line-opacity": hoehen ? 0.35 : 0.7, "line-width": 1, "line-dasharray": [2, 2] } });
  }

  if (laender) {
    layers.push({ id: "laender-rand", type: "line", source: "de-laender",
      paint: { "line-color": FARBE.grenze, "line-width": ["interpolate", ["linear"], ["zoom"], 5, 0.8, 9, 2] } });
  }

  // ── Beschriftungen (unten wichtig, oben wichtiger: MapLibre zeichnet später Kommendes obenauf) ──
  if (text) {
    const landschaften = ebene("de-landschaften");
    if (landschaften) {
      layers.push({ id: "landschaften-name", type: "symbol", source: geojson(landschaften), minzoom: 7,
        layout: { "text-field": ["get", "name"], "text-font": SCHRIFT.kursiv, "text-size": 11, "text-max-width": 8 },
        paint: { "text-color": "#5b5b5b", "text-halo-color": "#ffffffaa", "text-halo-width": 1 } });
    }
    if (fluesse || kleine) {
      for (const [id, e] of [["fluesse-klein", kleine], ["fluesse", fluesse]] as const) {
        if (!e) continue;
        layers.push({ id: `${id}-name`, type: "symbol", source: e.id, minzoom: id === "fluesse" ? 5.5 : 8,
          layout: { "symbol-placement": "line", "text-field": ["get", "name"], "text-font": SCHRIFT.kursiv,
            "text-size": ["match", ["get", "klasse"], 1, 13, 2, 11.5, 10.5], "symbol-spacing": 400,
            "symbol-sort-key": ["get", "klasse"] },
          paint: { "text-color": FARBE.wasserSchrift, "text-halo-color": "#ffffffcc", "text-halo-width": 1.2 } });
      }
    }
    if (seen) {
      layers.push({ id: "seen-name", type: "symbol", source: "de-seen", minzoom: 7,
        layout: { "text-field": ["get", "name"], "text-font": SCHRIFT.kursiv, "text-size": 11 },
        paint: { "text-color": FARBE.wasserSchrift, "text-halo-color": "#ffffffcc", "text-halo-width": 1 } });
    }
    if (gebirge) {
      layers.push({ id: "gebirge-name", type: "symbol", source: "de-gebirge",
        layout: { "text-field": ["upcase", ["get", "name"]], "text-font": SCHRIFT.kursiv, "text-letter-spacing": 0.15,
          "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10, 9, 15], "text-max-width": 7 },
        paint: { "text-color": FARBE.gebirgeSchrift, "text-halo-color": "#ffffffaa", "text-halo-width": 1.2 } });
    }
    if (staaten) {
      layers.push({ id: "staaten-name", type: "symbol", source: "eu-staaten",
        filter: ["!=", ["get", "id"], "DEU"],
        layout: { "text-field": ["upcase", ["get", "name"]], "text-font": SCHRIFT.normal, "text-size": 12, "text-letter-spacing": 0.1 },
        paint: { "text-color": "#8a847c" } });
    }
    if (laender && art === "politisch") {
      layers.push({ id: "laender-name", type: "symbol", source: "de-laender",
        layout: { "text-field": ["get", "name"], "text-font": SCHRIFT.fett, "text-size": ["interpolate", ["linear"], ["zoom"], 5, 10, 8, 15],
          "text-max-width": 8, "text-padding": 20 },
        paint: { "text-color": "#57534e", "text-opacity": 0.75 } });
    }
  }

  // Punkte immer zeigen (auf stummen Karten ohne Namen — Lage ist Teil der Frage)
  const gipfel = ebene("de-gipfel");
  if (gipfel) {
    layers.push({ id: "gipfel", type: "symbol", source: geojson(gipfel),
      layout: {
        "icon-image": "gipfel", "icon-size": 0.9,
        "symbol-sort-key": ["-", 0, ["get", "hoehe"]],
        ...(text ? {
          "text-field": ["concat", ["get", "name"], "\n", ["to-string", ["get", "hoehe"]], " m"],
          "text-font": SCHRIFT.normal, "text-size": 10.5, "text-anchor": "top", "text-offset": [0, 0.6], "text-optional": true,
        } : {}),
      },
      paint: { "text-color": FARBE.gebirgeSchrift, "text-halo-color": "#ffffffcc", "text-halo-width": 1 } });
  }
  const staedte = ebene("de-staedte");
  if (staedte) {
    const s = geojson(staedte);
    const stadt = (id: string, mittel: boolean): LayerSpecification => ({
      id, type: "symbol", source: s,
      // Mittelstädte erst beim Heranzoomen
      ...(mittel ? { minzoom: 7 } : {}),
      filter: [mittel ? "==" : "!=", ["get", "rang"], "mittelstadt"],
      layout: {
        "icon-image": ["match", ["get", "rang"], "hauptstadt", "hauptstadt", "landeshauptstadt", "landeshauptstadt", "stadt"],
        "icon-allow-overlap": !mittel,
        "symbol-sort-key": ["match", ["get", "rang"], "hauptstadt", 0, "landeshauptstadt", 1, "grossstadt", 2, 3],
        ...(text ? {
          "text-field": ["get", "name"],
          "text-font": mittel ? SCHRIFT.normal : SCHRIFT.fett,
          "text-size": ["match", ["get", "rang"], "hauptstadt", 14, "landeshauptstadt", 12.5, "grossstadt", 11.5, 10.5],
          "text-anchor": "left", "text-offset": [0.7, 0], "text-optional": true,
        } : {}),
      },
      paint: { "text-color": FARBE.schrift, "text-halo-color": "#ffffff", "text-halo-width": 1.3 },
    });
    layers.push(stadt("staedte-mittel", true), stadt("staedte", false));
  }

  return {
    version: 8,
    glyphs: "/karten/schriften/{fontstack}/{range}.pbf",
    sources,
    layers,
  };
}

/** Ebenen, deren Objekte man anklicken kann (Name zeigen, später: fürs Quiz wählen). */
export const KLICK_EBENEN: Record<string, string> = {
  "staedte": "de-staedte", "staedte-mittel": "de-staedte", "gipfel": "de-gipfel", "fluesse": "de-fluesse", "fluesse-klein": "de-fluesse-klein",
  "seen": "de-seen", "gebirge-rand": "de-gebirge", "laender-flaeche": "de-laender", "staaten-flaeche": "eu-staaten",
};

/** Kleine Symbole, die MapLibre beim ersten Bedarf anfordert (kein Sprite-Server nötig). */
export function zeichneSymbol(name: string): { width: number; height: number; data: Uint8ClampedArray } | null {
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
};

const inListe = (ids: string[]): ExpressionSpecification => ["in", ["get", "id"], ["literal", ids]];

/**
 * Legt einen Kartensatz über einen fertigen Stil. Die Ebenen bleiben dabei
 * vollständig geladen; ausgeblendet wird per Filter, nicht durch Kürzen der Daten.
 */
export function wendeSatzAn(stil: StyleSpecification, katalog: Katalog, satz: SatzAnsicht): StyleSpecification {
  const layers = stil.layers.map((l) => {
    if (!("source" in l) || typeof l.source !== "string") return l;
    const wahl = satz.auswahl[l.source];
    const nummern = satz.nummern[l.source];
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
  if (satz.bearbeiten) {
    for (const [ebeneId, wahl] of Object.entries(satz.auswahl)) {
      const e = katalog.ebenen.find((x) => x.id === ebeneId);
      if (!e || !stil.sources[ebeneId] || !wahl.objekte.length) continue;
      const filter = inListe(wahl.objekte);
      const id = `wahl-${ebeneId}`;
      zusatz.push(e.geometrie === "punkt"
        ? { id, type: "circle", source: ebeneId, filter, paint: { "circle-radius": 9, "circle-color": "transparent", "circle-stroke-color": FARBE.hervor, "circle-stroke-width": 2.5 } }
        : { id, type: "line", source: ebeneId, filter, paint: { "line-color": FARBE.hervor, "line-width": e.geometrie === "linie" ? 4 : 2.5, "line-opacity": 0.8 } });
    }
  }
  // Hervorhebung unter die Beschriftungen, Marken ganz nach oben
  const ersteSchrift = layers.findIndex((l) => l.type === "symbol");
  const mitHervor = ersteSchrift < 0 ? [...layers, ...zusatz] : [...layers.slice(0, ersteSchrift), ...zusatz, ...layers.slice(ersteSchrift)];

  const sources = { ...stil.sources };
  if (satz.anker.features.length) {
    sources["nummern"] = { type: "geojson", data: satz.anker };
    mitHervor.push(
      { id: "nummern-kreis", type: "circle", source: "nummern",
        paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 5, 9, 9, 12], "circle-color": "#ffffff",
          "circle-stroke-color": FARBE.hervor, "circle-stroke-width": 2 } },
      { id: "nummern-text", type: "symbol", source: "nummern",
        layout: { "text-field": ["get", "marke"], "text-font": SCHRIFT.fett, "text-size": ["interpolate", ["linear"], ["zoom"], 5, 11, 9, 14],
          "text-allow-overlap": true, "text-ignore-placement": true },
        paint: { "text-color": FARBE.hervor } },
    );
  }
  return { ...stil, sources, layers: mitHervor };
}
