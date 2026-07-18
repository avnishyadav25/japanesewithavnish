import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { sql } from "@/lib/db";
import { WritingPracticeClient } from "../WritingPracticeClient";
import { WritingGuestDemo } from "../WritingGuestDemo";
import { resolveWritingSet } from "@/lib/learn/writing-sets";
import { WritingComposition } from "./WritingComposition";
import { getResolvedContentBlocks } from "@/lib/blocks/getContentBlocks";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function WritingDetailPage({ params }: Props) {
  const { slug } = await params;
  const session = await getSession();

  // This route is also the URL for the character-tracing-set tool below
  // (a curated static list, resolveWritingSet) — but `content_type='writing'`
  // posts (composition-writing exercises, a different feature entirely) claim
  // the same /learn/writing/{slug} path. Check for a real post with published
  // content first; only fall through to the tracing-set tool if none exists,
  // so a composition post's slug never renders the (nonsensical) single-character
  // fallback the tracing tool used to show for any unrecognized slug.
  if (sql) {
    const postRows = (await sql`
      SELECT id, title, (jlpt_level)[1] AS level
      FROM posts WHERE slug = ${slug} AND content_type = 'writing' AND status = 'published'
      LIMIT 1
    `) as { id: string; title: string; level: string | null }[];
    const post = postRows[0];
    if (post) {
      const { blocks } = await getResolvedContentBlocks(post.id);
      if (blocks.length > 0) {
        return <WritingComposition title={post.title} level={post.level} slug={slug} blocks={blocks} />;
      }
    }
  }

  const activeSet = (await resolveWritingSet(slug)) || {
    title: slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" "),
    type: "kanji" as const,
    chars: [slug.charAt(0)],
    desc: `Practice tracing "${slug}" stroke sequences on drawing canvas.`,
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] py-12 px-4 sm:px-6">
      <div className="max-w-[800px] mx-auto space-y-6">
        
        {/* Breadcrumbs */}
        <nav className="text-[11px] font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
          <Link href="/learn" className="hover:text-primary transition-colors">Learn Hub</Link>
          <span>/</span>
          <Link href="/learn/writing" className="hover:text-primary transition-colors">Writing Practice</Link>
          <span>/</span>
          <span className="text-charcoal truncate">{activeSet.title}</span>
        </nav>

        {/* Title */}
        <div>
          <span className="text-[10px] font-bold tracking-widest text-[#D0021B] uppercase bg-[#FFF7F7] px-3 py-1 rounded-full border border-[#D0021B]/10">
            Writing Tracing Set
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-black text-charcoal mt-2.5">
            {activeSet.title}
          </h1>
          <p className="text-secondary text-xs mt-2 leading-relaxed">{activeSet.desc}</p>
        </div>

        {/* Drawing canvas practice client */}
        <div className="bg-white border border-[var(--divider)] rounded-3xl p-6 shadow-sm">
          {session?.email ? (
            <WritingPracticeClient
              initialType={activeSet.type}
              initialCharacters={activeSet.chars}
            />
          ) : (
            <div className="space-y-5">
              <WritingGuestDemo redirectSlug={slug} />
              <div className="text-center pt-4 border-t border-[var(--divider)]">
                <p className="text-secondary text-xs mb-3">
                  Sign in to unlock the full {activeSet.title} set, check stroke order matches, and track progress.
                </p>
                <Link
                  href={`/login?redirect=/learn/writing/${slug}`}
                  className="btn-secondary inline-flex h-10 px-4 rounded-xl text-xs font-bold font-heading items-center"
                >
                  Sign In
                </Link>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
