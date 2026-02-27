import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const TYPES = ["grammar", "vocabulary", "kanji", "reading", "writing"] as const;
const TYPE_LABELS: Record<string, string> = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  kanji: "Kanji",
  reading: "Reading",
  writing: "Writing",
};
const JLPT_LEVELS = ["N5", "N4", "N3", "N2", "N1"];

export default async function LearnTypePage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string }>;
  searchParams: Promise<{ level?: string }>;
}) {
  const { type } = await params;
  const { level } = await searchParams;
  const normalized = type.toLowerCase();

  if (!TYPES.includes(normalized as (typeof TYPES)[number])) notFound();

  const supabase = await createClient();
  let query = supabase
    .from("learning_content")
    .select("id, slug, title, jlpt_level")
    .eq("content_type", normalized)
    .eq("status", "published")
    .order("sort_order")
    .order("created_at", { ascending: false });

  if (level && JLPT_LEVELS.includes(level.toUpperCase())) {
    query = query.eq("jlpt_level", level.toUpperCase());
  }

  const { data: items } = await query;

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6 japanese-wave-bg">
      <div className="max-w-[1200px] mx-auto">
        <nav className="text-sm text-secondary mb-8 flex items-center gap-2">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span className="opacity-50">／</span>
          <Link href="/learn" className="hover:text-primary">Learn</Link>
          <span className="opacity-50">／</span>
          <span className="text-charcoal">{TYPE_LABELS[normalized]}</span>
        </nav>

        <div className="mb-10">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-2">
            {TYPE_LABELS[normalized]}
          </h1>
          <p className="text-secondary mb-4">
            Browse {TYPE_LABELS[normalized].toLowerCase()} content by JLPT level.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/learn/${normalized}`}
              className={`px-3 py-1.5 rounded-bento text-sm font-medium transition ${
                !level ? "bg-primary text-white" : "bg-base border border-[var(--divider)] text-secondary hover:border-primary"
              }`}
            >
              All
            </Link>
            {JLPT_LEVELS.map((l) => (
              <Link
                key={l}
                href={`/learn/${normalized}?level=${l}`}
                className={`px-3 py-1.5 rounded-bento text-sm font-medium transition ${
                  level === l ? "bg-primary text-white" : "bg-base border border-[var(--divider)] text-secondary hover:border-primary"
                }`}
              >
                {l}
              </Link>
            ))}
          </div>
        </div>

        {items && items.length > 0 ? (
          <div className="bento-grid">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/learn/${normalized}/${item.slug}`}
                className="bento-span-2 card block hover:no-underline group"
              >
                <h2 className="font-heading font-bold text-charcoal group-hover:text-primary transition">
                  {item.title}
                </h2>
                {item.jlpt_level && (
                  <span className="text-xs text-secondary mt-1 block">{item.jlpt_level}</span>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="card bento-span-6 p-12 text-center">
            <p className="text-secondary">No {TYPE_LABELS[normalized].toLowerCase()} content yet. Check back soon!</p>
            <Link href="/learn" className="btn-secondary mt-4 inline-block">Back to Learn</Link>
          </div>
        )}
      </div>
    </div>
  );
}
