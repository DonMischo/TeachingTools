/**
 * take-screenshots.js
 *
 * Captures screenshots of all important Hauspokal pages.
 * Requires the app to be running on http://localhost:1339
 *
 * Usage:
 *   cd screenshots
 *   npm install
 *   npx playwright install chromium
 *   node take-screenshots.js
 *
 * Optional env:
 *   BASE_URL=http://localhost:1339   (default)
 *   OUT_DIR=./out                    (default: ./out)
 *   TEACHER_USERNAME=...             (for authenticated pages)
 *   TEACHER_PASSWORD=...
 */

import { chromium } from "playwright";
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

fs.mkdirSync(OUT_DIR, { recursive: true });

// ── Viewports ────────────────────────────────────────────────────────────────
const DESKTOP = { width: 1280, height: 800 };
const MOBILE  = { width: 390,  height: 844, isMobile: true, hasTouch: true };

// ── Screenshot helper ─────────────────────────────────────────────────────────
async function shot(page, name, waitFor = 800) {
  await new Promise(r => setTimeout(r, waitFor));
  // Keep waiting (up to 8s) while any "Loading…" / "Laden…" text is visible
  await page.waitForFunction(
    () => !document.body?.innerText?.match(/\bLoading\b|\bLaden\b|\bLade\b/i),
    { timeout: 8000 }
  ).catch(() => {}); // ignore if it never clears
  const file = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  ✓ ${name}.png`);
}

// ── Login helper ──────────────────────────────────────────────────────────────
// Login is in the sidebar flyout — click the "Login" icon button to open it first.
async function login(page, username, password) {
  await page.goto(`${BASE_URL}/`);
  await page.waitForLoadState("networkidle");
  // Click the sidebar login/user icon button (title="Login" when not authenticated)
  await page.click('button[title="Login"]');
  await page.waitForSelector('input[placeholder="Benutzername"]', { state: "visible" });
  await page.fill('input[placeholder="Benutzername"]', username);
  await page.fill('input[placeholder="Passwort"]', password);
  await page.keyboard.press("Enter");
  // Wait until the login button title changes away from "Login" — cookie is set
  await page.waitForFunction(
    () => document.querySelector('button[title="Login"]') === null,
    { timeout: 10000 }
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
const browser = await chromium.launch({ headless: true });

try {

  // ── 1. Public / unauthenticated pages (desktop) ──────────────────────────
  console.log("\n📸 Public pages (desktop)");
  {
    const ctx = await browser.newContext({ viewport: DESKTOP });
    const page = await ctx.newPage();

    await page.goto(`${BASE_URL}/`);
    await page.waitForLoadState("networkidle");
    await page.click('button[title="Login"]');
    await page.waitForSelector('input[placeholder="Benutzername"]', { state: "visible" });
    await shot(page, "01-login", 400);

    // Game join screens — join form shows without a valid code, that's fine
    await page.goto(`${BASE_URL}/play/DEMO`);
    await shot(page, "02-caputh-join-desktop");

    await page.goto(`${BASE_URL}/play/bingo/DEMO`);
    await shot(page, "03-bingo-join-desktop");

    await page.goto(`${BASE_URL}/play/auction/DEMO`);
    await shot(page, "04-auction-join-desktop");

    await ctx.close();
  }

  // ── 2. Mobile student views (game join screens) ───────────────────────────
  console.log("\n📱 Student game views (mobile)");
  {
    const ctx = await browser.newContext({ ...MOBILE, viewport: { width: MOBILE.width, height: MOBILE.height } });
    const page = await ctx.newPage();

    await page.goto(`${BASE_URL}/play/DEMO`);
    await shot(page, "10-student-caputh-join");

    await page.goto(`${BASE_URL}/play/bingo/DEMO`);
    await shot(page, "11-student-bingo-join");

    await page.goto(`${BASE_URL}/play/auction/DEMO`);
    await shot(page, "12-student-auction-join");

    await ctx.close();
  }

  // ── 3. Authenticated teacher pages ───────────────────────────────────────
  if (TEACHER_USER && TEACHER_PASS) {
    console.log("\n🔐 Authenticated teacher pages (desktop)");
    const ctx = await browser.newContext({ viewport: DESKTOP });
    const page = await ctx.newPage();

    await login(page, TEACHER_USER, TEACHER_PASS);

    const teacherPages = [
      ["20-home",         "/"],
      ["21-games",        "/games"],
      ["22-tools",        "/tools"],
      ["23-bingo-list",   "/bingo"],
      ["24-bingo-new",    "/bingo/new"],
      ["25-klassen",      "/klassen"],
      ["26-haeuser",      "/haeuser"],
      ["27-barometer",    "/barometer"],
      ["28-exit-ticket",  "/exit-ticket"],
      ["29-schreibraum",  "/schreibraum"],
      ["30-punkte",       "/punkte"],
    ];

    for (const [name, url] of teacherPages) {
      await page.goto(`${BASE_URL}${url}`);
      await page.waitForLoadState("networkidle");
      await shot(page, name);
    }

    // ── 3a. Bingo host view (needs a real session) ──────────────────────────
    // Auth is cookie-based — use credentials:"include" from the browser context.
    console.log("\n🎰 Bingo host + student views");
    try {
      const resp = await page.evaluate(async () => {
        const r = await fetch("/api/bingo", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: "Screenshot Demo",
            grid_size: 3,
            grid_cols: 3,
            pairs: Array.from({ length: 15 }, (_, i) => ({
              caller: `Frage ${i + 1}`,
              answer: `Antwort ${i + 1}`,
            })),
            max_points: 0,
          }),
        });
        const text = await r.text();
        if (!r.ok) throw new Error(`${r.status}: ${text}`);
        return JSON.parse(text);
      });

      if (resp?.code) {
        const code = resp.code;
        console.log(`  Created demo bingo session: ${code}`);

        // Host lobby view
        await page.goto(`${BASE_URL}/bingo/host/${code}`);
        await page.waitForLoadState("networkidle");
        await shot(page, "31-bingo-host-lobby", 1500);

        // Student join view (mobile)
        const mobileCtx = await browser.newContext({
          viewport: { width: MOBILE.width, height: MOBILE.height },
        });
        const mobilePage = await mobileCtx.newPage();

        await mobilePage.goto(`${BASE_URL}/play/bingo/${code}`);
        await shot(mobilePage, "32-student-bingo-join-real", 1200);

        // Fill in name and join as guest
        const nameInput = mobilePage.locator('input[placeholder="Dein Name"]');
        if (await nameInput.isVisible()) {
          await nameInput.fill("Demo Schüler");
          await mobilePage.locator("button:has-text('Beitreten')").click();
          await shot(mobilePage, "33-student-bingo-waiting", 1500);
        }

        // Start the game from host
        await page.goto(`${BASE_URL}/bingo/host/${code}`);
        await page.waitForLoadState("networkidle");
        await page.locator("button:has-text('Starten')").first().click();
        await new Promise(r => setTimeout(r, 600));
        await shot(page, "34-bingo-host-active", 1000);

        // Student should now see the playing view
        await shot(mobilePage, "35-student-bingo-playing", 1500);

        // Call a term from host
        const callBtn = page.locator("button:has-text('Nächster')").or(page.locator("button:has-text('Rufen')")).first();
        if (await callBtn.isVisible()) {
          await callBtn.click();
          await new Promise(r => setTimeout(r, 600));
          await shot(page, "36-bingo-host-called", 800);
          await shot(mobilePage, "37-student-bingo-called", 800);
        }

        await mobileCtx.close();
      }
    } catch (e) {
      console.warn("  ⚠ Bingo session screenshots skipped:", e.message);
    }

    // ── 3b. Auction host + student ──────────────────────────────────────────
    console.log("\n🏷 Auction views");
    try {
      const resp = await page.evaluate(async () => {
        const r = await fetch("/api/auction", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Screenshot Auktion", max_points: 100 }),
        });
        const text = await r.text();
        if (!r.ok) throw new Error(`${r.status}: ${text}`);
        return JSON.parse(text);
      });

      if (resp?.code) {
        const code = resp.code;

        await page.goto(`${BASE_URL}/auction/host/${code}`);
        await page.waitForLoadState("networkidle");
        await shot(page, "40-auction-host", 1200);

        const mobileCtx = await browser.newContext({ viewport: { width: MOBILE.width, height: MOBILE.height } });
        const mobilePage = await mobileCtx.newPage();
        await mobilePage.goto(`${BASE_URL}/play/auction/${code}`);
        await shot(mobilePage, "41-student-auction-join-real", 1200);
        await mobileCtx.close();
      }
    } catch (e) {
      console.warn("  ⚠ Auction screenshots skipped:", e.message);
    }

    // ── 3c. Barometer (teacher controlling) ─────────────────────────────────
    console.log("\n🏎 Barometer views");
    try {
      await page.goto(`${BASE_URL}/barometer`);
      await page.waitForLoadState("networkidle");
      await shot(page, "50-barometer-teacher", 1200);

      // Find the play URL from QR or code display
      const codeEl = await page.locator("[data-code], code, .font-mono").first();
      if (await codeEl.isVisible()) {
        const code = (await codeEl.textContent())?.trim();
        if (code) {
          const mobileCtx = await browser.newContext({ viewport: { width: MOBILE.width, height: MOBILE.height } });
          const mobilePage = await mobileCtx.newPage();
          await mobilePage.goto(`${BASE_URL}/play/barometer/${code}`);
          await shot(mobilePage, "51-student-barometer", 1200);
          await mobileCtx.close();
        }
      }
    } catch (e) {
      console.warn("  ⚠ Barometer screenshots skipped:", e.message);
    }

    // ── Mobile authenticated student views ────────────────────────────────
    console.log("\n📱 Mobile teacher pages");
    const mCtx = await browser.newContext({ viewport: { width: MOBILE.width, height: MOBILE.height } });
    const mPage = await mCtx.newPage();
    await login(mPage, TEACHER_USER, TEACHER_PASS);

    for (const [name, url] of [
      ["60-mobile-home",   "/"],
      ["61-mobile-games",  "/games"],
      ["62-mobile-bingo",  "/bingo"],
    ]) {
      await mPage.goto(`${BASE_URL}${url}`);
      await mPage.waitForLoadState("networkidle");
      await shot(mPage, name);
    }
    await mCtx.close();
    await ctx.close();

  } else {
    console.log("\n⚠  Set TEACHER_USERNAME and TEACHER_PASSWORD to capture authenticated pages.");
    console.log("   Only public/join screens were captured.\n");
  }

} finally {
  await browser.close();
}

console.log(`\n✅ Screenshots saved to: ${OUT_DIR}\n`);
