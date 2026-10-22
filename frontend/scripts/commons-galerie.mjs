/**
 * Gemeinsamer Teil der Galerie-Skripte (Küste, Vulkane): holt Bilder von
 * Wikimedia Commons, prüft die Lizenz, verkleinert sie als WebP ins Repo
 * und schreibt die Bildnachweise (Urheber, Lizenz, Commons-Seite) als JSON.
 *
 * Nur freie Lizenzen: gemeinfrei, CC0, CC BY, CC BY-SA — sonst bricht das
 * Skript mit einer Meldung ab. Die Bilder liegen lokal, damit die
 * Simulationen offline im Schulnetz laufen und keine Schüler-IP an Dritte geht.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import sharp from "sharp";

const UA = "HauspokalSchule/1.0 (Unterrichtssimulation; https://github.com/DonMischo/Hauspokal)";
export const FREI = /^(CC0|CC BY(-SA)? [0-9.]+( de| igo)?|Public domain|PD|No restrictions)/i;

const ohneHtml = (s) => (s ?? "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
/** Commons-Eigenheiten glätten: doppelte »Unknown author«, Signaturen mit Zeitstempel */
const urheberSauber = (s) => {
  const t = s.replace(/^--/, "").replace(/\s*\d{1,2}:\d{2}, \d{1,2} \w+ \d{4} \(UTC\)$/, "").trim();
  return /^(Unknown author)+$/i.test(t) || !t ? "unbekannt" : t;
};
const warte = (ms) => new Promise((r) => setTimeout(r, ms));

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

/**
 * @param {object} o
 * @param {Record<string, string>} o.bilder  id → Dateiname auf Commons
 * @param {string} o.ziel        Ordner für die WebP-Dateien (unter public/)
 * @param {string} o.nachweise   Pfad der JSON-Datei mit den Bildnachweisen
 * @param {string} o.url         öffentlicher Pfad-Anfang, z. B. "/vulkan/galerie"
 * @param {boolean} [o.force]    vorhandene Bilder neu holen
 * @param {number} [o.breite]
 */
export async function holeGalerie({ bilder, ziel, nachweise: datei, url, force = false, breite = 1000 }) {
  const nachweise = existsSync(datei) ? JSON.parse(readFileSync(datei, "utf8")) : {};
  for (const [id, titel] of Object.entries(bilder)) {
    const pfad = join(ziel, `${id}.webp`);
    if (existsSync(pfad) && nachweise[id] && !force) continue;
    const info = await (await holen(
      "https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo" +
      `&iiprop=url|size|extmetadata&iiurlwidth=${breite}&titles=${encodeURIComponent("File:" + titel)}`,
    )).json();
    const seite = Object.values(info.query.pages)[0];
    if (seite.missing !== undefined) throw new Error(`Nicht auf Commons: ${titel}`);
    const ii = seite.imageinfo[0];
    const meta = ii.extmetadata ?? {};
    const lizenz = ohneHtml(meta.LicenseShortName?.value);
    if (!FREI.test(lizenz)) throw new Error(`Keine freie Lizenz (${lizenz || "?"}): ${titel}`);
    const quelle = ii.width > breite ? ii.thumburl : ii.url;
    const puffer = await sharp(Buffer.from(await (await holen(quelle)).arrayBuffer()))
      .rotate()
      .resize({ width: breite, height: breite, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 70 }).toBuffer();
    mkdirSync(dirname(pfad), { recursive: true });
    writeFileSync(pfad, puffer);
    nachweise[id] = {
      datei: `${url}/${id}.webp`,
      titel,
      seite: ii.descriptionurl ?? `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(titel)}`,
      lizenz,
      lizenzUrl: ohneHtml(meta.LicenseUrl?.value) || undefined,
      urheber: urheberSauber(ohneHtml(meta.Artist?.value).slice(0, 200) || ohneHtml(meta.Credit?.value).slice(0, 200)),
    };
    console.log(`${(puffer.length / 1024).toFixed(0).padStart(5)} KB  ${id}  (${lizenz})`);
    writeFileSync(datei, JSON.stringify(nachweise, null, 2));
    await warte(600);
  }
  const gueltig = new Set(Object.keys(bilder));
  const sortiert = Object.fromEntries(Object.entries(nachweise).filter(([k]) => gueltig.has(k)).sort(([a], [b]) => a.localeCompare(b)));
  mkdirSync(dirname(datei), { recursive: true });
  writeFileSync(datei, JSON.stringify(sortiert, null, 2) + "\n");
  console.log(`Fertig: ${Object.keys(sortiert).length} Bildnachweise in ${datei}.`);
}
