import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { ProductEditForm } from "../../ProductEditForm";

export default async function AdminProductEditPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createAdminClient();
  const { data: product, error } = await supabase
    .from("products")
    .select(
      "id, name, slug, badge, jlpt_level, preview_url, who_its_for, outcome, whats_included, faq, no_refunds_note"
    )
    .eq("id", params.id)
    .single();

  if (error || !product) {
    notFound();
  }

  return (
    <div>
      <AdminPageHeader
        title={product.name}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Products", href: "/admin/products" },
          { label: "Edit", href: `/admin/products/${product.id}/edit` },
        ]}
      />
      <AdminCard>
        <ProductEditForm product={product} />
      </AdminCard>
    </div>
  );
}

