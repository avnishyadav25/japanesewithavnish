import { createAdminClient } from "@/lib/supabase/admin";
import { DownloadButton } from "./DownloadButton";

export async function LibraryContent({ userEmail }: { userEmail: string }) {
  const supabase = createAdminClient();
  const { data: entitlements } = await supabase
    .from("entitlements")
    .select(`
      id,
      product:products(id, name, slug, product_assets(id, display_name, storage_path, type))
    `)
    .eq("user_email", userEmail)
    .eq("active", true);

  if (!entitlements || entitlements.length === 0) {
    return (
      <p className="text-secondary">
        You don&apos;t have any purchases yet.{" "}
        <a href="/store" className="text-primary font-medium hover:underline">
          Browse the store
        </a>
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {entitlements.map((ent) => {
        const product = Array.isArray(ent.product) ? ent.product[0] : ent.product;
        if (!product) return null;
        const assets = product.product_assets || [];
        return (
          <div key={ent.id} className="card">
            <h2 className="text-xl font-bold text-charcoal mb-4">{product.name}</h2>
            <ul className="space-y-2">
              {assets.map((asset: { id: string; display_name: string }) => (
                <li key={asset.id} className="flex items-center justify-between gap-4">
                  <span className="text-secondary">{asset.display_name}</span>
                  <DownloadButton assetId={asset.id} />
                </li>
              ))}
            </ul>
            {assets.length === 0 && (
              <p className="text-secondary text-sm">No assets yet. Contact support if you need help.</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
