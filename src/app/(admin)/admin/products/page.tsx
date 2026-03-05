import Link from "next/link";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { ProductListClient } from "./ProductListClient";

export default async function AdminProductsPage() {
  let products: { id: string; name: string; slug: string; price_paise: number; compare_price_paise: number | null; jlpt_level: string | null; image_url: string | null; badge: string | null; is_mega: boolean; description: string | null }[] | null = null;
  let productViews = 0;
  let productAvgSeconds: number | null = null;

  if (sql) {
    const [productRows, analyticsRows] = await Promise.all([
      sql`SELECT id, name, slug, price_paise, compare_price_paise, jlpt_level, image_url, badge, is_mega, description FROM products ORDER BY sort_order`,
      sql`
        SELECT
          COUNT(*) FILTER (WHERE event_type = 'view') AS views,
          ROUND(AVG(duration_seconds) FILTER (WHERE event_type = 'duration'))::int AS avg_seconds
        FROM content_events
        WHERE content_type = 'product'
      `,
    ]);
    products = productRows as unknown as typeof products;
    if (Array.isArray(analyticsRows) && analyticsRows[0]) {
      const row = analyticsRows[0] as { views: number; avg_seconds: number | null };
      productViews = Number(row.views || 0);
      productAvgSeconds = row.avg_seconds;
    }
  } else {
    products = [];
  }

  if (!products || products.length === 0) {
    return (
      <div>
        <AdminPageHeader
          title="Products"
          breadcrumb={[{ label: "Admin", href: "/admin" }]}
        />
        <AdminEmptyState
          message="No products. Seed the database or add via SQL."
          action={{ label: "View Store", href: "/store" }}
        />
      </div>
    );
  }

  return (
    <div>
      <AdminPageHeader
        title="Products"
        breadcrumb={[{ label: "Admin", href: "/admin" }]}
      />
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <p className="text-sm text-secondary">
          <a href="/admin/ai-logs?entityType=product" className="text-primary hover:underline">
            AI history
          </a>
        </p>
        <p className="text-sm text-secondary">
          <Link href="/admin/analytics" className="text-primary hover:underline">
            Content analytics
          </Link>
          {productViews > 0 && (
            <>
              {" "}
              — {productViews} product views
              {productAvgSeconds != null && productAvgSeconds > 0 ? `, avg ${productAvgSeconds}s per session` : ""}
            </>
          )}
        </p>
      </div>
      <ProductListClient products={products} />
    </div>
  );
}
