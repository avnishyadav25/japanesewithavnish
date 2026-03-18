import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { ShadowingPageClient } from "./ShadowingPageClient";

export default async function LearnShadowingPage() {
  const session = await getSession();
  let items: { id: string; title: string | null; audio_url: string | null; slug: string }[] = [];
  if (sql) {
    try {
      const rows = await sql`
        SELECT l.id, l.title, l.audio_url, p.slug
        FROM listening l
        JOIN posts p ON p.id = l.post_id AND p.status = 'published'
        WHERE l.audio_url IS NOT NULL AND l.audio_url != ''
        ORDER BY l.title NULLS LAST
        LIMIT 50
      ` as { id: string; title: string | null; audio_url: string | null; slug: string }[];
      items = rows ?? [];
    } catch {
      // ignore
    }
  }
  return (
    <div className="min-h-screen bg-[var(--base)]">
      <div className="max-w-[720px] mx-auto px-4 py-8">
        <nav className="text-sm text-secondary mb-4">
          <Link href="/learn/dashboard" className="hover:text-primary">Dashboard</Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal">Shadowing</span>
        </nav>
        <h1 className="font-heading text-3xl font-bold text-charcoal mb-2">Shadowing (listen & repeat)</h1>
        <p className="text-secondary mb-6">
          Listen to the native audio, then record yourself repeating the phrase. Play your recording to compare. Pronunciation grading will be added later.
        </p>
        {session?.email ? (
          <ShadowingPageClient initialItems={items} />
        ) : (
          <p className="text-secondary text-sm">
            <Link href={`/login?redirect=/learn/shadowing`} className="text-primary hover:underline">Sign in</Link> to practice shadowing.
          </p>
        )}
        <div className="mt-8 pt-6 border-t border-[var(--divider)] flex flex-wrap gap-4">
          <Link href="/learn/dashboard" className="text-primary text-sm font-medium hover:underline">← Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
