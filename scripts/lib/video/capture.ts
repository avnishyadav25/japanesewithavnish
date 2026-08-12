/**
 * Real-page B-roll capture.
 *
 * Drives Playwright over the live site so a video can cut to the actual product — a lesson
 * page, a kanji detail, the curriculum browser — rather than only showing template scenes.
 * Builds on the pattern already proven in scripts/seed-guide-content.ts (dynamic-import
 * playwright, screenshot, upload to R2).
 *
 * Two things matter more than they might seem:
 *
 * 1. The page must be CLEAN. This site loads Monetag, AdSense, Infolinks, GA, GTM and Meta
 *    Pixel. An ad unit or a cookie banner in the middle of a polished teaching video looks
 *    worse than having no B-roll at all, so third-party hosts are blocked at the network layer
 *    AND their containers are hidden with injected CSS — belt and braces, because a blocked
 *    script often still leaves a reserved empty box behind.
 *
 * 2. It must be DETERMINISTIC. Animations are disabled and scrolling is captured as one tall
 *    image that Remotion pans, rather than as a recorded scroll. Recording motion in the
 *    browser reintroduces exactly the wall-clock nondeterminism the render pipeline avoids.
 */
import { createHash } from "crypto";
import fs from "fs/promises";
import path from "path";
import type { Browser, BrowserContext, Page } from "playwright";
import { uploadToR2 } from "../../../src/lib/r2";
import { sql } from "./db";
import { makeTempDir, runFfmpeg } from "./render";

/** Blocked at the network layer so nothing is even requested. */
const BLOCKED_HOSTS = [
  "googlesyndication.com",
  "doubleclick.net",
  "googletagmanager.com",
  "google-analytics.com",
  "monetag.com",
  "infolinks.com",
  "connect.facebook.net",
  "facebook.com/tr",
  "adsbygoogle",
  "propellerads.com",
  "segment.com",
  "cdn.segment.io",
];

/** Hidden with CSS, because a blocked script often leaves its reserved container behind. */
const HIDE_CSS = `
  ins.adsbygoogle,
  [id*="monetag" i], [class*="monetag" i],
  [id*="infolink" i], [class*="infolink" i],
  [data-ad], [data-ad-slot], [aria-label*="advertisement" i],
  [class*="cookie" i][class*="banner" i],
  [class*="consent" i], #onetrust-consent-sdk,
  iframe[src*="doubleclick"], iframe[src*="googlesyndication"] {
    display: none !important;
  }
  /* Our own floating widgets. They belong on the live site but read as UI clutter hovering
     over a video — the Feedback pill (src/components/FeedbackWidget.tsx) and the chat bubble
     (src/components/ChatPanel.tsx) both sit at a fixed bottom corner and follow the pan. */
  .fixed.bottom-5.right-5,
  .fixed.bottom-6.left-6,
  .fixed.bottom-24.left-6 {
    display: none !important;
  }
  /* Freeze anything that would otherwise be mid-animation when the shutter fires. */
  *, *::before, *::after {
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    scroll-behavior: auto !important;
  }
  html { scrollbar-width: none; }
  ::-webkit-scrollbar { display: none; }
`;

export interface CaptureRecipe {
  /** Path or absolute URL. Relative paths resolve against VIDEO_CAPTURE_BASE_URL. */
  url: string;
  kind: "still" | "scroll_clip" | "interaction_clip";
  viewportWidth: number;
  viewportHeight: number;
  deviceScaleFactor?: number;
  /** Capture just this element instead of the viewport. */
  selector?: string;
  /** Extra CSS to inject, e.g. to hide a specific element for one shot. */
  hideSelectors?: string[];
  /** Only for interaction_clip. Each step is applied in order, then the clip stops. */
  steps?: { action: "click" | "hover" | "scrollTo" | "wait"; selector?: string; ms?: number }[];
  /** Only for interaction_clip. */
  durationSeconds?: number;
  contentRef?: { postId?: string; lessonId?: string };
}

export interface CapturedAsset {
  id: string;
  url: string;
  kind: "image" | "video";
  width: number;
  height: number;
  durationSeconds: number | null;
}

export function captureBaseUrl(): string {
  return (process.env.VIDEO_CAPTURE_BASE_URL || "https://japanesewithavnish.com").replace(/\/$/, "");
}

export function resolveCaptureUrl(urlOrPath: string): string {
  if (/^https?:\/\//i.test(urlOrPath)) return urlOrPath;
  return `${captureBaseUrl()}/${urlOrPath.replace(/^\//, "")}`;
}

/** Everything that would change a single captured pixel goes into the hash. */
export function recipeHash(recipe: CaptureRecipe): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        url: resolveCaptureUrl(recipe.url),
        kind: recipe.kind,
        w: recipe.viewportWidth,
        h: recipe.viewportHeight,
        dsf: recipe.deviceScaleFactor ?? 1,
        selector: recipe.selector ?? null,
        hide: recipe.hideSelectors ?? [],
        steps: recipe.steps ?? [],
        duration: recipe.durationSeconds ?? null,
      })
    )
    .digest("hex");
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

async function lookupCache(hash: string): Promise<CapturedAsset | null> {
  const rows = (await sql`
    SELECT id, asset_url, capture_kind, viewport_w, viewport_h, duration_seconds
    FROM video_broll_assets
    WHERE recipe_hash = ${hash} AND expires_at > NOW()
  `) as Record<string, unknown>[];
  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    url: String(row.asset_url),
    kind: row.capture_kind === "interaction_clip" ? "video" : "image",
    width: Number(row.viewport_w),
    height: Number(row.viewport_h),
    durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
  };
}

async function storeCache(
  recipe: CaptureRecipe,
  hash: string,
  asset: Omit<CapturedAsset, "id">
): Promise<CapturedAsset> {
  // Upsert rather than insert: an expired row keeps its recipe_hash, and two formats of the
  // same storyboard can race to capture the same page.
  const rows = (await sql`
    INSERT INTO video_broll_assets
      (source_url, capture_kind, viewport_w, viewport_h, device_scale, selector, capture_recipe,
       recipe_hash, asset_url, duration_seconds, content_ref, captured_at, expires_at)
    VALUES (${resolveCaptureUrl(recipe.url)}, ${recipe.kind}, ${asset.width}, ${asset.height},
            ${recipe.deviceScaleFactor ?? 1}, ${recipe.selector ?? null},
            ${JSON.stringify(recipe)}::jsonb, ${hash}, ${asset.url}, ${asset.durationSeconds},
            ${recipe.contentRef ? JSON.stringify(recipe.contentRef) : null}::jsonb,
            NOW(), NOW() + INTERVAL '14 days')
    ON CONFLICT (recipe_hash) DO UPDATE
      SET asset_url = EXCLUDED.asset_url,
          duration_seconds = EXCLUDED.duration_seconds,
          viewport_w = EXCLUDED.viewport_w,
          viewport_h = EXCLUDED.viewport_h,
          captured_at = NOW(),
          expires_at = NOW() + INTERVAL '14 days'
    RETURNING id
  `) as { id: string }[];
  return { ...asset, id: rows[0].id };
}

// ---------------------------------------------------------------------------
// Browser
// ---------------------------------------------------------------------------

let browserPromise: Promise<Browser> | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = import("playwright").then((pw) =>
      pw.chromium.launch({ args: ["--disable-lcd-text", "--force-color-profile=srgb"] })
    );
  }
  return browserPromise;
}

export async function closeBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise;
  await browser.close().catch(() => {});
  browserPromise = null;
}

async function newContext(recipe: CaptureRecipe, recordDir?: string): Promise<BrowserContext> {
  const browser = await getBrowser();
  const context = await browser.newContext({
    viewport: { width: recipe.viewportWidth, height: recipe.viewportHeight },
    deviceScaleFactor: recipe.deviceScaleFactor ?? 1,
    // Reduced motion suppresses framer-motion entrances, which would otherwise be caught
    // half-played.
    reducedMotion: "reduce",
    recordVideo: recordDir
      ? { dir: recordDir, size: { width: recipe.viewportWidth, height: recipe.viewportHeight } }
      : undefined,
  });

  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (BLOCKED_HOSTS.some((host) => url.includes(host))) return route.abort();
    return route.continue();
  });

  // Premium and admin-gated pages need a real session; without the cookie those pages capture
  // as a paywall, which is not what anyone wants in a lesson video.
  const cookie = process.env.VIDEO_CAPTURE_ADMIN_COOKIE;
  if (cookie) {
    const { hostname } = new URL(captureBaseUrl());
    await context.addCookies([
      { name: "auth_session", value: cookie, domain: hostname, path: "/", httpOnly: true, secure: true, sameSite: "Lax" },
    ]);
  }

  return context;
}

async function preparePage(page: Page, recipe: CaptureRecipe): Promise<void> {
  await page.goto(resolveCaptureUrl(recipe.url), { waitUntil: "networkidle", timeout: 45_000 });
  await page.addStyleTag({
    content: HIDE_CSS + (recipe.hideSelectors?.length ? `\n${recipe.hideSelectors.join(",")} { display: none !important; }` : ""),
  });
  // Lazy-loaded images below the fold never load if we never scroll past them, and a
  // full-page screenshot with empty image slots is worse than no B-roll.
  //
  // Passed as a STRING rather than a function on purpose. tsx compiles this file with esbuild,
  // whose keepNames transform rewrites named inner functions to call a `__name` helper — a
  // helper that exists in the Node bundle but not in the page, so a normal
  // `page.evaluate(() => {...})` with any named inner function dies with
  // "ReferenceError: __name is not defined".
  await page.evaluate(`
    new Promise((resolve) => {
      let y = 0;
      const step = function () {
        window.scrollTo(0, y);
        y += window.innerHeight;
        if (y < document.body.scrollHeight) setTimeout(step, 60);
        else { window.scrollTo(0, 0); setTimeout(resolve, 250); }
      };
      step();
    })
  `);
  await page.waitForTimeout(400);
}

// ---------------------------------------------------------------------------
// Capture
// ---------------------------------------------------------------------------

export async function capture(recipe: CaptureRecipe): Promise<CapturedAsset> {
  const hash = recipeHash(recipe);
  const cached = await lookupCache(hash);
  if (cached) return cached;

  if (recipe.kind === "interaction_clip") return captureClip(recipe, hash);
  return captureImage(recipe, hash);
}

async function captureImage(recipe: CaptureRecipe, hash: string): Promise<CapturedAsset> {
  const context = await newContext(recipe);
  try {
    const page = await context.newPage();
    await preparePage(page, recipe);

    // scroll_clip captures the whole page as one tall image; Remotion pans it. See the note
    // on BrollPageVisual.captureKind.
    const fullPage = recipe.kind === "scroll_clip";
    const target = recipe.selector ? page.locator(recipe.selector).first() : page;
    const buffer = await (recipe.selector
      ? (target as ReturnType<Page["locator"]>).screenshot({ type: "jpeg", quality: 90 })
      : page.screenshot({ type: "jpeg", quality: 90, fullPage }));

    // Also a string, for the same esbuild reason as the scroll pass above.
    const dimensions = (await page.evaluate(`({
      w: document.documentElement.clientWidth,
      h: Math.max(document.body.scrollHeight, document.documentElement.clientHeight),
    })`)) as { w: number; h: number };

    const url = await uploadToR2(`video/broll/${hash}.jpg`, buffer, "image/jpeg");
    return storeCache(recipe, hash, {
      url,
      kind: "image",
      width: recipe.viewportWidth,
      height: fullPage ? Math.round((dimensions.h / dimensions.w) * recipe.viewportWidth) : recipe.viewportHeight,
      durationSeconds: null,
    });
  } finally {
    await context.close().catch(() => {});
  }
}

async function captureClip(recipe: CaptureRecipe, hash: string): Promise<CapturedAsset> {
  const tmpDir = await makeTempDir("broll");
  const context = await newContext(recipe, tmpDir);
  let webmPath: string | null = null;

  try {
    const page = await context.newPage();
    await preparePage(page, recipe);

    for (const step of recipe.steps ?? []) {
      if (step.action === "wait") await page.waitForTimeout(step.ms ?? 500);
      else if (step.action === "click" && step.selector) await page.locator(step.selector).first().click({ timeout: 5000 }).catch(() => {});
      else if (step.action === "hover" && step.selector) await page.locator(step.selector).first().hover({ timeout: 5000 }).catch(() => {});
      else if (step.action === "scrollTo" && step.selector)
        await page.locator(step.selector).first().scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(step.ms ?? 400);
    }
    await page.waitForTimeout(Math.round((recipe.durationSeconds ?? 3) * 1000));

    const video = page.video();
    // The webm is only finalised on context.close(), so the path has to be read before closing
    // and the file read after.
    webmPath = video ? await video.path() : null;
  } finally {
    await context.close().catch(() => {});
  }

  if (!webmPath) throw new Error("Playwright produced no video for interaction_clip");

  // Playwright only writes VP8 webm; H.264 mp4 is what Remotion's <OffthreadVideo> and every
  // downstream platform expect.
  const mp4Path = path.join(tmpDir, "clip.mp4");
  await runFfmpeg([
    "-i", webmPath,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-pix_fmt", "yuv420p", "-an", "-y", mp4Path,
  ]);

  try {
    const url = await uploadToR2(`video/broll/${hash}.mp4`, await fs.readFile(mp4Path), "video/mp4");
    return storeCache(recipe, hash, {
      url,
      kind: "video",
      width: recipe.viewportWidth,
      height: recipe.viewportHeight,
      durationSeconds: recipe.durationSeconds ?? 3,
    });
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}
