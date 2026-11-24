/**
 * Screenshots für die Medien-Folie im Workshop-Deck:
 * Sim »medien« und der TaskCrawler »Zeitreise der Medien« in der 3D-Ansicht.
 * Usage: TEACHER_USERNAME=… TEACHER_PASSWORD=… node shoot-medien.mjs
 */
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const BASE = process.env.BASE_URL ?? "http://localhost:1339";
const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), "out");
const DESKTOP = { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
try {
  const ctx = await browser.newContext(DESKTOP);
  const page = await ctx.newPage();
  const login = await ctx.request.post(`${BASE}/api/auth/login`, { data: { username: process.env.TEACHER_USERNAME, password: process.env.TEACHER_PASSWORD } });
  if (!login.ok()) throw new Error(`Login ${login.status()}`);
  await page.goto(`${BASE}/`);

  const api = async (url, body, method = "POST") => {
    const r = await ctx.request.fetch(`${BASE}${url}`, { method, data: body });
    if (!r.ok()) throw new Error(`${url} ${r.status()}: ${await r.text()}`);
    return r.json();
  };

  // Sim »medien«
  await page.goto(`${BASE}/simulationen/medien`);
  await sleep(4000);
  await page.screenshot({ path: path.join(OUT, "83-sim-medien.png") });
  console.log("83-sim-medien");

  // TaskCrawler »Zeitreise der Medien« als Gast in der 3D-Welt
  const games = await (await ctx.request.get(`${BASE}/api/exitgames`)).json();
  const game = games.find(g => /Zeitreise der Medien/.test(g.title));
  const classes = await (await ctx.request.get(`${BASE}/api/classes`)).json();
  const { join_code: code } = await api(`/api/exitgames/${game.id}/sessions`, { class_id: classes[0].id });
  await api("/api/guest/allow", { tool: "exitgame", code, allow: true }, "PATCH");
  console.log("session", code);

  const g = await (await browser.newContext(DESKTOP)).newPage();
  await g.goto(`${BASE}/play/taskcrawler/${code}?ansicht=frei`);
  await sleep(2500);
  await g.screenshot({ path: path.join(OUT, "84-taskcrawler-medien-join.png") });
  const name = g.locator("input[type=text], input:not([type])").first();
  if (await name.isVisible().catch(() => false)) {
    await name.fill("Mila M.");
    await name.press("Enter");
  }
  await sleep(10000);
  await g.locator("button:has-text('Leicht')").last().click().catch(() => {});
  await sleep(1000);
  await g.mouse.click(800, 450);
  await g.keyboard.down("w"); await sleep(1500); await g.keyboard.up("w");
  await sleep(2500);
  await g.screenshot({ path: path.join(OUT, "85-taskcrawler-medien-3d.png") });
  console.log("85-taskcrawler-medien-3d");
  await api(`/api/exitgame-sessions/${code}/close`, {});
} finally {
  await browser.close();
}
