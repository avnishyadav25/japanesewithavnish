/**
 * Video Studio preflight.
 *
 *   npm run video:doctor            fast checks (~5s)
 *   npm run video:doctor -- --full  also bundles Remotion and lists compositions (~20s)
 *
 * Every check either proves the thing WORKS or says exactly how to fix it. That distinction is
 * the whole point: "the variable is set" and "the credential is valid" look identical from a
 * .env file and completely different from a render job, which is where the failure would
 * otherwise surface — ten minutes and three retry attempts later.
 *
 * The Google section is the reason this exists. Pasting a GCP private key into an env file has
 * about five distinct failure modes (multi-line paste, wrong project, API not enabled, billing
 * off, key deleted) and they all produce the same unhelpful "Google TTS not configured" or a
 * raw 403 from a background worker. Here they are told apart and named.
 */
import "dotenv/config";
import { execFileSync } from "child_process";
import { importPKCS8 } from "jose";
import { neon } from "@neondatabase/serverless";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2 } from "../src/lib/r2";
import { synthesize, ttsConfigured, wavDurationSeconds } from "../src/lib/video/tts";

type Level = "ok" | "warn" | "fail" | "info";

const ICON: Record<Level, string> = { ok: "✓", warn: "⚠", fail: "✗", info: "ℹ" };
const COLOR: Record<Level, string> = { ok: "\x1b[32m", warn: "\x1b[33m", fail: "\x1b[31m", info: "\x1b[36m" };
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

let failures = 0;
let warnings = 0;

function report(level: Level, label: string, detail: string, remedy?: string[]): void {
  if (level === "fail") failures += 1;
  if (level === "warn") warnings += 1;
  console.log(`  ${COLOR[level]}${ICON[level]}${RESET} ${label.padEnd(24)} ${detail}`);
  for (const line of remedy ?? []) console.log(`      ${DIM}→ ${line}${RESET}`);
}

function section(title: string): void {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------------------
// Local tooling
// ---------------------------------------------------------------------------

function checkTooling(): void {
  section("Local tooling");

  try {
    const out = execFileSync("ffmpeg", ["-version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    report("ok", "ffmpeg", out.split("\n")[0].replace("ffmpeg version ", "").split(" ")[0]);
  } catch {
    report("fail", "ffmpeg", "not found on PATH", [
      "brew install ffmpeg   (macOS)",
      "sudo apt-get install -y ffmpeg   (Linux/CI)",
    ]);
  }

  const major = Number(process.versions.node.split(".")[0]);
  if (major >= 20) report("ok", "node", process.versions.node);
  else report("fail", "node", `${process.versions.node} — Remotion needs 20+`, ["Install Node 20 or newer."]);
}

// ---------------------------------------------------------------------------
// Database
// ---------------------------------------------------------------------------

/**
 * NOT `video_publications` / `video_publish_targets`. Migration 143 supersedes both — it modelled
 * publishing per-video, the social engine models it per-brief — and DROPs them after asserting
 * they are empty. Listing them here made the doctor report "1 blocking problem" on a perfectly
 * healthy database, which is worse than not checking at all: a permanently-red doctor trains you
 * to skip its output, and then a real failure goes unread.
 *
 * `video_assets` is the round-4 sticker/character library.
 */
const VIDEO_TABLES = [
  "video_projects", "video_storyboards", "video_render_jobs", "video_renders", "video_themes",
  "video_bgm_tracks", "video_policies", "video_tts_assets", "video_broll_assets",
  "video_content_links", "video_events", "video_assets",
];

async function checkDatabase(): Promise<void> {
  section("Database");

  if (!process.env.DATABASE_URL) {
    report("fail", "DATABASE_URL", "unset", ["Copy it from your Neon dashboard into .env.local."]);
    return;
  }

  try {
    const sql = neon(process.env.DATABASE_URL);
    const tables = (await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY(${VIDEO_TABLES})
    `) as { table_name: string }[];

    const found = new Set(tables.map((t) => t.table_name));
    const missing = VIDEO_TABLES.filter((t) => !found.has(t));

    if (missing.length > 0) {
      report("fail", "video_* schema", `${found.size}/${VIDEO_TABLES.length} tables — missing ${missing.join(", ")}`, [
        "Apply supabase/migrations/134-138. They are additive and safe to re-run.",
      ]);
      return;
    }
    report("ok", "video_* schema", `all ${VIDEO_TABLES.length} tables present`);

    const [themes, policies, bgm, jobs] = await Promise.all([
      sql`SELECT COUNT(*)::int n FROM video_themes WHERE is_enabled` as Promise<{ n: number }[]>,
      sql`SELECT COUNT(*)::int n FROM video_policies WHERE is_enabled` as Promise<{ n: number }[]>,
      sql`SELECT COUNT(*)::int n FROM video_bgm_tracks WHERE is_enabled` as Promise<{ n: number }[]>,
      sql`SELECT status, COUNT(*)::int n FROM video_render_jobs GROUP BY status` as Promise<
        { status: string; n: number }[]
      >,
    ]);

    report(themes[0].n > 0 ? "ok" : "fail", "themes", `${themes[0].n} enabled`);
    report(policies[0].n > 0 ? "ok" : "fail", "approval policies", `${policies[0].n} enabled`);
    report(bgm[0].n > 0 ? "ok" : "info", "bgm tracks", bgm[0].n > 0 ? `${bgm[0].n} available` : "none — videos render narration-only");

    const byStatus = Object.fromEntries(jobs.map((j) => [j.status, j.n]));
    const queued = byStatus.queued ?? 0;
    const failed = byStatus.failed ?? 0;
    const running = (byStatus.claimed ?? 0) + (byStatus.running ?? 0);

    if (queued + running > 0) {
      report("info", "render queue", `${queued} queued, ${running} in flight`, ["Start a worker: npm run video:worker"]);
    } else if (failed > 0) {
      report("warn", "render queue", `${failed} failed job(s), nothing queued`, [
        "Fix whatever this doctor reports, then hit Retry at /admin/video/jobs.",
      ]);
    } else {
      report("ok", "render queue", "empty");
    }
  } catch (err) {
    report("fail", "DATABASE_URL", `connection failed — ${msg(err)}`, [
      "Check the connection string, and that the Neon project is not suspended.",
    ]);
  }
}

// ---------------------------------------------------------------------------
// R2
// ---------------------------------------------------------------------------

async function checkR2(): Promise<void> {
  section("Cloudflare R2");

  const r2 = getR2();
  if (!r2) {
    const missing = ["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME", "R2_BUCKET_URL"]
      .filter((k) => !process.env[k]);
    report("fail", "R2 config", `missing ${missing.join(", ")}`, ["Copy these from your Cloudflare R2 API token."]);
    return;
  }

  // A real round-trip. Credentials that can PUT but not GET (or a bucket name typo) look fine
  // until a render finishes and the upload silently 403s.
  const key = `video/_doctor/probe-${Date.now()}.txt`;
  try {
    await r2.client.send(
      new PutObjectCommand({ Bucket: r2.bucket, Key: key, Body: "ok", ContentType: "text/plain" })
    );
    const got = await r2.client.send(new GetObjectCommand({ Bucket: r2.bucket, Key: key }));
    const body = got.Body as { transformToString?: () => Promise<string> } | undefined;
    const text = body?.transformToString ? await body.transformToString() : "";
    await r2.client.send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: key }));

    if (text.trim() !== "ok") {
      report("fail", "R2 round-trip", "wrote an object but read back something else");
      return;
    }
    report("ok", "R2 round-trip", `write + read + delete on ${r2.bucket}`);

    if (!/^https?:\/\//.test(r2.bucketUrl)) {
      report("fail", "R2_BUCKET_URL", `"${r2.bucketUrl}" is not an absolute URL`, [
        "It must be the public bucket URL, e.g. https://pub-xxxx.r2.dev",
      ]);
    } else {
      report("ok", "R2_BUCKET_URL", r2.bucketUrl);
    }
  } catch (err) {
    report("fail", "R2 round-trip", msg(err), [
      "Check the token has Object Read & Write on this bucket, and that R2_BUCKET_NAME matches exactly.",
    ]);
  }
}

// ---------------------------------------------------------------------------
// Google Cloud TTS — the check that actually matters
// ---------------------------------------------------------------------------

function resolveGoogleCreds(): { email?: string; key?: string; source: string } {
  const email = process.env.GOOGLE_TTS_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_TTS_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (email && key) return { email, key, source: "GOOGLE_TTS_*" };

  const sheetsEmail = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL;
  const sheetsKey = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (sheetsEmail && sheetsKey) return { email: sheetsEmail, key: sheetsKey, source: "GOOGLE_SHEETS_* (fallback)" };

  return { email: email ?? sheetsEmail, key: key ?? sheetsKey, source: "none" };
}

async function checkGoogleTts(): Promise<void> {
  section("Google Cloud Text-to-Speech");

  const { email, key, source } = resolveGoogleCreds();

  if (!email || !key) {
    report("fail", "credentials", "not set", [
      "1. Enable the API:  console.cloud.google.com/apis/library/texttospeech.googleapis.com",
      "2. Service account → KEYS → ADD KEY → Create new key → JSON",
      "3. Put client_email in GOOGLE_TTS_SERVICE_ACCOUNT_EMAIL and private_key in",
      "   GOOGLE_TTS_SERVICE_ACCOUNT_PRIVATE_KEY (one line, literal \\n, wrapped in \" \").",
    ]);
    return;
  }
  report("ok", "credentials", `${email}  ${DIM}via ${source}${RESET}`);

  if (source.startsWith("GOOGLE_SHEETS") ) {
    report("warn", "credential source", "using the Sheets service account", [
      "Works locally, but .github/workflows/video-render.yml only passes GOOGLE_TTS_* —",
      "CI renders will fail until you set the GOOGLE_TTS_* names too.",
    ]);
  }

  // Mixing a TTS email with a Sheets key mints a JWT signed by the wrong identity, which fails
  // as an opaque 401 from Google rather than anything that names the real cause.
  const emailVar = process.env.GOOGLE_TTS_SERVICE_ACCOUNT_EMAIL;
  const keyVar = process.env.GOOGLE_TTS_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (Boolean(emailVar) !== Boolean(keyVar)) {
    report("fail", "credential pairing", "only one of the GOOGLE_TTS_* pair is set", [
      "Email and key fall back to the Sheets vars independently, so a half-set pair silently",
      "mixes identities. Set both, or neither.",
    ]);
    return;
  }

  // --- Does the key parse? The single most common mistake. ---
  const normalized = key.replace(/\\n/g, "\n");
  if (!normalized.includes("-----BEGIN")) {
    report("fail", "private key", "does not contain -----BEGIN PRIVATE KEY-----", [
      'Copy the whole private_key value out of the downloaded JSON, including the BEGIN/END lines.',
    ]);
    return;
  }
  if (!normalized.trimEnd().endsWith("-----END PRIVATE KEY-----")) {
    report("fail", "private key", "truncated — no END line", [
      "dotenv stops at the first real newline. Keep the value on ONE line using literal \\n",
      'escapes exactly as they appear in the JSON, wrapped in double quotes.',
    ]);
    return;
  }
  try {
    await importPKCS8(normalized, "RS256");
    report("ok", "private key", `parses as PKCS#8 (${key.length} chars)`);
  } catch (err) {
    report("fail", "private key", `will not parse — ${msg(err)}`, [
      "Almost always a copy/paste problem. Re-copy private_key from the JSON as a single line.",
    ]);
    return;
  }

  if (!ttsConfigured()) {
    report("warn", "ttsConfigured()", "reports false despite working credentials");
  }

  // --- Does Google accept it, and is the API on? ---
  try {
    const audio = await synthesize({
      ssml: "<speak>こんにちは</speak>",
      voiceName: "ja-JP-Neural2-B",
      speakingRate: 1,
      pitch: 0,
    });
    const duration = wavDurationSeconds(audio.buffer);
    report(
      "ok",
      "live synthesis",
      `ja-JP-Neural2-B → ${(audio.buffer.length / 1024).toFixed(0)} KB, ${duration.toFixed(2)}s, $${audio.estimatedCostUsd.toFixed(6)}`
    );

    if (duration <= 0) {
      report("fail", "audio duration", "measured 0s — scene timing would collapse", [
        "The WAV header parsed but has no data chunk. Report this; it should not happen.",
      ]);
    }
  } catch (err) {
    const text = msg(err);
    // Google's errors are precise if you know where to look; surface the meaning, not the JSON.
    if (/SERVICE_DISABLED|has not been used in project|is disabled/i.test(text)) {
      report("fail", "live synthesis", "the Text-to-Speech API is not enabled on this project", [
        "console.cloud.google.com/apis/library/texttospeech.googleapis.com → ENABLE",
        "Make sure you enable it on the SAME project the service account belongs to.",
      ]);
    } else if (/billing/i.test(text)) {
      report("fail", "live synthesis", "billing is not enabled on the project", [
        "console.cloud.google.com/billing/linkedaccount — link a billing account.",
        "Neural2 still gives 1,000,000 characters/month free, but the API 403s without billing linked.",
      ]);
    } else if (/invalid_grant|Invalid JWT|401/i.test(text)) {
      report("fail", "live synthesis", "Google rejected the credentials", [
        "The key may have been deleted, or the email does not match the key.",
        "Create a fresh key on the service account and copy BOTH values from the same JSON.",
      ]);
    } else if (/PERMISSION_DENIED|403/i.test(text)) {
      report("fail", "live synthesis", "permission denied", [
        "Check the API is enabled and billing is linked on this project.",
      ]);
    } else {
      report("fail", "live synthesis", text);
    }
  }
}

// ---------------------------------------------------------------------------
// Everything else
// ---------------------------------------------------------------------------

function checkMisc(): void {
  section("Script generation and publishing");

  if (process.env.DEEPSEEK_API_KEY) report("ok", "DEEPSEEK_API_KEY", "set — narration generation available");
  else report("fail", "DEEPSEEK_API_KEY", "unset", ["Narration cannot be generated without it."]);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    report("warn", "NEXT_PUBLIC_SITE_URL", "unset — outro falls back to japanesewithavnish.com");
  } else if (/localhost|127\.0\.0\.1/.test(siteUrl)) {
    report("warn", "NEXT_PUBLIC_SITE_URL", `${siteUrl} — a dev value`, [
      "The outro scene shows the site URL on screen. Localhost is ignored and the outro falls",
      "back to japanesewithavnish.com, but VideoObject embedUrl would still be wrong if you",
      "publish to the site from this machine.",
    ]);
  } else {
    report("ok", "NEXT_PUBLIC_SITE_URL", siteUrl);
  }

  const hasToken = Boolean(process.env.GITHUB_DISPATCH_TOKEN);
  const hasRepo = Boolean(process.env.GITHUB_DISPATCH_REPO);
  if (hasToken && hasRepo) {
    report("ok", "GitHub dispatch", `${process.env.GITHUB_DISPATCH_REPO} — queued jobs start CI immediately`);
  } else if (hasToken !== hasRepo) {
    report("warn", "GitHub dispatch", "only one of TOKEN/REPO is set — dispatch disabled", [
      "Set both GITHUB_DISPATCH_TOKEN and GITHUB_DISPATCH_REPO, or neither.",
    ]);
  } else {
    report("info", "GitHub dispatch", "not configured — CI picks jobs up on its 15-minute cron", [
      "Optional. A local worker (npm run video:worker) claims jobs within seconds regardless.",
    ]);
  }

  report(
    process.env.VIDEO_CAPTURE_BASE_URL ? "ok" : "info",
    "B-roll capture",
    process.env.VIDEO_CAPTURE_BASE_URL ?? "defaults to https://japanesewithavnish.com"
  );
}

async function checkRemotion(): Promise<void> {
  section("Remotion (--full)");
  try {
    const { bundle } = await import("@remotion/bundler");
    const { getCompositions } = await import("@remotion/renderer");
    const path = await import("path");
    const { webpackOverride } = await import("../remotion/webpackOverride");

    const started = Date.now();
    const serveUrl = await bundle({
      entryPoint: path.resolve(process.cwd(), "remotion/index.ts"),
      webpackOverride,
      publicDir: path.resolve(process.cwd(), "public"),
    });
    const comps = await getCompositions(serveUrl);
    report("ok", "bundle", `${comps.length} compositions in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    for (const c of comps) {
      report("info", `  ${c.id}`, `${c.width}x${c.height} @ ${c.fps}fps`);
    }
  } catch (err) {
    report("fail", "bundle", msg(err), ["Run `npm run video:studio` to see the full compiler output."]);
  }
}

function msg(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).split("\n")[0].slice(0, 220);
}

async function main(): Promise<void> {
  const full = process.argv.includes("--full");
  console.log("\nVideo Studio preflight");

  checkTooling();
  await checkDatabase();
  await checkR2();
  await checkGoogleTts();
  checkMisc();
  if (full) await checkRemotion();

  console.log("");
  if (failures > 0) {
    console.log(`${COLOR.fail}${failures} blocking problem${failures === 1 ? "" : "s"}${RESET}${warnings ? `, ${warnings} warning${warnings === 1 ? "" : "s"}` : ""}. Fix the ✗ lines above, then run this again.`);
    process.exitCode = 1;
    return;
  }
  if (warnings > 0) {
    console.log(`${COLOR.warn}Ready, with ${warnings} warning${warnings === 1 ? "" : "s"}.${RESET} Start a worker with ${DIM}npm run video:worker${RESET} and render from /admin/video.`);
    return;
  }
  console.log(`${COLOR.ok}Everything checks out.${RESET} Start a worker with ${DIM}npm run video:worker${RESET} and render from /admin/video.`);
}

main().catch((err) => {
  console.error("\nDoctor crashed:", err);
  process.exit(1);
});
