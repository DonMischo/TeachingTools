/**
 * Lädt die Tier- und Pflanzenbilder für den Kinderatlas von Openclipart (CC0, gemeinfrei) und
 * schreibt sie als 256-px-PNG nach public/karten/kinderatlas/<id>.png, dazu lizenzen.json
 * (Titel, Künstler, Link). Die SVGs bleiben in .karten-roh/kinderatlas: manche nachgezeichneten
 * Bilder haben Megabytes an Pfaden — auf der Karte zählt nur das kleine Bild.
 * Ausgewählt nach: gezeichnet/illustriert, nicht comichaft, ein Tier allein, ohne Text.
 *
 * Aufruf:  node scripts/fetch-kinderatlas.mjs [--force]   (--force lädt vorhandene neu)
 * id → Openclipart-Nummer (https://openclipart.org/detail/<nummer>); ids wie in src/lib/karten/kinderatlas.ts
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const HIER = dirname(fileURLToPath(import.meta.url));
const ZIEL = resolve(HIER, "../public/karten/kinderatlas");
const ROH = resolve(HIER, "../.karten-roh/kinderatlas");
const PX = 256;
const force = process.argv.includes("--force");

export const AUSWAHL = {
  // Tiere
  eisbaer: 339174, wal: 321246, delfin: 269678, hai: 172431, krake: 331496, schildkroete: 304020,
  giraffe: 265297, zebra: 220641, nashorn: 262576, panda: 327536, tiger: 331108, orangutan: 331667,
  trampeltier: 215616, kaenguru: 248625, koala: 315790, krokodil: 332624, bison: 321546, grizzly: 330314,
  adler: 305693, waschbaer: 334231, biber: 330206, faultier: 301220, papagei: 246172, jaguar: 167328,
  lama: 213395, fuchs: 215762, igel: 333117, eichhoernchen: 295333,
  pinguin: 284922, robbe: 254459, elefant: 329922, dromedar: 194450, wolf: 261833, hirsch: 240553,
  // Pflanzen
  mais: 334727, ahorn: 292321, nadelbaum: 181473, weizen: 249258, ananas: 288872, banane: 194073,
  palme: 280182, laubbaum: 301099, kaffee: 143449, kartoffel: 291193, tulpe: 320163, traube: 242073,
  orange: 352630, olive: 326826, sonnenblume: 293651, kirschbluete: 347865, kiwi: 348293, kokosnuss: 298210,
  kaktus: 274970, bambus: 298386, reis: 323377,
  // Ohne passende Illustration (Kachel statt Bild): loewe, gorilla, kakao, tee
};

const kopf = { "User-Agent": "Mozilla/5.0 (TT Teaching Tools; Kinderatlas)" };
mkdirSync(ZIEL, { recursive: true });
mkdirSync(ROH, { recursive: true });
const lizenzDatei = join(ZIEL, "lizenzen.json");
const lizenzen = existsSync(lizenzDatei) ? JSON.parse(readFileSync(lizenzDatei, "utf8")) : {};

for (const [id, nummer] of Object.entries(AUSWAHL)) {
  const datei = join(ZIEL, `${id}.png`), roh = join(ROH, `${id}-${nummer}.svg`);
  if (!force && existsSync(datei) && lizenzen[id]?.nummer === nummer) continue;
  const svg = existsSync(roh) && !force ? readFileSync(roh, "utf8")
    : await (await fetch(`https://openclipart.org/download/${nummer}`, { headers: kopf })).text();
  if (!svg.includes("<svg")) { console.warn(`  ${id}: kein SVG (${nummer}) — übersprungen`); continue; }
  // Angaben aus den Metadaten der Detailseite (JSON-LD)
  const seite = await (await fetch(`https://openclipart.org/detail/${nummer}`, { headers: kopf })).text();
  const feld = (name) => seite.match(new RegExp(`"${name}":\\s*"([^"]+)"`))?.[1];
  const kuenstler = seite.match(/"artist":\s*\{[^}]*?"name":\s*"([^"]+)"/)?.[1];
  const lizenz = feld("license")?.replaceAll("\\/", "/");
  if (lizenz && !lizenz.includes("publicdomain/zero")) throw new Error(`${id}: Lizenz ist nicht CC0 (${lizenz})`);
  writeFileSync(roh, svg);
  // Auf PX × PX einpassen, Rand weg, Hintergrund durchsichtig
  // Auflösung aus der Bildgröße: längere Seite ≈ 1024 px (große Zeichnungen sprengen sonst die Grenze)
  const { width = 512, height = 512 } = await sharp(Buffer.from(svg)).metadata();
  const density = Math.max(1, Math.min(600, (72 * 1024) / Math.max(width, height)));
  await sharp(Buffer.from(svg), { density, limitInputPixels: false }).trim().resize(PX, PX, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(datei);
  lizenzen[id] = { nummer, titel: seite.match(/"@type":\s*"ImageObject"[\s\S]*?"name":\s*"([^"]+)"/)?.[1] ?? "", kuenstler: kuenstler ?? "",
    lizenz: "CC0 1.0", url: `https://openclipart.org/detail/${nummer}` };
  writeFileSync(lizenzDatei, JSON.stringify(lizenzen, null, 1));
  console.log(`  ${id.padEnd(14)} ${String(nummer).padEnd(7)} SVG ${(svg.length / 1024).toFixed(0).padStart(5)} KB → PNG ${(readFileSync(datei).length / 1024).toFixed(0).padStart(3)} KB  ${lizenzen[id].kuenstler}`);
}
writeFileSync(lizenzDatei, JSON.stringify(lizenzen, null, 1));
console.log(`Kinderatlas: ${Object.keys(AUSWAHL).length} Bilder in ${ZIEL}`);
