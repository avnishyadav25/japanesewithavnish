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
  listening: "Listening",
  sounds: "Sounds",
  study_guide: "Study guide",
  practice_test: "Practice test",
};

interface LearnLessonCardProps {
  item: LearnItemForFilter;
  variant?: "card" | "list";
}

export function LearnLessonCard({ item, variant = "card" }: LearnLessonCardProps) {
  const summary = getSummary(item);
  const typeLabel = TYPE_LABELS[item.content_type] || item.content_type;
  const featureImageUrl =
    item.meta && typeof item.meta.feature_image_url === "string" ? item.meta.feature_image_url : null;

  if (variant === "list") {
    return (
      <Link
        href={`/blog/${item.content_type}/${item.slug}`}
        className="flex items-center gap-4 p-4 hover:no-underline group border-b border-[var(--divider)] last:border-b-0 hover:bg-[var(--divider)]/10 transition"
      >
        {featureImageUrl ? (
          <div className="w-24 h-16 sm:w-28 sm:h-20 flex-shrink-0 rounded overflow-hidden bg-[var(--divider)]/20">
            <img src={featureImageUrl} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-24 h-16 sm:w-28 sm:h-20 flex-shrink-0 rounded bg-[var(--divider)]/20 flex items-center justify-center text-secondary text-xs font-medium">
            {typeLabel}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-bold text-charcoal group-hover:text-primary transition line-clamp-1">
            {item.title}
          </h3>
          <div className="flex flex-wrap gap-2 mt-1">
            {item.jlpt_level && (
              <span className="text-xs px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#EEEEEE] text-[#555555]">
                {item.jlpt_level}
              </span>
            )}
            <span className="text-xs px-2 py-0.5 rounded bg-[#FAF8F5] border border-[#EEEEEE] text-[#555555]">
              {typeLabel}
            </span>
          </div>
          {summary && (
            <p className="text-secondary text-sm mt-1 line-clamp-1">{summary}</p>
          )}
        </div>
        <span className="text-primary text-sm font-medium shrink-0 group-hover:underline">
          Read →
        </span>
      </Link>
    );
  }

  return (
    <Link
      href={`/blog/${item.content_type}/${item.slug}`}
      className="card block overflow-hidden p-0 hover:no-underline group"
    >
      {featureImageUrl && (
        <div className="aspect-video w-full bg-[var(--divider)]/20">
          <img src={featureImageUrl} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="p-5">
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
      </div>
    </Link>
  );
}
