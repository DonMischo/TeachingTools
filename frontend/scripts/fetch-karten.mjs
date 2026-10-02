/**
 * Holt die Kartendaten für das Kartentool »karten« und bereitet sie auf.
 *
 * Alles liegt danach im Repo, damit die Karten offline im Schulnetz laufen
 * und keine Schüler-IP an Dritte geht:
 *   data/karten/ebenen/<id>.geojson   Vektorebenen (WGS84), liest das Backend
 *   data/karten/ebenen.json           Katalog: Name, Gruppe, Geometrie, Quelle
 *   public/karten/hoehen/*.webp       Höhenschichten (Web-Mercator-Kacheln)
 *   public/karten/schriften/…/*.pbf   Glyphen für MapLibre-Beschriftungen
 *                                     (Noto Sans, SIL OFL; sonst lädt MapLibre sie von fremden Servern)
 *
 * Quellen:
 *   BKG Open Data, dl-de/by-2.0, »© GeoBasis-DE / BKG (Jahr)«:
 *     VG2500 (Länder), DLM1000 (Gewässer, Landschaften), GN250 (Orte, Gipfel),
 *     DGM200 (Höhen, 200-m-Raster)
 *   Natural Earth, gemeinfrei: Staaten Europas
 *
 * Jedes Objekt bekommt eine feste `id` (Lösungen und Antworten hängen daran)
 * und einen `name`. Ebenen mit `quiz: true` taugen für Kartenquizze.
 *
 * Aufruf:  node scripts/fetch-karten.mjs  [--force]   (--force lädt neu)
 * Rohdaten landen in .karten-roh/ (nicht im Repo, ~150 MB).
 */
import { createHash } from "crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import JSZip from "jszip";
import mapshaper from "mapshaper";
import { fromFile } from "geotiff";
import proj4 from "proj4";
import sharp from "sharp";

const HIER = dirname(fileURLToPath(import.meta.url));
const ROH = resolve(HIER, "../.karten-roh");
const ZIEL = resolve(HIER, "../../data/karten");
const HOEHEN = resolve(HIER, "../public/karten/hoehen");
const SCHRIFTEN = resolve(HIER, "../public/karten/schriften");
const force = process.argv.includes("--force");

const BKG = "https://daten.gdz.bkg.bund.de/produkte";
const NE = "https://naciscdn.org/naturalearth";
const PAKETE = {
  vg2500: { url: `${BKG}/vg/vg2500/aktuell/vg2500_12-31.utm32s.shape.zip`, md5: true },
  dlm1000: { url: `${BKG}/dlm/dlm1000/aktuell/dlm1000.utm32s.shape.ebenen.zip`, md5: true },
  gn250: { url: `${BKG}/sonstige/gn250/aktuell/gn250.utm32s.shape.zip`, md5: true },
  dgm200: { url: `${BKG}/dgm/dgm200/aktuell/dgm200.utm32s.geotiff.zip`, md5: true },
  ne_staaten: { url: `${NE}/10m/cultural/ne_10m_admin_0_countries.zip`, md5: false },
  ne_10m_populated_places: { url: `${NE}/10m/cultural/ne_10m_populated_places.zip`, md5: false },
  ne_10m_rivers_lake_centerlines: { url: `${NE}/10m/physical/ne_10m_rivers_lake_centerlines.zip`, md5: false },
  ne_10m_rivers_europe: { url: `${NE}/10m/physical/ne_10m_rivers_europe.zip`, md5: false },
  ne_10m_lakes: { url: `${NE}/10m/physical/ne_10m_lakes.zip`, md5: false },
  ne_10m_lakes_europe: { url: `${NE}/10m/physical/ne_10m_lakes_europe.zip`, md5: false },
  ne_10m_geography_regions_polys: { url: `${NE}/10m/physical/ne_10m_geography_regions_polys.zip`, md5: false },
  ne_10m_geography_regions_elevation_points: { url: `${NE}/10m/physical/ne_10m_geography_regions_elevation_points.zip`, md5: false },
  ne_10m_geography_marine_polys: { url: `${NE}/10m/physical/ne_10m_geography_marine_polys.zip`, md5: false },
  // Atlasfarben mit Schummerung, 10800x5400, gemeinfrei
  ne_hyp: { url: `${NE}/50m/raster/HYP_50M_SR_W.zip`, md5: false },
  dlm250: { url: `${BKG}/dlm/dlm250/aktuell/dlm250.utm32s.shape.ebenen.zip`, md5: true },
  vg250ew: { url: `${BKG}/vg/vg250-ew_ebenen_1231/aktuell/vg250-ew_12-31.utm32s.shape.ebenen.zip`, md5: false },
  // CORINE Land Cover 2018, 5 ha (1,4 GB gepackt, 4,8 GB entpackt)
  clc5: { url: `${BKG}/dlm/clc5_2018/aktuell/clc5_2018.utm32s.shape.zip`, md5: true },
  // Köppen-Geiger 1991–2020 (Beck et al. 2023), GeoTIFFs in mehreren Auflösungen
  koeppen: { url: "https://ndownloader.figshare.com/files/61012822", md5: false },
};

const JAHR = new Date().getFullYear();
const QUELLE_BKG = { name: `© GeoBasis-DE / BKG (${JAHR})`, lizenz: "dl-de/by-2.0", url: "https://www.govdata.de/dl-de/by-2-0" };
const QUELLE_NE = { name: "Natural Earth", lizenz: "gemeinfrei", url: "https://www.naturalearthdata.com/" };

// ── Laden ────────────────────────────────────────────────────────────

const md5 = (datei) => createHash("md5").update(readFileSync(datei)).digest("hex");

async function lade(schluessel) {
  const { url, md5: mitPruefsumme } = PAKETE[schluessel];
  const zip = join(ROH, `${schluessel}.zip`);
  const ordner = join(ROH, schluessel);
  if (existsSync(join(ordner, ".fertig")) && !force) return ordner;
  if (!existsSync(zip) || force) {
    console.log(`Lade ${url} …`);
    const antwort = await fetch(url);
    if (!antwort.ok) throw new Error(`${url}: HTTP ${antwort.status}`);
    writeFileSync(zip, Buffer.from(await antwort.arrayBuffer()));
  }
  if (mitPruefsumme) {
    const soll = (await (await fetch(`${url}.md5`)).text()).trim().split(/\s+/)[0];
    if (md5(zip) !== soll) { rmSync(zip); throw new Error(`${schluessel}: Prüfsumme falsch, Datei gelöscht — bitte neu starten.`); }
  }
  rmSync(ordner, { recursive: true, force: true });
  mkdirSync(ordner, { recursive: true });
  const archiv = await JSZip.loadAsync(readFileSync(zip));
  for (const eintrag of Object.values(archiv.files)) {
    if (eintrag.dir) continue;
    const datei = join(ordner, eintrag.name);
    mkdirSync(dirname(datei), { recursive: true });
    writeFileSync(datei, await eintrag.async("nodebuffer"));
  }
  writeFileSync(join(ordner, ".fertig"), "");
  return ordner;
}

/** Lädt eine einzelne Datei (CSV) in den Rohordner, falls sie fehlt. */
async function ladeDatei(name, url) {
  const ziel = join(ROH, name);
  if (!existsSync(ziel) || force) {
    const antwort = await fetch(url);
    if (!antwort.ok) throw new Error(`${url}: HTTP ${antwort.status}`);
    writeFileSync(ziel, Buffer.from(await antwort.arrayBuffer()));
  }
  return ziel;
}

/** Findet eine Datei unter `ordner` (die Zips verschachteln unterschiedlich tief). */
function finde(ordner, name) {
  for (const e of readdirSync(ordner, { withFileTypes: true })) {
    const pfad = join(ordner, e.name);
    if (e.isDirectory()) { try { return finde(pfad, name); } catch { /* weiter suchen */ } }
    else if (e.name.toLowerCase() === name.toLowerCase()) return pfad;
  }
  throw new Error(`${name} fehlt in ${ordner}`);
}

/** Shapefile → GeoJSON-Features in WGS84, wahlweise mit weiteren mapshaper-Befehlen. */
async function lies(shp, befehle = "") {
  const ein = shp.replace(/\\/g, "/");
  const aus = await mapshaper.applyCommands(
    `-i "${ein}" encoding=utf8 ${befehle} -proj wgs84 -o format=geojson precision=0.0001 out.json`,
  );
  return JSON.parse(aus["out.json"].toString()).features;
}

// ── Hilfen ───────────────────────────────────────────────────────────

const slug = (s) => s.toLowerCase()
  .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
  .normalize("NFD").replace(/\p{M}/gu, "") // Rhône → rhone
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Vergibt eindeutige ids: doppelte bekommen -2, -3, … */
function eindeutig(features) {
  const gesehen = new Map();
  for (const f of features) {
    const basis = f.properties.id;
    const n = (gesehen.get(basis) ?? 0) + 1;
    gesehen.set(basis, n);
    if (n > 1) f.properties.id = `${basis}-${n}`;
  }
  return features;
}

const feature = (geometry, properties) => ({ type: "Feature", geometry, properties });

const KATALOG = [];
function schreibe(id, meta, features) {
  // Vereinfachen kann winzige Flächen ganz verschwinden lassen
  features = features.filter((f) => f.geometry);
  eindeutig(features);
  const datei = join(ZIEL, "ebenen", `${id}.geojson`);
  writeFileSync(datei, JSON.stringify({ type: "FeatureCollection", features }));
  const groesse = readFileSync(datei).length;
  KATALOG.push({ id, ...meta, anzahl: features.length, bytes: groesse });
  console.log(`  ${id.padEnd(22)} ${String(features.length).padStart(6)} Objekte  ${(groesse / 1e6).toFixed(2)} MB`);
}

// ── Ebenen ───────────────────────────────────────────────────────────

async function laender(vg) {
  // GF 9 = Landfläche (GF 4 wären auch Bodensee- und Küstengewässer)
  const fs = await lies(finde(vg, "VG2500_LAN.shp"), `-filter "GF==9" -simplify 15% keep-shapes`);
  const land = fs.map((f) => feature(f.geometry, { id: f.properties.AGS, name: f.properties.GEN, kurz: f.properties.LKZ }));
  schreibe("de-laender", { name: "Bundesländer", gruppe: "politisch", bereich: "de", geometrie: "flaeche", quiz: true, quelle: QUELLE_BKG }, land);
  return land;
}

const LANDESHAUPTSTAEDTE = ["Kiel", "Hamburg", "Schwerin", "Bremen", "Hannover", "Magdeburg", "Potsdam", "Düsseldorf",
  "Wiesbaden", "Erfurt", "Dresden", "Mainz", "Saarbrücken", "Stuttgart", "München", "Berlin"];

/** Größenklassen der Siedlungen; `standard` = beim Öffnen angehakt (nur die großen Städte). */
export const SIEDLUNG_KLASSEN = [
  { wert: "hauptstadt", text: "Hauptstadt", standard: true },
  { wert: "landeshauptstadt", text: "Landeshauptstädte", standard: true },
  { wert: "grossstadt", text: "Großstädte (ab 100 000)", standard: true },
  { wert: "mittelstadt", text: "Mittelstädte (20 000 – 100 000)", standard: false },
  { wert: "kleinstadt", text: "Kleinstädte und Gemeinden (5 000 – 20 000)", standard: false },
  { wert: "landgemeinde", text: "Gemeinden unter 5 000", standard: false },
  { wert: "ortsteil", text: "Ortsteile", standard: false },
];

/**
 * Alle Siedlungen (GN250): jede Gemeinde (AGS, Einwohner) und jeder Ortsteil
 * (Ortslage, die Teil einer Gemeinde ist — z. B. Trusen in Brotterode-Trusetal).
 * Geteilt in zwei Dateien, damit die 44 000 kleinen Orte erst laden, wenn man
 * sie anhakt: de-staedte (ab 5 000 Einwohnern) und de-orte (der Rest).
 */
async function staedte(gn) {
  const shp = finde(gn, "GN250_p.shp");
  const gemeinden = (await lies(shp, `-filter "OBA=='AX_Gemeinde'"`)).map((f) => {
    const p = f.properties;
    const ew = p.EWZ ?? 0;
    const rang = p.NAME === "Berlin" ? "hauptstadt"
      : LANDESHAUPTSTAEDTE.includes(p.NAME) ? "landeshauptstadt"
      : ew >= 100000 ? "grossstadt" : ew >= 20000 ? "mittelstadt" : ew >= 5000 ? "kleinstadt" : "landgemeinde";
    return feature(f.geometry, { id: p.AGS, name: p.NAME, ew, rang, land: p.BUNDESLAND });
  });
  const fehlt = LANDESHAUPTSTAEDTE.filter((n) => !gemeinden.some((f) => f.properties.name === n));
  if (fehlt.length) throw new Error(`Landeshauptstädte fehlen: ${fehlt.join(", ")}`);
  // Ortsteile: Ortslagen, die zu einer Gemeinde gehören (der Hauptort steckt schon in der Gemeinde)
  const ortsteile = (await lies(shp, `-filter "OBA=='AX_Ortslage' && GEMTEIL=='Ja' && VIRTUELL=='Nein'"`)).map((f) => {
    const p = f.properties;
    return feature(f.geometry, { id: p.NNID, name: p.NAME, ew: p.EWZ_GER ?? 0, rang: "ortsteil", gemeinde: p.GEMEINDE, land: p.BUNDESLAND });
  });
  const nachEw = (a, b) => b.properties.ew - a.properties.ew;
  // `vorhanden`: welche Klassen in dieser Datei stecken — die Legende schaltet danach die Datei zu
  const filter = (vorhanden) => ({ feld: "rang", werte: SIEDLUNG_KLASSEN, vorhanden });
  schreibe("de-staedte", { name: "Städte und Gemeinden", gruppe: "politisch", bereich: "de", geometrie: "punkt", quiz: true, quelle: QUELLE_BKG,
    filter: filter(["hauptstadt", "landeshauptstadt", "grossstadt", "mittelstadt", "kleinstadt"]) },
    gemeinden.filter((f) => f.properties.ew >= 5000).sort(nachEw));
  schreibe("de-orte", { name: "Kleine Gemeinden und Ortsteile", gruppe: "politisch", bereich: "de", geometrie: "punkt", quiz: true, quelle: QUELLE_BKG,
    filter: filter(["landgemeinde", "ortsteil"]) },
    [...gemeinden.filter((f) => f.properties.ew < 5000), ...ortsteile].sort(nachEw));
}

async function gipfel(gn) {
  const fs = await lies(finde(gn, "GN250_p.shp"), `-filter "OBA=='Besonderer_Hoehenpunkt' && HOEHE > 0"`);
  fs.sort((a, b) => b.properties.HOEHE - a.properties.HOEHE);
  schreibe("de-gipfel", { name: "Berge und Gipfel", gruppe: "topographisch", bereich: "de", geometrie: "punkt", quiz: true, quelle: QUELLE_BKG },
    fs.map((f) => feature(f.geometry, { id: f.properties.NNID, name: f.properties.NAME, hoehe: Math.round(f.properties.HOEHE), land: f.properties.BUNDESLAND })));
}

/** LTP-Schlüssel der DLM-Landschaften → unsere Arten. */
const LANDSCHAFT = { 1100: "gebirge", 1200: "berg", 1300: "becken", 1400: "tal", 1500: "ebene", 1600: "hochflaeche",
  1900: "wald", 2000: "inseln", 2100: "seenplatte", 2200: "region", 2300: "moor", 2500: "marsch", 2600: "historisch" };

async function landschaften(dlm) {
  const fs = await lies(finde(dlm, "geb02_f.shp"), `-filter "NAM != ''" -simplify 15% keep-shapes`);
  const alle = fs.map((f) => feature(f.geometry, { id: f.properties.OBJID, name: f.properties.NAM, art: LANDSCHAFT[f.properties.LTP] ?? "sonstige" }));
  schreibe("de-gebirge", { name: "Gebirge", gruppe: "topographisch", bereich: "de", geometrie: "flaeche", quiz: true, quelle: QUELLE_BKG },
    alle.filter((f) => f.properties.art === "gebirge"));
  schreibe("de-landschaften", { name: "Landschaften", gruppe: "topographisch", bereich: "de", geometrie: "flaeche", quiz: true, quelle: QUELLE_BKG },
    alle.filter((f) => f.properties.art !== "gebirge"));
}

/**
 * Flüsse: Das DLM zerlegt jeden Fluss in Abschnitte. Zusammengefasst wird
 * nach Name UND Zusammenhang — es gibt etliche »Schwarza« und zwei »Saale«,
 * die nichts miteinander zu tun haben. Klasse = WDM (1310 Bundeswasserstraße
 * … 1340 kleines Gewässer), je kleiner, desto wichtiger.
 */
async function fluesse(dlm) {
  const fs = await lies(finde(dlm, "gew01_l.shp"), `-filter "NAM != ''"`);
  const runde = ([x, y]) => `${x.toFixed(4)},${y.toFixed(4)}`;
  const linien = (g) => (g.type === "LineString" ? [g.coordinates] : g.coordinates);

  // Union-Find über Abschnitte gleichen Namens, die sich an einem Endpunkt berühren
  const eltern = fs.map((_, i) => i);
  const wurzel = (i) => (eltern[i] === i ? i : (eltern[i] = wurzel(eltern[i])));
  const anEnde = new Map();
  fs.forEach((f, i) => {
    for (const l of linien(f.geometry)) for (const p of [l[0], l[l.length - 1]]) {
      const k = `${f.properties.NAM}|${runde(p)}`;
      if (anEnde.has(k)) eltern[wurzel(i)] = wurzel(anEnde.get(k)); else anEnde.set(k, i);
    }
  });
  const zusammen = new Map();
  fs.forEach((f, i) => { const w = wurzel(i); if (!zusammen.has(w)) zusammen.set(w, []); zusammen.get(w).push(f); });

  // Gewässerkennzahl einer Gruppe: gemeinsamer Anfang aller Abschnitte, ohne Nullen am Ende
  const kennzahl = (teile) => {
    const alle = teile.map((t) => t.properties.GWK).filter((g) => g && !/^0*$/.test(g));
    let gwk = alle[0] ?? "";
    for (const k of alle) while (!k.startsWith(gwk)) gwk = gwk.slice(0, -1);
    return gwk.replace(/0+$/, "");
  };

  // Seen, Talsperren und Inseln unterbrechen einen Fluss: Stücke gleichen
  // Namens und gleicher Kennzahl gehören trotzdem zusammen (Saale, Rhein).
  const nachKennzahl = new Map();
  const ohne = [];
  for (const teile of zusammen.values()) {
    const gwk = kennzahl(teile);
    if (!gwk) { ohne.push(teile); continue; }
    const k = `${teile[0].properties.NAM}|${gwk}`;
    if (nachKennzahl.has(k)) nachKennzahl.get(k).push(...teile); else nachKennzahl.set(k, teile);
  }
  // Stücke ohne Kennzahl hängen sich an einen gleichnamigen Fluss in ≤ 5 km Nähe
  const punkte = (teile) => teile.flatMap((t) => linien(t.geometry).flat());
  const km = ([x1, y1], [x2, y2]) => Math.hypot((x1 - x2) * 70, (y1 - y2) * 111);
  const KLASSE = { 1310: 1, 1320: 2, 1330: 3, 1340: 4 };
  const klasseVon = (teile) => Math.min(...teile.map((t) => KLASSE[t.properties.WDM] ?? 4));
  const gruppen = [...nachKennzahl.values()].map((teile) => ({ gwk: kennzahl(teile), teile }));
  const nahe = (a, b, grenze) => { const pa = punkte(a); return punkte(b).some((p) => pa.some((q) => km(p, q) <= grenze)); };
  for (const teile of ohne) {
    const name = teile[0].properties.NAM;
    const gleich = gruppen.filter((g) => g.teile[0].properties.NAM === name);
    // Große Flüsse (Klasse 1–2) haben im DLM Lücken, wo der Strom als Fläche
    // erfasst ist (Tideelbe): gibt es nur einen großen Fluss dieses Namens, gehört das Stück zu ihm.
    const gross = gleich.filter((g) => klasseVon(g.teile) <= 2);
    const ziel = gleich.find((g) => nahe(g.teile, teile, 5))
      ?? (klasseVon(teile) <= 2 && gross.length === 1 ? gross[0] : null);
    if (ziel) ziel.teile.push(...teile); else gruppen.push({ gwk: "", teile });
  }
  // Große Flüsse gleichen Namens mit eigener Kennzahl, aber dicht beieinander (Donau-Altarme)
  for (let i = 0; i < gruppen.length; i++) for (let j = gruppen.length - 1; j > i; j--) {
    const [a, b] = [gruppen[i], gruppen[j]];
    if (a.teile[0].properties.NAM === b.teile[0].properties.NAM && klasseVon(a.teile) <= 2 && klasseVon(b.teile) <= 2
      && nahe(a.teile, b.teile, 1)) { a.teile.push(...b.teile); gruppen.splice(j, 1); }
  }

  const ergebnis = [];
  for (const { gwk, teile } of gruppen) {
    const name = teile[0].properties.NAM;
    const klasse = klasseVon(teile);
    const zweit = teile.map((t) => t.properties.ZNM).find(Boolean);
    ergebnis.push(feature(
      { type: "MultiLineString", coordinates: teile.flatMap((t) => linien(t.geometry)) },
      { id: `${slug(name)}-${gwk || teile[0].properties.OBJID}`, name, ...(zweit ? { name2: zweit } : {}), klasse },
    ));
  }
  // Vereinfachen erst nach dem Zusammenfassen, sonst reißen die Endpunkte auseinander
  const vereinfacht = await mapshaper.applyCommands(
    "-i in.json -simplify 20% -o format=geojson precision=0.0001 out.json",
    { "in.json": { type: "FeatureCollection", features: ergebnis } },
  );
  const fertig = JSON.parse(vereinfacht["out.json"].toString()).features;
  fertig.sort((a, b) => a.properties.klasse - b.properties.klasse);
  // Große Flüsse (Klasse 1–2) immer, kleine erst beim Heranzoomen
  schreibe("de-fluesse", { name: "Flüsse", gruppe: "topographisch", bereich: "de", geometrie: "linie", quiz: true, quelle: QUELLE_BKG },
    fertig.filter((f) => f.properties.klasse <= 2));
  schreibe("de-fluesse-klein", { name: "Kleine Flüsse und Bäche", gruppe: "topographisch", bereich: "de", geometrie: "linie", quiz: true, quelle: QUELLE_BKG },
    fertig.filter((f) => f.properties.klasse > 2));
}

async function gewaesserflaechen(dlm) {
  const fs = await lies(finde(dlm, "gew01_f.shp"), `-simplify 20% keep-shapes`);
  const ART = { AX_StehendesGewaesser: "see", AX_Fliessgewaesser: "fluss", AX_Meer: "meer" };
  const alle = fs.map((f) => feature(f.geometry, {
    id: f.properties.OBJID, name: f.properties.NAM || "", art: ART[f.properties.OBJART_TXT] ?? "see",
  }));
  schreibe("de-seen", { name: "Seen", gruppe: "topographisch", bereich: "de", geometrie: "flaeche", quiz: true, quelle: QUELLE_BKG },
    alle.filter((f) => f.properties.art === "see" && f.properties.name));
  // Unbenannte Seen, Meere und breite Flüsse: nur zum Zeichnen
  schreibe("de-gewaesser", { name: "Meere und weitere Gewässer", gruppe: "topographisch", bereich: "de", geometrie: "flaeche", quiz: false, quelle: QUELLE_BKG },
    alle.filter((f) => f.properties.art !== "see" || !f.properties.name));
}

const KONTINENT = {
  "Europe": "Europa", "Asia": "Asien", "Africa": "Afrika", "North America": "Nordamerika", "South America": "Südamerika",
  "Oceania": "Ozeanien", "Antarctica": "Antarktis", "Seven seas (open ocean)": "Ozeanien",
};

/** Staaten der Welt (deutsche Namen in NAME_DE, MAPCOLOR7 = Färbung ohne gleichfarbige Nachbarn). */
async function staaten(ne) {
  const fs = await lies(finde(ne, "ne_10m_admin_0_countries.shp"), `-simplify 12% keep-shapes`);
  const welt = fs.map((f) => feature(f.geometry, {
    id: f.properties.ADM0_A3, name: f.properties.NAME_DE || f.properties.NAME,
    kontinent: KONTINENT[f.properties.CONTINENT] ?? f.properties.CONTINENT, farbe: f.properties.MAPCOLOR7,
  }));
  schreibe("welt-staaten", { name: "Staaten", gruppe: "politisch", bereich: "welt", geometrie: "flaeche", quiz: true, quelle: QUELLE_NE }, welt);

  // Kontinente = Staaten zusammengefasst (genauer als die groben Natural-Earth-Kontinentflächen)
  const zusammen = await mapshaper.applyCommands(
    "-i in.json -dissolve kontinent -o format=geojson precision=0.0001 out.json",
    { "in.json": { type: "FeatureCollection", features: welt } },
  );
  schreibe("welt-kontinente", { name: "Kontinente", gruppe: "politisch", bereich: "welt", geometrie: "flaeche", quiz: true, quelle: QUELLE_NE },
    JSON.parse(zusammen["out.json"].toString()).features
      .filter((f) => f.properties.kontinent)
      .map((f) => feature(f.geometry, { id: slug(f.properties.kontinent), name: f.properties.kontinent })));
  return Object.fromEntries(welt.map((f) => [f.properties.id, f.properties.kontinent]));
}

/** Deutscher Name, sonst der Originalname. */
const nameDe = (p) => (p.name_de || p.NAME_DE || p.name || p.NAME || "").trim();

async function weltStaedte(ne, kontinentVon) {
  const fs = await lies(finde(ne, "ne_10m_populated_places.shp"));
  const auswahl = fs.filter((f) => {
    const p = f.properties;
    if (p.ADM0_A3 === "DEU") return false; // Deutschland kommt genauer vom BKG
    const hauptstadt = /^Admin-0 capital/.test(p.FEATURECLA);
    const europa = kontinentVon[p.ADM0_A3] === "Europa";
    return hauptstadt || p.POP_MAX >= 1_000_000 || (europa && p.POP_MAX >= 150_000);
  });
  const staedte = auswahl.map((f) => {
    const p = f.properties;
    const rang = p.FEATURECLA === "Admin-0 capital" ? "hauptstadt" : p.POP_MAX >= 5_000_000 ? "weltstadt"
      : p.POP_MAX >= 1_000_000 ? "millionenstadt" : "grossstadt";
    return feature(f.geometry, { id: `gn${p.GEONAMESID > 0 ? p.GEONAMESID : slug(p.NAME)}`, name: nameDe(p), ew: p.POP_MAX, rang,
      land: p.ADM0NAME, kontinent: kontinentVon[p.ADM0_A3] ?? "" });
  }).sort((a, b) => b.properties.ew - a.properties.ew);
  schreibe("welt-staedte", { name: "Städte der Welt", gruppe: "politisch", bereich: "welt", geometrie: "punkt", quiz: true, quelle: QUELLE_NE }, staedte);
}

/**
 * Flussstücke gleichen Namens, die sich berühren (oder ≤ luecke km auseinanderliegen,
 * etwa durch einen See), werden ein Fluss. `klasseVon` gibt je Stück 1 (groß) … 4.
 */
function fasseFluesseZusammen(stuecke, klasseVon, luecke) {
  const linien = (g) => (g.type === "LineString" ? [g.coordinates] : g.coordinates);
  const km = ([x1, y1], [x2, y2]) => Math.hypot((x1 - x2) * 111 * Math.cos((y1 * Math.PI) / 180), (y1 - y2) * 111);
  const nachName = new Map();
  for (const s of stuecke) {
    const n = nameDe(s.properties);
    if (!n) continue;
    if (!nachName.has(n)) nachName.set(n, []);
    nachName.get(n).push(s);
  }
  const ergebnis = [];
  for (const [name, teile] of nachName) {
    const enden = teile.map((t) => linien(t.geometry).flatMap((l) => [l[0], l[l.length - 1]]));
    const eltern = teile.map((_, i) => i);
    const wurzel = (i) => (eltern[i] === i ? i : (eltern[i] = wurzel(eltern[i])));
    for (let i = 0; i < teile.length; i++) for (let j = i + 1; j < teile.length; j++) {
      // Große Ströme (Kongo, Nil) haben in den Daten weite Lücken, etwa an Stauseen
      const grenze = klasseVon(teile[i]) <= 2 && klasseVon(teile[j]) <= 2 ? 60 : luecke;
      if (wurzel(i) !== wurzel(j) && enden[i].some((p) => enden[j].some((q) => km(p, q) <= grenze))) eltern[wurzel(j)] = wurzel(i);
    }
    const gruppen = new Map();
    teile.forEach((t, i) => { const w = wurzel(i); if (!gruppen.has(w)) gruppen.set(w, []); gruppen.get(w).push(t); });
    for (const g of [...gruppen.values()].sort((a, b) => b.length - a.length)) {
      ergebnis.push(feature(
        { type: "MultiLineString", coordinates: g.flatMap((t) => linien(t.geometry)) },
        { id: slug(name), name, klasse: Math.min(...g.map(klasseVon)) },
      ));
    }
  }
  return ergebnis.sort((a, b) => a.properties.klasse - b.properties.klasse);
}

async function weltGewaesser(ordner) {
  const fluss = (f) => /River|Canal|Lake Centerline/.test(f.properties.featurecla);
  const haupt = (await lies(finde(ordner.ne_10m_rivers_lake_centerlines, "ne_10m_rivers_lake_centerlines.shp"))).filter(fluss);
  const europa = (await lies(finde(ordner.ne_10m_rivers_europe, "ne_10m_rivers_europe.shp"))).filter(fluss);
  const klasse = (f) => { const r = f.properties.scalerank; return r <= 3 ? 1 : r <= 5 ? 2 : r <= 7 ? 3 : 4; };
  const fluesse = fasseFluesseZusammen([...haupt, ...europa], klasse, 15);
  const vereinfacht = await mapshaper.applyCommands("-i in.json -simplify 40% -o format=geojson precision=0.0001 out.json",
    { "in.json": { type: "FeatureCollection", features: fluesse } });
  schreibe("welt-fluesse", { name: "Flüsse der Welt", gruppe: "topographisch", bereich: "welt", geometrie: "linie", quiz: true, quelle: QUELLE_NE },
    JSON.parse(vereinfacht["out.json"].toString()).features);

  const seen = [
    ...(await lies(finde(ordner.ne_10m_lakes, "ne_10m_lakes.shp"), "-simplify 30% keep-shapes")),
    ...(await lies(finde(ordner.ne_10m_lakes_europe, "ne_10m_lakes_europe.shp"), "-simplify 30% keep-shapes")),
  ].map((f) => feature(f.geometry, { id: slug(nameDe(f.properties) || "see"), name: nameDe(f.properties),
    art: f.properties.featurecla === "Reservoir" ? "stausee" : "see" }));
  schreibe("welt-seen", { name: "Seen der Welt", gruppe: "topographisch", bereich: "welt", geometrie: "flaeche", quiz: true, quelle: QUELLE_NE },
    seen.filter((f) => f.properties.name));
  schreibe("welt-gewaesser", { name: "Weitere Seen", gruppe: "topographisch", bereich: "welt", geometrie: "flaeche", quiz: false, quelle: QUELLE_NE },
    seen.filter((f) => !f.properties.name));

  const meere = await lies(finde(ordner.ne_10m_geography_marine_polys, "ne_10m_geography_marine_polys.shp"), "-simplify 30% keep-shapes");
  const MEER = { ocean: "ozean", sea: "meer", bay: "bucht", gulf: "golf", strait: "meerenge", channel: "meerenge", sound: "meerenge", fjord: "fjord", lagoon: "lagune" };
  schreibe("welt-meere", { name: "Ozeane und Meere", gruppe: "topographisch", bereich: "welt", geometrie: "flaeche", quiz: true, quelle: QUELLE_NE },
    meere.filter((f) => MEER[f.properties.featurecla] && nameDe(f.properties))
      .map((f) => feature(f.geometry, { id: slug(nameDe(f.properties)), name: nameDe(f.properties), art: MEER[f.properties.featurecla],
        rang: f.properties.scalerank })));
}

/** Natural-Earth-Regionen: Gebirge, Wüsten, Halbinseln, Inseln … */
const REGION = {
  "Range/mtn": "gebirge", "Desert": "wueste", "Plateau": "hochland", "Plain": "ebene", "Lowland": "tiefland", "Basin": "becken",
  "Depression": "senke", "Valley": "tal", "Delta": "delta", "Tundra": "tundra", "Wetlands": "feuchtgebiet", "Pen/cape": "halbinsel",
  "Peninsula": "halbinsel", "Isthmus": "landenge", "Island": "insel", "Island group": "inseln", "Coast": "kueste", "Geoarea": "region",
  "Foothills": "vorland", "Gorge": "schlucht",
};

async function weltRegionen(ordner) {
  const fs = await lies(finde(ordner.ne_10m_geography_regions_polys, "ne_10m_geography_regions_polys.shp"), "-simplify 25% keep-shapes");
  const alle = fs.filter((f) => REGION[f.properties.FEATURECLA])
    .map((f) => feature(f.geometry, { id: slug(nameDe(f.properties)), name: nameDe(f.properties), art: REGION[f.properties.FEATURECLA],
      rang: f.properties.SCALERANK }));
  schreibe("welt-gebirge", { name: "Gebirge der Welt", gruppe: "topographisch", bereich: "welt", geometrie: "flaeche", quiz: true, quelle: QUELLE_NE },
    alle.filter((f) => f.properties.art === "gebirge"));
  schreibe("welt-landschaften", { name: "Wüsten, Halbinseln, Inseln …", gruppe: "topographisch", bereich: "welt", geometrie: "flaeche", quiz: true, quelle: QUELLE_NE },
    alle.filter((f) => f.properties.art !== "gebirge"));

  const gipfel = await lies(finde(ordner.ne_10m_geography_regions_elevation_points, "ne_10m_geography_regions_elevation_points.shp"));
  schreibe("welt-gipfel", { name: "Berge der Welt", gruppe: "topographisch", bereich: "welt", geometrie: "punkt", quiz: true, quelle: QUELLE_NE },
    gipfel.filter((f) => f.properties.featurecla === "mountain" && nameDe(f.properties))
      .sort((a, b) => b.properties.elevation - a.properties.elevation)
      .map((f) => feature(f.geometry, { id: slug(nameDe(f.properties)), name: nameDe(f.properties), hoehe: Math.round(f.properties.elevation) })));
}

/**
 * Natural-Earth-Atlasraster (Plattkarte) → Web-Mercator-Kacheln z0–5,
 * /karten/welt-hoehen/{z}/{x}/{y}.webp
 */
async function weltHoehen(ordner) {
  const ZIEL_W = resolve(HIER, "../public/karten/welt-hoehen");
  const tif = await (await fromFile(finde(ordner.ne_hyp, "HYP_50M_SR_W.tif"))).getImage();
  const [B, H] = [tif.getWidth(), tif.getHeight()];
  const rgb = await tif.readRasters({ interleave: true });
  const kanaele = tif.getSamplesPerPixel();
  const MAXZ = 5, T = 256;
  rmSync(ZIEL_W, { recursive: true, force: true });
  let bytes = 0, anzahl = 0;
  for (let z = 0; z <= MAXZ; z++) {
    const n = 2 ** z;
    for (let tx = 0; tx < n; tx++) for (let ty = 0; ty < n; ty++) {
      const bild = Buffer.alloc(T * T * 3);
      for (let py = 0; py < T; py++) {
        const my = Math.PI * (1 - (2 * (ty * T + py + 0.5)) / (n * T));
        const lat = (Math.atan(Math.sinh(my)) * 180) / Math.PI;
        const sy = Math.min(H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * H)));
        for (let px = 0; px < T; px++) {
          const lon = ((tx * T + px + 0.5) / (n * T)) * 360 - 180;
          const sx = Math.min(B - 1, Math.floor(((lon + 180) / 360) * B));
          const q = (sy * B + sx) * kanaele, k = (py * T + px) * 3;
          bild[k] = rgb[q]; bild[k + 1] = rgb[q + 1]; bild[k + 2] = rgb[q + 2];
        }
      }
      const datei = join(ZIEL_W, String(z), String(tx), `${ty}.webp`);
      mkdirSync(dirname(datei), { recursive: true });
      await sharp(bild, { raw: { width: T, height: T, channels: 3 } }).webp({ quality: 72 }).toFile(datei);
      bytes += readFileSync(datei).length; anzahl++;
    }
  }
  KATALOG.push({ id: "welt-hoehen", name: "Relief (Welt)", gruppe: "topographisch", bereich: "welt", geometrie: "raster", quiz: false,
    quelle: QUELLE_NE, kachelUrl: "/karten/welt-hoehen/{z}/{x}/{y}.webp", maxzoom: MAXZ, bytes });
  console.log(`  welt-hoehen            ${anzahl} Kacheln  ${(bytes / 1e6).toFixed(2)} MB`);
}

// ── Höhenschichten ───────────────────────────────────────────────────

/** Atlasfarben (Tiefland grün → Gebirge braun), Höhe in m. */
export const HOEHENSTUFEN = [
  [-50, [92, 152, 96]], [0, [120, 172, 104]], [100, [160, 196, 120]], [200, [206, 218, 140]],
  [300, [234, 226, 150]], [500, [226, 196, 128]], [750, [208, 160, 104]], [1000, [184, 128, 88]],
  [1500, [156, 104, 80]], [2000, [140, 120, 112]], [2500, [236, 236, 240]],
];

function farbe(h) {
  let i = HOEHENSTUFEN.findIndex(([grenze]) => h < grenze);
  if (i === -1) return HOEHENSTUFEN[HOEHENSTUFEN.length - 1][1];
  if (i === 0) return HOEHENSTUFEN[0][1];
  const [h0, c0] = HOEHENSTUFEN[i - 1], [h1, c1] = HOEHENSTUFEN[i];
  const t = (h - h0) / (h1 - h0);
  return c0.map((c, k) => c + (c1[k] - c) * t);
}

/**
 * DGM200 (UTM32) → Web Mercator, eingefärbt und schattiert, als 2×2 Kacheln
 * (≤ 2400 px, damit auch schwache Grafikchips sie laden).
 */
async function hoehen(dgm, land) {
  const tif = await (await fromFile(finde(dgm, "dgm200_utm32s.tif"))).getImage();
  const [b, h] = [tif.getWidth(), tif.getHeight()];
  const [x0, y0] = tif.getOrigin();
  const [rx, ry] = tif.getResolution();
  const roh = (await tif.readRasters({ interleave: true }));
  const leer = Number(tif.getGDALNoData() ?? -9999);

  const utm = "+proj=utm +zone=32 +ellps=GRS80 +units=m +no_defs";
  const nachUtm = proj4("EPSG:4326", utm);
  const R = 6378137;
  const merc = ([lon, lat]) => [R * lon * Math.PI / 180, R * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360))];
  const lonlat = ([mx, my]) => [mx / R * 180 / Math.PI, (2 * Math.atan(Math.exp(my / R)) - Math.PI / 2) * 180 / Math.PI];

  const RAHMEN = [5.5, 47.0, 15.5, 55.2]; // lon/lat
  const [ml, mu] = merc([RAHMEN[0], RAHMEN[1]]), [mr, mo] = merc([RAHMEN[2], RAHMEN[3]]);
  const schritt = 200 * 1.55; // ≈ 200 m auf 51° Breite
  const B = Math.round((mr - ml) / schritt), H = Math.round((mo - mu) / schritt);

  const hoehe = (x, y) => { // bilinear im UTM-Raster
    const fx = (x - x0) / rx, fy = (y - y0) / ry;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    if (ix < 0 || iy < 0 || ix + 1 >= b || iy + 1 >= h) return NaN;
    const w = [roh[iy * b + ix], roh[iy * b + ix + 1], roh[(iy + 1) * b + ix], roh[(iy + 1) * b + ix + 1]];
    if (w.some((v) => v === leer || v < -500)) return NaN;
    const tx = fx - ix, ty = fy - iy;
    return (w[0] * (1 - tx) + w[1] * tx) * (1 - ty) + (w[2] * (1 - tx) + w[3] * tx) * ty;
  };

  const z = new Float32Array(B * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < B; i++) {
    const [x, y] = nachUtm.forward(lonlat([ml + (i + 0.5) * schritt, mo - (j + 0.5) * schritt]));
    z[j * B + i] = hoehe(x, y);
  }

  // Schummerung: Licht aus Nordwest, Höhen leicht überhöht
  const bild = Buffer.alloc(B * H * 4);
  for (let j = 0; j < H; j++) for (let i = 0; i < B; i++) {
    const k = j * B + i, v = z[k];
    if (Number.isNaN(v)) continue;
    const l = z[k - 1] ?? v, r = z[k + 1] ?? v, o = z[k - B] ?? v, u = z[k + B] ?? v;
    const dx = ((Number.isNaN(r) ? v : r) - (Number.isNaN(l) ? v : l)) / (2 * 200);
    const dy = ((Number.isNaN(u) ? v : u) - (Number.isNaN(o) ? v : o)) / (2 * 200);
    const n = [-dx * 3, -dy * 3, 1], len = Math.hypot(...n);
    const licht = (n[0] * -0.5 + n[1] * -0.5 + n[2] * 0.707) / len;
    const s = Math.min(1.15, 0.55 + 0.6 * licht);
    const c = farbe(v);
    bild[k * 4] = Math.min(255, c[0] * s); bild[k * 4 + 1] = Math.min(255, c[1] * s);
    bild[k * 4 + 2] = Math.min(255, c[2] * s); bild[k * 4 + 3] = 255;
  }

  // Das Raster reicht in Kacheln ins Meer: auf die Landesfläche zuschneiden
  const punkt = (p) => { const [mx, my] = merc(p); return `${((mx - ml) / schritt).toFixed(1)},${((mo - my) / schritt).toFixed(1)}`; };
  const ringe = land.flatMap((f) => (f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates.flat()));
  const maske = `<svg xmlns="http://www.w3.org/2000/svg" width="${B}" height="${H}"><path fill="#fff" fill-rule="evenodd" d="${
    ringe.map((r) => "M" + r.map(punkt).join("L") + "Z").join("")}"/></svg>`;
  const zugeschnitten = await sharp(bild, { raw: { width: B, height: H, channels: 4 } })
    .composite([{ input: Buffer.from(maske), blend: "dest-in" }]).raw().toBuffer();

  mkdirSync(HOEHEN, { recursive: true });
  const kacheln = [];
  const bh = Math.ceil(B / 2), hh = Math.ceil(H / 2);
  for (let ky = 0; ky < 2; ky++) for (let kx = 0; kx < 2; kx++) {
    const left = kx * bh, top = ky * hh, width = Math.min(bh, B - left), height = Math.min(hh, H - top);
    const datei = `de-${ky}${kx}.webp`;
    await sharp(zugeschnitten, { raw: { width: B, height: H, channels: 4 } })
      .extract({ left, top, width, height }).webp({ quality: 82, alphaQuality: 60 }).toFile(join(HOEHEN, datei));
    // Ecken in lon/lat: oben links, oben rechts, unten rechts, unten links (MapLibre-Reihenfolge)
    const ecke = (i, j) => lonlat([ml + i * schritt, mo - j * schritt]).map((w) => +w.toFixed(5));
    kacheln.push({ datei, ecken: [ecke(left, top), ecke(left + width, top), ecke(left + width, top + height), ecke(left, top + height)] });
  }
  const bytes = kacheln.reduce((s, k) => s + readFileSync(join(HOEHEN, k.datei)).length, 0);
  KATALOG.push({ id: "de-hoehen", name: "Höhenschichten", gruppe: "topographisch", bereich: "de", geometrie: "raster", quiz: false,
    quelle: QUELLE_BKG, kacheln, stufen: HOEHENSTUFEN.map(([m, c]) => ({ ab: m, farbe: `rgb(${c.join(",")})` })), bytes });
  console.log(`  de-hoehen              ${B}×${H} px  ${(bytes / 1e6).toFixed(2)} MB`);
}

// ── Wirtschaft und Bevölkerung (Deutschland) ─────────────────────────

const QUELLE_OPSD = { name: "Open Power System Data (Stand 01.10.2020; BNetzA, UBA), bearbeitet", lizenz: "CC-BY 4.0",
  url: "https://data.open-power-system-data.org/conventional_power_plants/" };

/** Einfacher CSV-Leser (Felder in Anführungszeichen dürfen Kommas enthalten). */
function liesCsv(text) {
  const zeilen = text.split(/\r?\n/).filter(Boolean);
  const teile = (z) => { const o = []; let c = "", q = false; for (const ch of z) { if (ch === '"') q = !q; else if (ch === "," && !q) { o.push(c); c = ""; } else c += ch; } o.push(c); return o; };
  const kopf = teile(zeilen[0]);
  return zeilen.slice(1).map((z) => Object.fromEntries(teile(z).map((w, i) => [kopf[i], w])));
}

const ENERGIE = {
  "Lignite": "braunkohle", "Hard coal": "steinkohle", "Natural gas": "erdgas", "Nuclear": "kernenergie", "Oil": "erdoel",
  "Hydro": "wasser", "Biomass and biogas": "biomasse", "Bioenergy": "biomasse", "Waste": "abfall", "Non-renewable waste": "abfall",
};
export const ENERGIE_LEGENDE = [
  { wert: "braunkohle", text: "Braunkohle", farbe: "#8b5a2b" }, { wert: "steinkohle", text: "Steinkohle", farbe: "#333333" },
  { wert: "erdgas", text: "Erdgas", farbe: "#f2a33a" }, { wert: "erdoel", text: "Erdöl", farbe: "#7b3294" },
  { wert: "kernenergie", text: "Kernenergie", farbe: "#e41a1c" }, { wert: "wasser", text: "Wasserkraft", farbe: "#2b83ba" },
  { wert: "biomasse", text: "Biomasse", farbe: "#4daf4a" }, { wert: "abfall", text: "Abfall", farbe: "#999999" },
];

/**
 * Große Kraftwerke (≥ 100 MW, in Betrieb). Die Liste führt einzelne Blöcke —
 * zusammengefasst wird je Standort, Energieträger und Koordinate.
 * Die deutschen Kernkraftwerke sind seit dem 15.04.2023 abgeschaltet.
 */
function kraftwerke(csv, laender, id, name, bereich) {
  const standorte = new Map();
  for (const z of liesCsv(readFileSync(csv, "utf8"))) {
    const art = ENERGIE[z.energy_source];
    const leistung = Number(z.capacity_net_bnetza || z.capacity);
    const [lat, lon] = [Number(z.lat), Number(z.lon)];
    const land = (z.country || "").trim();
    if (!art || !lat || !lon || !(leistung > 0)) continue;
    if (z.status && z.status !== "operating") continue;
    if (laender && !laender.includes(land)) continue;
    if (art === "kernenergie" && land === "DE") continue; // Atomausstieg 2023
    const ort = (z.name_bnetza || z.name || z.name_uba || "Kraftwerk").trim();
    const schluessel = `${ort}|${art}|${lat.toFixed(3)}|${lon.toFixed(3)}`;
    const s = standorte.get(schluessel) ?? { ort, art, lat, lon, land, leistung: 0 };
    s.leistung += leistung;
    standorte.set(schluessel, s);
  }
  const fs = [...standorte.values()].filter((s) => s.leistung >= 100)
    .sort((a, b) => b.leistung - a.leistung)
    .map((s) => feature({ type: "Point", coordinates: [s.lon, s.lat] }, {
      id: `kw-${slug(`${s.ort}-${s.art}`)}`, name: s.ort, art: s.art, leistung: Math.round(s.leistung),
      ...(bereich === "welt" ? { land: s.land } : {}),
    }));
  schreibe(id, { name, gruppe: "wirtschaft", bereich, geometrie: "punkt", quiz: true, quelle: QUELLE_OPSD,
    darstellung: { feld: "art", art: "kategorie", werte: ENERGIE_LEGENDE, groesse: { feld: "leistung", max: 4000 } } }, fs);
}

const BERGBAU_LEGENDE = [
  { wert: "braunkohle", text: "Braunkohle (Tagebau)", farbe: "#8b5a2b" }, { wert: "kali", text: "Kali und Salz", farbe: "#d6604d" },
  { wert: "steine", text: "Steine und Erden, Kalk", farbe: "#bababa" }, { wert: "torf", text: "Torf", farbe: "#a6761d" },
  { wert: "steinkohle", text: "Steinkohle (stillgelegt, bis 2018)", farbe: "#333333" },
  { wert: "erz", text: "Erz, Graphit, Spat", farbe: "#542788" },
  { wert: "historisch", text: "Besucherbergwerk, alte Grube", farbe: "#c7c7c7" },
];

/** Bergbau: Tagebaue (DLM1000, Mittelpunkt) und Bergbaubetriebe (GN250). */
async function bergbau(dlm, gn) {
  const AGT = { 4021: "braunkohle", 4010: "torf", 1000: "steine", 2000: "steine" };
  const tagebaue = await lies(finde(dlm, "sie02_f.shp"), `-filter "OBJART_TXT=='AX_TagebauGrubeSteinbruch' && NAM != ''" -dissolve NAM copy-fields=AGT -points inner`);
  const betriebe = await lies(finde(gn, "GN250_p.shp"), `-filter "OBA=='AX_BauwerkOderAnlageFuerIndustrieUndGewerbe' && OBA_WERT=='Bergbaubetrieb'"`);
  const art = (n) => /kali|salz/i.test(n) ? "kali"
    : /braunkohle|tagebau/i.test(n) ? "braunkohle"
    : /besucher|schau|museum/i.test(n) ? "historisch"
    : /zeche|steinkohle|prosper|walsum|auguste victoria|göttelborn|ensdorf|ibbenbüren|merlebach|haard/i.test(n) ? "steinkohle"
    : /erz|zinn|silber|blei|uran|wismut|graphit|spat|kupfer/i.test(n) ? "erz"
    : /kalk|kies|sand|stein|ton|kaolin|gips|quarz/i.test(n) ? "steine" : "historisch";
  const fs = [
    ...tagebaue.map((f) => feature(f.geometry, { id: `tb-${slug(f.properties.NAM)}`, name: f.properties.NAM, art: AGT[f.properties.AGT] ?? art(f.properties.NAM) })),
    ...betriebe.map((f) => feature(f.geometry, { id: f.properties.NNID, name: f.properties.NAME, art: art(f.properties.NAME) })),
  ];
  schreibe("de-bergbau", { name: "Bergbau und Rohstoffe", gruppe: "wirtschaft", bereich: "de", geometrie: "punkt", quiz: true, quelle: QUELLE_BKG,
    darstellung: { feld: "art", art: "kategorie", werte: BERGBAU_LEGENDE } }, fs);
}

/** Industrie- und Gewerbeflächen (DLM250), zusammengefasst und vereinfacht. */
async function industrie(dlm250) {
  const fs = await lies(finde(dlm250, "sie02_f.shp"),
    `-filter "OBJART_TXT=='AX_IndustrieUndGewerbeflaeche'" -each "art='industrie'" -dissolve2 art -explode -filter "this.area > 400000" -simplify 30% keep-shapes`);
  schreibe("de-industrie", { name: "Industrie- und Gewerbeflächen", gruppe: "wirtschaft", bereich: "de", geometrie: "flaeche", quiz: false,
    quelle: QUELLE_BKG, darstellung: { feld: "art", art: "kategorie", werte: [{ wert: "industrie", text: "Industrie und Gewerbe", farbe: "#b2182b" }] } },
    fs.map((f, i) => feature(f.geometry, { id: `ind-${i + 1}`, name: "", art: "industrie" })));
}

/** Sonderkulturen: Wein, Obst, Hopfen (DLM250, VEG 1040/1050/1012). */
async function sonderkulturen(dlm250) {
  const fs = await lies(finde(dlm250, "veg01_f.shp"), `-each "art=({1040:'wein',1050:'obst',1012:'hopfen'})[VEG] || ''" -filter "art !== ''" -dissolve2 art -explode -simplify 30% keep-shapes`);
  schreibe("de-sonderkulturen", { name: "Sonderkulturen (Wein, Obst, Hopfen)", gruppe: "wirtschaft", bereich: "de", geometrie: "flaeche", quiz: false,
    quelle: QUELLE_BKG, darstellung: { feld: "art", art: "kategorie", werte: [
      { wert: "wein", text: "Weinbau", farbe: "#7b2d8b" }, { wert: "obst", text: "Obstbau", farbe: "#e7298a" }, { wert: "hopfen", text: "Hopfen", farbe: "#66a61e" }] } },
    fs.map((f, i) => feature(f.geometry, { id: `sk-${i + 1}`, name: "", art: f.properties.art })));

}

/** Verkehr: Autobahnen, Fernbahn (VKD 1000 = überregional), Flughäfen. */
async function verkehr(dlm, dlm250) {
  const ab = await lies(finde(dlm, "ver01_l.shp"), `-filter "WDM=='1301'" -each "nr=(BEZ||'').split('#').find(function(b){return /^A/.test(b)})||''" -dissolve nr -simplify 30%`);
  schreibe("de-autobahnen", { name: "Autobahnen", gruppe: "wirtschaft", bereich: "de", geometrie: "linie", quiz: true, quelle: QUELLE_BKG,
    darstellung: { feld: "art", art: "kategorie", werte: [{ wert: "autobahn", text: "Autobahn", farbe: "#e6550d" }] } },
    ab.filter((f) => f.properties.nr).map((f) => feature(f.geometry, { id: slug(f.properties.nr), name: f.properties.nr, art: "autobahn" })));

  const bahn = await lies(finde(dlm, "ver03_l.shp"), `-filter "OBJART_TXT=='AX_Bahnstrecke' && VKD=='1000'" -each "art='fernbahn'" -dissolve art -simplify 30%`);
  schreibe("de-bahn", { name: "Fernbahnstrecken", gruppe: "wirtschaft", bereich: "de", geometrie: "linie", quiz: false, quelle: QUELLE_BKG,
    darstellung: { feld: "art", art: "kategorie", werte: [{ wert: "fernbahn", text: "Fernbahn", farbe: "#404040" }] } },
    bahn.map((f) => feature(f.geometry, { id: "fernbahn", name: "", art: "fernbahn" })));

  const fh = await lies(finde(dlm250, "ver04_f.shp"), `-filter "(ART=='5511' || ART=='5512') && NAM != ''" -dissolve NAM copy-fields=ART -points inner`);
  schreibe("de-flughaefen", { name: "Flughäfen", gruppe: "wirtschaft", bereich: "de", geometrie: "punkt", quiz: true, quelle: QUELLE_BKG,
    darstellung: { feld: "art", art: "kategorie", werte: [
      { wert: "international", text: "Internationaler Flughafen", farbe: "#08519c" }, { wert: "regional", text: "Regionalflughafen", farbe: "#6baed6" }] } },
    fh.map((f) => feature(f.geometry, { id: slug(f.properties.NAM), name: f.properties.NAM, art: f.properties.ART === "5511" ? "international" : "regional" })));
}

/** CORINE-Klassen → Kategorien der Schulatlas-Karte »Bodennutzung«. */
const CLC_SCHULE = {
  111: "siedlung", 112: "siedlung", 121: "industrie", 122: "industrie", 123: "industrie", 124: "industrie",
  131: "abbau", 132: "abbau", 133: "abbau", 141: "siedlung", 142: "siedlung",
  211: "ackerland", 242: "ackerland", 221: "sonderkultur", 222: "sonderkultur", 231: "gruenland", 243: "gruenland",
  311: "wald", 312: "wald", 313: "wald", 321: "heide", 322: "heide", 324: "heide", 333: "heide",
  411: "moor", 412: "moor", 421: "kueste", 423: "kueste", 331: "kueste",
};
export const BODEN_LEGENDE = [
  { wert: "ackerland", text: "Ackerland", farbe: "#f3e08a" }, { wert: "gruenland", text: "Grünland", farbe: "#a6d96a" },
  { wert: "sonderkultur", text: "Wein- und Obstbau", farbe: "#b15928" }, { wert: "wald", text: "Wald", farbe: "#33a02c" },
  { wert: "heide", text: "Heide, Gebüsch", farbe: "#c2a5cf" }, { wert: "moor", text: "Moor, Sumpf", farbe: "#8073ac" },
  { wert: "kueste", text: "Watt, Strand, Salzwiesen", farbe: "#e0d3b8" }, { wert: "siedlung", text: "Siedlung", farbe: "#e31a1c" },
  { wert: "industrie", text: "Industrie, Gewerbe, Verkehr", farbe: "#7a0177" }, { wert: "abbau", text: "Abbauflächen (Tagebau)", farbe: "#6a3d0a" },
];

/**
 * Bodennutzung aus CORINE Land Cover 2018 (BKG, 5 ha). Die Rohdaten sind
 * 4,8 GB groß und nach Hauptklassen in fünf Dateien geteilt: jede zuerst auf
 * 1,2 km vereinfachen, dann nach Schulkategorie zusammenfassen, Flecken unter
 * 6 km² weglassen. Ackerland bleibt die Grundfarbe der Landfläche.
 */
async function bodennutzung(clc) {
  const teile = [];
  for (const klasse of ["1xx", "2xx", "3xx", "4xx"]) {
    const shp = finde(clc, `clc5_class${klasse}.shp`).replace(/\\/g, "/");
    // Stufe 1 (UTM): vereinfachen, je CORINE-Code zusammenfassen
    const roh = await mapshaper.applyCommands(`-i "${shp}" -simplify interval=1200 planar keep-shapes -dissolve2 CLC18 -o format=geojson out.json`);
    // Ackerland nicht als Fläche: es ist die Grundfarbe (Darstellung.grundfarbe) — spart 2 MB
    const nachCode = JSON.parse(roh["out.json"].toString()).features
      .map((f) => ({ ...f, properties: { art: CLC_SCHULE[f.properties.CLC18] ?? "" } }))
      .filter((f) => f.properties.art && f.properties.art !== "ackerland");
    // Stufe 2: je Schulkategorie zusammenfassen, kleine Flecken weg, nach WGS84
    const aus = await mapshaper.applyCommands(
      `-i in.json -dissolve2 art -explode -filter "this.area > 6000000" -simplify interval=900 planar keep-shapes -proj wgs84 from="+proj=utm +zone=32 +ellps=GRS80 +units=m" ` +
      `-o format=geojson precision=0.001 out.json`, { "in.json": { type: "FeatureCollection", features: nachCode } });
    teile.push(...JSON.parse(aus["out.json"].toString()).features);
    console.log(`    CORINE ${klasse}: ${teile.length} Flächen`);
  }
  schreibe("de-bodennutzung", { name: "Bodennutzung (CORINE 2018)", gruppe: "wirtschaft", bereich: "de", geometrie: "flaeche", quiz: false,
    quelle: { ...QUELLE_BKG, name: `${QUELLE_BKG.name}, CORINE Land Cover 2018` },
    darstellung: { feld: "art", art: "kategorie", werte: BODEN_LEGENDE, grundfarbe: BODEN_LEGENDE[0].farbe } },
    teile.map((f, i) => feature(f.geometry, { id: `bn-${i + 1}`, name: "", art: f.properties.art })));
}

/** Bevölkerungsdichte der Kreise (VG250-EW: Einwohner, Fläche in km²). */
async function bevoelkerung(vgew) {
  const fs = await lies(finde(vgew, "VG250_KRS.shp"), `-filter "GF==4" -simplify 12% keep-shapes`);
  schreibe("de-dichte", { name: "Bevölkerungsdichte (Kreise)", gruppe: "bevoelkerung", bereich: "de", geometrie: "flaeche", quiz: true, quelle: QUELLE_BKG,
    darstellung: { feld: "dichte", art: "stufen", einheit: "Einw./km²", werte: [
      { wert: 0, text: "unter 100", farbe: "#fff5eb" }, { wert: 100, text: "100 – 200", farbe: "#fdd0a2" },
      { wert: 200, text: "200 – 500", farbe: "#fd8d3c" }, { wert: 500, text: "500 – 1 000", farbe: "#e6550d" },
      { wert: 1000, text: "1 000 – 2 000", farbe: "#a63603" }, { wert: 2000, text: "über 2 000", farbe: "#5a1d02" }] } },
    fs.map((f) => feature(f.geometry, { id: f.properties.AGS, name: `${f.properties.GEN}${/Landkreis|Kreis$/.test(f.properties.BEZ) ? " (Kreis)" : ""}`,
      einwohner: f.properties.EWZ, dichte: Math.round(f.properties.EWZ / f.properties.KFL) })));
}

// ── Physische Geografie: Platten, Wüsten, Klimazonen ──────────────────

const QUELLE_BIRD = { name: "Bird (2003), PB2002 / Ahlenius (fraxen/tectonicplates), bearbeitet", lizenz: "ODC-BY 1.0",
  url: "https://github.com/fraxen/tectonicplates" };
const QUELLE_KOEPPEN = { name: "Beck et al. (2023), Köppen-Geiger 1991–2020, bearbeitet", lizenz: "CC BY 4.0",
  url: "https://doi.org/10.6084/m9.figshare.21789074" };

const PLATTE_DE = {
  "Africa": "Afrikanische Platte", "Antarctica": "Antarktische Platte", "Somalia": "Somalische Platte", "India": "Indische Platte",
  "Australia": "Australische Platte", "Eurasia": "Eurasische Platte", "North America": "Nordamerikanische Platte",
  "South America": "Südamerikanische Platte", "Nazca": "Nazca-Platte", "Pacific": "Pazifische Platte", "Arabia": "Arabische Platte",
  "Sunda": "Sunda-Platte", "Caribbean": "Karibische Platte", "Cocos": "Cocos-Platte", "Okhotsk": "Ochotskische Platte",
  "Juan de Fuca": "Juan-de-Fuca-Platte", "Philippine Sea": "Philippinische Platte", "Amur": "Amur-Platte", "Scotia": "Scotia-Platte",
  "Anatolia": "Anatolische Platte", "Aegean Sea": "Ägäische Platte", "Yangtze": "Jangtse-Platte", "Caroline": "Karolinen-Platte",
  "Mariana": "Marianen-Platte", "Panama": "Panama-Platte", "Rivera": "Rivera-Platte", "Burma": "Burma-Platte", "Tonga": "Tonga-Platte",
};

const GRENZE = { OSR: "divergent", CRB: "divergent", OTF: "transform", CTF: "transform", SUB: "subduktion", OCB: "kollision", CCB: "kollision" };

async function platten(roh) {
  const p = JSON.parse(readFileSync(await roh("PB2002_plates.json", "https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_plates.json"), "utf8"));
  // Mehrteilige Platten (Kermadec, Balmoral Reef) haben zwei Einträge — zusammenfassen
  const zusammen = await mapshaper.applyCommands("-i in.json -dissolve Code copy-fields=PlateName -o format=geojson precision=0.001 out.json",
    { "in.json": p });
  const grosse = new Set(["AF", "AN", "IN", "AU", "EU", "NA", "SA", "NZ", "PA"]);
  schreibe("welt-platten", { name: "Lithosphärenplatten", gruppe: "topographisch", bereich: "welt", geometrie: "flaeche", quiz: true, quelle: QUELLE_BIRD,
    darstellung: { feld: "groesse", art: "kategorie", werte: [
      { wert: "gross", text: "große Platte", farbe: "#d9c7a3" }, { wert: "klein", text: "kleinere Platte", farbe: "#efe3c8" }] } },
    JSON.parse(zusammen["out.json"].toString()).features.map((f) => feature(f.geometry, {
      id: slug(f.properties.Code), name: PLATTE_DE[f.properties.PlateName] ?? `${f.properties.PlateName} (Mikroplatte)`,
      groesse: grosse.has(f.properties.Code) ? "gross" : "klein" })));

  // Grenzen: Birds Schritte (wenige km) je Grenze und Art zu Linien zusammenfassen
  const s = JSON.parse(readFileSync(await roh("PB2002_steps.json", "https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_steps.json"), "utf8"));
  const schritte = s.features.map((f) => ({ ...f, properties: { grenze: f.properties.PLATEBOUND, art: GRENZE[f.properties.STEPCLASS] ?? "transform",
    v: f.properties.VELOCITYLE } }));
  const linien = await mapshaper.applyCommands("-i in.json -dissolve grenze,art calc='mm=Math.round(average(v))' -simplify 15% -o format=geojson precision=0.01 out.json",
    { "in.json": { type: "FeatureCollection", features: schritte } });
  const namen = Object.fromEntries(p.features.map((f) => [f.properties.Code, PLATTE_DE[f.properties.PlateName] ?? f.properties.PlateName]));
  schreibe("welt-plattengrenzen", { name: "Plattengrenzen", gruppe: "topographisch", bereich: "welt", geometrie: "linie", quiz: false, quelle: QUELLE_BIRD,
    darstellung: { feld: "art", art: "kategorie", werte: [
      { wert: "divergent", text: "divergent (Rücken, Grabenbruch)", farbe: "#d7301f" },
      { wert: "subduktion", text: "konvergent: Subduktion", farbe: "#2b6cb0" },
      { wert: "kollision", text: "konvergent: Kollision", farbe: "#6a3d9a" },
      { wert: "transform", text: "Transformstörung", farbe: "#1a9850" }] } },
    JSON.parse(linien["out.json"].toString()).features.map((f, i) => {
      const [a, b] = f.properties.grenze.split(/[-\/\\]/);
      return feature(f.geometry, { id: `pg-${i + 1}`, name: `${namen[a] ?? a} / ${namen[b] ?? b}`, art: f.properties.art, mm: f.properties.mm });
    }));
}

/** Große Wüsten als eigene Ebene (aus den Natural-Earth-Regionen). */
async function wuesten(ordner) {
  const fs = await lies(finde(ordner.ne_10m_geography_regions_polys, "ne_10m_geography_regions_polys.shp"), `-filter "FEATURECLA=='Desert'" -simplify 25% keep-shapes`);
  schreibe("welt-wuesten", { name: "Wüsten", gruppe: "topographisch", bereich: "welt", geometrie: "flaeche", quiz: true, quelle: QUELLE_NE,
    darstellung: { feld: "art", art: "kategorie", werte: [{ wert: "wueste", text: "Wüste", farbe: "#f2c879" }] } },
    fs.map((f) => feature(f.geometry, { id: slug(nameDe(f.properties)), name: nameDe(f.properties), art: "wueste", rang: f.properties.SCALERANK })));
}

/** Köppen-Geiger 1991–2020: Klassen 1–30 → Farbe (Beck et al.) und Hauptzone A–E. */
const KOEPPEN = [
  [null], ["Af", [0, 0, 255]], ["Am", [0, 120, 255]], ["Aw", [70, 170, 250]], ["BWh", [255, 0, 0]], ["BWk", [255, 150, 150]],
  ["BSh", [245, 165, 0]], ["BSk", [255, 220, 100]], ["Csa", [255, 255, 0]], ["Csb", [200, 200, 0]], ["Csc", [150, 150, 0]],
  ["Cwa", [150, 255, 150]], ["Cwb", [100, 200, 100]], ["Cwc", [50, 150, 50]], ["Cfa", [200, 255, 80]], ["Cfb", [100, 255, 80]],
  ["Cfc", [50, 200, 0]], ["Dsa", [255, 0, 255]], ["Dsb", [200, 0, 200]], ["Dsc", [150, 50, 150]], ["Dsd", [150, 100, 150]],
  ["Dwa", [170, 175, 255]], ["Dwb", [90, 120, 220]], ["Dwc", [75, 80, 180]], ["Dwd", [50, 0, 135]], ["Dfa", [0, 255, 255]],
  ["Dfb", [55, 200, 255]], ["Dfc", [0, 125, 125]], ["Dfd", [0, 70, 95]], ["ET", [178, 178, 178]], ["EF", [102, 102, 102]],
];
const KOEPPEN_TEXT = {
  Af: "tropisches Regenwaldklima", Am: "tropisches Monsunklima", Aw: "Savannenklima", BWh: "heißes Wüstenklima", BWk: "kaltes Wüstenklima",
  BSh: "heißes Steppenklima", BSk: "kaltes Steppenklima", Csa: "Mittelmeerklima, heißer Sommer", Csb: "Mittelmeerklima, warmer Sommer",
  Csc: "Mittelmeerklima, kühler Sommer", Cwa: "wintertrocken, heißer Sommer", Cwb: "wintertrocken, warmer Sommer",
  Cwc: "wintertrocken, kühler Sommer", Cfa: "feucht, heißer Sommer", Cfb: "feucht, warmer Sommer (Seeklima)", Cfc: "feucht, kühler Sommer",
  Dsa: "kontinental, sommertrocken, heiß", Dsb: "kontinental, sommertrocken, warm", Dsc: "kontinental, sommertrocken, kühl",
  Dsd: "kontinental, sommertrocken, sehr kalter Winter", Dwa: "kontinental, wintertrocken, heiß", Dwb: "kontinental, wintertrocken, warm",
  Dwc: "kontinental, wintertrocken, kühl", Dwd: "kontinental, wintertrocken, sehr kalter Winter", Dfa: "kontinental, feucht, heißer Sommer",
  Dfb: "kontinental, feucht, warmer Sommer", Dfc: "subarktisch (boreal)", Dfd: "subarktisch, sehr kalter Winter",
  ET: "Tundrenklima", EF: "Eisklima",
};
const HAUPTZONEN = [
  { wert: "A", text: "A – tropisches Klima", farbe: [36, 99, 214] }, { wert: "B", text: "B – Trockenklima", farbe: [232, 131, 58] },
  { wert: "C", text: "C – warmgemäßigtes Klima", farbe: [91, 180, 70] }, { wert: "D", text: "D – kaltgemäßigtes (boreales) Klima", farbe: [122, 92, 196] },
  { wert: "E", text: "E – Polarklima", farbe: [170, 170, 170] },
];

async function klimazonen(koeppen) {
  const pfad = finde(join(koeppen, "1991_2020"), "koppen_geiger_0p1.tif");
  const bild = await (await fromFile(pfad)).getImage();
  const [B, H] = [bild.getWidth(), bild.getHeight()];
  const raster = (await bild.readRasters())[0];
  const hauptzone = (k) => (k >= 1 && k <= 3 ? 0 : k <= 7 ? 1 : k <= 16 ? 2 : k <= 28 ? 3 : 4);
  for (const [id, name, farbeVon, legende] of [
    ["welt-klima-haupt", "Klimazonen (Köppen, Hauptzonen)", (k) => HAUPTZONEN[hauptzone(k)].farbe,
      HAUPTZONEN.map((z) => ({ wert: z.wert, text: z.text, farbe: `rgb(${z.farbe.join(",")})` }))],
    ["welt-klima-typen", "Klimatypen (Köppen-Geiger)", (k) => KOEPPEN[k][1],
      KOEPPEN.slice(1).map(([c, f]) => ({ wert: c, text: `${c} – ${KOEPPEN_TEXT[c]}`, farbe: `rgb(${f.join(",")})` }))],
  ]) {
    const ziel = resolve(HIER, `../public/karten/${id}`);
    rmSync(ziel, { recursive: true, force: true });
    let bytes = 0, anzahl = 0;
    const MAXZ = 5, T = 256;
    for (let z = 0; z <= MAXZ; z++) {
      const n = 2 ** z;
      for (let tx = 0; tx < n; tx++) for (let ty = 0; ty < n; ty++) {
        const px = Buffer.alloc(T * T * 4);
        let leer = true;
        for (let y = 0; y < T; y++) {
          const my = Math.PI * (1 - (2 * (ty * T + y + 0.5)) / (n * T));
          const lat = (Math.atan(Math.sinh(my)) * 180) / Math.PI;
          const sy = Math.min(H - 1, Math.max(0, Math.floor((90 - lat) / 0.1)));
          for (let x = 0; x < T; x++) {
            const lon = ((tx * T + x + 0.5) / (n * T)) * 360 - 180;
            const sx = Math.min(B - 1, Math.max(0, Math.floor((lon + 180) / 0.1)));
            const k = raster[sy * B + sx];
            if (!k) continue;
            const c = farbeVon(k);
            const o = (y * T + x) * 4;
            px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
            leer = false;
          }
        }
        if (leer) continue; // reine Meereskacheln weglassen (404 = durchsichtig)
        const datei = join(ziel, String(z), String(tx), `${ty}.png`);
        mkdirSync(dirname(datei), { recursive: true });
        await sharp(px, { raw: { width: T, height: T, channels: 4 } }).png({ palette: true, compressionLevel: 9 }).toFile(datei);
        bytes += readFileSync(datei).length; anzahl++;
      }
    }
    KATALOG.push({ id, name, gruppe: "topographisch", bereich: "welt", geometrie: "raster", quiz: false, quelle: QUELLE_KOEPPEN,
      kachelUrl: `/karten/${id}/{z}/{x}/{y}.png`, maxzoom: MAXZ, bytes,
      darstellung: { feld: "klasse", art: "kategorie", werte: legende } });
    console.log(`  ${id.padEnd(22)} ${anzahl} Kacheln  ${(bytes / 1e6).toFixed(2)} MB`);
  }
}

// ── Schriften ────────────────────────────────────────────────────────

/** Latein, Latein-Erweiterung A (Nachbarländer) und Satzzeichen (– „ “). */
const BEREICHE = ["0-255", "256-511", "8192-8447"];
export const SCHRIFTARTEN = ["Noto Sans Regular", "Noto Sans Bold", "Noto Sans Italic"];

async function schriften() {
  for (const art of SCHRIFTARTEN) for (const bereich of BEREICHE) {
    const datei = join(SCHRIFTEN, art, `${bereich}.pbf`);
    if (existsSync(datei) && !force) continue;
    mkdirSync(dirname(datei), { recursive: true });
    for (let versuch = 1; ; versuch++) {
      const antwort = await fetch(`https://demotiles.maplibre.org/font/${encodeURIComponent(art)}/${bereich}.pbf`).catch(() => null);
      if (antwort?.ok) { writeFileSync(datei, Buffer.from(await antwort.arrayBuffer())); break; }
      if (versuch === 4) throw new Error(`Schrift ${art} ${bereich} nicht ladbar`);
      await new Promise((weiter) => setTimeout(weiter, 2000 * versuch));
    }
  }
  console.log(`  Schriften: ${SCHRIFTARTEN.join(", ")}`);
}

// ── Ablauf ───────────────────────────────────────────────────────────

mkdirSync(ROH, { recursive: true });
mkdirSync(join(ZIEL, "ebenen"), { recursive: true });

const ordner = {};
for (const k of Object.keys(PAKETE)) ordner[k] = await lade(k);

// `--nur boden,kraftwerke` baut nur diese Schritte neu und ergänzt den bestehenden Katalog
const nurStelle = process.argv.indexOf("--nur");
const nur = nurStelle > 0 ? process.argv[nurStelle + 1].split(",") : null;
const schritt = async (name, f) => { if (!nur || nur.includes(name)) await f(); };
let land, kontinentVon;

console.log("Ebenen:");
await schritt("laender", async () => { land = await laender(ordner.vg2500); });
await schritt("staedte", () => staedte(ordner.gn250));
await schritt("gipfel", () => gipfel(ordner.gn250));
await schritt("landschaften", () => landschaften(ordner.dlm1000));
await schritt("fluesse", () => fluesse(ordner.dlm1000));
await schritt("gewaesser", () => gewaesserflaechen(ordner.dlm1000));
await schritt("hoehen", async () => hoehen(ordner.dgm200, land ?? await laender(ordner.vg2500)));
await schritt("staaten", async () => { kontinentVon = await staaten(ordner.ne_staaten); });
await schritt("weltstaedte", async () => weltStaedte(ordner.ne_10m_populated_places, kontinentVon ?? await staaten(ordner.ne_staaten)));
await schritt("weltgewaesser", () => weltGewaesser(ordner));
await schritt("weltregionen", () => weltRegionen(ordner));
await schritt("welthoehen", () => weltHoehen(ordner));
await schritt("kraftwerke", async () => kraftwerke(await ladeDatei("opsd_de.csv",
  "https://data.open-power-system-data.org/conventional_power_plants/latest/conventional_power_plants_DE.csv"),
  null, "de-kraftwerke", "Kraftwerke (ab 100 MW)", "de"));
await schritt("bergbau", () => bergbau(ordner.dlm1000, ordner.gn250));
await schritt("industrie", () => industrie(ordner.dlm250));
await schritt("sonderkulturen", () => sonderkulturen(ordner.dlm250));
await schritt("verkehr", () => verkehr(ordner.dlm1000, ordner.dlm250));
await schritt("bevoelkerung", () => bevoelkerung(ordner.vg250ew));
await schritt("boden", () => bodennutzung(ordner.clc5));
await schritt("platten", () => platten(ladeDatei));
await schritt("wuesten", () => wuesten(ordner));
await schritt("klima", () => klimazonen(ordner.koeppen));
await schritt("schriften", () => schriften());

let ebenen = KATALOG;
if (nur) {
  const alt = JSON.parse(readFileSync(join(ZIEL, "ebenen.json"), "utf8")).ebenen;
  const neu = new Map(KATALOG.map((e) => [e.id, e]));
  ebenen = [...alt.map((e) => neu.get(e.id) ?? e), ...KATALOG.filter((e) => !alt.some((a) => a.id === e.id))];
}
writeFileSync(join(ZIEL, "ebenen.json"), JSON.stringify({ stand: new Date().toISOString().slice(0, 10), ebenen }, null, 2));
console.log(`Katalog: ${join(ZIEL, "ebenen.json")}`);
