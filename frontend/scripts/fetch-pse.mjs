/**
 * Holt Daten und Fotos für die Simulation »Periodensystem« (pse).
 *
 * 1. Kenndaten aller 118 Elemente von PubChem (NCBI, gemeinfrei als Werk der
 *    US-Regierung) → src/lib/pse/daten.json. Deutsche Namen, Kategorien und
 *    Texte stehen nicht hier, sondern in src/lib/pse/*.ts.
 * 2. Fotos der Stoffproben von Wikimedia Commons → public/pse/proben/<Symbol>.webp,
 *    Nachweise (Lizenz, Urheber, Seite) → src/lib/pse/bilder.json. Die Liste
 *    stammt aus dem Wikidata-Bild (P18) der Elemente, von Hand bereinigt:
 *    ohne SVG-Platzhalter, Legierungen und Fotos, die das Element nicht zeigen.
 *
 * Die Bilder liegen im Repo, damit die Simulation offline läuft und keine
 * Schüler-IP an Dritte geht. Aufgenommen wird nur, was frei ist (gemeinfrei,
 * CC0, CC BY, CC BY-SA, Free Art License); alles andere meldet das Skript und lässt es weg.
 *
 * Aufruf:  node scripts/fetch-pse.mjs  [--force]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import sharp from "sharp";

const UA = "HauspokalSchule/1.0 (Unterrichtssimulation; https://github.com/DonMischo/Hauspokal)";
const DATEN = "src/lib/pse/daten.json";
const ZIEL = "public/pse/proben";
const NACHWEISE = "src/lib/pse/bilder.json";
const BREITE = 480;
const force = process.argv.includes("--force");

const PROBEN = [
  ["H", "Hydrogen discharge tube.jpg"],
  ["He", "Angeregtes Helium 3.jpg"],
  ["Li", "Purified lithium in an ampoule under argon, dark background.png"],
  ["Be", "Beryllium nuggets 2.jpg"],
  ["B", "Boron.jpg"],
  ["C", "Graphite-and-diamond-with-scale.jpg"],
  ["N", "Fluessiger Stickstoff.jpg"],
  ["O", "Liquid oxygen in a beaker 4.jpg"],
  ["F", "Liquid fluorine tighter crop.jpg"],
  ["Ne", "NeTube.jpg"],
  ["Na", "Na (Sodium).jpg"],
  ["Mg", "Magnesium crystals.jpg"],
  ["Al", "Aluminium-4.jpg"],
  ["Si", "SiliconCroda.jpg"],
  ["P", "Phosphor.JPG"],
  ["S", "Sulfur - El Desierto mine, San Pablo de Napa, Daniel Campos Province, Potosí, Bolivia.jpg"],
  ["Cl", "Chlorine liquid in an ampoule.jpg"],
  ["Ar", "ArTube.jpg"],
  ["K", "Kalium.jpg"],
  ["Ca", "Calcium 1.jpg"],
  ["Sc", "Scandium sublimed dendritic and 1cm3 cube.jpg"],
  ["Ti", "Titan-crystal bar.JPG"],
  ["V", "Vanadium 1.jpg"],
  ["Cr", "Chromium crystals and 1cm3 cube.jpg"],
  ["Mn", "Manganese electrolytic and 1cm3 cube.jpg"],
  ["Fe", "Iron electrolytic and 1cm3 cube.jpg"],
  ["Co", "Kobalt electrolytic and 1cm3 cube.jpg"],
  ["Ni", "Electrolytic nickel.jpg"],
  ["Cu", "Cuivre Michigan.jpg"],
  ["Zn", "Zinc fragment sublimed and 1cm3 cube.jpg"],
  ["Ga", "Gallium crystals.jpg"],
  ["Ge", "Germanium element.jpg"],
  ["As", "Arsen 1.jpg"],
  ["Se", "Selen 1.jpg"],
  ["Br", "Bromine vial in acrylic cube.jpg"],
  ["Kr", "KrTube.jpg"],
  ["Rb", "RbMetal.JPG"],
  ["Sr", "Strontium destilled crystals.jpg"],
  ["Y", "Yttrium sublimed dendritic and 1cm3 cube.jpg"],
  ["Zr", "Zirconium crystal bar and 1cm3 cube.jpg"],
  ["Nb", "Niobium crystals and 1cm3 cube.jpg"],
  ["Mo", "Molybdenum crystaline fragment and 1cm3 cube.jpg"],
  ["Tc", "Technetium-sample.jpg"],
  ["Ru", "Ruthenium a half bar.jpg"],
  ["Rh", "Rhodium powder pressed melted.jpg"],
  ["Pd", "Palladium (46 Pd).jpg"],
  ["Ag", "Silver crystal.jpg"],
  ["Cd", "Cadmium-crystal bar.jpg"],
  ["In", "Indium wetting glass.jpg"],
  ["Sn", "Cín.PNG"],
  ["Sb", "Antimony-2.jpg"],
  ["Te", "Tellurium element 2.jpg"],
  ["I", "Sample of iodine.jpg"],
  ["Xe", "XeTube.jpg"],
  ["Cs", "Cesium.jpg"],
  ["Ba", "Barium 1.jpg"],
  ["La", "Lanthan 1-cropflipped.jpg"],
  ["Ce", "CE2k2g.jpg"],
  ["Pr", "Praseodym 1.jpg"],
  ["Nd", "Neodym 1.jpg"],
  ["Pm", "Promethium Metal Buttons (cropped).png"],
  ["Sm", "Samarium 1.jpg"],
  ["Eu", "Eu-Block.jpg"],
  ["Gd", "Gadolinium.jpg"],
  ["Tb", "Terbium element.jpg"],
  ["Dy", "Dysprosium1.jpg"],
  ["Ho", "Holmium.jpg"],
  ["Er", "Erbium.jpg"],
  ["Tm", "Thulium sublimed dendritic and 1cm3 cube.jpg"],
  ["Yb", "Ytterbium element.jpg"],
  ["Lu", "Lutetium sublimed dendritic and 1cm3 cube.jpg"],
  ["Hf", "Hf-crystal bar.jpg"],
  ["Ta", "Tantalum single crystal and 1cm3 cube.jpg"],
  ["W", "Wolfram evaporated crystals and 1cm3 cube.jpg"],
  ["Re", "Rhenium single crystal bar and 1cm3 cube.jpg"],
  ["Os", "Osmium crystals.jpg"],
  ["Ir", "Iridium foil.jpg"],
  ["Pt", "Platinum crystals.jpg"],
  ["Au", "Gold-crystals.jpg"],
  ["Hg", "Mercury-element.jpg"],
  ["Tl", "Thallium pieces in ampoule.jpg"],
  ["Pb", "Lead electrolytic and 1cm3 cube.jpg"],
  ["Bi", "Bismuth crystals and 1cm3 cube.jpg"],
  ["Po", "2019-11-22 Spark plugs and static eliminators with radioactive polonium at museum display.jpg"],
  ["At", "Glow from a sample of astatine (cropped).jpg"],
  ["Rn", "Radon water apparatus P1120815.JPG"],
  ["Ra", "Radium226.jpg"],
  ["Ac", "Actinium sample (31481701837).png"],
  ["Th", "Thorium sample 0.1g.jpg"],
  ["Pa", "Protactinium-233.jpg"],
  ["U", "Uranium2.jpg"],
  ["Np", "Neptunium2.jpg"],
  ["Pu", "Plutonium ring.jpg"],
  ["Am", "Americium microscope.jpg"],
  ["Cm", "Cm-Fluoreszenz.png"],
  ["Bk", "Berkelium metal.jpg"],
  ["Cf", "Californium.jpg"],
  ["Es", "Einsteinium.jpg"],
];

const FREI = /^(public domain|pd|cc0|cc by(-sa)?( \d\.\d)?( de)?|fal|free art license|attribution$)/i;
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
    if ((res.status === 429 || res.status >= 500) && versuch < 5) { await warte(4000 * versuch); continue; }
    throw new Error(`${res.status} ${url}`);
  }
}

// ── 1. Kenndaten ──
if (!existsSync(DATEN) || force) {
  const pt = await holeJson("https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON");
  const spalten = pt.Table.Columns.Column;
  const zahl = (s) => (s === "" ? null : Number(s));
  const elemente = pt.Table.Row.map(({ Cell }) => {
    const r = Object.fromEntries(spalten.map((s, i) => [s, Cell[i]]));
    return {
      z: Number(r.AtomicNumber),
      symbol: r.Symbol,
      masse: zahl(r.AtomicMass),
      konfiguration: r.ElectronConfiguration,
      en: zahl(r.Electronegativity),
      radius: zahl(r.AtomicRadius),
      ionisierung: zahl(r.IonizationEnergy),
      oxidationszahlen: r.OxidationStates ? r.OxidationStates.split(",").map((s) => Number(s.trim())) : [],
      zustand: r.StandardState === "Solid" ? "fest" : r.StandardState === "Liquid" ? "flüssig" : r.StandardState === "Gas" ? "gasförmig" : null,
      schmelzpunkt: zahl(r.MeltingPoint),
      siedepunkt: zahl(r.BoilingPoint),
      dichte: zahl(r.Density),
      entdeckt: r.YearDiscovered === "Ancient" ? "Altertum" : r.YearDiscovered,
    };
  });
  mkdirSync(dirname(DATEN), { recursive: true });
  writeFileSync(DATEN, JSON.stringify(elemente, null, 1) + "\n");
  console.log(`Kenndaten: ${elemente.length} Elemente in ${DATEN}.`);
}

// ── 2. Fotos ──
const nachweise = existsSync(NACHWEISE) ? JSON.parse(readFileSync(NACHWEISE, "utf8")) : {};
for (const [symbol, titel] of PROBEN) {
  const pfad = join(ZIEL, `${symbol}.webp`);
  if (existsSync(pfad) && nachweise[symbol] && !force) continue;

  const info = await holeJson(
    "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo" +
    `&iiprop=url|size|extmetadata&iiurlwidth=${BREITE}&titles=${encodeURIComponent("File:" + titel)}`,
  );
  const seite = Object.values(info.query.pages)[0];
  if (seite.missing !== undefined) { console.warn(`⚠ Nicht auf Commons: ${symbol} ${titel}`); continue; }
  const ii = seite.imageinfo[0];
  const meta = ii.extmetadata ?? {};
  const lizenz = ohneHtml(meta.LicenseShortName?.value);
  if (!FREI.test(lizenz)) { console.warn(`⚠ Lizenz »${lizenz}« nicht übernommen: ${symbol} ${titel}`); continue; }

  const quelle = ii.width > BREITE ? ii.thumburl : ii.url;
  const puffer = await sharp(await holeBytes(quelle))
    .resize({ width: BREITE, height: BREITE, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78 }).toBuffer();
  mkdirSync(ZIEL, { recursive: true });
  writeFileSync(pfad, puffer);

  nachweise[symbol] = {
    datei: `/pse/proben/${symbol}.webp`,
    titel,
    seite: ii.descriptionurl ?? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(titel)}`,
    lizenz,
    urheber: ohneHtml(meta.Artist?.value).slice(0, 200) || ohneHtml(meta.Credit?.value).slice(0, 200) || "unbekannt",
  };
  console.log(`${(puffer.length / 1024).toFixed(0).padStart(5)} KB  ${symbol}  (${lizenz})`);
  await warte(600);
}

// Aus der Liste gestrichene Bilder verlieren auch ihren Nachweis.
const gueltig = new Set(PROBEN.map(([s]) => s));
const sortiert = Object.fromEntries(Object.entries(nachweise).filter(([k]) => gueltig.has(k)));
writeFileSync(NACHWEISE, JSON.stringify(sortiert, null, 2) + "\n");
console.log(`Fertig: ${Object.keys(sortiert).length} Bildnachweise in ${NACHWEISE}.`);
