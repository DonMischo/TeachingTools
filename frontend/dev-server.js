/**
 * dev-server.js
 *
 * Thin wrapper for development: starts `next dev` on NEXT_PORT and then
 * proxies everything on PORT — HTTP to Next.js, WebSocket upgrades to FastAPI.
 * This is necessary because `npx next dev` does not forward WS upgrade requests.
 */

const http = require("http");
// Silence DEP0060: node-http-proxy calls the deprecated util._extend.
require("util")._extend = Object.assign;
const httpProxy = require("http-proxy");
const { spawn } = require("child_process");

const PORT = parseInt(process.env.PORT || "1339");
const NEXT_PORT = parseInt(process.env.NEXT_PORT || "3000");
const API_HOST = process.env.API_HOST || "127.0.0.1";
const API_PORT = parseInt(process.env.API_PORT || "8000");

const { execSync } = require("child_process");
console.log("Syncing node_modules...");
execSync("npm install --legacy-peer-deps --prefer-offline", { stdio: "inherit" });

const nextProc = spawn(
  "npx",
  ["next", "dev", "-p", String(NEXT_PORT), "-H", "0.0.0.0", "--webpack"],
  { stdio: "inherit", shell: process.platform === "win32" },
);
nextProc.on("exit", (code) => process.exit(code ?? 1));

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

const os = require("os");
function getLanIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === "IPv4" && !iface.internal && !iface.address.startsWith("172."))
        return iface.address;
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
    if (process.env.HOST_IP) { respond(process.env.HOST_IP); return; }
    respond(getLanIp());
    return;
  }
  httpProxy_.web(req, res, { target: `http://127.0.0.1:${NEXT_PORT}` });
});

server.on("upgrade", (req, socket, head) => {
  wsProxy.ws(req, socket, head);
});

server.listen(PORT, () => {
  console.log(`[dev] Hauspokal dev proxy on :${PORT}`);
  console.log(`  → HTTP → Next.js :${NEXT_PORT}`);
  console.log(`  → WS upgrades → FastAPI ${API_HOST}:${API_PORT}`);
});
