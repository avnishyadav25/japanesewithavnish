import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { AnalyticsClient } from "./AnalyticsClient";

export default async function LearnAnalyticsPage() {
  const session = await getSession();
  return (
    <div className="min-h-screen bg-[var(--base)]">
      <div className="max-w-[720px] mx-auto px-4 py-8">
        <nav className="text-sm text-secondary mb-4">
          <Link href="/learn/dashboard" className="hover:text-primary">Dashboard</Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal">Analytics</span>
        </nav>
        <h1 className="font-heading text-3xl font-bold text-charcoal mb-2">Your analytics</h1>
        <p className="text-secondary mb-6">
          Accuracy and response time (last 30 days). Modules with lower accuracy may need more review.
        </p>
        {session?.email ? (
          <AnalyticsClient />
        ) : (
          <p className="text-secondary text-sm">
            <Link href={`/login?redirect=/learn/analytics`} className="text-primary hover:underline">Sign in</Link> to see your analytics.
          </p>
        )}
        <div className="mt-8 pt-6 border-t border-[var(--divider)] flex flex-wrap gap-4">
          <Link href="/learn/dashboard" className="text-primary text-sm font-medium hover:underline">← Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
