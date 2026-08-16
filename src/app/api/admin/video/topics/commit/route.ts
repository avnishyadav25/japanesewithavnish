import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { slugify, uniqueSlug } from "@/lib/slugify";
import type { ProposedWord } from "@/lib/video/topics";

/**
 * Writes confirmed LLM-authored words into the content library as draft posts.
 *
 * WHY DRAFTS AND NOT STORYBOARD-ONLY. A word that exists only inside one storyboard is invisible
 * to the review pipeline, unreusable by the next video, and earns no page. As a draft post it
 * enters Content Review like anything else, and the second video about animals finds it by search
 * instead of inventing it again.
 *
 * status='draft' and review_state='not_reviewed' are the point, not an oversight: this content
 * has been read by nobody. It is publishable from the normal review UI once it has been.
 *
 * Idempotent on (content_type, word): committing the same topic twice reuses the existing draft
 * rather than creating a second one, because the picker is easy to submit twice.
 */
export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  const db = sql;

  const body = await req.json().catch(() => ({}));
  const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
  const words = (Array.isArray(body?.words) ? body.words : []) as ProposedWord[];

  if (words.length === 0) return NextResponse.json({ postIds: [], created: 0, reused: 0 });

  const postIds: string[] = [];
  let created = 0;
  let reused = 0;
  const skipped: string[] = [];

  for (const w of words) {
    if (!w?.word || !w?.meaning) {
      skipped.push(String(w?.word ?? "?"));
      continue;
    }

    // Reuse an existing entry for the same word rather than duplicating the library.
    const existing = (await db`
      SELECT p.id FROM vocabulary v JOIN posts p ON p.id = v.post_id
      WHERE v.word = ${w.word} LIMIT 1
    `) as { id: string }[];
    if (existing[0]) {
      postIds.push(existing[0].id);
      reused += 1;
      continue;
    }

    // Romaji, not the Japanese, so the slug is a usable URL. Falls back to a transliteration of
    // the meaning when the model omitted romaji.
    const slugBase = slugify(w.romaji || w.meaning || w.word) || "word";
    const slug = await uniqueSlug(slugBase, async (candidate) => {
      const rows = (await db`SELECT 1 FROM posts WHERE slug = ${candidate} LIMIT 1`) as unknown[];
      return rows.length > 0;
    });

    const level = /^N[1-5]$/.test(w.jlptLevel ?? "") ? w.jlptLevel : "N5";
    const tags = ["vocabulary", level, topic].filter(Boolean);

    const rows = (await db`
      INSERT INTO posts (
        slug, title, summary, jlpt_level, tags, status, review_state,
        content_type, content_surface, author_name
      ) VALUES (
        ${slug}, ${w.word}, ${w.meaning}, ${[level]}, ${tags}, 'draft', 'not_reviewed',
        'vocabulary', 'learn_library', ${admin.email}
      )
      RETURNING id
    `) as { id: string }[];
    const postId = rows[0].id;

    await db`
      INSERT INTO vocabulary (post_id, word, reading, romaji, meaning, part_of_speech, jlpt_level)
      VALUES (${postId}, ${w.word}, ${w.reading ?? null}, ${w.romaji ?? null}, ${w.meaning},
              ${w.partOfSpeech ?? null}, ${level})
    `;

    // The example is what makes a vocabulary scene worth watching — a word with no sentence
    // renders as a bare flashcard. Table is `examples` with sentence_ja/sentence_en (both NOT
    // NULL), keyed by vocabulary_id, matching the exampleFk map in scopeResolver.
    if (w.exampleJa && w.exampleEn) {
      await db`
        INSERT INTO examples (vocabulary_id, sentence_ja, sentence_romaji, sentence_en, sort_order)
        SELECT v.id, ${w.exampleJa}, ${w.exampleRomaji ?? null}, ${w.exampleEn}, 0
        FROM vocabulary v WHERE v.post_id = ${postId}
      `;
    }

    postIds.push(postId);
    created += 1;
  }

  return NextResponse.json({
    postIds,
    created,
    reused,
    skipped,
    message:
      `${created} new draft${created === 1 ? "" : "s"} written` +
      (reused > 0 ? `, ${reused} already in the library` : "") +
      `. They are unreviewed — check them in Content Review before publishing the pages.`,
  });
}
