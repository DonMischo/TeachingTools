/**
 * server-wrapper.js
 *
 * Builds Next.js when source changed, then serves it on PORT.
 * - WebSocket upgrades to /api/** → FastAPI directly
 * - Everything else → Next.js on NEXT_PORT
 */

const http = require("http");
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
      if (e.name.startsWith(".") || e.name === "node_modules") continue;
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
  const buildId = ".next/BUILD_ID";
  if (!fs.existsSync(buildId)) return true;
  const buildTime = fs.statSync(buildId).mtimeMs;
  const srcTime = newestMtime("src");
  const cfgTime = Math.max(
    fs.existsSync("next.config.ts") ? fs.statSync("next.config.ts").mtimeMs : 0,
    fs.existsSync("next.config.js") ? fs.statSync("next.config.js").mtimeMs : 0,
    fs.existsSync("tailwind.config.ts") ? fs.statSync("tailwind.config.ts").mtimeMs : 0,
    fs.existsSync("package.json") ? fs.statSync("package.json").mtimeMs : 0,
  );
  return Math.max(srcTime, cfgTime) > buildTime;
}

if (needsBuild()) {
  console.log("Source changed — building Next.js...");
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

const httpProxy_ = httpProxy.createProxyServer({});
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
    const local = getLanIp();
    const respond = (ip) => {
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      res.end(JSON.stringify({ ip }));
    };
    if (local) { respond(local); return; }
    // Inside Docker: resolve the host machine's IP via host.docker.internal
    dns.lookup("host.docker.internal").then(({ address }) => respond(address)).catch(() => respond(null));
    return;
  }
  httpProxy_.web(req, res, { target: `http://127.0.0.1:${NEXT_PORT}` });
});

server.on("upgrade", (req, socket, head) => {
  wsProxy.ws(req, socket, head);
});

server.listen(PORT, () => {
  console.log(`Hauspokal listening on http://localhost:${PORT}`);
  console.log(`  → HTTP proxied to Next.js :${NEXT_PORT}`);
  console.log(`  → WS /api/** proxied to FastAPI ${API_HOST}:${API_PORT}`);
});
