/**
 * Holt die Galerie-Bilder der Simulation »Küstendynamik« von Wikimedia Commons.
 *
 * Wie beim Sonnensystem liegen die Bilder verkleinert im Repo
 * (public/kueste/galerie/), damit die Simulation offline im Schulnetz läuft
 * und keine Schüler-IP an Dritte geht. Das Skript fragt Commons nach Lizenz
 * und Urheber und schreibt src/lib/kueste/bilder.json — daraus zeigt die
 * Galerie die Bildnachweise an. Die Bildtexte stehen in src/lib/kueste/galerie.ts.
 *
 * Nur freie Lizenzen: gemeinfrei, CC0, CC BY, CC BY-SA. Die Pressebilder
 * des GeoCenters Møns Klint haben keine Lizenzangabe und sind deshalb
 * nicht dabei — die GeoCenter-Bilder hier stammen von Commons.
 *
 * Aufruf:  node scripts/fetch-kueste.mjs  [--force]
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import sharp from "sharp";

const UA = "HauspokalSchule/1.0 (Unterrichtssimulation; https://github.com/DonMischo/Hauspokal)";
const ZIEL = "public/kueste/galerie";
const NACHWEISE = "src/lib/kueste/bilder.json";
const force = process.argv.includes("--force");

/** id → Dateiname auf Commons. Die Reihenfolge ist egal, die Galerie ordnet selbst. */
export const BILDER = {
  // ── Rügens Steilküste ──
  "koenigsstuhl": "Kreidefelsen-am-Königsstuhl-Nationalpark-Jasmund.jpg",
  "koenigsstuhl-aussicht": "Aussicht vom Königsstuhl auf majestätische Kreidefelsen.jpg",
  "stubbenkammer": "Kreidefelsen, Stubbenkammer (2011-05-21) 7.JPG",
  "jasmund-findlinge": "Kreidefelsen with the sea below.jpg",
  "jasmund-feuersteinstrand": "FFH-Gebiet Jasmund Kreidefelsen Ostsee Felsen Sommer 2025-06 01.jpg",
  "wissow-schutthang": "Beach at Wissower Klinken Jasmund 2021-09-14 02.jpg",
  "wissow-schuttkegel": "Beach at Wissower Klinken Jasmund 2021-09-14 17.jpg",
  "kreideabbruch-2007": "Ruegen Kreideabbruch 2007-06-28.jpg",
  "jasmund-hohlkehle": "Nationalpark Jasmund Wave-cut notch.jpg",
  "arkona": ".00 5010 Kap Arkona, Steilküste auf der Insel Rügen.jpg",
  "arkona-rutschung": "South of Kap Arkona 2021-09-16 10.jpg",
  "arkona-blockstrand": "South of Kap Arkona 2021-09-16 15.jpg",
  // ── Møns Klint und GeoCenter ──
  "moen-1": "Møns Klint chalk cliffs 1.jpg",
  "moen-3": "Møns Klint chalk cliffs 3.jpg",
  "moen-klippen": "Mons Klint Klippen.jpg",
  "moen-store-taler": "MoensKlint StoreTaler.JPG",
  "moen-feuerstein": "Feuersteinbänder Møns Klint.jpg",
  "moen-schuttrinne": "Mons Klint 2017 30.jpg",
  "moen-dronningestolen": "Møns Klint - Dronningestolen og Forchhammers Pynt.jpg",
  "geocenter": "Mons Klint GeoCenter.jpg",
  "geocenter-innen": "Mons Klint GeoCenter interior.jpg",
  "geocenter-mosasaurier": "GeoCenter3.JPG",
  // ── Weitere Steilküsten ──
  "brodten": "Brodtener Ufer Sept 2014b.jpg",
  "brodten-luft": "Brodtener Steilufer bei Niendorf Ostsee (50705369501).jpg",
  "fischland": "Hohes Ufer zwischen Ahrenshoop und Wustrow.jpg",
  "hiddensee": "Cliff at Swantevitschlucht Hiddensee NLP Vorpommersche Boddenlandschaft 2023-06-12 01.jpg",
  "rotes-kliff": "Das rote Kliff auf Sylt (25232010288).jpg",
  "rotes-kliff-1980": "Rotes Kliff in Sylt 1980 HBdia00577.jpg",
  "rotes-kliff-treppe": "Rotes Kliff.jpg",
  "kampener-findling": "Sylt Kampener Findling vom Roten Kliff 2012 PD.JPG",
  "morsum-kliff": "Kliff+Dünen+Salzwiese direkt an der Nordsee im Naturschutzgebiet Morsum-Kliff auf Sylt.jpg",
  // ── Flachküste, Watt und Haken ──
  "strandhafer": "Dünenlandschaft mit Strandhafer (Ammophila arenaria) an der Küste Spiekeroogs.jpg",
  "sturmflut-sylt-1985": "Sturmflut auf Sylt 1985 HBdia00585.jpg",
  "watt-priel": "Watt der Elbmündung am Trischendamm im Schleswig-Holsteinisches Wattenmeer.jpg",
  "watt-queller": "Das Watt vor Friedrichskoog-Spitze.jpg",
  "salzwiese": "Salzwiese plattform bei nebel amrum 05 2009.jpg",
  "landunter": "Landunter auf Hallig Hooge am 29. Oktober 2013.jpg",
  "darsser-ort": "Darßer Ort 01.jpg",
  "darsser-ort-kernzone": "Darßer-Ort-Kernzone.jpg",
  // ── Küstenschutz ──
  "vorspuelung": "Sandvorspülung auf Sylt Westerland 2012 PD 1.JPG",
  "vorspuelung-rohr": "Sandvorspülung auf Sylt Westerland 2012 PD 4.JPG",
  "vorspuelung-hoernum-1983": "Strandvorspülung vor Hörnum-Sylt 1983-05-31 HBdia00583.jpg",
  "tetrapoden": "Beton-Tetrapoden Hörnum-Sylt.jpg",
  "tetrapoden-2": "Tetrapoden Hoernum Sylt.jpg",
  "buhnen": "Rostock Ostsee (49833109701).jpg",
  "sandfangzaun-1976": "Sandfangzäune vor Dünenfuß-Sylt 1976 HBdia00571.jpg",
  "sandfangzaun": "Cuxhaven, Strand, Sandfangzaun -- 2024 -- 090459.jpg",
  "lahnungen": "Schleswig Holsteinisches Wattenmeer Lahnungen.jpg",
  "lahnungen-hallig": "2009-05-01 Lahnungen im Wattenmeer mit der Neuwarft auf Hallig Nordstrandischmoor (IMG 2312).JPG",
  "deich-schafe": "Deichprofil friedrichsgabekoog.JPG",
  "deich-nordstrand": "Deich-nordstrand.jpg",
  "deich-innen": "Büsum Deich Innenseite.jpg",
  "deich-sturmflutmarken": "Seedeich Harlesiel, Höhenanzeiger Sturmfluten (1).jpg",
};

const BREITE = 1000;

const ohneHtml = (s) => (s ?? "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
/** Commons-Eigenheiten glätten: doppelte »Unknown author«, Signaturen mit Zeitstempel */
const urheberSauber = (s) => {
  const t = s.replace(/^--/, "").replace(/\s*\d{1,2}:\d{2}, \d{1,2} \w+ \d{4} \(UTC\)$/, "").trim();
  return /^(Unknown author)+$/i.test(t) || !t ? "unbekannt" : t;
};
const warte = (ms) => new Promise((r) => setTimeout(r, ms));
const FREI = /^(CC0|CC BY(-SA)? [0-9.]+( de)?|Public domain|PD|No restrictions)/i;

/** fetch mit Wiederholung: Commons drosselt und trennt gelegentlich Verbindungen */
async function holen(url) {
  for (let versuch = 1; ; versuch++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.ok) return res;
      if ((res.status === 429 || res.status >= 500) && versuch < 5) { await warte(4000 * versuch); continue; }
      throw new Error(`${res.status} ${url}`);
    } catch (e) {
      if (versuch >= 5 || String(e).includes(" http")) throw e;
      await warte(3000 * versuch);
    }
  }
}

async function holeJson(url) {
  return (await holen(url)).json();
}

async function holeBytes(url) {
  return Buffer.from(await (await holen(url)).arrayBuffer());
}

if (process.argv[1] && process.argv[1].endsWith("fetch-kueste.mjs")) {
  const nachweise = existsSync(NACHWEISE) ? JSON.parse(readFileSync(NACHWEISE, "utf8")) : {};
  for (const [id, titel] of Object.entries(BILDER)) {
    const pfad = join(ZIEL, `${id}.webp`);
    if (existsSync(pfad) && nachweise[id] && !force) continue;
    const info = await holeJson(
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo" +
      `&iiprop=url|size|extmetadata&iiurlwidth=${BREITE}&titles=${encodeURIComponent("File:" + titel)}`,
    );
    const seite = Object.values(info.query.pages)[0];
    if (seite.missing !== undefined) throw new Error(`Nicht auf Commons: ${titel}`);
    const ii = seite.imageinfo[0];
    const meta = ii.extmetadata ?? {};
    const lizenz = ohneHtml(meta.LicenseShortName?.value);
    if (!FREI.test(lizenz)) throw new Error(`Keine freie Lizenz (${lizenz || "?"}): ${titel}`);
    const quelle = ii.width > BREITE ? ii.thumburl : ii.url;
    const puffer = await sharp(await holeBytes(quelle))
      .rotate()
      .resize({ width: BREITE, height: BREITE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 70 }).toBuffer();
    mkdirSync(dirname(pfad), { recursive: true });
    writeFileSync(pfad, puffer);
    nachweise[id] = {
      datei: `/kueste/galerie/${id}.webp`,
      titel,
      seite: ii.descriptionurl ?? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(titel)}`,
      lizenz,
      lizenzUrl: ohneHtml(meta.LicenseUrl?.value) || undefined,
      urheber: urheberSauber(ohneHtml(meta.Artist?.value).slice(0, 200) || ohneHtml(meta.Credit?.value).slice(0, 200)),
    };
    console.log(`${(puffer.length / 1024).toFixed(0).padStart(5)} KB  ${id}  (${lizenz})`);
    writeFileSync(NACHWEISE, JSON.stringify(nachweise, null, 2));
    await warte(600);
  }
  const gueltig = new Set(Object.keys(BILDER));
  const sortiert = Object.fromEntries(Object.entries(nachweise).filter(([k]) => gueltig.has(k)).sort(([a], [b]) => a.localeCompare(b)));
  mkdirSync(dirname(NACHWEISE), { recursive: true });
  writeFileSync(NACHWEISE, JSON.stringify(sortiert, null, 2) + "\n");
  console.log(`Fertig: ${Object.keys(sortiert).length} Bildnachweise in ${NACHWEISE}.`);
}
