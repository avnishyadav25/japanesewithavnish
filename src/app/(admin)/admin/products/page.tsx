import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";
import { ProductListClient } from "./ProductListClient";

export default async function AdminProductsPage() {
  const supabase = createAdminClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, slug, price_paise, compare_price_paise, jlpt_level, image_url, badge, is_mega, description")
    .order("sort_order");

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
