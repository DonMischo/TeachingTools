/**
 * Holt die Bilder der Simulation »Sonnensystem« von Wikimedia Commons.
 *
 * Die Bilder liegen verkleinert im Repo (public/sonnensystem/), damit die
 * Simulation offline im Schulnetz läuft und keine Schüler-IP an Dritte geht.
 * Dieses Skript ist der Nachweis, woher jedes Bild kommt: es fragt Commons
 * nach Lizenz und Urheber, lädt eine passende Vorschaugröße, schneidet bei
 * Bedarf Legenden weg und schreibt src/lib/sonnensystem/bilder.json — daraus
 * zeigt die Oberfläche die Bildnachweise an.
 *
 * Nur aufnehmen, was frei ist: gemeinfrei (NASA/JPL/USGS), CC0, CC BY oder
 * CC BY-SA. sharp kommt über Next.js mit und ist deshalb nicht eigens gelistet.
 *
 * Aufruf:  node scripts/fetch-sonnensystem.mjs  [--force]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import sharp from "sharp";

const UA = "HauspokalSchule/1.0 (Unterrichtssimulation; https://github.com/DonMischo/Hauspokal)";
const ZIEL = "public/sonnensystem";
const NACHWEISE = "src/lib/sonnensystem/bilder.json";
const force = process.argv.includes("--force");

/** Texturen sind zylindrisch projizierte Karten (2:1), Fotos quadratische Porträts. */
const T = (id, titel, breite = 2048, extra = {}) => ({ id, ordner: "texturen", titel, breite, hoehe: breite / 2, ...extra });
const F = (id, titel, extra = {}) => ({ id, ordner: "fotos", titel, breite: 720, ...extra });
const G = (id, titel, extra = {}) => ({ id, ordner: "galerie", titel, breite: 1400, ...extra });

// Lizenzfeld leer bei manchen PIA-Bildern: die sind als NASA-Werk gemeinfrei.
const NASA = { lizenzErsatz: "Public domain (NASA)" };

const BILDER = [
  // ── Planetentexturen: Solar System Scope (CC BY 4.0) ──
  T("sonne", "Solarsystemscope texture 2k sun.jpg"),
  T("merkur", "Solarsystemscope texture 2k mercury.jpg"),
  T("venus", "Solarsystemscope texture 2k venus atmosphere.jpg"),
  T("erde", "Solarsystemscope texture 8k earth daymap.jpg"),
  T("erde-wolken", "Solarsystemscope texture 2k earth clouds.jpg"),
  T("erde-nacht", "Solarsystemscope texture 2k earth nightmap.jpg"),
  T("mond", "Solarsystemscope texture 2k moon.jpg"),
  T("mars", "Solarsystemscope texture 2k mars.jpg"),
  T("jupiter", "Solarsystemscope texture 2k jupiter.jpg"),
  T("saturn", "Solarsystemscope texture 2k saturn.jpg"),
  { id: "saturn-ring", ordner: "texturen", titel: "Solarsystemscope texture 2k saturn ring alpha.png", breite: 1024, hoehe: 64, format: "png" },
  T("uranus", "Solarsystemscope texture 2k uranus.jpg", 1024),
  T("neptun", "Solarsystemscope texture 2k neptune.jpg", 1024),
  // Die Vorlage ist sehr dunkel; verkleinert verschwinden sonst die schwachen Sterne.
  T("milchstrasse", "Solarsystemscope texture 8k stars milky way.jpg", 4096, { qualitaet: 85, verstaerkung: 2.6 }),

  // ── Mondkarten (NASA/USGS/LPI, meist gemeinfrei) ──
  T("pluto", "PIA20658-Pluto-Global-released20160502.jpg", 1024),
  T("charon", "Charon map iau1803c.jpg", 1024),
  T("io", "Io map projection PIA00319.jpg", 1024),
  T("europa", "Europa Voyager GalileoSSI global mosaic.jpg", 1024),
  T("ganymed", "Map of Ganymede by Björn Jónsson.jpg", 1024),
  T("kallisto", "Callisto USGS global small.jpg", 1024),
  T("titan", "PIA19658-SaturnMoon-TitanGlobalMap-June2015.jpg", 1024,
    { ...NASA, zuschnitt: { links: 0.047, oben: 0.092, rechts: 0.969, unten: 0.918 } }),
  T("enceladus", "Enceladus Color Map.jpg", 1024),
  T("mimas", "Color map of Mimas PIA18437 Nov. 2014.jpg", 1024,
    { zuschnitt: { links: 0.032, oben: 0.048, rechts: 0.970, unten: 0.796 } }),
  T("tethys", "Tethys Color Map.jpg", 1024),
  T("dione", "Dione Color Map.jpg", 1024),
  T("rhea", "Rhea Color Map.jpg", 1024),
  T("iapetus", "Iapetus Color Map.jpg", 1024),
  T("miranda", "Miranda map JPL USGS.jpg", 1024),
  T("titania", "Titania map JPL USGS.jpg", 1024),
  T("oberon", "Oberon map JPL USGS.jpg", 1024),
  T("triton", "Triton map no grid.jpg", 1024),
  T("phobos", "Phobos map by Askaniy.png", 1024),
  T("deimos", "Deimos map by Askaniy.png", 1024),

  // ── Porträts für die Steckbriefe ──
  F("sonne", "The Sun by the Atmospheric Imaging Assembly of NASA's Solar Dynamics Observatory - 20100819.jpg"),
  F("merkur", "Mercury in true color.jpg"),
  F("venus", "Venus-real color.jpg"),
  F("erde", "The Earth seen from Apollo 17.jpg"),
  F("mond", "FullMoon2010.jpg"),
  F("mars", "OSIRIS Mars true color.jpg"),
  F("jupiter", "Jupiter and its shrunken Great Red Spot.jpg"),
  F("saturn", "Saturn during Equinox.jpg", { breite: 1100 }),
  F("uranus", "Uranus as seen by NASA's Voyager 2 (remastered) - JPEG converted.jpg"),
  F("neptun", "Neptune Voyager2 color calibrated.png"),
  F("pluto", "Pluto in True Color - High-Res.jpg"),
  F("ceres", "Ceres - RC3 - Haulani Crater (22381131691) (cropped).jpg"),
  F("io", "Io highest resolution true color.jpg"),
  F("europa", "Europa-moon-with-margins.jpg"),
  F("ganymed", "Ganymede g1 true-edit1.jpg"),
  F("kallisto", "Callisto.jpg"),
  F("titan", "Titan in true color.jpg"),
  F("enceladus", "PIA17202 - Approaching Enceladus.jpg"),
  F("mimas", "Mimas Cassini.jpg"),
  F("tethys", "PIA18317-SaturnMoon-Tethys-Cassini-20150411.jpg", NASA),
  F("dione", "Dione in natural light.jpg"),
  F("rhea", "PIA07763 Rhea full globe5.jpg"),
  F("iapetus", "Iapetus as seen by the Cassini probe - 20071008.jpg"),
  F("miranda", "Miranda.jpg"),
  F("titania", "Titania (moon) color, edited.jpg"),
  F("oberon", "Voyager 2 picture of Oberon.jpg"),
  F("triton", "Triton moon mosaic Voyager 2 (large).jpg"),
  F("charon", "Charon in True Color - High-Res.jpg"),
  F("phobos", "Phobos colour 2008.jpg"),
  F("deimos", "Deimos-MRO.jpg"),

  // ── Porträts der Raumfahrzeuge ──
  F("iss", "ISS from the SpaceX Crew Dragon Endeavor during Flyaround (iss066e081130).jpg"),
  F("tiangong", "Tiangong Space Station Rendering 2022.11.01.jpg"),
  F("hubble", "Hubble 2009 close-up.jpg"),
  F("chandra", "Chandra X-Ray Observatory (noirlab2427c).jpg"),
  F("sentinel", "Sentinel-2A satellite - CSG - Carefully aligning the satellite to the adapter.jpg"),
  F("gps", "Navstar-2F.jpg"),
  F("meteosat", "Meteosat Third Generation Imager above Earth ESA24620590.png"),

  // ── Galerie: Weltraumteleskope und Raumsonden ──
  G("hubble-deep-field", "Hubble ultra deep field.jpg"),
  G("webb-deep-field", "Webb's First Deep Field.jpg"),
  G("saeulen-hubble", "Pillars of creation 2014 HST WFC3-UVIS full-res denoised.jpg", { breite: 1100 }),
  G("saeulen-webb", "Pillars of Creation (NIRCam Image).jpg", { breite: 1000 }),
  G("pale-blue-dot", "PIA23645-Earth-PaleBlueDot-6Bkm-Voyager1-orig19900214-upd20200212.jpg", NASA),
  G("erde-von-saturn", "The Day the Earth Smiled - PIA17172.jpg", { breite: 1800 }),
  G("earthrise", "NASA-Apollo8-Dec24-Earthrise.jpg"),
  G("webb-spiegel", "NASA's James Webb Space Telescope Primary Mirror Fully Assembled (25423929476).jpg"),
  G("gaia-karte", "Gaia’s new map of star density ESA393130.jpg", { breite: 1800 }),
  G("soho-cme", "05 Coronal Mass Ejection (2819895025).jpg"),
  G("chandra-krebsnebel", "Chandra X-ray Images of Crab Nebula (2009-crab-more-1 - crab xray).tiff", { breite: 1000 }),
  G("lucy-dinkinesh", "Lucy Sees Asteroid Dinkinesh in Detail (SVS14596).jpg", { breite: 1280 }),
  G("iss-cupola", "ISS-68 Astronaut Bob Hines looks at the Earth through the cupola.jpg"),
  G("sentinel-bahamas", "Sentinel-2 bahamas (cropped).jpg", { breite: 1000 }),
  G("jupiter-webb", "Jupiter Showcases Auroras, Hazes (NIRCam Widefield View).png"),
  G("jupiter-juno-fleck", "PIA22946-Jupiter-RedSpot-JunoSpacecraft-20190212.jpg", NASA),
  G("jupiter-juno-suedpol", "Jupiter South Pole - Juno Perijove 4 - February 2 2017 (38605852072).jpg"),
  G("europa-juno", "Europa - Nasa's Juno PJ 45 (52393304986).png"),
  G("saturn-hubble", "Hubble sees summertime on Saturn ESA23797272.jpg"),
  G("saturn-webb", "Saturn JWST NIRCam.jpg"),
  G("riesen-webb", "Quartet of Ringed Giants - Jupiter, Saturn, Uranus and Neptune - NASA-ESA JWST Webb Space Telescope (53100897700).png", { breite: 1800 }),
  G("neptun-webb", "Neptune and Triton - NASA-ESA JWST Webb Space Telescope (53023362438).png",
    { breite: 1000, zuschnitt: { links: 0.30, oben: 0.10, rechts: 0.70, unten: 0.80 } }),
  G("uranus-webb", "Uranus - NASA-ESA JWST Webb Space Telescope (53412941760).png",
    { breite: 600, zuschnitt: { links: 0.38, oben: 0.29, rechts: 0.62, unten: 0.71 } }),
  G("merkur-bepi", "BepiColombo hugs Mercury ESA24939504.png"),
  G("komet-rosetta", "Comet 67P on 19 September 2014 NavCam mosaic.jpg"),
  G("erde-juice", "Juice images Earth during lunar-Earth flyby ESA500763.png", { breite: 1020 }),

  // ── Galerie: Bilder von Missionen, die dort waren ──
  G("mond-aldrin", "Aldrin Apollo 11 original.jpg", { breite: 1100 }),
  G("mond-schmitt", "Moon-apollo17-schmitt boulder.jpg", { breite: 1100 }),
  G("mond-yutu", "Yutu-2 leaving Chang e-4-iau1901a.jpg"),
  G("venus-venera", "Surface of Venus taken by Venera 13 (panoramic).jpg"),
  G("erde-epic", "DSCOVR-EPIC-Earth-natural-true-color1c.jpg", { breite: 1100 }),
  G("erde-polarlicht", "ISS-44 Night Earth Observation of an Aurora Australis.jpg"),
  G("komet-neowise", "ISS-63 Comet Neowise (3).jpg"),
  G("mars-curiosity", "NASA-CuriosityRover-Selfie-June2018.jpg", { breite: 1000 }),
  G("mars-sonnenuntergang", "PIA19400-MarsCuriosityRover-GaleCrater-Sunset-20150415.jpg", NASA),
  G("mars-ingenuity", "Mastcam-Z Gives Ingenuity a Close-up.jpg"),
  G("mars-perseverance", "PIA25681 Perseverance's Three Forks Sample Depot Selfie.jpg", { breite: 1200 }),
  G("mars-sojourner", "Sojourner on Mars PIA01122.jpg"),
  G("ceres-flecken", "Bright Spots on Ceres by Dawn on 6 June 2015.jpg", { breite: 1041 }),
  G("jupiter-voyager", "Voyager 1 Image of Jupiter with Io and Europa.jpg", { breite: 1200 }),
  G("jupiter-polarlicht", "Ultraviolet Aurora borealis on Jupiter from Hubble 1998.jpg"),
  G("io-juno", "PIA25726-Jupiter+MoonIo-Juno-20230731.jpg"),
  G("saturn-hexagon", "PIA18274-Saturn-NorthPolarHexagon-Cassini-20140402.jpg", NASA),
  G("saturn-gegenlicht", "PIA14934 - A Splendor Seldom Seen - Saturn Cassini.jpg", { breite: 1800 }),
  G("enceladus-fontaenen", "Dramatic plumes, both large and small, spray water ice out from many locations along the famed tiger stripes near the south pole of Saturn’s moon Enceladus in this image released on Feb 23 (newly-found-organics-in-enceladus-plumes).jpg"),
  G("titan-huygens", "Huygens surface color sr.jpg"),
  G("miranda-voyager", "Miranda as seen by Voyager 2 - GPN-2003-000005 (cropped).jpg", { breite: 1100 }),
  G("neptun-dunkler-fleck", "Neptune's Great Dark Spot (cropped).jpg"),
  G("pluto-berge", "PIA19947-NH-Pluto-Norgay-Hillary-Mountains-20150714.jpg"),
  G("arrokoth", "UltimaThule CA06 color 20190516.png", { breite: 1200 }),
  G("sonne-solar-orbiter", "Solar Orbiter’s widest high-res view of the Sun ESA508430.jpg", { breite: 1200 }),
  G("mond-rueckseite", "The first panorama from the far side of the moon.jpg", { breite: 2000 }),
];

const ohneHtml = (s) => (s ?? "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

async function holeJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function holeBytes(url) {
  for (let versuch = 1; ; versuch++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    // Commons drosselt das Rendern großer Vorschaubilder — kurz warten hilft.
    if ((res.status === 429 || res.status >= 500) && versuch < 5) { await warte(4000 * versuch); continue; }
    throw new Error(`${res.status} ${url}`);
  }
}

const nachweise = existsSync(NACHWEISE) ? JSON.parse(readFileSync(NACHWEISE, "utf8")) : {};

for (const b of BILDER) {
  const endung = b.format === "png" ? "png" : "webp";
  const datei = `${b.ordner}/${b.id}.${endung}`;
  const pfad = join(ZIEL, datei);
  const schluessel = `${b.ordner}/${b.id}`;
  if (existsSync(pfad) && nachweise[schluessel] && !force) continue;

  // Beim Zuschneiden eine größere Vorlage holen, damit die Zielbreite bleibt.
  const anteil = b.zuschnitt ? b.zuschnitt.rechts - b.zuschnitt.links : 1;
  const vorlage = Math.ceil(b.breite / anteil);
  const info = await holeJson(
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo" +
    `&iiprop=url|size|extmetadata&iiurlwidth=${vorlage}&titles=${encodeURIComponent("File:" + b.titel)}`,
  );
  const seite = Object.values(info.query.pages)[0];
  if (seite.missing !== undefined) throw new Error(`Nicht auf Commons: ${b.titel}`);
  const ii = seite.imageinfo[0];
  const meta = ii.extmetadata ?? {};
  // Kleiner als die Vorlage? Dann liefert Commons das Original als thumburl.
  const quelle = ii.width > vorlage ? ii.thumburl : ii.url;
  let bild = sharp(await holeBytes(quelle));

  if (b.zuschnitt) {
    const { width, height } = await bild.metadata();
    const z = b.zuschnitt;
    bild = sharp(await bild.extract({
      left: Math.round(z.links * width), top: Math.round(z.oben * height),
      width: Math.round((z.rechts - z.links) * width), height: Math.round((z.unten - z.oben) * height),
    }).toBuffer());
  }
  if (b.verstaerkung) bild = bild.linear(b.verstaerkung, 0);
  bild = b.hoehe
    ? bild.resize(b.breite, b.hoehe, { fit: "fill" })
    : bild.resize({ width: b.breite, withoutEnlargement: true });

  mkdirSync(dirname(pfad), { recursive: true });
  const puffer = endung === "png"
    ? await bild.png({ compressionLevel: 9 }).toBuffer()
    : await bild.webp({ quality: b.qualitaet ?? (b.ordner === "texturen" ? 80 : 78) }).toBuffer();
  writeFileSync(pfad, puffer);

  const lizenz = ohneHtml(meta.LicenseShortName?.value) || b.lizenzErsatz;
  if (!lizenz) throw new Error(`Keine Lizenzangabe: ${b.titel}`);
  nachweise[schluessel] = {
    datei: `/sonnensystem/${datei}`,
    titel: b.titel,
    seite: seite.imageinfo[0].descriptionurl ?? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(b.titel)}`,
    lizenz,
    urheber: ohneHtml(meta.Artist?.value).slice(0, 200) || ohneHtml(meta.Credit?.value).slice(0, 200) || "unbekannt",
  };
  console.log(`${(puffer.length / 1024).toFixed(0).padStart(5)} KB  ${datei}  (${lizenz})`);
  await warte(600);
}

// Wo liegt die Planetenscheibe im Foto? Der Größenvergleich braucht das, denn
// manche Aufnahmen haben breite schwarze Ränder. Gemessen wird die Box um alles,
// was heller als der Weltraum ist; ein angeschnittener Rand (Triton) zählt über
// die längere Seite. Saturn misst die Ringe mit — dafür steht »scheibe« ab.
const RINGE_IM_FOTO = { saturn: 2.3 };
for (const b of BILDER.filter((b) => b.ordner === "fotos")) {
  const eintrag = nachweise[`fotos/${b.id}`];
  if (!eintrag || (eintrag.scheibe && !force)) continue;
  const { data, info } = await sharp(join(ZIEL, "fotos", `${b.id}.webp`))
    .resize({ width: 256 }).greyscale().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width, y0 = info.height, x1 = -1, y1 = -1;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[y * info.width + x] > 28) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  }
  const d = Math.max(x1 - x0, y1 - y0) / (RINGE_IM_FOTO[b.id] ?? 1);
  // Halb beleuchtet (Titania, Oberon): die Box ist schmaler als die Scheibe.
  // Der Rand liegt auf der helleren Seite, die Mitte eine halbe Scheibe davor.
  let cx = (x0 + x1) / 2;
  if (!RINGE_IM_FOTO[b.id] && x1 - x0 < d * 0.97) {
    let links = 0, rechts = 0;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (x < cx) links += data[y * info.width + x]; else rechts += data[y * info.width + x];
    }
    cx = rechts > links ? x1 - d / 2 : x0 + d / 2;
  }
  const r = (n) => Math.round(n * 1000) / 1000;
  eintrag.scheibe = {
    x: r(cx / info.width),
    y: r(Math.min((y0 + y1) / 2, y0 + d / 2) / info.height),
    d: r(d / info.width),
  };
}

// Aus der Liste gestrichene Bilder verlieren auch ihren Nachweis.
const gueltig = new Set(BILDER.map((b) => `${b.ordner}/${b.id}`));
const sortiert = Object.fromEntries(Object.entries(nachweise).filter(([k]) => gueltig.has(k)).sort(([a], [b]) => a.localeCompare(b)));
mkdirSync(dirname(NACHWEISE), { recursive: true });
writeFileSync(NACHWEISE, JSON.stringify(sortiert, null, 2) + "\n");
console.log(`Fertig: ${Object.keys(sortiert).length} Bildnachweise in ${NACHWEISE}.`);
