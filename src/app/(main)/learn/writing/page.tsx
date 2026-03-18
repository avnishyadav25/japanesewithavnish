import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { WritingPracticeClient } from "./WritingPracticeClient";

export default async function LearnWritingPage() {
  const session = await getSession();
  return (
    <div className="min-h-screen bg-[var(--base)]">
      <div className="max-w-[720px] mx-auto px-4 py-8">
        <nav className="text-sm text-secondary mb-4">
          <Link href="/learn/dashboard" className="hover:text-primary">Dashboard</Link>
          <span className="mx-2">/</span>
          <Link href="/learn/curriculum" className="hover:text-primary">Curriculum</Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal">Writing practice</span>
        </nav>
        <h1 className="font-heading text-3xl font-bold text-charcoal mb-2">Writing practice</h1>
        <p className="text-secondary mb-6">
          Practice hiragana, katakana, and kanji with correct stroke order. Draw in the canvas, then check your work. Use &quot;Read aloud&quot; to hear the character.
        </p>
        {session?.email ? (
          <WritingPracticeClient />
        ) : (
          <p className="text-secondary text-sm">
            <Link href={`/login?redirect=/learn/writing`} className="text-primary hover:underline">Sign in</Link> to use the writing canvas and save progress.
          </p>
        )}
        <div className="mt-8 pt-6 border-t border-[var(--divider)] flex flex-wrap gap-4">
          <Link href="/learn/curriculum" className="text-primary text-sm font-medium hover:underline">← Curriculum</Link>
          <Link href="/learn/dashboard" className="text-secondary text-sm font-medium hover:underline">Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
