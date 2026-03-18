import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { MockExamClient } from "./MockExamClient";

export default async function LearnExamPage() {
  const session = await getSession();
  let levels: { id: string; code: string; name: string }[] = [];
  if (sql) {
    const rows = await sql`
      SELECT id, code, name FROM curriculum_levels ORDER BY sort_order, code
    ` as { id: string; code: string; name: string }[];
    levels = rows ?? [];
  }
  return (
    <div className="min-h-screen bg-[var(--base)]">
      <div className="max-w-[720px] mx-auto px-4 py-8">
        <nav className="text-sm text-secondary mb-4">
          <Link href="/learn/dashboard" className="hover:text-primary">Dashboard</Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal">Mock exam</span>
        </nav>
        <h1 className="font-heading text-3xl font-bold text-charcoal mb-2">Mock exam</h1>
        <p className="text-secondary mb-6">
          Timed practice exam (honor system). Choose a level and complete the section before time runs out.
        </p>
        {session?.email ? (
          <MockExamClient levels={levels} />
        ) : (
          <p className="text-secondary text-sm">
            <Link href={`/login?redirect=/learn/exam`} className="text-primary hover:underline">Sign in</Link> to take a mock exam.
          </p>
        )}
        <div className="mt-8 pt-6 border-t border-[var(--divider)] flex flex-wrap gap-4">
          <Link href="/learn/dashboard" className="text-primary text-sm font-medium hover:underline">← Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
