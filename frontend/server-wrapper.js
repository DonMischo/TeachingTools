/**
 * server-wrapper.js
 *
 * Builds Next.js when source changed, then serves it on PORT.
 * - WebSocket upgrades to /api/** → FastAPI directly
 * - Everything else → Next.js on NEXT_PORT
 */

const http = require("http");
// node-http-proxy (http-proxy) is unmaintained and calls the deprecated
// util._extend, which prints a DEP0060 warning on every start. Aliasing it to
// Object.assign before the library loads silences the warning without any
// behavior change (Object.assign is the documented replacement).
require("util")._extend = Object.assign;
const httpProxy = require("http-proxy");
const { spawn, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const dns = require("dns").promises;

const PORT = parseInt(process.env.PORT || "1339");
const NEXT_PORT = parseInt(process.env.NEXT_PORT || "3000");
const API_HOST = process.env.API_HOST || "127.0.0.1";
const API_PORT = parseInt(process.env.API_PORT || "8000");

// Walk a directory and return the newest mtime found
function newestMtime(dir, extensions = [".ts", ".tsx", ".js", ".json", ".css"]) {
  let newest = 0;
  function walk(d) {
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "tests") continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) { walk(full); }
      else if (extensions.some(x => e.name.endsWith(x))) {
        const mt = fs.statSync(full).mtimeMs;
        if (mt > newest) newest = mt;
      }
    }
  }
  walk(dir);
  return newest;
}

function needsBuild() {
  // A build is only usable if `next start` can find all of its manifests. A
  // persisted .next volume can hold a BUILD_ID from an interrupted or
  // version-mismatched build (e.g. after a Next upgrade) while these are
  // missing — that makes `next start` crash with ENOENT on prerender-manifest.
  // Treat any missing artifact as "must rebuild" before trusting mtimes.
  const required = [
    ".next/BUILD_ID",
    ".next/build-manifest.json",
    ".next/routes-manifest.json",
    ".next/prerender-manifest.json",
  ];
  if (required.some((f) => !fs.existsSync(f))) return true;
  const buildTime = fs.statSync(".next/BUILD_ID").mtimeMs;
  const srcTime = newestMtime("src");
  const cfgTime = Math.max(
    fs.existsSync("next.config.ts") ? fs.statSync("next.config.ts").mtimeMs : 0,
    fs.existsSync("next.config.js") ? fs.statSync("next.config.js").mtimeMs : 0,
    fs.existsSync("next.config.mjs") ? fs.statSync("next.config.mjs").mtimeMs : 0,
    fs.existsSync("tailwind.config.ts") ? fs.statSync("tailwind.config.ts").mtimeMs : 0,
    fs.existsSync("package.json") ? fs.statSync("package.json").mtimeMs : 0,
  );
  return Math.max(srcTime, cfgTime) > buildTime;
}

// Sync packages so a stale node_modules volume doesn't break the build (skipped when nothing changed).
require("./sync-deps").syncDeps();

// Snap! (public/snap) ist zu groß fürs Repo und wird einmalig geholt — hier und
// nicht im Dockerfile, weil der Bind-Mount ./frontend:/app alles überdeckt, was
// im Image unter /app liegt. Das Skript merkt sich die Version und tut beim
// zweiten Start nichts mehr. Ein Fehlschlag (kein Netz) darf den Start nicht
// aufhalten: dann fehlt nur das Snap!-Tool, der Rest läuft.
try {
  execSync("node scripts/fetch-snap.mjs", { stdio: "inherit" });
} catch {
  console.warn("Snap! konnte nicht geladen werden — /tools/snap bleibt leer. Nachholen: npm run fetch:snap");
}

if (needsBuild()) {
  console.log("Source changed — building Next.js...");
  // Alte Typen eines früheren `next dev` (tsconfig bindet .next/dev/types ein) verweisen auf
  // Seiten, die es nicht mehr gibt — der Typcheck des Builds bricht dann ab. Der Build braucht sie nicht.
  fs.rmSync(path.join(".next", "dev"), { recursive: true, force: true });
  execSync("npx next build", { stdio: "inherit" });
  console.log("Build complete.");
} else {
  console.log("No source changes detected, skipping build.");
}

// Start Next.js production server
const nextProc = spawn("npx", ["next", "start", "-p", String(NEXT_PORT)], {
  stdio: "inherit",
  shell: process.platform === "win32",
});
nextProc.on("exit", (code) => {
  console.error(`Next.js exited with code ${code}`);
  process.exit(code ?? 1);
});

// Generous timeout: bulk admin ops (e.g. generating credentials for a whole
// school) do hundreds of bcrypt hashes and can legitimately run ~1–2 minutes.
const httpProxy_ = httpProxy.createProxyServer({ proxyTimeout: 300000, timeout: 300000 });
const wsProxy = httpProxy.createProxyServer({
  target: { host: API_HOST, port: API_PORT },
  ws: true,
});

httpProxy_.on("error", (err, _req, res) => {
  if (res && !res.headersSent) res.writeHead(502).end("Bad gateway");
});
wsProxy.on("error", (_err, _req, socket) => { socket.destroy(); });

function getLanIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === "IPv4" && !iface.internal && !iface.address.startsWith("172.")) {
        return iface.address;
      }
    }
  }
  return null;
}

const server = http.createServer((req, res) => {
  if (req.url === "/server-ip") {
    const respond = (ip) => {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ ip }));
    };
    // Prefer HOST_IP injected by start.bat via docker-compose environment
    if (process.env.HOST_IP) { respond(process.env.HOST_IP); return; }
    const local = getLanIp();
    if (local) { respond(local); return; }
    // Last resort: resolve host.docker.internal
    dns.lookup("host.docker.internal").then(({ address }) => respond(address)).catch(() => respond(null));
    return;
  }
  httpProxy_.web(req, res, { target: `http://127.0.0.1:${NEXT_PORT}` });
});

server.on("upgrade", (req, socket, head) => {
  wsProxy.ws(req, socket, head);
});

// Only open the port once Next.js answers. `next start` needs a moment after
// spawning; a request in that window hit the proxy error handler above and got
// a bare 502 — right after every container start, often on the first page load.
// If Next.js never comes up, nextProc's exit handler ends the process anyway.
function waitForNext(onReady) {
  const probe = http.request(
    { host: "127.0.0.1", port: NEXT_PORT, path: "/", method: "HEAD", timeout: 2000 },
    (res) => { res.resume(); onReady(); },
  );
  probe.on("timeout", () => probe.destroy());
  probe.on("error", () => setTimeout(() => waitForNext(onReady), 250));
  probe.end();
}

waitForNext(() => {
  server.listen(PORT, () => {
    console.log(`TT - Teaching Tools listening on http://localhost:${PORT}`);
    console.log(`  → HTTP proxied to Next.js :${NEXT_PORT}`);
    console.log(`  → WS /api/** proxied to FastAPI ${API_HOST}:${API_PORT}`);
  });
});
