import { notFound } from "next/navigation";
import Link from "next/link";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { LessonCompleteButton } from "./LessonCompleteButton";
import { LearnMarkdown } from "@/components/learn/LearnMarkdown";
import { InteractivePracticePanel } from "@/components/learn/practices/InteractivePracticePanel";
import { canAccessLesson } from "@/lib/auth/access";
import { Countdown } from "@/components/learn/Countdown";

export default async function LearnCurriculumLessonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!sql) notFound();
  const rows = await sql`
    SELECT l.id, l.code, l.title, l.goal, l.introduction, l.description, l.sort_order, l.feature_image_url, l.slug,
           sm.title AS submodule_title, m.title AS module_title, lv.code AS level_code, m.id AS module_id
    FROM curriculum_lessons l
    JOIN curriculum_submodules sm ON sm.id = l.submodule_id
    JOIN curriculum_modules m ON m.id = sm.module_id
    JOIN curriculum_levels lv ON lv.id = m.level_id
    WHERE l.id::text = ${id} OR l.slug = ${id} LIMIT 1
  `;
  const row = (rows as { id: string; code: string; title: string; goal: string | null; introduction: string | null; description: string | null; submodule_title: string; module_title: string; level_code: string; feature_image_url: string | null; module_id: string; slug: string }[])[0];
  if (!row) notFound();

  // Guard lesson access for logged in users
  let accessAllowed = true;
  let lockReason = "";
  let resetAt = "";

  if (session?.email) {
    const access = await canAccessLesson(session.email, row.id);
    if (!access.allowed) {
      accessAllowed = false;
      lockReason = access.reason;
      resetAt = (access as any).resetAt;
    }
  }

  if (!accessAllowed) {
    return (
      <div className="min-h-screen bg-[var(--base)] py-12 px-4 flex flex-col items-center justify-center japanese-wave-bg">
        <div className="max-w-md w-full bg-white border border-[var(--divider)] rounded-3xl p-8 shadow-card text-center space-y-6">
          <div className="w-16 h-16 bg-[#D0021B]/5 rounded-full flex items-center justify-center mx-auto border border-[#D0021B]/10">
            <span className="text-3xl text-primary">🔒</span>
          </div>
          <div>
            <h1 className="font-heading text-xl font-bold text-charcoal">Lesson Locked</h1>
            <p className="text-secondary text-sm mt-2 leading-relaxed">
              {lockReason === "daily_limit_reached"
                ? "You have completed today's 2 free lessons. Your next lessons unlock tomorrow."
                : "This lesson is currently locked in your curriculum path sequence. Please complete the previous lessons first to unlock."}
            </p>
          </div>

          {lockReason === "daily_limit_reached" && (
            <div className="bg-[#FAF8F5] rounded-2xl p-4 border border-[var(--divider)]/60">
              <p className="text-secondary text-[10px] uppercase tracking-wider font-bold">Unlocks In</p>
              <Countdown resetAt={resetAt} />
            </div>
          )}

          <div className="pt-2 flex flex-col gap-3">
            <Link
              href="/pricing"
              className="w-full py-3 bg-[#D0021B] hover:bg-[#D0021B]/95 text-white font-bold rounded-2xl transition shadow-md text-sm text-center block"
            >
              Upgrade to Premium for Unlimited Access
            </Link>
            <Link
              href={`/learn/curriculum?level=${row.level_code}&module=${row.module_id}`}
              className="text-secondary hover:text-charcoal text-xs font-semibold underline block"
            >
              Go back to Curriculum
            </Link>
          </div>
        </div>
      </div>
    );
  }

  let nextLesson: { id: string; code: string; title: string; slug: string } | null = null;
  const nextRows = await sql`
    WITH ordered AS (
      SELECT l.id, l.code, l.title, l.slug,
             ROW_NUMBER() OVER (ORDER BY lv.sort_order, m.sort_order, sm.sort_order, l.sort_order, l.code) AS rn
      FROM curriculum_lessons l
      JOIN curriculum_submodules sm ON sm.id = l.submodule_id
      JOIN curriculum_modules m ON m.id = sm.module_id
      JOIN curriculum_levels lv ON lv.id = m.level_id
    )
    SELECT o2.id, o2.code, o2.title, o2.slug FROM ordered o1
    JOIN ordered o2 ON o2.rn = o1.rn + 1
    WHERE o1.id = ${row.id}::uuid LIMIT 1
  `;
  const nextRow = (nextRows as { id: string; code: string; title: string; slug: string }[])[0];
  if (nextRow) nextLesson = nextRow;

  let prevLesson: { id: string; code: string; title: string; slug: string } | null = null;
  const prevRows = await sql`
    WITH ordered AS (
      SELECT l.id, l.code, l.title, l.slug,
             ROW_NUMBER() OVER (ORDER BY lv.sort_order, m.sort_order, sm.sort_order, l.sort_order, l.code) AS rn
      FROM curriculum_lessons l
      JOIN curriculum_submodules sm ON sm.id = l.submodule_id
      JOIN curriculum_modules m ON m.id = sm.module_id
      JOIN curriculum_levels lv ON lv.id = m.level_id
    )
    SELECT o2.id, o2.code, o2.title, o2.slug FROM ordered o1
    JOIN ordered o2 ON o2.rn = o1.rn - 1
    WHERE o1.id = ${row.id}::uuid LIMIT 1
  `;
  const prevRow = (prevRows as { id: string; code: string; title: string; slug: string }[])[0];
  if (prevRow) prevLesson = prevRow;

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
    WHERE c.lesson_id = ${row.id}::uuid
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
    WHERE lv.lesson_id = ${row.id}::uuid
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
    WHERE lg.lesson_id = ${row.id}::uuid
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
    WHERE lk.lesson_id = ${row.id}::uuid
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
    WHERE lk.lesson_id = ${row.id}::uuid
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
    WHERE lesson_id = ${row.id}::uuid
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

  const practiceRows = await sql`
    SELECT id, title, description, practice_type, content_data, estimated_minutes
    FROM curriculum_practices
    WHERE lesson_id = ${row.id}::uuid
    ORDER BY sort_order, created_at
  `;
  const practices = (practiceRows as {
    id: string;
    title: string;
    description: string | null;
    practice_type: string | null;
    content_data: any;
    estimated_minutes: number | null;
  }[]) ?? [];

  const writingHiraganaChars = kana
    .filter((k) => k.type === "hiragana" && k.character)
    .map((k) => k.character);
  const writingKatakanaChars = kana
    .filter((k) => k.type === "katakana" && k.character)
    .map((k) => k.character);

  const writingType: "hiragana" | "katakana" | null = writingHiraganaChars.length
    ? "hiragana"
    : writingKatakanaChars.length
      ? "katakana"
      : null;
  const writingChars =
    writingType === "hiragana"
      ? Array.from(new Set(writingHiraganaChars))
      : writingType === "katakana"
        ? Array.from(new Set(writingKatakanaChars))
        : [];

  return (
    <div className="min-h-screen bg-[var(--base)]">
      <div className="max-w-[1100px] mx-auto px-4 py-8">
        {/* Breadcrumbs */}
        <nav className="text-xs text-secondary mb-4">
          <Link href="/learn/dashboard" className="hover:text-primary">Dashboard</Link>
          <span className="mx-2">/</span>
          <Link href="/learn/curriculum" className="hover:text-primary">Curriculum</Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal">{row.level_code} › {row.module_title} › {row.submodule_title}</span>
        </nav>

        {/* Lesson Header */}
        <div className="mb-6">
          <span className="text-[10px] font-bold text-primary uppercase tracking-wider bg-primary/5 px-2.5 py-1 rounded-full border border-primary/10">
            Lesson {row.code}
          </span>
          <h1 className="font-heading text-2xl font-bold text-charcoal mt-3 mb-2">{row.title}</h1>
          {row.description && (
            <p className="text-secondary text-sm leading-relaxed max-w-2xl mb-4">
              {row.description}
            </p>
          )}
          {row.goal && (
            <p className="text-primary text-xs font-semibold bg-[#FFF7F7] border border-[#D0021B]/15 px-3 py-1.5 rounded-xl inline-block">
              🎯 Goal: {row.goal}
            </p>
          )}
        </div>

        {/* Feature Image centered */}
        {row.feature_image_url && (
          <div className="mb-8 flex justify-center">
            <div className="relative w-full max-w-[640px] aspect-[16/9] rounded-2xl overflow-hidden border border-[var(--divider)] shadow-xs">
              <img
                src={row.feature_image_url}
                alt={row.title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        {/* Introduction */}
        {row.introduction && (
          <div id="intro" className="prose prose-charcoal mb-8 text-charcoal text-sm leading-relaxed bg-white border border-[var(--divider)] rounded-bento p-5">
            <p className="font-semibold text-secondary text-[10px] uppercase tracking-wider mb-2">Introduction</p>
            <p>{row.introduction}</p>
          </div>
        )}

        {/* Main 2-Column Split Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Column: Lesson markdown body + exercises + practices */}
          <div className="lg:col-span-8 space-y-8 min-w-0">
            <section id="lesson" className="scroll-mt-6">
              <h2 className="font-heading text-lg font-semibold text-charcoal mb-3">Lesson Content</h2>
              {mainBlocks.length ? (
                <div className="space-y-6">
                  {mainBlocks.map((b) => (
                    <div key={b.id} className="bg-white border border-[var(--divider)] rounded-bento p-6">
                      <div className="prose prose-charcoal max-w-none text-sm leading-relaxed">
                        <LearnMarkdown content={(b.content ?? "").trim() || "_Content coming soon._"} meta={b.meta ?? {}} contentType={b.content_type ?? undefined} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-secondary text-xs italic">No main lesson content yet.</p>
              )}
            </section>

            {exercises.length > 0 && (
              <section id="exercises" className="scroll-mt-6">
                <h2 className="font-heading text-lg font-semibold text-charcoal mb-3">Exercises</h2>
                <div className="space-y-4">
                  {exercises.map((ex) => (
                    <div key={ex.id} className="bg-white border border-[var(--divider)] rounded-bento p-6">
                      <h3 className="font-heading font-semibold text-sm text-charcoal mb-3">
                        {ex.title?.trim() || ex.content_slug || "Exercise"}
                      </h3>
                      <div className="prose prose-charcoal max-w-none text-sm leading-relaxed">
                        <LearnMarkdown content={(ex.content ?? "").trim() || "_Exercise content coming soon._"} meta={ex.meta ?? {}} contentType={ex.content_type ?? undefined} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {examples.length > 0 && (
              <section id="examples" className="scroll-mt-6">
                <h2 className="font-heading text-lg font-semibold text-charcoal mb-3">Examples</h2>
                <div className="space-y-3">
                  {examples.map((ex) => (
                    <div key={ex.id} className="bg-white border border-[var(--divider)] rounded-bento p-4">
                      <p className="text-charcoal text-sm font-semibold mb-1">{ex.sentence_ja}</p>
                      {ex.sentence_romaji && <p className="text-secondary text-xs mb-2 font-mono">{ex.sentence_romaji}</p>}
                      <p className="text-secondary text-xs">{ex.sentence_en}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section id="practice" className="scroll-mt-6">
              <h2 className="font-heading text-lg font-semibold text-charcoal mb-3">Practice Drills</h2>
              <InteractivePracticePanel
                practices={practices}
                lessonTitle={row.title}
                lessonId={row.id}
                kanaList={kana.map((k) => ({ character: k.character, romaji: k.romaji, type: k.type }))}
                kanjiList={kanji
                  .filter((k) => k.character && k.meaning)
                  .map((k) => ({ character: k.character as string, meaning: k.meaning as string }))}
              />
            </section>
          </div>

          {/* Right Column: Sticky Navigation and Materials lists */}
          <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-6">
            
            {/* Table of Contents Widget */}
            <div className="bg-white border border-[var(--divider)] rounded-2xl p-4 shadow-sm">
              <h3 className="font-heading font-bold text-xs uppercase tracking-wider text-secondary mb-3">
                On this lesson
              </h3>
              <ul className="space-y-2 text-xs">
                <li>
                  <a href="#intro" className="text-charcoal hover:text-primary transition font-medium">
                    Introduction
                  </a>
                </li>
                <li>
                  <a href="#lesson" className="text-charcoal hover:text-primary transition font-medium">
                    Lesson Content
                  </a>
                </li>
                {exercises.length > 0 && (
                  <li>
                    <a href="#exercises" className="text-charcoal hover:text-primary transition font-medium">
                      Exercises
                    </a>
                  </li>
                )}
                {examples.length > 0 && (
                  <li>
                    <a href="#examples" className="text-charcoal hover:text-primary transition font-medium">
                      Examples
                    </a>
                  </li>
                )}
                <li>
                  <a href="#practice" className="text-charcoal hover:text-primary transition font-medium">
                    Practice Drills
                  </a>
                </li>
                <li>
                  <a href="#lists" className="text-charcoal hover:text-primary transition font-medium">
                    Lesson Materials
                  </a>
                </li>
              </ul>
            </div>

            {/* Structured Materials Lists */}
            <div id="lists" className="space-y-4">
              <h3 className="font-heading font-bold text-xs uppercase tracking-wider text-secondary pl-1">
                Lesson Materials
              </h3>

              {/* Vocabulary */}
              <div className="bg-white border border-[var(--divider)] rounded-2xl p-4 shadow-sm">
                <h4 className="font-heading font-semibold text-xs text-charcoal mb-2">Vocabulary</h4>
                {vocab.length ? (
                  <div className="space-y-2.5">
                    {vocab.map((v) => (
                      <div key={v.id} className="flex flex-col border-b border-[var(--divider)]/40 pb-2 last:border-0 last:pb-0">
                        <Link href={`/learn/vocabulary/${v.slug}`} className="text-xs font-bold text-primary hover:underline">
                          {v.word} ({v.reading})
                        </Link>
                        <span className="text-[11px] text-secondary mt-0.5">{v.meaning}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-secondary text-xs italic">No vocabulary in this lesson.</p>
                )}
              </div>

              {/* Grammar */}
              <div className="bg-white border border-[var(--divider)] rounded-2xl p-4 shadow-sm">
                <h4 className="font-heading font-semibold text-xs text-charcoal mb-2">Grammar</h4>
                {grammar.length ? (
                  <div className="space-y-2.5">
                    {grammar.map((g) => (
                      <div key={g.id} className="flex flex-col border-b border-[var(--divider)]/40 pb-2 last:border-0 last:pb-0">
                        <Link href={`/learn/grammar/${g.slug}`} className="text-xs font-bold text-primary hover:underline">
                          {g.pattern}
                        </Link>
                        <span className="text-[11px] text-secondary mt-0.5 font-mono">{g.structure}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-secondary text-xs italic">No grammar rules in this lesson.</p>
                )}
              </div>

              {/* Kanji */}
              <div className="bg-white border border-[var(--divider)] rounded-2xl p-4 shadow-sm">
                <h4 className="font-heading font-semibold text-xs text-charcoal mb-2">Kanji</h4>
                {kanji.length ? (
                  <div className="space-y-2.5">
                    {kanji.map((k) => (
                      <div key={k.id} className="flex flex-col border-b border-[var(--divider)]/40 pb-2 last:border-0 last:pb-0">
                        <Link href={`/learn/kanji/${k.slug}`} className="text-xs font-bold text-primary hover:underline">
                          {k.character} — {k.meaning}
                        </Link>
                        {k.onyomi && k.onyomi.length > 0 && (
                          <span className="text-[10px] text-secondary mt-0.5">Onyomi: {k.onyomi.join(", ")}</span>
                        )}
                        {k.kunyomi && k.kunyomi.length > 0 && (
                          <span className="text-[10px] text-secondary">Kunyomi: {k.kunyomi.join(", ")}</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-secondary text-xs italic">No kanji characters in this lesson.</p>
                )}
              </div>

              {/* Kana */}
              <div className="bg-white border border-[var(--divider)] rounded-2xl p-4 shadow-sm">
                <h4 className="font-heading font-semibold text-xs text-charcoal mb-2">Kana</h4>
                {kana.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {kana.map((k) => (
                      <span key={k.id} className="px-2 py-0.5 rounded-full border border-[var(--divider)] text-charcoal bg-[var(--divider)]/10 text-[10px] font-semibold">
                        {k.character} <span className="text-secondary text-[9px] font-mono">({k.romaji})</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-secondary text-xs italic">No kana characters in this lesson.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Mobile/Desktop Bottom Navigation Row */}
        <div className="mt-12 pt-6 border-t border-[var(--divider)] flex flex-row items-center justify-between gap-4">
          {prevLesson ? (
            <Link
              href={`/learn/curriculum/lesson/${prevLesson.slug || prevLesson.id}`}
              className="px-4 py-2.5 rounded-xl border border-[var(--divider)] text-charcoal font-semibold text-xs hover:bg-[var(--divider)]/10 transition whitespace-nowrap"
            >
              ← Previous
            </Link>
          ) : (
            <div className="w-16" />
          )}

          <div className="flex justify-center flex-1">
            {session?.email ? (
              <LessonCompleteButton lessonId={row.id} nextLesson={nextLesson} />
            ) : (
              <Link
                href={`/login?redirect=/learn/curriculum/lesson/${row.slug || row.id}`}
                className="px-4 py-2.5 bg-primary text-white font-bold rounded-xl text-xs hover:bg-primary/95 transition shadow-sm text-center"
              >
                Sign in to Complete
              </Link>
            )}
          </div>

          {nextLesson ? (
            <Link
              href={`/learn/curriculum/lesson/${nextLesson.slug || nextLesson.id}`}
              className="px-4 py-2.5 bg-primary text-white font-semibold text-xs rounded-xl hover:bg-primary/95 transition whitespace-nowrap"
            >
              Next →
            </Link>
          ) : (
            <div className="w-16" />
          )}
        </div>

        {/* Navigation Footer */}
        <div className="mt-6 flex gap-4 text-xs font-semibold">
          <Link href={`/learn/curriculum?level=${row.level_code}&module=${row.module_id}`} className="text-secondary hover:text-primary transition">
            ← Back to Curriculum
          </Link>
          <span className="text-[var(--divider)]">|</span>
          <Link href="/learn/dashboard" className="text-secondary hover:text-primary transition">
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
