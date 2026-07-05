import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { WritingPracticeClient } from "./WritingPracticeClient";

function parseCharsParam(chars?: string | string[]) {
  const raw = Array.isArray(chars) ? chars[0] : chars;
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default async function LearnWritingPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await getSession();
  const typeRaw = typeof searchParams?.type === "string" ? searchParams.type : "";
  const type = (typeRaw || "kanji").toLowerCase() as "kanji" | "hiragana" | "katakana";
  const chars = parseCharsParam(searchParams?.chars);
  const redirectTo =
    chars.length && (type === "hiragana" || type === "katakana")
      ? `/learn/writing?type=${encodeURIComponent(type)}&chars=${encodeURIComponent(chars.join(","))}`
      : "/learn/writing";
  return (
    <div className="min-h-screen bg-[var(--base)]">
      <div className="max-w-[1200px] mx-auto px-4 py-8">
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
          <WritingPracticeClient
            initialType={["kanji", "hiragana", "katakana"].includes(type) ? type : "kanji"}
            initialCharacters={chars.length ? chars : undefined}
          />
        ) : (
          <p className="text-secondary text-sm">
            <Link href={`/login?redirect=${encodeURIComponent(redirectTo)}`} className="text-primary hover:underline">Sign in</Link> to use the writing canvas and save progress.
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
