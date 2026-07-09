import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { WritingPracticeClient } from "../WritingPracticeClient";
import { resolveWritingSet } from "@/lib/learn/writing-sets";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function WritingDetailPage({ params }: Props) {
  const { slug } = await params;
  const session = await getSession();

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
            <div className="text-center py-6">
              <p className="text-secondary text-xs mb-4">
                Sign in to use the interactive canvas, check stroke order matches, and track progress.
              </p>
              <Link
                href={`/login?redirect=/learn/writing/${slug}`}
                className="btn-primary inline-flex h-11 px-5 rounded-xl text-xs font-bold font-heading items-center"
              >
                Sign In / Sign Up
              </Link>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
