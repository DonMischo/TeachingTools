/**
 * Liest die Lizenzen der direkten npm-Abhängigkeiten aus node_modules/<paket>/package.json
 * und schreibt src/lib/quellen/pakete.json — für die Admin-Seite »Quellen und Lizenzen«.
 * Nichts wird geraten: fehlt das Feld »license«, steht dort »unbekannt«.
 *
 * Aufruf:  node scripts/quellen-pakete.mjs   (nach jedem npm install mit neuen Paketen)
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const HIER = dirname(fileURLToPath(import.meta.url));
const WURZEL = resolve(HIER, "..");
const paket = JSON.parse(readFileSync(join(WURZEL, "package.json"), "utf8"));

// Laufzeit-Pakete plus die Build-Werkzeuge, mit denen Daten in public/ entstehen
const BUILD = ["mapshaper", "geotiff", "proj4", "sharp"];
const namen = [...Object.keys(paket.dependencies ?? {}), ...BUILD.filter((n) => paket.devDependencies?.[n] || existsSync(join(WURZEL, "node_modules", n)))];

const liste = [...new Set(namen)].sort().map((name) => {
  const datei = join(WURZEL, "node_modules", name, "package.json");
  if (!existsSync(datei)) return { name, version: "", lizenz: "unbekannt", url: "", art: BUILD.includes(name) ? "build" : "laufzeit" };
  const p = JSON.parse(readFileSync(datei, "utf8"));
  const lizenz = typeof p.license === "string" ? p.license : p.license?.type ?? (p.licenses?.map((l) => l.type).join(" OR ") || "unbekannt");
  const repo = typeof p.repository === "string" ? p.repository : p.repository?.url ?? "";
  const url = p.homepage || repo.replace(/^git\+/, "").replace(/\.git$/, "").replace(/^git:\/\//, "https://");
  return { name, version: p.version, lizenz, url, art: BUILD.includes(name) ? "build" : "laufzeit" };
});

const ziel = join(WURZEL, "src/lib/quellen/pakete.json");
mkdirSync(dirname(ziel), { recursive: true });
writeFileSync(ziel, JSON.stringify(liste, null, 2) + "\n");
console.log(`${liste.length} Pakete → ${ziel}`);
for (const p of liste) console.log(`  ${p.name.padEnd(36)} ${p.lizenz}`);
