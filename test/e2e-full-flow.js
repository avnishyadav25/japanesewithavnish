/**
 * E2E full flow: public pages, tutor, quiz, scoreboard, student auth/dashboard, admin.
 * Requires: E2E_BASE_URL (e.g. http://localhost:3001), optional E2E_ADMIN_*, E2E_STUDENT_1_*.
 * Screenshots saved to test/screenshots/. Run: npm run e2e (or node test/e2e-full-flow.js)
 */
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

const BASE_URL = process.env.E2E_BASE_URL || "http://localhost:3001";
const HEADLESS = process.env.E2E_HEADLESS !== "false";
const SCREENSHOT_DIR = path.resolve(__dirname, "screenshots");
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "";
const STUDENT_EMAIL = process.env.E2E_STUDENT_1_EMAIL || "";
const STUDENT_PASSWORD = process.env.E2E_STUDENT_1_PASSWORD || "";

function ensureScreenshotDir() {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
}

async function screenshot(page, name) {
  ensureScreenshotDir();
  const file = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true }).catch((e) => console.warn("Screenshot failed:", name, e.message));
  console.log("  📸", name + ".png");
}

async function main() {
  console.log("E2E base URL:", BASE_URL);
  ensureScreenshotDir();

  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  const errors = [];

  try {
    // --- Public: Home ---
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 15000 }).catch((e) => errors.push({ step: "home", err: e.message }));
    await page.waitForTimeout(800);
    await screenshot(page, "home-hero");

    // --- Public: Login page ---
    await page.goto(BASE_URL + "/login", { waitUntil: "domcontentloaded", timeout: 10000 }).catch((e) => errors.push({ step: "login", err: e.message }));
    await page.waitForTimeout(500);
    await screenshot(page, "login-form");

    // --- Public: Tutor ---
    await page.goto(BASE_URL + "/tutor", { waitUntil: "domcontentloaded", timeout: 10000 }).catch((e) => errors.push({ step: "tutor", err: e.message }));
    await page.waitForTimeout(1000);
    await screenshot(page, "tutor-chat");

    // --- Public: Scoreboard ---
    await page.goto(BASE_URL + "/scoreboard", { waitUntil: "domcontentloaded", timeout: 10000 }).catch((e) => errors.push({ step: "scoreboard", err: e.message }));
    await page.waitForTimeout(500);
    await screenshot(page, "scoreboard");

    // --- Quiz: wait for questions to load, then answer each (first option) and Next / Finish Quiz ---
    await page.goto(BASE_URL + "/quiz", { waitUntil: "domcontentloaded", timeout: 10000 }).catch((e) => errors.push({ step: "quiz", err: e.message }));
    await page.waitForSelector("text=Question 1 of", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1000);
    for (let q = 0; q < 12; q++) {
      const optionsGrid = page.locator(".bento-span-4 .grid").first();
      const firstOption = optionsGrid.locator("button").first();
      await firstOption.waitFor({ state: "visible", timeout: 3000 }).catch(() => {});
      await firstOption.click().catch(() => {});
      await page.waitForTimeout(400);
      const nextBtn = page.getByRole("button", { name: /Next|Finish Quiz/ });
      await nextBtn.waitFor({ state: "visible", timeout: 2000 }).catch(() => {});
      await nextBtn.click().catch(() => {});
      await page.waitForTimeout(800);
      if (page.url().includes("/quiz/result")) break;
    }
    await page.waitForTimeout(1000);
    if (page.url().includes("/quiz/result")) {
      await screenshot(page, "quiz-result-n5");
    }

    // --- Student login + dashboard + review + account (if creds set) ---
    if (STUDENT_EMAIL && STUDENT_PASSWORD) {
      await page.goto(BASE_URL + "/login", { waitUntil: "domcontentloaded", timeout: 10000 }).catch((e) => errors.push({ step: "student login page", err: e.message }));
      await page.waitForTimeout(500);
      await page.locator('input[type="email"]').first().fill(STUDENT_EMAIL).catch(() => {});
      await page.locator('input[type="password"]').first().fill(STUDENT_PASSWORD).catch(() => {});
      await page.locator('button[type="submit"]').first().click().catch(() => {});
      await page.waitForTimeout(3000);
      if (page.url().includes("/learn/dashboard") || page.url().includes("/dashboard")) {
        await screenshot(page, "learn-dashboard-rewards");
      }
      await page.goto(BASE_URL + "/review", { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(800);
      await screenshot(page, "review-page");
      await page.goto(BASE_URL + "/account", { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(800);
      await screenshot(page, "account-settings");
    } else {
      await page.goto(BASE_URL + "/learn/dashboard", { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(1000);
      await screenshot(page, "learn-dashboard-rewards");
      await page.goto(BASE_URL + "/review", { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(800);
      await screenshot(page, "review-page");
    }

    // --- Admin login + dashboard, students, prompts (if creds set) ---
    if (ADMIN_EMAIL && ADMIN_PASSWORD) {
      await page.goto(BASE_URL + "/admin/login", { waitUntil: "domcontentloaded", timeout: 10000 }).catch((e) => errors.push({ step: "admin login page", err: e.message }));
      await page.waitForTimeout(500);
      await page.locator('input[type="email"]').fill(ADMIN_EMAIL).catch(() => {});
      await page.locator('input[type="password"]').fill(ADMIN_PASSWORD).catch(() => {});
      await page.locator('button[type="submit"]').click().catch(() => {});
      await page.waitForTimeout(3000);
      if (page.url().includes("/admin") && !page.url().includes("/admin/login")) {
        await screenshot(page, "admin-dashboard");
        await page.goto(BASE_URL + "/admin/students", { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1000);
        await screenshot(page, "admin-students-list");
        await page.goto(BASE_URL + "/admin/prompts", { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1000);
        await screenshot(page, "admin-prompts");
      }
    } else {
      await page.goto(BASE_URL + "/admin/login", { waitUntil: "domcontentloaded", timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(500);
      await screenshot(page, "admin-login");
    }
  } catch (e) {
    errors.push({ step: "run", err: e.message });
    console.error("E2E error:", e.message);
  } finally {
    await browser.close();
  }

  if (errors.length > 0) {
    console.log("\n⚠️ Errors encountered:");
    errors.forEach(({ step, err }) => console.log("  -", step, ":", err));
    process.exitCode = 1;
  } else {
    console.log("\n✅ E2E flow completed. Screenshots in test/screenshots/");
  }
}

main();
