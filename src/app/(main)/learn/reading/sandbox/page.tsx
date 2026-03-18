import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { ReadingSandboxClient } from "./ReadingSandboxClient";

export default async function ReadingSandboxPage() {
  const session = await getSession();
  return (
    <div className="min-h-screen bg-[var(--base)]">
      <div className="max-w-[720px] mx-auto px-4 py-8">
        <nav className="text-sm text-secondary mb-4">
          <Link href="/learn/dashboard" className="hover:text-primary">Dashboard</Link>
          <span className="mx-2">/</span>
          <Link href="/learn/reading" className="hover:text-primary">Reading</Link>
          <span className="mx-2">/</span>
          <span className="text-charcoal">Sandbox</span>
        </nav>
        <h1 className="font-heading text-3xl font-bold text-charcoal mb-2">Reading sandbox</h1>
        <p className="text-secondary mb-6">
          Long-form reading with tap-for-definition. Tap any highlighted segment to see its definition without leaving the page.
        </p>
        {session?.email ? (
          <ReadingSandboxClient />
        ) : (
          <p className="text-secondary text-sm">
            <Link href={`/login?redirect=/learn/reading/sandbox`} className="text-primary hover:underline">Sign in</Link> to use the reading sandbox.
          </p>
        )}
        <div className="mt-8 pt-6 border-t border-[var(--divider)] flex flex-wrap gap-4">
          <Link href="/learn/dashboard" className="text-primary text-sm font-medium hover:underline">← Dashboard</Link>
        </div>
      </div>
    </div>
  );
}
