import type { SectionHeadingData, RichTextData, SummaryData, TipData, CultureNoteData, CommonMistakeData } from "@/lib/curriculum/blockTypes";
import { LearnMarkdown } from "@/components/learn/LearnMarkdown";

export function SectionHeadingBlock({ data }: { data: SectionHeadingData }) {
  return (
    <div id={data.anchorId} className="scroll-mt-6">
      <h2 className="font-heading text-lg font-bold text-charcoal">{data.title}</h2>
      {data.subtitle && <p className="text-secondary text-sm mt-1">{data.subtitle}</p>}
    </div>
  );
}

export function RichTextBlock({ data }: { data: RichTextData }) {
  return (
    <div className="bg-white border border-[var(--divider)] rounded-bento p-6">
      <LearnMarkdown content={data.markdown} />
    </div>
  );
}

export function SummaryBlock({ data }: { data: SummaryData }) {
  return (
    <div className="bg-[#FAF8F5] border border-[var(--divider)] rounded-bento p-6">
      <h3 className="font-heading font-bold text-sm text-charcoal mb-3">Lesson Summary</h3>
      <ul className="space-y-1.5">
        {data.items.map((item, i) => (
          <li key={i} className="text-sm text-secondary flex gap-2">
            <span className="text-primary font-bold">✓</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TipBlock({ data }: { data: TipData }) {
  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-bento p-4 text-sm text-emerald-900">
      <span className="font-bold">💡 Tip: </span>
      {data.text}
    </div>
  );
}

export function CultureNoteBlock({ data }: { data: CultureNoteData }) {
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-bento p-4 text-sm text-amber-900">
      <span className="font-bold">🎎 Culture Note: </span>
      {data.text}
    </div>
  );
}

export function CommonMistakeBlock({ data }: { data: CommonMistakeData }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-bento p-4 text-sm text-red-900">
      <span className="font-bold">⚠️ Common mistake: </span>
      {data.text}
    </div>
  );
}
