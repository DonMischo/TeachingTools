/**
 * take-screenshots.js
 *
 * Captures screenshots of the important TT pages for the pitch deck.
 * Requires the app to be running on http://localhost:1339
 *
 * Usage:
 *   cd screenshots
 *   npm install
 *   node take-screenshots.js
 *
 * Optional env:
 *   BASE_URL=http://localhost:1339   (default)
 *   OUT_DIR=./out                    (default: ./out)
 *   TEACHER_USERNAME=...             (for authenticated pages)
 *   TEACHER_PASSWORD=...
 *   ONLY=sim-,play                   (comma-separated name filter, re-shoots just those)
 */

import { chromium, request as playwrightRequest } from "playwright";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Ensure Chromium is installed before launching
console.log("⬇  Checking Playwright browser install…");
execSync("npx playwright install chromium", { stdio: "inherit" });

const BASE_URL = process.env.BASE_URL ?? "http://localhost:1339";
const OUT_DIR  = process.env.OUT_DIR  ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "out");
const TEACHER_USER = process.env.TEACHER_USERNAME ?? "";
const TEACHER_PASS = process.env.TEACHER_PASSWORD ?? "";
const ONLY = (process.env.ONLY ?? "").split(",").map(s => s.trim()).filter(Boolean);

fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Viewports ────────────────────────────────────────────────────────────────
// 16:9 at 2× so the shots fill a slide crisply.
const DESKTOP = { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 };
const MOBILE  = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

// ── Shot lists ───────────────────────────────────────────────────────────────
// [file name, path, extra wait in ms (WebGL/3D needs longer)]
const PUBLIC_PAGES = [
  ["01-play-hub",            "/play"],
  ["02-fragmente-join",      "/fragmente/join"],
];

const TEACHER_PAGES = [
  // Overview
  ["10-home",                "/"],
  ["11-aktivitaeten",        "/aktivitaeten"],
  ["12-tools",               "/tools"],
  ["13-simulationen",        "/simulationen"],
  ["14-erfolge",             "/erfolge"],
  // Hauspokal / Schule
  ["20-haeuser",             "/haeuser"],
  ["21-klassen",             "/klassen"],
  ["22-kalender",            "/kalender"],
  ["23-stundenplaner",       "/stundenplaner"],
  ["24-classroom",           "/classroom"],
  ["25-sportundspiele",      "/sportundspiele"],
  // Aktivitäten
  ["30-bingo",               "/aktivitaeten/bingo"],
  ["31-caputh",              "/aktivitaeten/caputh"],
  ["32-taskcrawler",         "/aktivitaeten/taskcrawler"],
  ["33-challenge",           "/aktivitaeten/challenge"],
  ["34-karten",              "/aktivitaeten/karten"],
  ["35-lueckentexte",        "/aktivitaeten/lueckentexte"],
  ["36-zeitstrahl",          "/aktivitaeten/zeitstrahl"],
  // Werkzeuge
  ["40-barometer",           "/tools/barometer"],
  ["41-exit-ticket",         "/tools/exit-ticket"],
  ["42-auktion",             "/tools/auction"],
  ["43-wettkampf",           "/tools/wettkampf"],
  ["44-sportfest",           "/tools/sportfest"],
  ["45-kompendium",          "/tools/kompendium"],
  ["46-schreibraum",         "/schreibraum"],
  ["47-fragmente",           "/fragmente"],
  // Simulationen
  ["50-sim-sonnensystem",    "/simulationen/sonnensystem", 5000],
  ["51-sim-erdaufbau",       "/simulationen/erdaufbau",    4000],
  ["52-sim-wilson",          "/simulationen/wilson",       3000],
  ["53-sim-kueste",          "/simulationen/kueste",       3000],
  ["54-sim-erosion",         "/simulationen/erosion",      4000],
  ["55-sim-stadt",           "/simulationen/stadt",        4000],
  ["56-sim-verkehr",         "/simulationen/verkehr",      5000],
  ["57-sim-leben",           "/simulationen/leben"],
  ["58-sim-leviathan",       "/simulationen/leviathan"],
  ["59-sim-ki",              "/simulationen/ki"],
  ["60-sim-algo",            "/simulationen/algo"],
  ["61-sim-schichten",       "/simulationen/schichten"],
  ["62-sim-pse",             "/simulationen/pse"],
  ["63-sim-strukturformeln", "/simulationen/strukturformeln"],
  ["64-sim-atommodelle",     "/simulationen/atommodelle"],
  ["65-sim-funktionen",      "/simulationen/funktionen"],
  ["66-sim-gleichungswaage", "/simulationen/gleichungswaage"],
  ["67-sim-groessen",        "/simulationen/groessen"],
  ["68-sim-rechenzeichen",   "/simulationen/rechenzeichen"],
  ["69-sim-vierecke",        "/simulationen/vierecke"],
  ["70-sim-dla",             "/simulationen/dla",          3000],
  ["71-sim-wfc",             "/simulationen/wfc"],
  ["72-sim-regeln",          "/simulationen/regeln"],
  ["73-sim-maus",            "/simulationen/maus"],
  ["74-sim-tippen",          "/simulationen/tippen"],
  ["75-sim-diagramme",       "/simulationen/diagramme"],
  ["76-sim-binaerrechner",   "/simulationen/binaerrechner"],
  ["77-sim-bildformate",     "/simulationen/bildformate"],
  ["78-sim-abacus",          "/simulationen/abacus"],
  ["79-sim-baum",            "/simulationen/baum",         3000],
  // Admin
  ["80-admin-availability",  "/admin/availability"],
  ["81-admin-permissions",   "/admin/permissions"],
  ["82-admin-style",         "/admin/style"],
];

const MOBILE_TEACHER_PAGES = [
  ["90-mobile-home",          "/"],
  ["91-mobile-simulationen",  "/simulationen"],
  ["92-mobile-aktivitaeten",  "/aktivitaeten"],
];

const wanted = name => !ONLY.length || ONLY.some(f => name.includes(f));

// ── Screenshot helper ─────────────────────────────────────────────────────────
async function shot(page, name, waitFor = 800) {
  await new Promise(r => setTimeout(r, waitFor));
  // Wait up to 10s for loading spinners to clear; if still loading after that, warn but continue
  const cleared = await page.waitForFunction(
    () => !document.body?.innerText?.match(/^Laden\.{0,3}$|^\s*Loading\.{0,3}\s*$/im),
    { timeout: 10000 }
  ).then(() => true).catch(() => false);
  if (!cleared) console.warn(`  ⚠ ${name}: still loading after 10s`);
  const file = path.join(OUT_DIR, `${name}.png`);
  // Busy render loops (erosion) can starve the default 30s screenshot timeout.
  await page.screenshot({ path: file, fullPage: false, timeout: 120000 });
  console.log(`  ✓ ${name}.png`);
}

async function shootList(page, list) {
  for (const [name, url, wait] of list) {
    if (!wanted(name)) continue;
    try {
      const resp = await page.goto(`${BASE_URL}${url}`);
      if (resp && resp.status() >= 400) console.warn(`  ⚠ ${name}: HTTP ${resp.status()} (route missing in this build?)`);
      // Live pages keep sockets/polls open, so networkidle may never come.
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      await shot(page, name, wait ?? 800);
    } catch (e) {
      console.warn(`  ⚠ ${name} skipped: ${e.message.split("\n")[0]}`);
    }
  }
}

// ── Login helper ──────────────────────────────────────────────────────────────
// Call the API directly from Node to get the hp_session cookie, then inject it
// into the browser context — avoids flaky UI interaction in headless mode.
async function login(page, username, password) {
  const apiCtx = await playwrightRequest.newContext({ baseURL: BASE_URL });
  const resp = await apiCtx.post("/api/auth/login", {
    data: { username, password },
    headers: { "Content-Type": "application/json" },
  });
  if (!resp.ok()) {
    const body = await resp.text();
    throw new Error(`Login failed ${resp.status()}: ${body}`);
  }
  const cookies = resp.headers()["set-cookie"];
  await apiCtx.dispose();

  const match = cookies?.match(/hp_session=([^;]+)/);
  if (!match) throw new Error("hp_session cookie not found in login response");

  const url = new URL(BASE_URL);
  await page.context().addCookies([{
    name: "hp_session",
    value: match[1],
    domain: url.hostname,
    path: "/",
    httpOnly: true,
    secure: false,
  }]);

  // Navigate to home so the React auth context hydrates from the cookie
  await page.goto(`${BASE_URL}/`);
  await page.waitForLoadState("networkidle");
  await new Promise(r => setTimeout(r, 800));
}

async function apiPost(page, url, body, method = "POST") {
  return page.evaluate(async ([url, body, method]) => {
    const r = await fetch(url, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const text = await r.text();
    if (!r.ok) throw new Error(`${r.status}: ${text}`);
    return JSON.parse(text);
  }, [url, body, method]);
}

// Guests (the phone shots) may only join once the host opened the session for them.
const allowGuests = (page, tool, code) => apiPost(page, "/api/guest/allow", { tool, code, allow: true }, "PATCH");

// ── Main ──────────────────────────────────────────────────────────────────────
// WebGL via SwiftShader so the 3D simulations render headless.
const browser = await chromium.launch({ headless: true, args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

try {

  // ── 1. Public pages (desktop + mobile) ────────────────────────────────────
  console.log("\n📸 Public pages");
  {
    const ctx = await browser.newContext(DESKTOP);
    await shootList(await ctx.newPage(), PUBLIC_PAGES);
    await ctx.close();

    const mCtx = await browser.newContext(MOBILE);
    await shootList(await mCtx.newPage(), PUBLIC_PAGES.map(([n, u, w]) => [`${n}-mobile`, u, w]));
    await mCtx.close();
  }

  if (!TEACHER_USER || !TEACHER_PASS) {
    console.log("\n⚠  Set TEACHER_USERNAME and TEACHER_PASSWORD to capture authenticated pages.");
    console.log("   Only public pages were captured.\n");
  } else {

    // ── 2. Teacher pages (desktop) ──────────────────────────────────────────
    console.log("\n🔐 Teacher pages (desktop)");
    const ctx = await browser.newContext(DESKTOP);
    const page = await ctx.newPage();
    await login(page, TEACHER_USER, TEACHER_PASS);
    await shootList(page, TEACHER_PAGES);

    // ── 3. Bingo live: host + student on a phone ────────────────────────────
    if (wanted("bingo-live")) {
      console.log("\n🎰 Bingo live");
      try {
        const { code } = await apiPost(page, "/api/bingo", {
          title: "Screenshot Demo",
          grid_size: 3,
          grid_cols: 3,
          pairs: Array.from({ length: 15 }, (_, i) => ({ caller: `Frage ${i + 1}`, answer: `Antwort ${i + 1}` })),
          max_points: 0,
        });
        console.log(`  Created demo bingo session: ${code}`);
        await allowGuests(page, "bingo", code);

        await page.goto(`${BASE_URL}/aktivitaeten/bingo/host/${code}`);
        await shot(page, "100-bingo-live-host-lobby", 1500);

        const mCtx = await browser.newContext(MOBILE);
        const m = await mCtx.newPage();
        await m.goto(`${BASE_URL}/play/bingo/${code}`);
        await shot(m, "101-bingo-live-student-join", 1200);

        const nameInput = m.locator('input[placeholder="Dein Name"]');
        if (await nameInput.isVisible()) {
          await nameInput.fill("Mila Muster");
          await m.locator("button:has-text('Beitreten')").click();
          await shot(m, "102-bingo-live-student-waiting", 1500);
        }

        await page.goto(`${BASE_URL}/aktivitaeten/bingo/host/${code}`);
        await page.locator("button:has-text('Starten')").first().click();
        await shot(page, "103-bingo-live-host-active", 1200);
        await shot(m, "104-bingo-live-student-playing", 1500);

        const callBtn = page.locator("button:has-text('Nächster')").or(page.locator("button:has-text('Rufen')")).first();
        if (await callBtn.isVisible()) {
          await callBtn.click();
          await shot(page, "105-bingo-live-host-called", 1200);
          await shot(m, "106-bingo-live-student-called", 800);
        }
        await mCtx.close();
      } catch (e) {
        console.warn("  ⚠ Bingo live skipped:", e.message.split("\n")[0]);
      }
    }

    // ── 4. Auction live ─────────────────────────────────────────────────────
    if (wanted("auktion-live")) {
      console.log("\n🏷 Auktion live");
      try {
        const { code } = await apiPost(page, "/api/auction", { title: "Screenshot Auktion", max_points: 100 });
        await allowGuests(page, "auction", code);
        await page.goto(`${BASE_URL}/tools/auction/host/${code}`);
        await shot(page, "110-auktion-live-host", 1500);

        const mCtx = await browser.newContext(MOBILE);
        const m = await mCtx.newPage();
        await m.goto(`${BASE_URL}/play/auction/${code}`);
        await shot(m, "111-auktion-live-student", 1200);
        await mCtx.close();
      } catch (e) {
        console.warn("  ⚠ Auktion live skipped:", e.message.split("\n")[0]);
      }
    }
    await ctx.close();

    // ── 5. Teacher pages (mobile) ───────────────────────────────────────────
    console.log("\n📱 Teacher pages (mobile)");
    const mCtx = await browser.newContext(MOBILE);
    const mPage = await mCtx.newPage();
    await login(mPage, TEACHER_USER, TEACHER_PASS);
    await shootList(mPage, MOBILE_TEACHER_PAGES);
    await mCtx.close();
  }

} finally {
  await browser.close();
}

console.log(`\n✅ Screenshots saved to: ${OUT_DIR}\n`);
