/**
 * Kopiert den Web-Worker von maplibre-gl nach public/karten/maplibre/.
 *
 * MapLibre 6 sucht seinen Worker relativ zu import.meta.url — das schreibt
 * webpack um, und der Worker lädt dann HTML statt JavaScript (leere Karte).
 * KartenAnsicht setzt deshalb setWorkerUrl("/karten/maplibre/maplibre-gl-worker.mjs").
 * Nach jedem Update von maplibre-gl neu ausführen; src/tests/kartenWorker.test.ts
 * schlägt an, wenn die Kopie veraltet ist.
 *
 * Aufruf:  npm run karten:worker
 */
import { copyFileSync, mkdirSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

const HIER = dirname(fileURLToPath(import.meta.url));
const QUELLE = resolve(HIER, "../node_modules/maplibre-gl/dist");
const ZIEL = resolve(HIER, "../public/karten/maplibre");
mkdirSync(ZIEL, { recursive: true });
for (const datei of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) copyFileSync(join(QUELLE, datei), join(ZIEL, datei));
console.log(`MapLibre-Worker nach ${ZIEL} kopiert.`);
