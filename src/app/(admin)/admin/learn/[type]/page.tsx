import Link from "next/link";
import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { LEARN_CONTENT_TYPES, LEARN_TYPE_LABELS, type LearnContentType } from "@/lib/learn-filters";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { GenerateLearnListButton } from "@/components/admin/GenerateLearnListButton";
import { GenerateMockTestButton } from "@/components/admin/GenerateMockTestButton";
import { LearnContentRowActions } from "@/components/admin/LearnContentRowActions";

type UsageLessonBadge = { lesson_id: string; lesson_title: string; lesson_code: string; module_title: string; level_code: string };

function UsedInBadge({ usage }: { usage: UsageLessonBadge[] }) {
  if (usage.length === 0) {
    return <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-500 border border-gray-200 font-semibold">Unused</span>;
  }
  if (usage.length === 1) {
    const u = usage[0];
    return (
      <Link
        href={`/admin/learn/curriculum/lessons/${u.lesson_id}`}
        className="text-[10px] px-2 py-0.5 rounded-full bg-primary/5 text-primary border border-primary/20 font-semibold hover:bg-primary/10 transition"
        title={`${u.level_code} — ${u.module_title} — ${u.lesson_title}`}
      >
        {u.level_code} {u.lesson_code}
      </Link>
    );
  }
  return (
    <Link
      href={`/admin/learn/curriculum/lessons/${usage[0].lesson_id}`}
      className="text-[10px] px-2 py-0.5 rounded-full bg-primary/5 text-primary border border-primary/20 font-semibold hover:bg-primary/10 transition"
      title={usage.map((u) => `${u.level_code} — ${u.module_title} — ${u.lesson_title}`).join("\n")}
    >
      {usage.length} lessons
    </Link>
  );
}

export default async function AdminLearnPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ level?: string; view?: string }>;
}) {
  const { type } = await params;
  const { level = "all", view = "table" } = await searchParams;
  
  const normalized = type.toLowerCase();
  if (!LEARN_CONTENT_TYPES.includes(normalized as LearnContentType)) notFound();

  const selectedLevel = level.toUpperCase();
  const selectedView = view.toLowerCase();

  type Row = {
    id: string;
    slug: string;
    title: string;
    jlpt_level: string | null;
    status: string;
    sort_order: number;
    meta: Record<string, unknown> | null;
    og_image_url?: string | null;
    vocabulary_id?: string;
    vocabulary_word?: string | null;
    vocabulary_reading?: string | null;
    vocabulary_romaji?: string | null;
    vocabulary_meaning?: string | null;
    kanji_id?: string;
    kanji_character?: string | null;
    kanji_meaning?: string | null;
    kanji_onyomi?: string[] | null;
    kanji_kunyomi?: string[] | null;
    kanji_stroke_count?: number | null;
    grammar_id?: string;
    grammar_pattern?: string | null;
    grammar_structure?: string | null;
  };

  type UsageLesson = { lesson_id: string; lesson_title: string; lesson_code: string; module_title: string; level_code: string };

  let items: Row[] = [];
  let levelCounts: Record<string, number> = {
    ALL: 0,
    N5: 0,
    N4: 0,
    N3: 0,
    N2: 0,
    N1: 0,
  };

  if (sql) {
    if (normalized === "vocabulary") {
      const countRows = (await sql`
        SELECT coalesce(v.jlpt_level, (p.jlpt_level)[1], 'ALL') AS level, COUNT(*)::int AS count
        FROM posts p
        JOIN vocabulary v ON v.post_id = p.id
        WHERE p.content_type = 'vocabulary'
        GROUP BY 1
      `) as { level: string; count: number }[];

      const counts = { ...levelCounts };
      for (const row of countRows ?? []) {
        const key = String(row.level || "ALL").toUpperCase();
        if (key in counts) counts[key] = Number(row.count) || 0;
        counts.ALL += Number(row.count) || 0;
      }
      levelCounts = counts;

      if (selectedLevel === "ALL") {
        const rows = await sql`
          SELECT
            p.id,
            p.slug,
            p.title,
            coalesce(v.jlpt_level, (p.jlpt_level)[1]) AS jlpt_level,
            p.status,
            p.sort_order,
            p.meta,
            p.og_image_url,
            v.id AS vocabulary_id,
            v.word AS vocabulary_word,
            v.reading AS vocabulary_reading,
            v.romaji AS vocabulary_romaji,
            v.meaning AS vocabulary_meaning
          FROM posts p
          JOIN vocabulary v ON v.post_id = p.id
          WHERE p.content_type = 'vocabulary'
          ORDER BY coalesce(v.jlpt_level, (p.jlpt_level)[1]), coalesce(v.romaji, v.reading, v.word), v.word
        `;
        items = (rows ?? []) as Row[];
      } else {
        const rows = await sql`
          SELECT
            p.id,
            p.slug,
            p.title,
            coalesce(v.jlpt_level, (p.jlpt_level)[1]) AS jlpt_level,
            p.status,
            p.sort_order,
            p.meta,
            p.og_image_url,
            v.id AS vocabulary_id,
            v.word AS vocabulary_word,
            v.reading AS vocabulary_reading,
            v.romaji AS vocabulary_romaji,
            v.meaning AS vocabulary_meaning
          FROM posts p
          JOIN vocabulary v ON v.post_id = p.id
          WHERE p.content_type = 'vocabulary'
            AND (v.jlpt_level = ${selectedLevel} OR (p.jlpt_level)[1] = ${selectedLevel})
          ORDER BY coalesce(v.romaji, v.reading, v.word), v.word
        `;
        items = (rows ?? []) as Row[];
      }
    } else if (normalized === "kanji") {
      const countRows = (await sql`
        SELECT coalesce(k.jlpt_level, (p.jlpt_level)[1], 'ALL') AS level, COUNT(*)::int AS count
        FROM posts p
        JOIN kanji k ON k.post_id = p.id
        WHERE p.content_type = 'kanji'
        GROUP BY 1
      `) as { level: string; count: number }[];

      const counts = { ...levelCounts };
      for (const row of countRows ?? []) {
        const key = String(row.level || "ALL").toUpperCase();
        if (key in counts) counts[key] = Number(row.count) || 0;
        counts.ALL += Number(row.count) || 0;
      }
      levelCounts = counts;

      if (selectedLevel === "ALL") {
        const rows = await sql`
          SELECT
            p.id,
            p.slug,
            p.title,
            coalesce(k.jlpt_level, (p.jlpt_level)[1]) AS jlpt_level,
            p.status,
            p.sort_order,
            p.meta,
            p.og_image_url,
            k.id AS kanji_id,
            k.character AS kanji_character,
            k.meaning AS kanji_meaning,
            k.onyomi AS kanji_onyomi,
            k.kunyomi AS kanji_kunyomi,
            k.stroke_count AS kanji_stroke_count
          FROM posts p
          JOIN kanji k ON k.post_id = p.id
          WHERE p.content_type = 'kanji'
          ORDER BY coalesce(k.jlpt_level, (p.jlpt_level)[1]), k.character
        `;
        items = (rows ?? []) as Row[];
      } else {
        const rows = await sql`
          SELECT
            p.id,
            p.slug,
            p.title,
            coalesce(k.jlpt_level, (p.jlpt_level)[1]) AS jlpt_level,
            p.status,
            p.sort_order,
            p.meta,
            p.og_image_url,
            k.id AS kanji_id,
            k.character AS kanji_character,
            k.meaning AS kanji_meaning,
            k.onyomi AS kanji_onyomi,
            k.kunyomi AS kanji_kunyomi,
            k.stroke_count AS kanji_stroke_count
          FROM posts p
          JOIN kanji k ON k.post_id = p.id
          WHERE p.content_type = 'kanji'
            AND (k.jlpt_level = ${selectedLevel} OR (p.jlpt_level)[1] = ${selectedLevel})
          ORDER BY k.character
        `;
        items = (rows ?? []) as Row[];
      }
    } else if (normalized === "grammar") {
      const countRows = (await sql`
        SELECT coalesce(g.level, (p.jlpt_level)[1], 'ALL') AS level, COUNT(*)::int AS count
        FROM posts p
        JOIN grammar g ON g.post_id = p.id
        WHERE p.content_type = 'grammar'
        GROUP BY 1
      `) as { level: string; count: number }[];

      const counts = { ...levelCounts };
      for (const row of countRows ?? []) {
        const key = String(row.level || "ALL").toUpperCase();
        if (key in counts) counts[key] = Number(row.count) || 0;
        counts.ALL += Number(row.count) || 0;
      }
      levelCounts = counts;

      if (selectedLevel === "ALL") {
        const rows = await sql`
          SELECT
            p.id,
            p.slug,
            p.title,
            coalesce(g.level, (p.jlpt_level)[1]) AS jlpt_level,
            p.status,
            p.sort_order,
            p.meta,
            p.og_image_url,
            g.id AS grammar_id,
            g.pattern AS grammar_pattern,
            g.structure AS grammar_structure
          FROM posts p
          JOIN grammar g ON g.post_id = p.id
          WHERE p.content_type = 'grammar'
          ORDER BY coalesce(g.level, (p.jlpt_level)[1]), g.pattern
        `;
        items = (rows ?? []) as Row[];
      } else {
        const rows = await sql`
          SELECT
            p.id,
            p.slug,
            p.title,
            coalesce(g.level, (p.jlpt_level)[1]) AS jlpt_level,
            p.status,
            p.sort_order,
            p.meta,
            p.og_image_url,
            g.id AS grammar_id,
            g.pattern AS grammar_pattern,
            g.structure AS grammar_structure
          FROM posts p
          JOIN grammar g ON g.post_id = p.id
          WHERE p.content_type = 'grammar'
            AND (g.level = ${selectedLevel} OR (p.jlpt_level)[1] = ${selectedLevel})
          ORDER BY g.pattern
        `;
        items = (rows ?? []) as Row[];
      }
    } else {
      const countRows = (await sql`
        SELECT coalesce((jlpt_level)[1], 'ALL') AS level, COUNT(*)::int AS count
        FROM posts
        WHERE content_type = ${normalized}
        GROUP BY 1
      `) as { level: string; count: number }[];

      const counts = { ...levelCounts };
      for (const row of countRows ?? []) {
        const key = String(row.level || "ALL").toUpperCase();
        if (key in counts) counts[key] = Number(row.count) || 0;
        counts.ALL += Number(row.count) || 0;
      }
      levelCounts = counts;

      if (selectedLevel === "ALL") {
        const rows = await sql`
          SELECT id, slug, title, (jlpt_level)[1] AS jlpt_level, status, sort_order, meta, og_image_url
          FROM posts WHERE content_type = ${normalized}
          ORDER BY sort_order, created_at DESC
        `;
        items = (rows ?? []) as Row[];
      } else {
        const rows = await sql`
          SELECT id, slug, title, (jlpt_level)[1] AS jlpt_level, status, sort_order, meta, og_image_url
          FROM posts WHERE content_type = ${normalized} AND (jlpt_level)[1] = ${selectedLevel}
          ORDER BY sort_order, created_at DESC
        `;
        items = (rows ?? []) as Row[];
      }
    }
  }

  // Reverse-lookup: which curriculum lessons use each vocab/kanji/grammar item, batched in one query.
  const usageKeyField = normalized === "vocabulary" ? "vocabulary_id" : normalized === "kanji" ? "kanji_id" : normalized === "grammar" ? "grammar_id" : null;
  const usageByItem: Record<string, UsageLesson[]> = {};
  if (sql && usageKeyField) {
    const ids = items.map((i) => i[usageKeyField as keyof Row]).filter((v): v is string => typeof v === "string");
    if (ids.length > 0) {
      const joinTable = normalized === "vocabulary" ? "curriculum_lesson_vocabulary" : normalized === "kanji" ? "curriculum_lesson_kanji" : "curriculum_lesson_grammar";
      const joinColumn = usageKeyField;
      const usageRows = (await sql.query(
        `SELECT j."${joinColumn}" AS item_id, l.id AS lesson_id, l.title AS lesson_title, l.code AS lesson_code,
                m.title AS module_title, lv.code AS level_code
         FROM ${joinTable} j
         JOIN curriculum_lessons l ON l.id = j.lesson_id
         JOIN curriculum_submodules sm ON sm.id = l.submodule_id
         JOIN curriculum_modules m ON m.id = sm.module_id
         JOIN curriculum_levels lv ON lv.id = m.level_id
         WHERE j."${joinColumn}" = ANY($1::uuid[])`,
        [ids]
      )) as unknown as (UsageLesson & { item_id: string })[];
      for (const r of usageRows) {
        if (!usageByItem[r.item_id]) usageByItem[r.item_id] = [];
        usageByItem[r.item_id].push({ lesson_id: r.lesson_id, lesson_title: r.lesson_title, lesson_code: r.lesson_code, module_title: r.module_title, level_code: r.level_code });
      }
    }
  }
  const itemUsage = (item: Row): UsageLesson[] => {
    const key = item[usageKeyField as keyof Row];
    return typeof key === "string" ? (usageByItem[key] ?? []) : [];
  };

  const featureImageUrl = (item: Row) =>
    item.og_image_url ?? (item.meta && typeof item.meta.feature_image_url === "string" ? item.meta.feature_image_url : null);

  const vocabularyWord = (item: Row) =>
    item.vocabulary_word ?? (typeof item.meta?.japanese === "string" ? item.meta.japanese : item.title);
  const vocabularyReading = (item: Row) =>
    item.vocabulary_reading ?? (typeof item.meta?.reading === "string" ? item.meta.reading : "");
  const vocabularyRomaji = (item: Row) =>
    item.vocabulary_romaji ?? (typeof item.meta?.romaji === "string" ? item.meta.romaji : "");
  const vocabularyMeaning = (item: Row) =>
    item.vocabulary_meaning ?? (typeof item.meta?.meaning === "string" ? item.meta.meaning : "");
  const kanjiCharacter = (item: Row) =>
    item.kanji_character ?? (typeof item.meta?.character === "string" ? item.meta.character : item.title.slice(0, 1));
  const kanjiMeaning = (item: Row) =>
    item.kanji_meaning ?? (typeof item.meta?.meaning === "string" ? item.meta.meaning : "");
  const kanjiOnyomi = (item: Row) => item.kanji_onyomi ?? [];
  const kanjiKunyomi = (item: Row) => item.kanji_kunyomi ?? [];
  const kanjiStrokeCount = (item: Row) =>
    item.kanji_stroke_count ?? (typeof item.meta?.stroke_count === "number" ? item.meta.stroke_count : null);

  const levels = ["ALL", "N5", "N4", "N3", "N2", "N1"];
  const publishedCount = items.filter((item) => item.status === "published").length;
  const draftCount = items.filter((item) => item.status !== "published").length;

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={LEARN_TYPE_LABELS[normalized as LearnContentType]}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Learning" },
        ]}
        action={{ label: "Add Item", href: `/admin/learn/${normalized}/new` }}
      />

      {/* Level filter tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--divider)] pb-4">
        <div className="flex flex-wrap gap-2">
          {levels.map((lvl) => {
            const active = selectedLevel === lvl;
            const linkParams = new URLSearchParams();
            if (lvl !== "ALL") linkParams.set("level", lvl.toLowerCase());
            if (selectedView !== "table") linkParams.set("view", selectedView);
            const href = `/admin/learn/${normalized}?${linkParams.toString()}`;

            return (
              <Link
                key={lvl}
                href={href}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition border ${
                  active
                    ? "bg-[#D0021B] border-[#D0021B] text-white"
                    : "bg-white border-[#EEEEEE] hover:border-primary/40 text-charcoal"
                }`}
              >
                {lvl}
                <span className={`ml-2 ${active ? "text-white/80" : "text-secondary"}`}>
                  {levelCounts[lvl].toLocaleString()}
                </span>
              </Link>
            );
          })}
        </div>

        {/* View toggles */}
        <div className="flex items-center gap-1 bg-white border border-[#EEEEEE] p-1 rounded-lg">
          {["table", "gallery", "list"].map((v) => {
            const active = selectedView === v;
            const linkParams = new URLSearchParams();
            if (selectedLevel !== "ALL") linkParams.set("level", selectedLevel.toLowerCase());
            linkParams.set("view", v);
            const href = `/admin/learn/${normalized}?${linkParams.toString()}`;

            return (
              <Link
                key={v}
                href={href}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition ${
                  active ? "bg-primary/10 text-primary" : "text-secondary hover:text-charcoal"
                }`}
              >
                {v}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-[var(--divider)] bg-white p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">Showing</span>
          <strong className="block font-heading text-2xl text-charcoal mt-1">{items.length.toLocaleString()}</strong>
        </div>
        <div className="rounded-xl border border-[var(--divider)] bg-white p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">Published</span>
          <strong className="block font-heading text-2xl text-charcoal mt-1">{publishedCount.toLocaleString()}</strong>
        </div>
        <div className="rounded-xl border border-[var(--divider)] bg-white p-4">
          <span className="text-[10px] font-bold uppercase tracking-wider text-secondary">Draft</span>
          <strong className="block font-heading text-2xl text-charcoal mt-1">{draftCount.toLocaleString()}</strong>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <GenerateLearnListButton
          contentType={normalized}
          existingItems={items.map((i) => ({ slug: i.slug, title: i.title }))}
        />
        {normalized === "practice_test" && <GenerateMockTestButton />}
      </div>

      {items.length > 0 ? (
        <>
          {selectedView === "table" && (
            <AdminCard>
              <AdminTable
                headers={
                  normalized === "vocabulary"
                    ? ["#", "Kanji / Kana", "Furigana", "Romaji", "Meaning", "JLPT", "Used In", "Status", "Actions"]
                    : normalized === "kanji"
                    ? ["#", "Kanji", "Meaning", "On-yomi", "Kun-yomi", "Strokes", "JLPT", "Used In", "Status", "Actions"]
                    : normalized === "grammar"
                    ? ["#", "Pattern", "Structure", "JLPT", "Used In", "Status", "Actions"]
                    : ["Image", "Title", "JLPT", "Status", "Actions"]
                }
              >
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-[var(--divider)]">
                    {normalized === "vocabulary" ? (
                      <>
                        <td className="py-2 px-2 text-secondary text-xs tabular-nums">{items.indexOf(item) + 1}</td>
                        <td className="py-2 px-2 font-semibold text-charcoal">{vocabularyWord(item) || "—"}</td>
                        <td className="py-2 px-2 text-secondary text-sm">{vocabularyReading(item) || "—"}</td>
                        <td className="py-2 px-2 text-secondary text-sm">{vocabularyRomaji(item) || "—"}</td>
                        <td className="py-2 px-2 text-secondary text-sm max-w-[360px]">{vocabularyMeaning(item) || "—"}</td>
                        <td className="py-2 px-2 text-secondary text-sm">{item.jlpt_level ?? "—"}</td>
                        <td className="py-2 px-2"><UsedInBadge usage={itemUsage(item)} /></td>
                        <td className="py-2 px-2">
                          <StatusBadge
                            status={item.status}
                            variant={item.status === "published" ? "published" : "draft"}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <LearnContentRowActions contentType={normalized} slug={item.slug} status={item.status} />
                        </td>
                      </>
                    ) : normalized === "kanji" ? (
                      <>
                        <td className="py-2 px-2 text-secondary text-xs tabular-nums">{items.indexOf(item) + 1}</td>
                        <td className="py-2 px-2 font-heading text-xl text-charcoal">{kanjiCharacter(item) || "—"}</td>
                        <td className="py-2 px-2 text-secondary text-sm max-w-[320px]">{kanjiMeaning(item) || "—"}</td>
                        <td className="py-2 px-2 text-secondary text-sm">{kanjiOnyomi(item).join(", ") || "—"}</td>
                        <td className="py-2 px-2 text-secondary text-sm">{kanjiKunyomi(item).join(", ") || "—"}</td>
                        <td className="py-2 px-2 text-secondary text-sm tabular-nums">{kanjiStrokeCount(item) ?? "—"}</td>
                        <td className="py-2 px-2 text-secondary text-sm">{item.jlpt_level ?? "—"}</td>
                        <td className="py-2 px-2"><UsedInBadge usage={itemUsage(item)} /></td>
                        <td className="py-2 px-2">
                          <StatusBadge
                            status={item.status}
                            variant={item.status === "published" ? "published" : "draft"}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <LearnContentRowActions contentType={normalized} slug={item.slug} status={item.status} />
                        </td>
                      </>
                    ) : normalized === "grammar" ? (
                      <>
                        <td className="py-2 px-2 text-secondary text-xs tabular-nums">{items.indexOf(item) + 1}</td>
                        <td className="py-2 px-2 font-semibold text-charcoal">{item.grammar_pattern || "—"}</td>
                        <td className="py-2 px-2 text-secondary text-sm font-mono max-w-[320px]">{item.grammar_structure || "—"}</td>
                        <td className="py-2 px-2 text-secondary text-sm">{item.jlpt_level ?? "—"}</td>
                        <td className="py-2 px-2"><UsedInBadge usage={itemUsage(item)} /></td>
                        <td className="py-2 px-2">
                          <StatusBadge
                            status={item.status}
                            variant={item.status === "published" ? "published" : "draft"}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <LearnContentRowActions contentType={normalized} slug={item.slug} status={item.status} />
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-2 px-2">
                          {featureImageUrl(item) ? (
                            <div className="w-10 h-10 rounded overflow-hidden border border-[var(--divider)] bg-[var(--divider)]/20 flex-shrink-0">
                              <img src={featureImageUrl(item)!} alt="" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <span className="text-secondary text-xs">—</span>
                          )}
                        </td>
                        <td className="py-2 px-2 font-medium text-charcoal">{item.title}</td>
                        <td className="py-2 px-2 text-secondary text-sm">{item.jlpt_level ?? "—"}</td>
                        <td className="py-2 px-2">
                          <StatusBadge
                            status={item.status}
                            variant={item.status === "published" ? "published" : "draft"}
                          />
                        </td>
                        <td className="py-2 px-2">
                          <LearnContentRowActions contentType={normalized} slug={item.slug} status={item.status} />
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </AdminTable>
            </AdminCard>
          )}

          {selectedView === "gallery" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {items.map((item) => {
                const img = featureImageUrl(item);
                return (
                  <div key={item.id} className="card bg-white border border-[#EEEEEE] p-4 rounded-xl flex flex-col justify-between hover:shadow-md transition">
                    <div>
                      {img ? (
                        <div className="aspect-[16/9] w-full rounded-lg overflow-hidden mb-3 border border-[var(--divider)] bg-[var(--divider)]/10">
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="aspect-[16/9] w-full rounded-lg bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center text-primary font-bold text-lg mb-3">
                          {item.title.slice(0, 3)}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[10px] font-bold text-secondary bg-base px-2 py-0.5 rounded border border-[var(--divider)]">
                          {item.jlpt_level ?? "ALL"}
                        </span>
                        <StatusBadge
                          status={item.status}
                          variant={item.status === "published" ? "published" : "draft"}
                        />
                      </div>
                      <h3 className="font-bold text-charcoal text-sm truncate">{item.title}</h3>
                      <p className="text-secondary text-xs mt-1 truncate">
                        {normalized === "vocabulary"
                          ? `${vocabularyReading(item) || "—"} • ${vocabularyRomaji(item) || "—"} • ${vocabularyMeaning(item) || "—"}`
                          : normalized === "kanji"
                          ? `${kanjiMeaning(item) || "—"} • ${kanjiOnyomi(item).join(", ") || "—"} • ${kanjiKunyomi(item).join(", ") || "—"}`
                          : String(item.meta?.summary ?? item.meta?.meaning ?? "Learn Japanese")}
                      </p>
                    </div>
                    <div className="mt-4 border-t border-[var(--divider)] pt-3 flex items-center justify-end">
                      <LearnContentRowActions contentType={normalized} slug={item.slug} status={item.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedView === "list" && (
            <div className="space-y-3">
              {items.map((item) => {
                const img = featureImageUrl(item);
                return (
                  <div key={item.id} className="card bg-white border border-[#EEEEEE] p-4 rounded-xl flex flex-col sm:flex-row items-center gap-4 hover:shadow-sm transition">
                    {img ? (
                      <div className="w-16 h-16 rounded-lg overflow-hidden border border-[var(--divider)] bg-[var(--divider)]/10 flex-shrink-0">
                        <img src={img} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                        {item.title.slice(0, 2)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-secondary bg-base px-1.5 py-0.5 rounded border border-[var(--divider)]">
                          {item.jlpt_level ?? "ALL"}
                        </span>
                        <StatusBadge
                          status={item.status}
                          variant={item.status === "published" ? "published" : "draft"}
                        />
                      </div>
                      <h3 className="font-bold text-charcoal text-sm truncate">
                        {normalized === "vocabulary" ? vocabularyWord(item) : normalized === "kanji" ? `${kanjiCharacter(item)} - ${kanjiMeaning(item)}` : item.title}
                      </h3>
                      <p className="text-secondary text-xs truncate mt-0.5">
                        {normalized === "vocabulary"
                          ? `${vocabularyReading(item) || "—"} • ${vocabularyRomaji(item) || "—"} • ${vocabularyMeaning(item) || "—"}`
                          : normalized === "kanji"
                          ? `${kanjiOnyomi(item).join(", ") || "—"} • ${kanjiKunyomi(item).join(", ") || "—"} • ${kanjiStrokeCount(item) ?? "—"} strokes`
                          : String(item.meta?.summary ?? item.meta?.meaning ?? "Learn Japanese")}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <LearnContentRowActions contentType={normalized} slug={item.slug} status={item.status} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      ) : (
        <AdminEmptyState
          message={`No ${LEARN_TYPE_LABELS[normalized as LearnContentType].toLowerCase()} content yet.`}
          action={{ label: "Add Item", href: `/admin/learn/${normalized}/new` }}
        />
      )}
    </div>
  );
}
