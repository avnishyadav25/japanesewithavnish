import { notFound } from "next/navigation";
import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { ProductEditForm } from "../../ProductEditForm";

export default async function AdminProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!sql) notFound();

  const rows = await sql`
    SELECT id, name, slug, description, price_paise, compare_price_paise, badge, jlpt_level, preview_url, who_its_for, outcome, whats_included, faq, no_refunds_note, is_mega, image_url, image_prompt, gallery_images
    FROM products WHERE id = ${id} LIMIT 1
  `;
  const product = rows[0] as Record<string, unknown> | undefined;
  if (!product) notFound();

  return (
    <div className="page-enter">
      <AdminPageHeader
        title={`🔥 ${product.name as string}`}
        breadcrumb={[
          { label: "Admin", href: "/admin" },
          { label: "Products", href: "/admin/products" },
          { label: "Edit", href: `/admin/products/${product.id}/edit` },
        ]}
      />
      <ProductEditForm product={product as unknown as Parameters<typeof ProductEditForm>[0]["product"]} />
    </div>
  );
}
