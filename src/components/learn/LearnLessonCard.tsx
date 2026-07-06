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
  
  const meta = (item.meta && typeof item.meta === "object") ? item.meta : {};
  const featureImageUrl = typeof meta.feature_image_url === "string" ? meta.feature_image_url : null;
  const meaning = typeof meta.meaning === "string" ? meta.meaning : "";
  const reading = typeof meta.reading === "string" ? meta.reading : "";
  const onyomi = Array.isArray(meta.onyomi) ? meta.onyomi : [];
  const kunyomi = Array.isArray(meta.kunyomi) ? meta.kunyomi : [];
  const duration = typeof meta.duration === "string" ? meta.duration : "3 min";
  const charsCount = typeof meta.characters_count === "number" ? `${meta.characters_count} characters` : "5 characters";
  const desc = typeof meta.desc === "string" ? meta.desc : "";

  // 1. LIST VARIANT (Compact list view)
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
          <div className="w-24 h-16 sm:w-28 sm:h-20 flex-shrink-0 rounded bg-[var(--divider)]/20 flex items-center justify-center text-secondary text-xs font-bold font-heading">
            {item.content_type === "kanji" ? (
              <span className="text-3xl font-bold">{item.title}</span>
            ) : (
              typeLabel
            )}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="font-heading font-bold text-charcoal group-hover:text-primary transition line-clamp-1">
            {item.title}
          </h3>
          <div className="flex flex-wrap gap-2 mt-1">
            {item.jlpt_level && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FAF8F5] border border-[var(--divider)] text-secondary">
                {item.jlpt_level}
              </span>
            )}
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#FAF8F5] border border-[var(--divider)] text-secondary">
              {typeLabel}
            </span>
          </div>
          <p className="text-secondary text-xs mt-1 line-clamp-1">
            {meaning || desc || summary}
          </p>
        </div>
        <span className="text-primary text-xs font-bold shrink-0 group-hover:underline">
          Read →
        </span>
      </Link>
    );
  }

  // 2. CARD VARIANT: Taylored Category Views

  // A. GRAMMAR CARD
  if (item.content_type === "grammar") {
    return (
      <Link
        href={`/blog/grammar/${item.slug}`}
        className="card bg-white border border-[var(--divider)] p-5 rounded-2xl flex flex-col justify-between hover:shadow-md transition hover:no-underline group"
      >
        <div>
          <span className="inline-block text-[10px] font-bold text-primary bg-[#FFF7F7] border border-primary/15 px-2.5 py-0.5 rounded-full uppercase">
            {item.jlpt_level || "N5"} • Grammar
          </span>
          <h3 className="font-heading text-lg font-bold text-charcoal mt-3 group-hover:text-primary transition line-clamp-1">
            {item.title}
          </h3>
          <p className="text-secondary text-xs mt-1.5 leading-relaxed line-clamp-3">
            {meaning || summary || "JLPT Japanese grammar pattern review and usage rules."}
          </p>
        </div>
        <span className="text-primary text-xs font-bold mt-4 inline-block group-hover:underline">
          Read →
        </span>
      </Link>
    );
  }

  // B. VOCABULARY CARD
  if (item.content_type === "vocabulary") {
    return (
      <Link
        href={`/blog/vocabulary/${item.slug}`}
        className="card bg-white border border-[var(--divider)] p-5 rounded-2xl flex flex-col justify-between hover:shadow-md transition hover:no-underline group"
      >
        <div>
          <span className="inline-block text-[10px] font-bold text-primary bg-[#FFF7F7] border border-primary/15 px-2.5 py-0.5 rounded-full uppercase">
            {item.jlpt_level || "N5"} • Vocabulary
          </span>
          <div className="mt-3 flex items-baseline gap-2 flex-wrap">
            <h3 className="font-heading text-lg font-bold text-charcoal group-hover:text-primary transition">
              {item.title}
            </h3>
            {reading && (
              <span className="text-secondary text-xs font-bold">({reading})</span>
            )}
          </div>
          <p className="text-charcoal font-semibold text-xs mt-2 line-clamp-2">
            {meaning || summary}
          </p>
        </div>
        <span className="text-primary text-xs font-bold mt-4 inline-block group-hover:underline">
          Read →
        </span>
      </Link>
    );
  }

  // C. KANJI CARD
  if (item.content_type === "kanji") {
    return (
      <Link
        href={`/blog/kanji/${item.slug}`}
        className="card bg-white border border-[var(--divider)] p-5 rounded-2xl flex flex-col justify-between hover:shadow-md transition hover:no-underline text-center group"
      >
        <div>
          {featureImageUrl ? (
            <div className="aspect-video w-full rounded-lg overflow-hidden bg-[var(--divider)]/20 mb-3">
              <img src={featureImageUrl} alt="" className="w-full h-full object-cover" />
            </div>
          ) : (
            <span className="text-[42px] font-bold text-charcoal block mb-2 mt-2 leading-none font-heading group-hover:scale-105 transition-transform duration-200">
              {item.title}
            </span>
          )}
          <span className="inline-block text-[10px] font-bold text-primary bg-[#FFF7F7] border border-primary/15 px-2.5 py-0.5 rounded-full uppercase mb-2">
            {item.jlpt_level || "N5"} • Kanji
          </span>
          <p className="text-charcoal font-bold text-xs truncate max-w-full" title={meaning || summary}>
            Meaning: {meaning || summary}
          </p>
          {(onyomi.length > 0 || kunyomi.length > 0) && (
            <p className="text-secondary text-[11px] mt-1 truncate">
              Reading: {[...onyomi, ...kunyomi].slice(0, 3).join(", ")}
            </p>
          )}
        </div>
        <span className="text-primary text-xs font-bold mt-4 block group-hover:underline">
          Read →
        </span>
      </Link>
    );
  }

  // D. LISTENING CARD
  if (item.content_type === "listening") {
    return (
      <Link
        href={`/learn/listening/${item.slug}`}
        className="card bg-white border border-[var(--divider)] p-5 rounded-2xl flex flex-col justify-between hover:shadow-md transition hover:no-underline group"
      >
        <div>
          <span className="inline-block text-[10px] font-bold text-primary bg-[#FFF7F7] border border-primary/15 px-2.5 py-0.5 rounded-full uppercase">
            {item.jlpt_level || "N5"} • Listening • {duration}
          </span>
          <h3 className="font-heading text-base font-black text-charcoal mt-3 group-hover:text-primary transition line-clamp-1">
            {item.title}
          </h3>
          <p className="text-secondary text-xs mt-1.5 leading-relaxed line-clamp-2">
            {meaning || summary || "Audio + 5 comprehension questions."}
          </p>
        </div>
        <span className="text-primary text-xs font-bold mt-4 inline-block group-hover:underline">
          Start practice →
        </span>
      </Link>
    );
  }

  // E. WRITING CARD
  if (item.content_type === "writing") {
    return (
      <Link
        href={`/learn/writing/${item.slug || "hiragana-a-row"}`}
        className="card bg-white border border-[var(--divider)] p-5 rounded-2xl flex flex-col justify-between hover:shadow-md transition hover:no-underline group text-left"
      >
        <div>
          <span className="inline-block text-[10px] font-bold text-primary bg-[#FFF7F7] border border-primary/15 px-2.5 py-0.5 rounded-full uppercase">
            {item.jlpt_level || "N5"} • Writing • {charsCount}
          </span>
          <h3 className="font-heading text-base font-bold text-charcoal mt-3 group-hover:text-primary transition line-clamp-1">
            {item.title}
          </h3>
          <p className="text-secondary text-xs mt-1.5 leading-relaxed line-clamp-2">
            {desc || meaning || summary || "Practice stroke order drawing guides."}
          </p>
        </div>
        <span className="text-primary text-xs font-bold mt-4 inline-block group-hover:underline">
          Practice stroke order →
        </span>
      </Link>
    );
  }

  // F. BLOG CARD OR DEFAULT FALLBACK
  return (
    <Link
      href={`/blog/${item.content_type}/${item.slug}`}
      className="card block overflow-hidden p-0 hover:shadow-md transition hover:no-underline group bg-white border border-[var(--divider)] rounded-2xl"
    >
      <div className="aspect-video w-full bg-[var(--divider)]/20 relative overflow-hidden">
        {featureImageUrl ? (
          <img src={featureImageUrl} alt="" className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#FFF7F7] to-[#FAF8F5] border-b border-[var(--divider)]">
            <span className="text-secondary font-bold text-sm tracking-wide uppercase">{typeLabel}</span>
            <span className="text-charcoal/30 font-black text-2xl font-heading mt-1">Japanese Notes</span>
          </div>
        )}
      </div>
      <div className="p-5">
        <span className="inline-block text-[9px] font-bold text-secondary bg-base border border-[var(--divider)] px-2 py-0.5 rounded uppercase mb-2">
          {item.jlpt_level || "N5"} • {typeLabel}
        </span>
        <h3 className="font-heading text-base font-bold text-charcoal group-hover:text-primary transition line-clamp-2">
          {item.title}
        </h3>
        {summary && (
          <p className="text-secondary text-xs mt-2 line-clamp-2">{summary}</p>
        )}
        <span className="text-primary text-xs font-bold mt-3 inline-block group-hover:underline">
          Read →
        </span>
      </div>
    </Link>
  );
}
