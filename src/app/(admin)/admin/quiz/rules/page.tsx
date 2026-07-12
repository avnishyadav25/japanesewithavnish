import { sql } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { QuizThresholdsForm } from "./QuizThresholdsForm";

export default async function AdminQuizRulesPage() {
  let thresholds: { level: string; min_score: number; recommended_product_id: string | null }[] = [];
  let products: { id: string; name: string }[] = [];

  if (sql) {
    try {
      [thresholds, products] = await Promise.all([
        sql`SELECT level, min_score, recommended_product_id FROM quiz_thresholds ORDER BY level` as unknown as Promise<typeof thresholds>,
        sql`SELECT id, name FROM products WHERE is_active = true ORDER BY name` as unknown as Promise<typeof products>,
      ]);
    } catch (e) {
      console.error("Admin quiz rules:", e);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <AdminPageHeader
        title="Quiz Result Rules"
        breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Quiz" }, { label: "Result Rules" }]}
      />
      <p className="text-secondary text-sm -mt-2">
        Placement quiz score thresholds per JLPT level, and the product recommended to students who land at each level.
      </p>
      <QuizThresholdsForm initial={thresholds} products={products} />
    </div>
  );
}
export const dynamic = "force-dynamic";
