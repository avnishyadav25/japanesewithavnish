import { sql } from "@/lib/db";
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
  const rows = await sql`
    SELECT e.id AS ent_id, p.id AS product_id, p.name AS product_name, p.slug AS product_slug,
           pa.id AS asset_id, pa.display_name AS asset_display_name, pa.storage_path AS asset_storage_path, pa.type AS asset_type
    FROM entitlements e
    JOIN products p ON p.id = e.product_id
    LEFT JOIN product_assets pa ON pa.product_id = p.id
    WHERE e.user_email = ${userEmail} AND e.active = true
    ORDER BY p.sort_order, pa.sort_order
  ` as EntitlementRow[];

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
  if (products.length === 0) {
    return (
      <div className="bento-grid">
        <div className="bento-span-6 card p-12 text-center">
          <p className="text-secondary mb-4">
            You don&apos;t have any purchases yet.
          </p>
          <a href="/store" className="btn-primary inline-block">Browse the store</a>
        </div>
      </div>
    );
  }

  return (
    <div className="bento-grid">
      {products.map((prod) => (
        <div key={prod.entId} className="bento-span-4 bento-row-2 card">
          <h2 className="font-heading text-xl font-bold text-charcoal mb-4">{prod.name}</h2>
          <ul className="space-y-3">
            {prod.assets.map((asset) => (
              <li key={asset.id} className="flex items-center justify-between gap-4 py-2 border-b border-[var(--divider)] last:border-0">
                <span className="text-secondary">{asset.display_name}</span>
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
  );
}
