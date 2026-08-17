import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { isKnownVoice } from "@/lib/video/voices";
import { DEFAULT_VOICES } from "@/lib/video/tts";
import type { NarrationLang } from "@/lib/video/types";

/**
 * Theme CRUD.
 *
 * There was none. `video_themes` carries thirteen colour and font tokens plus per-language
 * default voices, and the assets page said "Edit these in the video_themes table" — which is
 * accurate and is not a UI.
 *
 * The three seeded themes are editable but not deletable, and a theme any project references
 * cannot be disabled: theme_key is a FK with ON UPDATE CASCADE and no ON DELETE, so breaking it
 * breaks project rows rather than failing loudly.
 */

/** Every token the scene templates read. Anything outside this list is dropped rather than
 * stored, so a typo cannot quietly become a token nothing renders. */
const TOKEN_KEYS = [
  "bg", "surface", "text", "textMuted", "textSubtle", "primary", "primaryHover", "accent",
  "border", "radius", "fontSans", "fontSerif", "fontJa",
] as const;

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function cleanTokens(input: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!input || typeof input !== "object") return out;
  const src = input as Record<string, unknown>;
  for (const key of TOKEN_KEYS) {
    const v = src[key];
    if (v === undefined || v === null) continue;
    if (key === "radius") {
      const n = Number(v);
      if (Number.isFinite(n)) out[key] = Math.min(64, Math.max(0, n));
      continue;
    }
    if (typeof v !== "string" || !v.trim()) continue;
    // Colours are validated; font stacks are free text because they legitimately contain
    // quotes, commas and fallbacks.
    if (key.startsWith("font")) out[key] = v.trim();
    else if (HEX.test(v.trim())) out[key] = v.trim().toLowerCase();
  }
  return out;
}

function cleanVoices(input: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!input || typeof input !== "object") return out;
  const src = input as Record<string, unknown>;
  for (const lang of ["en", "hi", "ja"] as NarrationLang[]) {
    const name = src[lang];
    if (typeof name === "string" && isKnownVoice(lang, name)) out[lang] = name;
  }
  for (const rate of ["jaRate", "narrationRate"]) {
    const n = Number(src[rate]);
    // Google TTS accepts 0.25-4.0; anything outside 0.5-1.5 is unusable for teaching.
    if (Number.isFinite(n)) out[rate] = Math.min(1.5, Math.max(0.5, n));
  }
  return out;
}

export async function GET() {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const rows = (await sql`
    SELECT t.key, t.label, t.description, t.tokens, t.default_voices, t.is_enabled, t.sort_order,
           (SELECT COUNT(*)::int FROM video_projects p WHERE p.theme_key = t.key) AS usage_count
    FROM video_themes t ORDER BY t.sort_order, t.label
  `) as Record<string, unknown>[];

  return NextResponse.json({
    themes: rows.map((r) => ({
      key: String(r.key),
      label: String(r.label),
      description: (r.description as string | null) ?? null,
      tokens: (r.tokens as Record<string, unknown>) ?? {},
      defaultVoices: (r.default_voices as Record<string, unknown>) ?? DEFAULT_VOICES,
      isEnabled: Boolean(r.is_enabled),
      sortOrder: Number(r.sort_order),
      usageCount: Number(r.usage_count),
    })),
  });
}

/** Creates a theme, normally by duplicating an existing one — the safe way to make a variant
 * without risking the three the whole studio defaults to. */
export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const key = String(body?.key ?? "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-");
  const label = String(body?.label ?? "").trim();
  if (!key || !label) return NextResponse.json({ error: "A key and a label are required" }, { status: 400 });

  const exists = (await sql`SELECT 1 FROM video_themes WHERE key = ${key}`) as unknown[];
  if (exists.length > 0) return NextResponse.json({ error: `A theme called "${key}" already exists` }, { status: 409 });

  let tokens = cleanTokens(body?.tokens);
  let voices = cleanVoices(body?.defaultVoices);

  // Copy-from is resolved server-side so a duplicate always starts from what is actually stored,
  // not from whatever the browser happened to be showing.
  if (typeof body?.copyFrom === "string") {
    const src = (await sql`SELECT tokens, default_voices FROM video_themes WHERE key = ${body.copyFrom}`) as Record<string, unknown>[];
    if (src[0]) {
      tokens = { ...(src[0].tokens as Record<string, unknown>), ...tokens };
      voices = { ...(src[0].default_voices as Record<string, unknown>), ...voices };
    }
  }

  const rows = (await sql`
    INSERT INTO video_themes (key, label, description, tokens, default_voices, is_enabled, sort_order)
    VALUES (${key}, ${label}, ${typeof body?.description === "string" ? body.description : null},
            ${JSON.stringify(tokens)}::jsonb, ${JSON.stringify(voices)}::jsonb, true,
            COALESCE((SELECT MAX(sort_order) + 1 FROM video_themes), 0))
    RETURNING key
  `) as { key: string }[];

  return NextResponse.json({ ok: true, key: rows[0].key, message: `Created "${label}".` });
}

export async function PATCH(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const key = typeof body?.key === "string" ? body.key : "";
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });

  const rows = (await sql`
    SELECT tokens, default_voices,
           (SELECT COUNT(*)::int FROM video_projects p WHERE p.theme_key = ${key}) AS usage_count
    FROM video_themes WHERE key = ${key}
  `) as Record<string, unknown>[];
  if (!rows[0]) return NextResponse.json({ error: "Theme not found" }, { status: 404 });

  if (body?.isEnabled === false && Number(rows[0].usage_count) > 0) {
    return NextResponse.json(
      { error: `${rows[0].usage_count} project(s) use this theme. Move them to another theme first.` },
      { status: 409 }
    );
  }

  // Merged, not replaced: the editor sends only what changed, and replacing would blank every
  // token the form did not happen to include.
  const tokens = { ...(rows[0].tokens as Record<string, unknown>), ...cleanTokens(body?.tokens) };
  const voices = { ...(rows[0].default_voices as Record<string, unknown>), ...cleanVoices(body?.defaultVoices) };

  await sql`
    UPDATE video_themes SET
      label = COALESCE(${typeof body?.label === "string" && body.label.trim() ? body.label.trim() : null}, label),
      description = COALESCE(${typeof body?.description === "string" ? body.description : null}, description),
      tokens = ${JSON.stringify(tokens)}::jsonb,
      default_voices = ${JSON.stringify(voices)}::jsonb,
      is_enabled = COALESCE(${typeof body?.isEnabled === "boolean" ? body.isEnabled : null}, is_enabled),
      sort_order = COALESCE(${typeof body?.sortOrder === "number" ? body.sortOrder : null}, sort_order),
      updated_at = NOW()
    WHERE key = ${key}
  `;

  return NextResponse.json({ ok: true, tokens, defaultVoices: voices, message: "Saved." });
}
