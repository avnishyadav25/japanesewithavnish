import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
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
      "id, name, slug, description, price_paise, compare_price_paise, badge, jlpt_level, preview_url, who_its_for, outcome, whats_included, faq, no_refunds_note, is_mega, image_url, image_prompt, gallery_images"
    )
    .eq("id", params.id)
    .single();

  if (error || !product) {
    notFound();
  }

  return (
    <div className="page-enter">
      <AdminPageHeader
        title={`🔥 ${product.name}`}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Products", href: "/admin/products" },
          { label: "Edit", href: `/admin/products/${product.id}/edit` },
        ]}
      />
      <ProductEditForm product={product} />
    </div>
  );
}
