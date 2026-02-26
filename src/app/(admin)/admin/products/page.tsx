import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export default async function AdminProductsPage() {
  const supabase = createAdminClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, slug, price_paise, jlpt_level")
    .order("sort_order");

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal mb-6">Products</h1>
      {products && products.length > 0 ? (
        <div className="space-y-2">
          {products.map((p) => (
            <div key={p.id} className="flex items-center justify-between p-4 bg-white rounded-card border">
              <div>
                <span className="font-medium">{p.name}</span>
                <span className="text-secondary text-sm ml-2">₹{p.price_paise / 100}</span>
              </div>
              <Link href={`/product/${p.slug}`} className="text-primary text-sm">View</Link>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-secondary">No products. Seed the database or add via SQL.</p>
      )}
    </div>
  );
}
