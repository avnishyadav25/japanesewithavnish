import { notFound } from "next/navigation";
import Link from "next/link";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { LessonCompleteButton } from "./LessonCompleteButton";
import { LearnMarkdown } from "@/components/learn/LearnMarkdown";

export default async function LearnCurriculumLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!sql) notFound();
  const rows = await sql`
    SELECT l.id, l.code, l.title, l.goal, l.introduction, l.sort_order,
           sm.title AS submodule_title, m.title AS module_title, lv.code AS level_code
    FROM curriculum_lessons l
    JOIN curriculum_submodules sm ON sm.id = l.submodule_id
    JOIN curriculum_modules m ON m.id = sm.module_id
    JOIN curriculum_levels lv ON lv.id = m.level_id
    WHERE l.id = ${id} LIMIT 1
  `;
  const row = (rows as { id: string; code: string; title: string; goal: string | null; introduction: string | null; submodule_title: string; module_title: string; level_code: string }[])[0];
  if (!row) notFound();

  let nextLesson: { id: string; code: string; title: string } | null = null;
  const nextRows = await sql`
    WITH ordered AS (
      SELECT l.id, l.code, l.title,
             ROW_NUMBER() OVER (ORDER BY lv.sort_order, m.sort_order, sm.sort_order, l.sort_order, l.code) AS rn
      FROM curriculum_lessons l
      JOIN curriculum_submodules sm ON sm.id = l.submodule_id
      JOIN curriculum_modules m ON m.id = sm.module_id
      JOIN curriculum_levels lv ON lv.id = m.level_id
    )
    SELECT o2.id, o2.code, o2.title FROM ordered o1
    JOIN ordered o2 ON o2.rn = o1.rn + 1
    WHERE o1.id = ${id} LIMIT 1
  `;
  const nextRow = (nextRows as { id: string; code: string; title: string }[])[0];
  if (nextRow) nextLesson = nextRow;

  const contentRows = await sql`
    SELECT
      c.id,
      c.content_slug,
      c.content_role,
      c.sort_order,
      COALESCE(p.title, c.title, c.content_slug) AS title,
      p.content,
      p.meta,
      p.content_type
    FROM curriculum_lesson_content c
    LEFT JOIN posts p ON (p.id = c.post_id) OR (c.post_id IS NULL AND p.slug = c.content_slug)
    WHERE c.lesson_id = ${id}
    ORDER BY c.sort_order, c.content_slug
  `;
  const blocks = (contentRows as {
    id: string;
    content_slug: string;
    content_role: string;
    sort_order: number;
    title: string;
    content: string | null;
    meta: Record<string, unknown> | null;
    content_type: string | null;
  }[]) ?? [];
  const mainBlocks = blocks.filter((b) => b.content_role === "main");
  const exercises = blocks.filter((b) => b.content_role === "exercise");

  const vocabRows = await sql`
    SELECT lv.id, lv.sort_order, v.id AS vocabulary_id, v.word, v.reading, v.meaning, p.slug, p.meta
    FROM curriculum_lesson_vocabulary lv
    JOIN vocabulary v ON v.id = lv.vocabulary_id
    JOIN posts p ON p.id = v.post_id
    WHERE lv.lesson_id = ${id}
    ORDER BY lv.sort_order, v.word
  `;
  const vocab = (vocabRows as {
    id: string;
    vocabulary_id: string;
    sort_order: number;
    word: string | null;
    reading: string | null;
    meaning: string | null;
    slug: string;
    meta: Record<string, unknown> | null;
  }[]) ?? [];

  const grammarRows = await sql`
    SELECT lg.id, lg.sort_order, g.id AS grammar_id, g.pattern, g.structure, g.level, p.slug, p.meta
    FROM curriculum_lesson_grammar lg
    JOIN grammar g ON g.id = lg.grammar_id
    JOIN posts p ON p.id = g.post_id
    WHERE lg.lesson_id = ${id}
    ORDER BY lg.sort_order, g.pattern
  `;
  const grammar = (grammarRows as {
    id: string;
    grammar_id: string;
    sort_order: number;
    pattern: string | null;
    structure: string | null;
    level: string | null;
    slug: string;
    meta: Record<string, unknown> | null;
  }[]) ?? [];

  const kanjiRows = await sql`
    SELECT lk.id, lk.sort_order, k.id AS kanji_id, k.character, k.meaning, k.onyomi, k.kunyomi, p.slug, p.meta
    FROM curriculum_lesson_kanji lk
    JOIN kanji k ON k.id = lk.kanji_id
    JOIN posts p ON p.id = k.post_id
    WHERE lk.lesson_id = ${id}
    ORDER BY lk.sort_order, k.character
  `;
  const kanji = (kanjiRows as {
    id: string;
    kanji_id: string;
    sort_order: number;
    character: string | null;
    meaning: string | null;
    onyomi: string[] | null;
    kunyomi: string[] | null;
    slug: string;
    meta: Record<string, unknown> | null;
  }[]) ?? [];

  const kanaRows = await sql`
    SELECT lk.id, lk.sort_order, k.id AS kana_id, k.character, k.romaji, k.row_label, k.type
    FROM curriculum_lesson_kana lk
    JOIN kana k ON k.id = lk.kana_id
    WHERE lk.lesson_id = ${id}
    ORDER BY lk.sort_order, k.sort_order, k.character
  `;
  const kana = (kanaRows as {
    id: string;
    kana_id: string;
    sort_order: number;
    character: string;
    romaji: string;
    row_label: string | null;
    type: string;
  }[]) ?? [];

  const exampleRows = await sql`
    SELECT id, sentence_ja, sentence_romaji, sentence_en, notes, sort_order
    FROM examples
    WHERE lesson_id = ${id}
    ORDER BY sort_order, created_at
  `;
  const examples = (exampleRows as {
    id: string;
    sentence_ja: string;
    sentence_romaji: string | null;
    sentence_en: string;
    notes: string | null;
    sort_order: number;
  }[]) ?? [];

  return (
    <div className="min-h-screen bg-[var(--base)]">
      <div className="max-w-[720px] mx-auto px-4 py-8">
        <nav className="text-sm text-secondary mb-4">
          <Link href="/learn/dashboard" className="hover:text-primary">Dashboard</Link>
          <span className="mx-2">/</span>
          <Link href="/learn/curriculum" className="hover:text-primary">Curriculum</Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal">{row.level_code} › {row.module_title} › {row.submodule_title}</span>
        </nav>
        <h1 className="font-heading text-3xl font-bold text-charcoal mb-2">{row.title}</h1>
        {row.goal && <p className="text-primary font-medium mb-4 text-lg">{row.goal}</p>}
        {row.introduction && (
          <div className="prose prose-charcoal mb-8 text-charcoal text-base leading-relaxed">
            <p>{row.introduction}</p>
          </div>
        )}

        <section className="mb-8">
          <h2 className="font-heading text-xl font-semibold text-charcoal mb-3">Lesson</h2>
          {mainBlocks.length ? (
            <div className="space-y-6">
              {mainBlocks.map((b) => (
                <div key={b.id} className="bg-white border border-[var(--divider)] rounded-bento p-5">
                  <div className="prose prose-charcoal max-w-none">
                    <LearnMarkdown content={(b.content ?? "").trim() || "_Content coming soon._"} meta={b.meta ?? {}} contentType={b.content_type ?? undefined} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-secondary text-sm">No main lesson content yet.</p>
          )}
        </section>

        <section id="lists" className="mb-8">
          <h2 className="font-heading text-xl font-semibold text-charcoal mb-3">Lists</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-[var(--divider)] rounded-bento p-5">
              <h3 className="font-heading font-semibold text-charcoal mb-2">Vocabulary</h3>
              {vocab.length ? (
                <ul className="space-y-2">
                  {vocab.map((v) => (
                    <li key={v.id} className="flex items-baseline justify-between gap-3">
                      <Link href={`/learn/vocabulary/${v.slug}`} className="text-primary hover:underline">
                        {v.word || v.slug}
                      </Link>
                      <span className="text-xs text-secondary truncate">{v.meaning || ""}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-secondary text-sm">No vocabulary linked yet.</p>
              )}
            </div>

            <div className="bg-white border border-[var(--divider)] rounded-bento p-5">
              <h3 className="font-heading font-semibold text-charcoal mb-2">Grammar</h3>
              {grammar.length ? (
                <ul className="space-y-2">
                  {grammar.map((g) => (
                    <li key={g.id} className="flex items-baseline justify-between gap-3">
                      <Link href={`/learn/grammar/${g.slug}`} className="text-primary hover:underline">
                        {g.pattern || g.slug}
                      </Link>
                      <span className="text-xs text-secondary truncate">{g.structure || ""}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-secondary text-sm">No grammar linked yet.</p>
              )}
            </div>

            <div className="bg-white border border-[var(--divider)] rounded-bento p-5">
              <h3 className="font-heading font-semibold text-charcoal mb-2">Kanji</h3>
              {kanji.length ? (
                <ul className="space-y-2">
                  {kanji.map((k) => (
                    <li key={k.id} className="flex items-baseline justify-between gap-3">
                      <Link href={`/learn/kanji/${k.slug}`} className="text-primary hover:underline">
                        {k.character || k.slug}
                      </Link>
                      <span className="text-xs text-secondary truncate">{k.meaning || ""}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-secondary text-sm">No kanji linked yet.</p>
              )}
            </div>

            <div className="bg-white border border-[var(--divider)] rounded-bento p-5">
              <h3 className="font-heading font-semibold text-charcoal mb-2">Kana</h3>
              {kana.length ? (
                <div className="flex flex-wrap gap-2">
                  {kana.map((k) => (
                    <span key={k.id} className="px-2 py-1 rounded border border-[var(--divider)] text-charcoal bg-[var(--divider)]/10 text-sm">
                      {k.character} <span className="text-secondary text-xs">({k.romaji})</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-secondary text-sm">No kana linked yet.</p>
              )}
            </div>
          </div>
        </section>

        <section id="exercises" className="mb-8">
          <h2 className="font-heading text-xl font-semibold text-charcoal mb-3">Exercises</h2>
          {exercises.length ? (
            <div className="space-y-4">
              {exercises.map((ex) => (
                <div key={ex.id} className="bg-white border border-[var(--divider)] rounded-bento p-5">
                  <h3 className="font-heading font-semibold text-charcoal mb-3">
                    {ex.title?.trim() || ex.content_slug || "Exercise"}
                  </h3>
                  <div className="prose prose-charcoal max-w-none">
                    <LearnMarkdown content={(ex.content ?? "").trim() || "_Exercise content coming soon._"} meta={ex.meta ?? {}} contentType={ex.content_type ?? undefined} />
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-secondary text-sm">No exercises yet for this lesson.</p>}
        </section>

        <section id="examples" className="mb-8">
          <h2 className="font-heading text-xl font-semibold text-charcoal mb-3">Examples</h2>
          {examples.length ? (
            <div className="space-y-3">
              {examples.map((ex) => (
                <div key={ex.id} className="bg-white border border-[var(--divider)] rounded-bento p-4">
                  <p className="text-charcoal text-base mb-1">{ex.sentence_ja}</p>
                  {ex.sentence_romaji && <p className="text-secondary text-sm mb-2">{ex.sentence_romaji}</p>}
                  <p className="text-secondary text-sm">{ex.sentence_en}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-secondary text-sm">No examples yet for this lesson.</p>
          )}
        </section>

        <section id="practice" className="mb-8">
          <h2 className="font-heading text-xl font-semibold text-charcoal mb-3">Practice</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href={`/learn/grammar-drills?lessonId=${row.id}`} className="bg-white border border-[var(--divider)] rounded-bento p-5 hover:border-primary transition">
              <div className="font-heading font-semibold text-charcoal mb-1">Grammar drills</div>
              <div className="text-secondary text-sm">Quick multiple-choice drills for this lesson.</div>
            </Link>
            <Link href="/learn/listening" className="bg-white border border-[var(--divider)] rounded-bento p-5 hover:border-primary transition">
              <div className="font-heading font-semibold text-charcoal mb-1">Listening</div>
              <div className="text-secondary text-sm">Scenarios + questions.</div>
            </Link>
            <Link href="/learn/reading/sandbox" className="bg-white border border-[var(--divider)] rounded-bento p-5 hover:border-primary transition">
              <div className="font-heading font-semibold text-charcoal mb-1">Reading sandbox</div>
              <div className="text-secondary text-sm">Read with glossary support.</div>
            </Link>
            <Link href="/learn/writing" className="bg-white border border-[var(--divider)] rounded-bento p-5 hover:border-primary transition">
              <div className="font-heading font-semibold text-charcoal mb-1">Writing</div>
              <div className="text-secondary text-sm">Write, get feedback, and track mistakes.</div>
            </Link>
            <Link href="/learn/exam" className="bg-white border border-[var(--divider)] rounded-bento p-5 hover:border-primary transition md:col-span-2">
              <div className="font-heading font-semibold text-charcoal mb-1">Mock exam</div>
              <div className="text-secondary text-sm">Try a full practice test.</div>
            </Link>
          </div>
        </section>

        {session?.email ? (
          <LessonCompleteButton lessonId={row.id} nextLesson={nextLesson} />
        ) : (
          <p className="text-secondary text-sm">
            <Link href={`/login?redirect=/learn/curriculum/lesson/${row.id}`} className="text-primary hover:underline">Sign in</Link> to mark this lesson complete.
          </p>
        )}
        <div className="mt-8 pt-6 border-t border-[var(--divider)] flex flex-wrap gap-4">
          <Link href="/learn/curriculum" className="text-primary text-sm font-medium hover:underline">← Curriculum path</Link>
          <Link href="/learn/dashboard" className="text-secondary text-sm font-medium hover:underline">Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
