import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { GrammarDrillsClient } from "./GrammarDrillsClient";

export default async function GrammarDrillsPage({
  searchParams,
}: {
  searchParams: Promise<{ lessonId?: string; grammarId?: string }>;
}) {
  const session = await getSession();
  const params = await searchParams;
  return (
    <div className="min-h-screen bg-[var(--base)]">
      <div className="max-w-[720px] mx-auto px-4 py-8">
        <nav className="text-sm text-secondary mb-4">
          <Link href="/learn/dashboard" className="hover:text-primary">Dashboard</Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal">Grammar drills</span>
        </nav>
        <h1 className="font-heading text-3xl font-bold text-charcoal mb-2">Grammar drills</h1>
        <p className="text-secondary mb-6">
          Choose the correct particle or conjugation. Drills are linked to lessons or grammar points.
        </p>
        {session?.email ? (
          <GrammarDrillsClient lessonId={params.lessonId} grammarId={params.grammarId} />
        ) : (
          <p className="text-secondary text-sm">
            <Link href={`/login?redirect=/learn/grammar-drills`} className="text-primary hover:underline">Sign in</Link> to practice.
          </p>
        )}
        <div className="mt-8 pt-6 border-t border-[var(--divider)] flex flex-wrap gap-4">
          <Link href="/learn/dashboard" className="text-primary text-sm font-medium hover:underline">← Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
