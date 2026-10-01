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
  schreibe("de-laender", { name: "Bundesländer", gruppe: "politisch", geometrie: "flaeche", quiz: true, quelle: QUELLE_BKG }, land);
  return land;
}

const LANDESHAUPTSTAEDTE = ["Kiel", "Hamburg", "Schwerin", "Bremen", "Hannover", "Magdeburg", "Potsdam", "Düsseldorf",
  "Wiesbaden", "Erfurt", "Dresden", "Mainz", "Saarbrücken", "Stuttgart", "München", "Berlin"];

async function staedte(gn) {
  const alle = await lies(finde(gn, "GN250_p.shp"), `-filter "OBA=='AX_Gemeinde' && EWZ >= 20000"`);
  const fs = alle.map((f) => {
    const p = f.properties;
    const rang = p.NAME === "Berlin" ? "hauptstadt"
      : LANDESHAUPTSTAEDTE.includes(p.NAME) ? "landeshauptstadt"
      : p.EWZ >= 100000 ? "grossstadt" : "mittelstadt";
    return feature(f.geometry, { id: p.AGS, name: p.NAME, ew: p.EWZ, rang, land: p.BUNDESLAND });
  });
  const fehlt = LANDESHAUPTSTAEDTE.filter((n) => !fs.some((f) => f.properties.name === n));
  if (fehlt.length) throw new Error(`Landeshauptstädte fehlen: ${fehlt.join(", ")}`);
  fs.sort((a, b) => b.properties.ew - a.properties.ew);
  schreibe("de-staedte", { name: "Städte", gruppe: "politisch", geometrie: "punkt", quiz: true, quelle: QUELLE_BKG }, fs);
}

async function gipfel(gn) {
  const fs = await lies(finde(gn, "GN250_p.shp"), `-filter "OBA=='Besonderer_Hoehenpunkt' && HOEHE > 0"`);
  fs.sort((a, b) => b.properties.HOEHE - a.properties.HOEHE);
  schreibe("de-gipfel", { name: "Berge und Gipfel", gruppe: "topographisch", geometrie: "punkt", quiz: true, quelle: QUELLE_BKG },
    fs.map((f) => feature(f.geometry, { id: f.properties.NNID, name: f.properties.NAME, hoehe: Math.round(f.properties.HOEHE), land: f.properties.BUNDESLAND })));
}

/** LTP-Schlüssel der DLM-Landschaften → unsere Arten. */
const LANDSCHAFT = { 1100: "gebirge", 1200: "berg", 1300: "becken", 1400: "tal", 1500: "ebene", 1600: "hochflaeche",
  1900: "wald", 2000: "inseln", 2100: "seenplatte", 2200: "region", 2300: "moor", 2500: "marsch", 2600: "historisch" };

async function landschaften(dlm) {
  const fs = await lies(finde(dlm, "geb02_f.shp"), `-filter "NAM != ''" -simplify 15% keep-shapes`);
  const alle = fs.map((f) => feature(f.geometry, { id: f.properties.OBJID, name: f.properties.NAM, art: LANDSCHAFT[f.properties.LTP] ?? "sonstige" }));
  schreibe("de-gebirge", { name: "Gebirge", gruppe: "topographisch", geometrie: "flaeche", quiz: true, quelle: QUELLE_BKG },
    alle.filter((f) => f.properties.art === "gebirge"));
  schreibe("de-landschaften", { name: "Landschaften", gruppe: "topographisch", geometrie: "flaeche", quiz: true, quelle: QUELLE_BKG },
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
  schreibe("de-fluesse", { name: "Flüsse", gruppe: "topographisch", geometrie: "linie", quiz: true, quelle: QUELLE_BKG },
    fertig.filter((f) => f.properties.klasse <= 2));
  schreibe("de-fluesse-klein", { name: "Kleine Flüsse und Bäche", gruppe: "topographisch", geometrie: "linie", quiz: true, quelle: QUELLE_BKG },
    fertig.filter((f) => f.properties.klasse > 2));
}

async function gewaesserflaechen(dlm) {
  const fs = await lies(finde(dlm, "gew01_f.shp"), `-simplify 20% keep-shapes`);
  const ART = { AX_StehendesGewaesser: "see", AX_Fliessgewaesser: "fluss", AX_Meer: "meer" };
  const alle = fs.map((f) => feature(f.geometry, {
    id: f.properties.OBJID, name: f.properties.NAM || "", art: ART[f.properties.OBJART_TXT] ?? "see",
  }));
  schreibe("de-seen", { name: "Seen", gruppe: "topographisch", geometrie: "flaeche", quiz: true, quelle: QUELLE_BKG },
    alle.filter((f) => f.properties.art === "see" && f.properties.name));
  // Unbenannte Seen, Meere und breite Flüsse: nur zum Zeichnen
  schreibe("de-gewaesser", { name: "Meere und weitere Gewässer", gruppe: "topographisch", geometrie: "flaeche", quiz: false, quelle: QUELLE_BKG },
    alle.filter((f) => f.properties.art !== "see" || !f.properties.name));
}

async function staaten(ne) {
  // Europa samt Rand; deutsche Namen stehen bei Natural Earth in NAME_DE
  const fs = await lies(finde(ne, "ne_10m_admin_0_countries.shp"), `-clip bbox=-25,33,46,72 -simplify 20% keep-shapes`);
  schreibe("eu-staaten", { name: "Staaten Europas", gruppe: "politisch", geometrie: "flaeche", quiz: true, quelle: QUELLE_NE },
    fs.map((f) => feature(f.geometry, { id: f.properties.ADM0_A3, name: f.properties.NAME_DE || f.properties.NAME })));
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
  KATALOG.push({ id: "de-hoehen", name: "Höhenschichten", gruppe: "topographisch", geometrie: "raster", quiz: false,
    quelle: QUELLE_BKG, kacheln, stufen: HOEHENSTUFEN.map(([m, c]) => ({ ab: m, farbe: `rgb(${c.join(",")})` })), bytes });
  console.log(`  de-hoehen              ${B}×${H} px  ${(bytes / 1e6).toFixed(2)} MB`);
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

console.log("Ebenen:");
const land = await laender(ordner.vg2500);
await staedte(ordner.gn250);
await gipfel(ordner.gn250);
await landschaften(ordner.dlm1000);
await fluesse(ordner.dlm1000);
await gewaesserflaechen(ordner.dlm1000);
await staaten(ordner.ne_staaten);
await hoehen(ordner.dgm200, land);
await schriften();

writeFileSync(join(ZIEL, "ebenen.json"), JSON.stringify({ stand: new Date().toISOString().slice(0, 10), ebenen: KATALOG }, null, 2));
console.log(`Katalog: ${join(ZIEL, "ebenen.json")}`);
