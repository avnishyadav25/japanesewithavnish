import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { ListeningComprehensionClient } from "./ListeningComprehensionClient";

export default async function LearnListeningPage() {
  const session = await getSession();
  return (
    <div className="min-h-screen bg-[var(--base)]">
      <div className="max-w-[720px] mx-auto px-4 py-8">
        <nav className="text-sm text-secondary mb-4">
          <Link href="/learn/dashboard" className="hover:text-primary">Dashboard</Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal">Listening</span>
        </nav>
        <h1 className="font-heading text-3xl font-bold text-charcoal mb-2">Listening comprehension</h1>
        <p className="text-secondary mb-6">
          JLPT-style: listen to the audio, then answer multiple-choice questions. Use playback speed and reveal the transcript after submitting.
        </p>
        {session?.email ? (
          <ListeningComprehensionClient />
        ) : (
          <p className="text-secondary text-sm">
            <Link href={`/login?redirect=/learn/listening`} className="text-primary hover:underline">Sign in</Link> to practice and save your attempts.
          </p>
        )}
        <div className="mt-8 pt-6 border-t border-[var(--divider)] flex flex-wrap gap-4">
          <Link href="/learn/dashboard" className="text-primary text-sm font-medium hover:underline">← Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
