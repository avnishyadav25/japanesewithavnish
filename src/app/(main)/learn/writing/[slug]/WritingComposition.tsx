import Link from "next/link";
import { LessonBlockRenderer } from "@/components/curriculum/LessonBlockRenderer";
import type { ResolvedBlock } from "@/lib/curriculum/getLessonBlocks";

/** Public view for a content_type='writing' composition-exercise post — a
 * different feature from the character-tracing tool that otherwise owns this
 * URL (see writing-sets.ts). Reuses LessonBlockRenderer (built for curriculum
 * lesson pages) since content_blocks and lesson_blocks share the same
 * BlockType registry and the same getResolvedContentBlocks/getResolvedLessonBlocks
 * FK-resolution shape. */
export function WritingComposition({
  title,
  level,
  slug,
  blocks,
}: {
  title: string;
  level: string | null;
  slug: string;
  blocks: ResolvedBlock[];
}) {
  return (
    <div className="min-h-screen bg-[#FAF8F5] py-12 px-4 sm:px-6">
      <div className="max-w-[800px] mx-auto space-y-6">
        <nav className="text-[11px] font-bold text-secondary uppercase tracking-wider flex items-center gap-1.5">
          <Link href="/learn" className="hover:text-primary transition-colors">Learn Hub</Link>
          <span>/</span>
          <Link href="/learn/writing" className="hover:text-primary transition-colors">Writing Practice</Link>
          <span>/</span>
          <span className="text-charcoal truncate">{title}</span>
        </nav>

        <div>
          <span className="text-[10px] font-bold tracking-widest text-[#D0021B] uppercase bg-[#FFF7F7] px-3 py-1 rounded-full border border-[#D0021B]/10">
            {level || "N5"} • Writing Composition
          </span>
          <h1 className="font-heading text-2xl sm:text-3xl font-black text-charcoal mt-2.5">{title}</h1>
        </div>

        <LessonBlockRenderer blocks={blocks} />

        <div className="pt-4 border-t border-[var(--divider)] text-center">
          <p className="text-secondary text-xs mb-3">Want to practice writing the characters used in this exercise by hand?</p>
          <Link href={`/learn/writing/hiragana-a-row`} className="btn-secondary inline-flex h-10 px-4 rounded-xl text-xs font-bold font-heading items-center">
            Open the tracing canvas
          </Link>
        </div>
      </div>
    </div>
  );
}
