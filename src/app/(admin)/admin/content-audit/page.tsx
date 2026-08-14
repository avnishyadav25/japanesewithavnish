import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminTable } from "@/components/admin/AdminTable";
import { getContentAudit } from "@/lib/admin/contentAudit";

function pct(current: number, target: number) {
  if (!target) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

export default async function AdminContentAuditPage() {
  let audit: Awaited<ReturnType<typeof getContentAudit>> | null = null;
  let error = "";

  try {
    audit = await getContentAudit();
  } catch (e) {
    console.error("Admin content audit page:", e);
    error = "Content audit could not be loaded. Check database connectivity and recent migrations.";
  }

  const duplicateTotal = audit
    ? audit.duplicateTotals.vocabulary + audit.duplicateTotals.grammar + audit.duplicateTotals.kanji
    : 0;

  return (
    <div className="space-y-8 page-enter">
      <AdminPageHeader title="Content Audit" />

      {error && (
        <div className="rounded-3xl border border-primary/20 bg-[#FFF7F7] p-5 text-sm text-primary font-semibold">
          {error}
        </div>
      )}

      {audit && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AdminCard>
              <span className="text-secondary text-[10px] font-bold uppercase tracking-wider">Duplicate Groups</span>
              <strong className="block font-heading text-3xl text-charcoal mt-2">{duplicateTotal}</strong>
              <p className="text-xs text-secondary mt-1">Top 50 groups shown per type.</p>
            </AdminCard>
            <AdminCard>
              <span className="text-secondary text-[10px] font-bold uppercase tracking-wider">Lesson Issues</span>
              <strong className="block font-heading text-3xl text-charcoal mt-2">{audit.lessonIssues.length}</strong>
              <p className="text-xs text-secondary mt-1">Short bodies, weak outlines, missing examples, drills, links, or images.</p>
            </AdminCard>
            <AdminCard>
              <span className="text-secondary text-[10px] font-bold uppercase tracking-wider">Safe Merge Flow</span>
              <strong className="block font-heading text-lg text-charcoal mt-2">Dry-run first</strong>
              <p className="text-xs text-secondary mt-1">Use scripts before applying destructive duplicate merges.</p>
            </AdminCard>
          </div>

          <section>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <div>
                <h2 className="font-heading text-lg font-black text-charcoal">JLPT Coverage Targets</h2>
                <p className="text-sm text-secondary">Actual published inventory compared with cumulative targets.</p>
              </div>
              <Link href="/admin/learn/curriculum" className="text-sm font-bold text-primary hover:underline">
                Open curriculum →
              </Link>
            </div>
            <AdminCard>
              <AdminTable headers={["Level", "Kanji", "Vocabulary", "Grammar"]}>
                {audit.coverage.map((row) => (
                  <tr key={row.level} className="border-b border-[var(--divider)] hover:bg-[var(--base)] transition-colors">
                    <td className="py-3 px-2 font-heading font-bold text-charcoal">{row.level}</td>
                    <td className="py-3 px-2">{row.kanji.toLocaleString()} / {row.kanjiTarget.toLocaleString()} <span className="text-secondary">({pct(row.kanji, row.kanjiTarget)}%)</span></td>
                    <td className="py-3 px-2">{row.vocabulary.toLocaleString()} / {row.vocabularyTarget.toLocaleString()} <span className="text-secondary">({pct(row.vocabulary, row.vocabularyTarget)}%)</span></td>
                    <td className="py-3 px-2">{row.grammar.toLocaleString()} / {row.grammarTarget.toLocaleString()} <span className="text-secondary">({pct(row.grammar, row.grammarTarget)}%)</span></td>
                  </tr>
                ))}
              </AdminTable>
            </AdminCard>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {(["vocabulary", "grammar", "kanji"] as const).map((type) => (
              <div key={type} className="bg-white border border-[var(--divider)] rounded-3xl p-5 shadow-sm">
                <h2 className="font-heading text-base font-black text-charcoal capitalize">{type} duplicates</h2>
                <p className="text-xs text-secondary mb-4">
                  {audit.duplicateTotals[type].toLocaleString()} total, {audit.duplicates[type].length} shown.
                </p>
                <div className="space-y-3 max-h-[420px] overflow-auto pr-1">
                  {audit.duplicates[type].slice(0, 12).map((group) => (
                    <div key={group.key} className="rounded-2xl border border-[var(--divider)] bg-[var(--base)] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <strong className="text-sm text-charcoal break-all">{group.key}</strong>
                        <span className="text-[11px] font-bold text-primary shrink-0">{group.count} rows</span>
                      </div>
                      <p className="text-xs text-secondary mt-1 line-clamp-2">{group.labels.filter(Boolean).join(", ")}</p>
                    </div>
                  ))}
                  {!audit.duplicates[type].length && <p className="text-sm text-secondary">No duplicates found.</p>}
                </div>
              </div>
            ))}
          </section>

          <section>
            <h2 className="font-heading text-lg font-black text-charcoal">Lesson Quality Issues</h2>
            <p className="text-sm text-secondary mb-4">Review these before bulk publishing regenerated content.</p>
            <AdminCard>
              <div className="max-h-[520px] overflow-auto">
                <AdminTable headers={["Level", "Lesson", "Issue", "Detail"]}>
                  {audit.lessonIssues.slice(0, 100).map((issue) => (
                    <tr key={`${issue.lessonId}-${issue.issue}`} className="border-b border-[var(--divider)] hover:bg-[var(--base)] transition-colors">
                      <td className="py-3 px-2 font-bold text-charcoal">{issue.level}</td>
                      <td className="py-3 px-2">
                        <Link href={`/admin/learn/curriculum/lessons/${issue.lessonId}`} className="font-semibold text-primary hover:underline">
                          {issue.lessonTitle}
                        </Link>
                        <span className="block text-xs text-secondary">{issue.moduleTitle}</span>
                      </td>
                      <td className="py-3 px-2 font-semibold text-charcoal">{issue.issue.replaceAll("_", " ")}</td>
                      <td className="py-3 px-2 text-secondary">{issue.detail}</td>
                    </tr>
                  ))}
                  {!audit.lessonIssues.length && (
                    <tr>
                      <td className="py-6 text-secondary" colSpan={4}>No lesson quality issues found.</td>
                    </tr>
                  )}
                </AdminTable>
              </div>
            </AdminCard>
          </section>

          <section className="bg-[#FFF7F7] border border-primary/15 rounded-3xl p-6">
            <h2 className="font-heading text-base font-black text-charcoal">Safe terminal actions</h2>
            <p className="text-sm text-secondary mt-1">Run these before any destructive merge:</p>
            <pre className="mt-4 overflow-auto rounded-2xl bg-white border border-[var(--divider)] p-4 text-xs text-charcoal">{`npm run content:audit
npm run content:dedupe -- --type=vocabulary --limit=5
npm run content:dedupe -- --type=vocabulary --limit=1 --apply --confirm=MERGE_DUPLICATES`}</pre>
          </section>
        </>
      )}
    </div>
  );
}
