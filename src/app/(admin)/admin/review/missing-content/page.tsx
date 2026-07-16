import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { getCompleteListeningPostIds } from "@/lib/learn/listeningPublishGate";

type Row = { id: string; slug: string; title: string; content_type: string; reason: string };

/** Gap-fix phase 19: proactive incomplete-content listing — pure SQL detection of the same
 * gaps the review pipeline's deterministic checks would hard-fail on, but without needing to
 * actually queue and run a review job first. Required-field checks here use each type's
 * single primary field (word/pattern/character/title) — the same default
 * content_review_policies was seeded with — rather than dynamically reading whatever an
 * admin may have since customized on /admin/review/policies, since column names can't be
 * parameterized in SQL; the real enforcement during an actual review always reads the live
 * policy correctly. This page is a proactive heads-up, not the source of truth. */
export default async function MissingContentPage() {
  let rows: Row[] = [];

  if (sql) {
    const [
      missingVocabSidecar,
      missingGrammarSidecar,
      missingKanjiSidecar,
      missingReadingSidecar,
      missingListeningSidecar,
      missingWritingSidecar,
      missingSoundsSidecar,
      blankRequiredField,
      grammarNoPractice,
      emptyWritingSoundsContent,
      listeningTotalIds,
      listeningCompleteIds,
    ] = await Promise.all([
      sql`SELECT p.id, p.slug, p.title, p.content_type FROM posts p LEFT JOIN vocabulary s ON s.post_id = p.id WHERE p.content_type = 'vocabulary' AND s.id IS NULL`,
      sql`SELECT p.id, p.slug, p.title, p.content_type FROM posts p LEFT JOIN grammar s ON s.post_id = p.id WHERE p.content_type = 'grammar' AND s.id IS NULL`,
      sql`SELECT p.id, p.slug, p.title, p.content_type FROM posts p LEFT JOIN kanji s ON s.post_id = p.id WHERE p.content_type = 'kanji' AND s.id IS NULL`,
      sql`SELECT p.id, p.slug, p.title, p.content_type FROM posts p LEFT JOIN reading s ON s.post_id = p.id WHERE p.content_type = 'reading' AND s.id IS NULL`,
      sql`SELECT p.id, p.slug, p.title, p.content_type FROM posts p LEFT JOIN listening s ON s.post_id = p.id WHERE p.content_type = 'listening' AND s.id IS NULL`,
      sql`SELECT p.id, p.slug, p.title, p.content_type FROM posts p LEFT JOIN writing s ON s.post_id = p.id WHERE p.content_type = 'writing' AND s.id IS NULL`,
      sql`SELECT p.id, p.slug, p.title, p.content_type FROM posts p LEFT JOIN sounds s ON s.post_id = p.id WHERE p.content_type = 'sounds' AND s.id IS NULL`,
      sql`
        SELECT p.id, p.slug, p.title, p.content_type FROM posts p JOIN vocabulary s ON s.post_id = p.id WHERE p.content_type = 'vocabulary' AND (s.word IS NULL OR trim(s.word) = '')
        UNION ALL
        SELECT p.id, p.slug, p.title, p.content_type FROM posts p JOIN grammar s ON s.post_id = p.id WHERE p.content_type = 'grammar' AND (s.pattern IS NULL OR trim(s.pattern) = '')
        UNION ALL
        SELECT p.id, p.slug, p.title, p.content_type FROM posts p JOIN kanji s ON s.post_id = p.id WHERE p.content_type = 'kanji' AND (s.character IS NULL OR trim(s.character) = '')
        UNION ALL
        SELECT p.id, p.slug, p.title, p.content_type FROM posts p JOIN reading s ON s.post_id = p.id WHERE p.content_type = 'reading' AND (s.title IS NULL OR trim(s.title) = '')
        UNION ALL
        SELECT p.id, p.slug, p.title, p.content_type FROM posts p JOIN listening s ON s.post_id = p.id WHERE p.content_type = 'listening' AND (s.title IS NULL OR trim(s.title) = '')
      `,
      sql`
        SELECT p.id, p.slug, p.title, p.content_type
        FROM posts p JOIN grammar g ON g.post_id = p.id
        WHERE p.content_type = 'grammar' AND NOT EXISTS (SELECT 1 FROM grammar_drill_items gdi WHERE gdi.grammar_id = g.id)
      `,
      sql`SELECT id, slug, title, content_type FROM posts WHERE content_type IN ('writing', 'sounds') AND (content IS NULL OR trim(content) = '')`,
      sql`SELECT id FROM posts WHERE content_type = 'listening'`,
      getCompleteListeningPostIds(),
    ]);

    const sidecarRows = [
      ...(missingVocabSidecar as Row[]),
      ...(missingGrammarSidecar as Row[]),
      ...(missingKanjiSidecar as Row[]),
      ...(missingReadingSidecar as Row[]),
      ...(missingListeningSidecar as Row[]),
      ...(missingWritingSidecar as Row[]),
      ...(missingSoundsSidecar as Row[]),
    ].map((r) => ({ ...r, reason: "No matching sidecar row" }));

    const blankFieldRows = (blankRequiredField as Row[]).map((r) => ({ ...r, reason: "Required field is blank" }));
    const noPracticeRows = (grammarNoPractice as Row[]).map((r) => ({ ...r, reason: "No practice drill items" }));
    const emptyContentRows = (emptyWritingSoundsContent as Row[]).map((r) => ({ ...r, reason: "Content field is empty" }));

    const completeIds = listeningCompleteIds as Set<string>;
    const incompleteListeningIds = new Set((listeningTotalIds as { id: string }[]).map((r) => r.id).filter((id) => !completeIds.has(id)));

    const listeningAudioRows =
      incompleteListeningIds.size > 0
        ? ((await sql`SELECT id, slug, title, content_type FROM posts WHERE id = ANY(${Array.from(incompleteListeningIds)})`) as Row[]).map((r) => ({
            ...r,
            reason: "No complete scenario (audio + transcript + 3 questions)",
          }))
        : [];

    // Dedupe by (id, reason) — a post can legitimately show up for more than one distinct
    // reason (e.g. no sidecar row AND, moot since sidecar-dependent checks then can't run —
    // in practice these categories are mutually exclusive per post, but de-dupe defensively.
    const seen = new Set<string>();
    rows = [...sidecarRows, ...blankFieldRows, ...noPracticeRows, ...emptyContentRows, ...listeningAudioRows].filter((r) => {
      const key = `${r.id}:${r.reason}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    rows.sort((a, b) => a.content_type.localeCompare(b.content_type) || a.title.localeCompare(b.title));
  }

  return (
    <div>
      <AdminPageHeader
        title="Missing Content"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Content Review", href: "/admin/review" }]}
      />
      <p className="text-sm text-secondary mb-4">
        Content with structurally detectable gaps (no sidecar row, a blank required field, no practice items, or empty body text) —
        found directly via SQL, without needing to queue and run a full AI review first.
      </p>
      {rows.length > 0 ? (
        <AdminCard>
          <AdminTable headers={["Content", "Type", "Issue", "Actions"]}>
            {rows.map((r, i) => (
              <tr key={`${r.id}-${r.reason}-${i}`} className="border-b border-[var(--divider)]">
                <td className="py-2 px-2 font-medium text-charcoal max-w-[280px]">
                  <span className="line-clamp-1 block" title={r.title}>
                    {r.title || r.slug}
                  </span>
                </td>
                <td className="py-2 px-2 text-secondary text-sm">{r.content_type}</td>
                <td className="py-2 px-2 text-sm text-amber-700">{r.reason}</td>
                <td className="py-2 px-2">
                  <Link href={`/admin/learn/${r.content_type}/${r.slug}/edit`} className="text-primary text-sm hover:underline">
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </AdminTable>
        </AdminCard>
      ) : (
        <AdminEmptyState message="No structurally incomplete content detected." />
      )}
    </div>
  );
}
