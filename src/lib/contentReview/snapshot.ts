import crypto from "node:crypto";
import { sql } from "@/lib/db";
import type { ContentSnapshot, ReviewEntityType } from "./types";

type PostRow = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  content: string | null;
  jlpt_level: string[] | null;
  tags: string[] | null;
  content_type: string;
  status: string;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  canonical_url: string | null;
};

async function fetchSidecar(entityType: ReviewEntityType, postId: string): Promise<Record<string, unknown> | null> {
  if (!sql) return null;

  if (entityType === "vocabulary") {
    const rows = (await sql`SELECT * FROM vocabulary WHERE post_id = ${postId} LIMIT 1`) as Record<string, unknown>[];
    return rows[0] ?? null;
  }
  if (entityType === "grammar") {
    const rows = (await sql`SELECT * FROM grammar WHERE post_id = ${postId} LIMIT 1`) as Record<string, unknown>[];
    return rows[0] ?? null;
  }
  if (entityType === "kanji") {
    const rows = (await sql`SELECT * FROM kanji WHERE post_id = ${postId} LIMIT 1`) as Record<string, unknown>[];
    return rows[0] ?? null;
  }
  if (entityType === "reading") {
    const rows = (await sql`SELECT * FROM reading WHERE post_id = ${postId} LIMIT 1`) as Record<string, unknown>[];
    return rows[0] ?? null;
  }
  if (entityType === "listening") {
    const rows = (await sql`SELECT * FROM listening WHERE post_id = ${postId} LIMIT 1`) as Record<string, unknown>[];
    return rows[0] ?? null;
  }
  if (entityType === "writing") {
    const rows = (await sql`SELECT * FROM writing WHERE post_id = ${postId} LIMIT 1`) as Record<string, unknown>[];
    return rows[0] ?? null;
  }
  if (entityType === "sounds") {
    const rows = (await sql`SELECT * FROM sounds WHERE post_id = ${postId} LIMIT 1`) as Record<string, unknown>[];
    return rows[0] ?? null;
  }
  return null;
}

/** Practice/quiz data, only exists for grammar (grammar_drill_items) and listening
 * (listening_scenarios -> listening_questions) today — null for the other 5 types. */
async function fetchPractice(entityType: ReviewEntityType, sidecar: Record<string, unknown> | null): Promise<unknown> {
  if (!sql || !sidecar) return null;

  if (entityType === "grammar") {
    const grammarId = sidecar.id as string | undefined;
    if (!grammarId) return null;
    const rows = await sql`
      SELECT id, sentence_ja, correct_answers, distractors, hint
      FROM grammar_drill_items WHERE grammar_id = ${grammarId}
    `;
    return rows;
  }

  if (entityType === "listening") {
    const listeningId = sidecar.id as string | undefined;
    if (!listeningId) return null;
    const scenarios = (await sql`
      SELECT id, title, audio_url, transcript FROM listening_scenarios WHERE listening_id = ${listeningId}
    `) as { id: string; title: string; audio_url: string; transcript: string | null }[];
    const scenarioIds = scenarios.map((s) => s.id);
    const questions = scenarioIds.length
      ? await sql`
          SELECT scenario_id, question_text, options, correct_index
          FROM listening_questions WHERE scenario_id = ANY(${scenarioIds})
        `
      : [];
    return { scenarios, questions };
  }

  return null;
}

/** Deterministic JSON stringify: sorts object keys so the checksum is stable regardless
 * of column/property enumeration order. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export function checksumSnapshot(snapshot: ContentSnapshot): string {
  return crypto.createHash("sha256").update(stableStringify(snapshot)).digest("hex");
}

export async function buildContentSnapshot(
  entityType: ReviewEntityType,
  entityId: string
): Promise<ContentSnapshot | null> {
  if (!sql) return null;

  const rows = (await sql`
    SELECT id, slug, title, summary, content, jlpt_level, tags, content_type, status,
           seo_title, seo_description, og_image_url, canonical_url
    FROM posts WHERE id = ${entityId} AND content_type = ${entityType}
    LIMIT 1
  `) as PostRow[];
  const post = rows[0];
  if (!post) return null;

  const sidecar = await fetchSidecar(entityType, post.id);
  const practice = await fetchPractice(entityType, sidecar);

  return {
    entityType,
    entityId: post.id,
    post: {
      id: post.id,
      slug: post.slug,
      title: post.title,
      summary: post.summary,
      content: post.content,
      jlptLevel: post.jlpt_level,
      tags: post.tags,
      contentType: post.content_type,
      status: post.status,
      seoTitle: post.seo_title,
      seoDescription: post.seo_description,
      ogImageUrl: post.og_image_url,
      canonicalUrl: post.canonical_url,
    },
    sidecar,
    practice: practice ?? undefined,
  };
}
