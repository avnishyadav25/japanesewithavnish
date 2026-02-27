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

export default async function LearnDetailPage({
  params,
}: {
  params: Promise<{ type: string; slug: string }>;
}) {
  const { type, slug } = await params;
  const normalized = type.toLowerCase();

  if (!TYPES.includes(normalized as (typeof TYPES)[number])) notFound();

  const supabase = await createClient();
  const { data: item, error } = await supabase
    .from("learning_content")
    .select("*")
    .eq("content_type", normalized)
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (error || !item) notFound();

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6 japanese-wave-bg">
      <div className="max-w-[800px] mx-auto">
        <nav className="text-sm text-secondary mb-8 flex items-center gap-2">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span className="opacity-50">／</span>
          <Link href="/learn" className="hover:text-primary">Learn</Link>
          <span className="opacity-50">／</span>
          <Link href={`/learn/${normalized}`} className="hover:text-primary">
            {TYPE_LABELS[normalized]}
          </Link>
          <span className="opacity-50">／</span>
          <span className="text-charcoal truncate max-w-[200px]">{item.title}</span>
        </nav>

        <article className="card-content japanese-shoji-border">
          <div className="flex items-center gap-2 mb-4">
            <span className="japanese-kanji-accent text-lg">{TYPE_LABELS[normalized]}</span>
            {item.jlpt_level && (
              <span className="text-xs text-secondary">{item.jlpt_level}</span>
            )}
          </div>
          <h1 className="font-heading text-2xl sm:text-3xl font-bold text-charcoal mb-6">
            {item.title}
          </h1>
          {item.content && (
            <div
              className="prose prose-charcoal max-w-none text-secondary"
              dangerouslySetInnerHTML={{ __html: item.content.replace(/\n/g, "<br />") }}
            />
          )}
        </article>

        <div className="mt-8">
          <Link href={`/learn/${normalized}`} className="btn-secondary">
            ← Back to {TYPE_LABELS[normalized]}
          </Link>
        </div>
      </div>
    </div>
  );
}
