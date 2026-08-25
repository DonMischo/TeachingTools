/**
 * Baut die Simulationen zu einer einzigen HTML-Datei.
 *
 * Vite bettet Schriften und Bilder schon als data:-URI ein; übrig bleiben eine
 * .js und eine .css daneben. Die werden hier in die HTML hineingezogen, damit
 * am Ende wirklich nur eine Datei übrig ist — die per Doppelklick läuft, ohne
 * Server, ohne Installation.
 *
 * Aufruf: npm run build:standalone
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const frontend = resolve(here, "..");
const buildDir = join(frontend, ".standalone-build");
const outDir = resolve(frontend, "..", "data", "standalone");
const outFile = join(outDir, "simulationen.html");

console.log("Baue die Simulationen …");
execFileSync("npx", ["vite", "build", "--config", "vite.standalone.config.ts"], {
  cwd: frontend,
  stdio: "inherit",
  shell: process.platform === "win32",
});

let html = readFileSync(join(buildDir, "index.html"), "utf8");

/** Holt eine Nachbardatei aus dem Build-Ordner. */
const assetOf = (url) => readFileSync(join(buildDir, url.replace(/^\//, "")), "utf8");

// <script src="/assets/x.js"> → <script>…</script>
html = html.replace(/<script([^>]*)\ssrc="([^"]+)"([^>]*)><\/script>/g, (_m, before, src, after) => {
  const code = assetOf(src).replace(/<\/script>/g, "<\\/script>");
  const type = /type="module"/.test(before + after) ? ' type="module"' : "";
  return `<script${type}>\n${code}\n</script>`;
});

// <link rel="stylesheet" href="/assets/x.css"> → <style>…</style>
html = html.replace(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_m, href) => {
  return `<style>\n${assetOf(href)}\n</style>`;
});

const leftovers = [...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map(m => m[1]);
if (leftovers.length) {
  console.error("Diese Dateien liegen noch daneben statt drin:", leftovers);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, html, "utf8");
rmSync(buildDir, { recursive: true, force: true });

const mb = (statSync(outFile).size / 1024 / 1024).toFixed(2);
console.log(`\nFertig: ${outFile}  (${mb} MB)`);
console.log("Doppelklick genügt — kein Server, keine Installation.");
