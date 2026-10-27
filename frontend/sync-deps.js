/**
 * sync-deps.js
 *
 * Hält das node_modules-Volume passend zu package.json/package-lock.json, ohne den Start
 * bei schlechtem Netz zu blockieren:
 * - Haben sich beide Dateien seit dem letzten erfolgreichen Install nicht geändert
 *   (Fingerabdruck in node_modules/.sync-stamp), wird npm gar nicht erst gestartet.
 * - Sonst läuft npm install mit kurzen Netz-Timeouts und höchstens 3 Minuten.
 * - Schlägt das fehl, geht es mit dem vorhandenen node_modules weiter (nur Warnung).
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const STAMP = path.join("node_modules", ".sync-stamp");

function fingerprint() {
  const h = crypto.createHash("sha256");
  for (const f of ["package.json", "package-lock.json"]) if (fs.existsSync(f)) h.update(fs.readFileSync(f));
  return h.digest("hex");
}

function syncDeps() {
  const fp = fingerprint();
  const haveModules = fs.existsSync(path.join("node_modules", ".package-lock.json"));
  if (haveModules && fs.existsSync(STAMP) && fs.readFileSync(STAMP, "utf8").trim() === fp) {
    console.log("node_modules up to date, skipping npm install.");
    return;
  }
  console.log("Syncing node_modules...");
  try {
    execSync("npm install --legacy-peer-deps --prefer-offline --no-audit --no-fund --fetch-timeout=30000 --fetch-retries=1", {
      stdio: "inherit",
      timeout: 180000,
    });
    // npm kann package-lock.json beim Install umschreiben: Fingerabdruck danach neu bilden
    fs.writeFileSync(STAMP, fingerprint());
  } catch (e) {
    if (!haveModules) throw e;
    console.warn("npm install failed or timed out (network?). Continuing with the existing node_modules.");
  }
}

module.exports = { syncDeps };
