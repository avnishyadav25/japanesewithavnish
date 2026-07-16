import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { RunReviewButton } from "../RunReviewButton";

type DupGroup = { key: string; count: number; postIds: string[]; labels: string[] };

/** Library-wide duplicate scan. Reuses the exact normalization getContentAudit()
 * (src/lib/admin/contentAudit.ts, powering /admin/content-audit) already uses for
 * vocabulary/grammar/kanji, but returns posts.id (not the sidecar table's own id) since
 * that's what content_review_jobs.entity_id is actually keyed on — getContentAudit()'s
 * groups return vocabulary/grammar/kanji.id, which would silently mismatch RunReviewButton. */
async function getDuplicateGroups(): Promise<{ vocabulary: DupGroup[]; grammar: DupGroup[]; kanji: DupGroup[] }> {
  if (!sql) return { vocabulary: [], grammar: [], kanji: [] };

  const [vocabRows, grammarRows, kanjiRows] = await Promise.all([
    sql`
      SELECT
        lower(trim(v.word)) || '|' || coalesce(lower(trim(v.reading)), '') AS key,
        COUNT(*)::int AS count,
        array_agg(v.post_id::text ORDER BY v.updated_at DESC NULLS LAST) AS post_ids,
        array_agg(coalesce(v.word, '') || coalesce(' (' || v.reading || ')', '') ORDER BY v.updated_at DESC NULLS LAST) AS labels
      FROM vocabulary v
      WHERE v.word IS NOT NULL AND trim(v.word) <> ''
      GROUP BY 1 HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC LIMIT 50
    `,
    sql`
      SELECT
        lower(trim(g.pattern)) AS key,
        COUNT(*)::int AS count,
        array_agg(g.post_id::text ORDER BY g.updated_at DESC NULLS LAST) AS post_ids,
        array_agg(coalesce(g.pattern, '') ORDER BY g.updated_at DESC NULLS LAST) AS labels
      FROM grammar g
      WHERE g.pattern IS NOT NULL AND trim(g.pattern) <> ''
      GROUP BY 1 HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC LIMIT 50
    `,
    sql`
      SELECT
        k.character AS key,
        COUNT(*)::int AS count,
        array_agg(k.post_id::text ORDER BY k.updated_at DESC NULLS LAST) AS post_ids,
        array_agg(coalesce(k.character, '') || coalesce(' - ' || k.meaning, '') ORDER BY k.updated_at DESC NULLS LAST) AS labels
      FROM kanji k
      WHERE k.character IS NOT NULL AND trim(k.character) <> ''
      GROUP BY 1 HAVING COUNT(*) > 1
      ORDER BY COUNT(*) DESC LIMIT 50
    `,
  ]);

  const toGroups = (rows: unknown[]) =>
    (rows as { key: string; count: number; post_ids: string[]; labels: string[] }[]).map((r) => ({
      key: r.key,
      count: r.count,
      postIds: r.post_ids,
      labels: r.labels,
    }));

  return { vocabulary: toGroups(vocabRows), grammar: toGroups(grammarRows), kanji: toGroups(kanjiRows) };
}

function DuplicateSection({ title, entityType, groups }: { title: string; entityType: string; groups: DupGroup[] }) {
  if (groups.length === 0) return null;
  return (
    <div className="mb-8">
      <h2 className="font-heading text-lg font-bold text-charcoal mb-3">
        {title} ({groups.length} group{groups.length === 1 ? "" : "s"})
      </h2>
      <div className="space-y-3">
        {groups.map((g) => (
          <AdminCard key={g.key}>
            <p className="text-sm text-secondary mb-2">
              {g.count} entries share the key <code className="bg-base px-1.5 py-0.5 rounded">{g.key}</code>
            </p>
            <div className="space-y-1">
              {g.postIds.map((postId, i) => (
                <div key={postId} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-charcoal">{g.labels[i]}</span>
                  <RunReviewButton entityType={entityType} entityId={postId} />
                </div>
              ))}
            </div>
          </AdminCard>
        ))}
      </div>
    </div>
  );
}

export default async function DuplicateDetectorPage() {
  const groups = await getDuplicateGroups();
  const totalGroups = groups.vocabulary.length + groups.grammar.length + groups.kanji.length;

  return (
    <div>
      <AdminPageHeader title="Duplicate Detector" breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Content Review", href: "/admin/review" }]} />
      {totalGroups === 0 ? (
        <AdminEmptyState message="No duplicate groups found." />
      ) : (
        <>
          <DuplicateSection title="Vocabulary" entityType="vocabulary" groups={groups.vocabulary} />
          <DuplicateSection title="Grammar" entityType="grammar" groups={groups.grammar} />
          <DuplicateSection title="Kanji" entityType="kanji" groups={groups.kanji} />
        </>
      )}
    </div>
  );
}
