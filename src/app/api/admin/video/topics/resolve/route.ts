import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/admin";
import { sql } from "@/lib/db";
import { deepSeekConfigured } from "@/lib/ai/deepseek";
import { expandTopic, matchTopicItems, proposeTopicWords, type TopicCandidate } from "@/lib/video/topics";

/**
 * Turns a free-text topic into a confirmable list of items.
 *
 * Two halves, both fallible and both surfaced as such:
 *   library  published content matched by word-boundary search on expanded terms
 *   llm      words written just now to fill the gap, marked unreviewed
 *
 * NOTHING IS SAVED HERE. This is a read-only proposal; the draft posts are written by
 * /api/admin/video/topics/commit once you have ticked the ones you want. Writing on search would
 * fill the content library with drafts for every topic anyone ever typed into the box.
 */
export async function POST(req: Request) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sql) return NextResponse.json({ error: "Database unavailable" }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const topic = typeof body?.topic === "string" ? body.topic.trim() : "";
  const jlptLevel = typeof body?.jlptLevel === "string" && body.jlptLevel ? body.jlptLevel : undefined;
  const target = Math.min(30, Math.max(1, Number(body?.count) || 10));
  const allowLlm = body?.allowLlm !== false;

  if (!topic) return NextResponse.json({ error: "Give the topic a name, e.g. \"birds in Japanese\"" }, { status: 400 });

  const terms = await expandTopic(topic);
  const library = await matchTopicItems(terms, { jlptLevel, limit: Math.max(target * 3, 40) });

  // Only ask the model for what the library could not supply. On this database that is nothing
  // for "numbers" (40 N5 matches) and most of the list for "birds" (10, several of them wrong).
  const shortfall = Math.max(0, target - library.length);
  let proposed: TopicCandidate[] = [];
  let llmError: string | null = null;

  if (shortfall > 0 && allowLlm && deepSeekConfigured()) {
    try {
      const words = await proposeTopicWords({
        topic,
        jlptLevel,
        have: library.map((i) => i.word ?? i.title).filter(Boolean).slice(0, 40),
        count: shortfall,
      });
      proposed = words.map((w) => ({
        contentType: "vocabulary",
        title: w.word,
        word: w.word,
        reading: w.reading,
        meaning: w.meaning,
        jlptLevel: w.jlptLevel,
        source: "llm" as const,
        // Carried through so /commit can write the post without a second model call.
        ...({ proposal: w } as Record<string, unknown>),
      }));
    } catch (err) {
      // A failed expansion must not lose the library matches, which are the trustworthy half.
      llmError = err instanceof Error ? err.message : "Could not write new words";
    }
  }

  return NextResponse.json({
    topic,
    terms,
    library,
    proposed,
    llmError,
    notice:
      library.length === 0 && proposed.length === 0
        ? `Nothing matched "${topic}". Try naming the things themselves — "sparrow, crow, pigeon" rather than "birds".`
        : null,
  });
}
