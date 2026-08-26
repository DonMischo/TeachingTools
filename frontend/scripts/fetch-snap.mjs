/**
 * Lädt Snap! (Berkeley) als statischen Ordner nach public/snap/.
 *
 * Snap! ist eine reine Client-App: kein Build, kein Server, keine CDN-Aufrufe —
 * auch die Kostüm-/Klang-Bibliotheken liegen als Dateien bei. Damit läuft der
 * Editor im Schulnetz vollständig offline.
 *
 * Der Ordner ist zu groß fürs Repo (~90 MB) und deshalb in .gitignore; dieses
 * Skript holt ihn einmalig. Aufruf:  npm run fetch:snap  [-- --force]
 */
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "fs";
import { dirname, join } from "path";
import JSZip from "jszip";

// Feste Version statt "latest": die Entwicklerversion zeigt beim Start einen
// Warndialog, der das programmatische Laden von Projekten blockiert.
const VERSION = "v12.0.6";
const URL = `https://codeload.github.com/jmoenig/Snap/zip/refs/tags/${VERSION}`;
const TARGET = "public/snap";
const STAMP = join(TARGET, ".snap-version");

// help/ sind ~93 MB Hilfebilder zu einzelnen Blöcken (englisch) — für den
// Unterrichtseinsatz verzichtbar, der Rest bleibt vollständig.
const SKIP = ["help/"];

const force = process.argv.includes("--force");

if (existsSync(STAMP) && readFileSync(STAMP, "utf8").trim() === VERSION && !force) {
  console.log(`Snap! ${VERSION} liegt bereits in ${TARGET}/ — nichts zu tun (--force erzwingt neu).`);
  process.exit(0);
}

console.log(`Lade Snap! ${VERSION} …`);
const res = await fetch(URL);
if (!res.ok) throw new Error(`Download fehlgeschlagen: ${res.status} ${res.statusText}`);
const buf = Buffer.from(await res.arrayBuffer());
console.log(`  ${(buf.length / 1024 / 1024).toFixed(0)} MB geladen, entpacke …`);

const zip = await JSZip.loadAsync(buf);
if (existsSync(TARGET)) rmSync(TARGET, { recursive: true, force: true });

let written = 0;
let skipped = 0;
for (const entry of Object.values(zip.files)) {
  if (entry.dir) continue;
  // Im Archiv liegt alles unter einem Wurzelordner (Snap-12.0.6/) — abschneiden.
  const rel = entry.name.split("/").slice(1).join("/");
  if (!rel) continue;
  if (SKIP.some(prefix => rel.startsWith(prefix))) { skipped++; continue; }
  const dest = join(TARGET, rel);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, await entry.async("nodebuffer"));
  written++;
}

writeFileSync(STAMP, `${VERSION}\n`);
console.log(`Fertig: ${written} Dateien nach ${TARGET}/ (${skipped} übersprungen: ${SKIP.join(", ")}).`);
