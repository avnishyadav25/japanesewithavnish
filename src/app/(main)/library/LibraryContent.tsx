import { sql } from "@/lib/db";
import Link from "next/link";
import { AddToReviewButton } from "./AddToReviewButton";
import { DownloadButton } from "./DownloadButton";

type EntitlementRow = {
  ent_id: string;
  product_id: string;
  product_name: string;
  product_slug: string;
  asset_id: string | null;
  asset_display_name: string | null;
  asset_storage_path: string | null;
  asset_type: string | null;
};

export async function LibraryContent({ userEmail }: { userEmail: string }) {
  if (!sql) {
    return (
      <div className="bento-grid">
        <div className="bento-span-6 card p-12 text-center">
          <p className="text-secondary mb-4">Library unavailable. Please try again later.</p>
          <a href="/store" className="btn-primary inline-block">Browse the store</a>
        </div>
      </div>
    );
  }
  const [completedRows, reviewRows, rows] = await Promise.all([
    sql`
      SELECT
        cl.id,
        cl.slug,
        cl.code,
        cl.title,
        cl.content_type,
        ulp.completed_at::text,
        cs.title AS submodule_title,
        cm.title AS module_title,
        lv.code AS level_code
      FROM user_lesson_progress ulp
      JOIN curriculum_lessons cl ON cl.id = ulp.lesson_id
      JOIN curriculum_submodules cs ON cs.id = cl.submodule_id
      JOIN curriculum_modules cm ON cm.id = cs.module_id
      JOIN curriculum_levels lv ON lv.id = cm.level_id
      WHERE ulp.user_email = ${userEmail} AND ulp.status = 'completed'
      ORDER BY ulp.completed_at DESC NULLS LAST, ulp.updated_at DESC
      LIMIT 30
    `,
    sql`
      SELECT
        rs.id,
        rs.item_type,
        rs.item_id,
        rs.next_review_at::text,
        cl.title AS lesson_title,
        cl.slug AS lesson_slug,
        cl.code AS lesson_code
      FROM review_schedule rs
      LEFT JOIN curriculum_lessons cl ON rs.item_type = 'lesson' AND cl.id::text = rs.item_id
      WHERE rs.user_email = ${userEmail}
      ORDER BY rs.next_review_at ASC
      LIMIT 20
    `,
    sql`
    SELECT e.id AS ent_id, p.id AS product_id, p.name AS product_name, p.slug AS product_slug,
           pa.id AS asset_id, pa.display_name AS asset_display_name, pa.storage_path AS asset_storage_path, pa.type AS asset_type
    FROM entitlements e
    JOIN products p ON p.id = e.product_id
    LEFT JOIN product_assets pa ON pa.product_id = p.id
    WHERE e.user_email = ${userEmail} AND e.active = true
    ORDER BY p.sort_order, pa.sort_order
    `,
  ]) as [
    {
      id: string;
      slug: string;
      code: string;
      title: string;
      content_type: string | null;
      completed_at: string | null;
      submodule_title: string;
      module_title: string;
      level_code: string;
    }[],
    {
      id: string;
      item_type: string;
      item_id: string;
      next_review_at: string;
      lesson_title: string | null;
      lesson_slug: string | null;
      lesson_code: string | null;
    }[],
    EntitlementRow[]
  ];

  const byProduct = new Map<
    string,
    { entId: string; name: string; slug: string; assets: { id: string; display_name: string }[] }
  >();
  for (const r of rows) {
    if (!byProduct.has(r.product_id)) {
      byProduct.set(r.product_id, {
        entId: r.ent_id,
        name: r.product_name,
        slug: r.product_slug,
        assets: [],
      });
    }
    const entry = byProduct.get(r.product_id)!;
    if (r.asset_id && r.asset_display_name) {
      entry.assets.push({ id: r.asset_id, display_name: r.asset_display_name });
    }
  }

  const products = Array.from(byProduct.values());

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-[var(--divider)] bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b border-[var(--divider)] pb-4 mb-4">
          <div>
            <h2 className="font-heading text-xl font-bold text-charcoal">Completed Lessons</h2>
            <p className="text-secondary text-sm">Lessons you have finished and can study again.</p>
          </div>
          <Link href="/learn/curriculum" className="text-primary text-xs font-bold hover:underline">Browse curriculum →</Link>
        </div>

        {completedRows.length ? (
          <div className="space-y-3">
            {completedRows.map((lesson) => (
              <article key={lesson.id} className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-[var(--divider)] bg-[var(--base)] p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200 font-bold">Completed</span>
                    <span className="text-[10px] text-secondary font-bold">{lesson.level_code} · {lesson.code}</span>
                    {lesson.content_type && <span className="text-[10px] text-secondary">{lesson.content_type}</span>}
                  </div>
                  <h3 className="font-heading font-bold text-charcoal text-sm">{lesson.title}</h3>
                  <p className="text-secondary text-xs mt-1">{lesson.module_title} · {lesson.submodule_title}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 md:justify-end">
                  <Link href={`/learn/curriculum/lesson/${lesson.slug || lesson.id}`} className="btn-primary px-3 py-1.5 rounded-xl text-[11px] font-bold">
                    Study Again
                  </Link>
                  <AddToReviewButton itemId={lesson.id} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--divider)] bg-[var(--base)] p-8 text-center">
            <p className="text-secondary text-sm mb-4">No completed lessons yet.</p>
            <Link href="/learn/curriculum" className="btn-primary inline-block">Start a lesson</Link>
          </div>
        )}
      </section>

      <section className="rounded-3xl border border-[var(--divider)] bg-white p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b border-[var(--divider)] pb-4 mb-4">
          <div>
            <h2 className="font-heading text-xl font-bold text-charcoal">Review Queue</h2>
            <p className="text-secondary text-sm">Items scheduled for spaced repetition.</p>
          </div>
          <Link href="/review" className="text-primary text-xs font-bold hover:underline">Open reviews →</Link>
        </div>

        {reviewRows.length ? (
          <ul className="divide-y divide-[var(--divider)]">
            {reviewRows.map((item) => {
              const isDue = new Date(item.next_review_at).getTime() <= Date.now();
              return (
                <li key={item.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-charcoal text-sm truncate">
                      {item.lesson_title || item.item_id}
                    </p>
                    <p className="text-secondary text-xs">
                      {item.lesson_code || item.item_type} · {isDue ? "Due now" : `Next ${new Date(item.next_review_at).toLocaleDateString()}`}
                    </p>
                  </div>
                  {item.lesson_slug ? (
                    <Link href={`/learn/curriculum/lesson/${item.lesson_slug}`} className="text-primary text-xs font-bold hover:underline">
                      Study
                    </Link>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-secondary text-sm">Your review queue is empty. Add completed lessons above when you want to revisit them.</p>
        )}
      </section>

      <section className="rounded-3xl border border-[var(--divider)] bg-white p-6 shadow-sm">
        <div className="border-b border-[var(--divider)] pb-4 mb-4">
          <h2 className="font-heading text-xl font-bold text-charcoal">Purchases</h2>
          <p className="text-secondary text-sm">Your purchases and downloads remain available here.</p>
        </div>

        {products.length ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {products.map((prod) => (
              <div key={prod.entId} className="rounded-2xl border border-[var(--divider)] bg-[var(--base)] p-5">
                <h3 className="font-heading text-base font-bold text-charcoal mb-4">{prod.name}</h3>
                <ul className="space-y-3">
                  {prod.assets.map((asset) => (
                    <li key={asset.id} className="flex items-center justify-between gap-4 py-2 border-b border-[var(--divider)] last:border-0">
                      <span className="text-secondary text-sm">{asset.display_name}</span>
                      <DownloadButton assetId={asset.id} />
                    </li>
                  ))}
                </ul>
                {prod.assets.length === 0 && (
                  <p className="text-secondary text-sm">No assets yet. Contact support if you need help.</p>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--divider)] bg-[var(--base)] p-8 text-center">
            <p className="text-secondary mb-4">You do not have any purchases yet.</p>
            <Link href="/store" className="btn-primary inline-block">Browse the store</Link>
          </div>
        )}
      </section>
    </div>
  );
}
