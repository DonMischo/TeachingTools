/**
 * Screenshots für die Workshop-Folien »KI und Medienbildung« und »So entsteht TT«:
 * KI-Kompass, Klikk, Curriculinator und der graphify-Wissensgraph des Repos.
 * Usage: TEACHER_USERNAME=… TEACHER_PASSWORD=… node shoot-ki.mjs
 */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath, pathToFileURL } from "url";

const BASE = process.env.BASE_URL ?? "http://localhost:1339";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "out");
const DESKTOP = { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  const ctx = await browser.newContext(DESKTOP);
  const page = await ctx.newPage();
  const login = await ctx.request.post(`${BASE}/api/auth/login`, { data: { username: process.env.TEACHER_USERNAME, password: process.env.TEACHER_PASSWORD } });
  if (!login.ok()) throw new Error(`Login ${login.status()}`);

  for (const [url, name] of [
    ["/simulationen/kikompass", "86-sim-kikompass"],
    ["/simulationen/klikk", "87-sim-klikk"],
    ["/tools/curriculum", "88-tool-curriculum"],
  ]) {
    await page.goto(`${BASE}${url}`);
    await sleep(4000);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log(name);
  }

  // Wissensgraph (graphify-out ist lokal und gitignored)
  const graph = path.join(HERE, "..", "graphify-out", "graph.html");
  await page.goto(pathToFileURL(graph).href);
  await sleep(20000);
  await page.screenshot({ path: path.join(OUT, "89-graphify.png") });
  console.log("89-graphify");
} finally {
  await browser.close();
}
