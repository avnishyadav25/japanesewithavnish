import Image from "next/image";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminEmptyState } from "@/components/admin/AdminEmptyState";

export default async function AdminProductsPage() {
  const supabase = createAdminClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, slug, price_paise, jlpt_level, image_url, badge")
    .order("sort_order");

  return (
    <div>
      <AdminPageHeader title="Products" breadcrumb={[{ label: "Admin", href: "/admin" }]} />
      {products && products.length > 0 ? (
        <div className="bento-grid">
          {products.map((p) => (
            <AdminCard key={p.id} className="bento-span-2">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  {p.image_url && (
                    <div className="relative w-12 h-12 rounded-bento overflow-hidden flex-shrink-0 bg-base">
                      <Image
                        src={p.image_url}
                        alt=""
                        fill
                        className="object-cover"
                        sizes="48px"
                      />
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="font-medium text-charcoal block truncate">{p.name}</span>
                    <span className="text-secondary text-sm">₹{p.price_paise / 100}</span>
                    {p.jlpt_level && (
                      <span className="ml-2 text-xs text-secondary">{p.jlpt_level}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <Link
                    href={`/product/${p.slug}`}
                    className="text-primary text-sm hover:underline"
                  >
                    View
                  </Link>
                  <Link
                    href={`/admin/products/${p.id}/edit`}
                    className="text-secondary text-sm hover:underline"
                  >
                    Edit
                  </Link>
                </div>
              </div>
            </AdminCard>
          ))}
        </div>
      ) : (
        <AdminEmptyState
          message="No products. Seed the database or add via SQL."
          action={{ label: "View Store", href: "/store" }}
        />
      )}
    </div>
  );
}
