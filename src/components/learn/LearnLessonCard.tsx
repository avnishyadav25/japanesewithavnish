import Link from "next/link";
import { getSummary, type LearnItemForFilter } from "@/lib/learn-filters";

const TYPE_LABELS: Record<string, string> = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  kanji: "Kanji",
  reading: "Reading",
  writing: "Writing",
  roadmap: "Roadmap",
  tips: "Tips",
};

interface LearnLessonCardProps {
  item: LearnItemForFilter;
}

export function LearnLessonCard({ item }: LearnLessonCardProps) {
  const summary = getSummary(item);
  const typeLabel = TYPE_LABELS[item.content_type] || item.content_type;

  return (
    <Link
      href={`/learn/${item.content_type}/${item.slug}`}
      className="card block p-5 hover:no-underline group"
    >
      <h3 className="font-heading font-bold text-charcoal group-hover:text-primary transition line-clamp-2">
        {item.title}
      </h3>
      <div className="flex flex-wrap gap-2 mt-2">
        {item.jlpt_level && (
          <span className="text-xs px-2 py-1 rounded-md bg-[#FAF8F5] border border-[#EEEEEE] text-[#555555]">
            {item.jlpt_level}
          </span>
        )}
        <span className="text-xs px-2 py-1 rounded-md bg-[#FAF8F5] border border-[#EEEEEE] text-[#555555]">
          {typeLabel}
        </span>
      </div>
      {summary && (
        <p className="text-secondary text-sm mt-2 line-clamp-2">{summary}</p>
      )}
      <span className="text-primary text-sm font-medium mt-2 inline-block group-hover:underline">
        Read →
      </span>
    </Link>
  );
}
