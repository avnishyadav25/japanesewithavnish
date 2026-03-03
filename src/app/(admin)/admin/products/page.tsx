import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { ProductListClient } from "./ProductListClient";

export default async function AdminProductsPage() {
  let products: { id: string; name: string; slug: string; price_paise: number; compare_price_paise: number | null; jlpt_level: string | null; image_url: string | null; badge: string | null; is_mega: boolean; description: string | null }[] | null = null;

  if (sql) {
    const rows = await sql`SELECT id, name, slug, price_paise, compare_price_paise, jlpt_level, image_url, badge, is_mega, description FROM products ORDER BY sort_order`;
    products = rows as unknown as typeof products;
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
      <ProductListClient products={products} />
    </div>
  );
}
