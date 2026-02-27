import Link from "next/link";

interface StudyRoadmapData {
  headline?: string;
  bullets?: string[];
  ctaText?: string;
  megaSlug?: string;
}

const LEVELS = ["N5", "N4", "N3", "N2", "N1"];

export function StudyRoadmapMegaCta({
  data,
  megaPrice,
}: {
  data: StudyRoadmapData | null;
  megaPrice?: number;
}) {
  if (!data?.megaSlug) return null;

  return (
    <div className="card flex flex-col md:flex-row gap-8 items-center border border-[#C8A35F] p-5 relative">
      <span className="badge-premium absolute top-4 right-4">Complete System</span>
      <div className="flex-1">
        <div className="flex flex-wrap items-center justify-center gap-2">
          {LEVELS.map((level, i) => (
            <span key={level} className="flex items-center gap-2">
              <span className="px-4 py-2 rounded-bento bg-primary/10 text-primary font-bold text-sm">
                {level}
              </span>
              {i < LEVELS.length - 1 && (
                <span className="text-secondary text-lg hidden sm:inline">→</span>
              )}
            </span>
          ))}
        </div>
        {data.headline && (
          <p className="text-secondary text-sm mt-4 text-center">{data.headline}</p>
        )}
        <p className="text-secondary text-xs mt-2 text-center">
          Worksheets + Mock Tests + Audio at every level
        </p>
      </div>
      <div className="flex-1 flex flex-col items-center md:items-start">
        {data.bullets?.map((b, i) => (
          <p key={i} className="text-charcoal text-sm mb-2 flex items-center gap-2">
            <span className="text-primary">✓</span> {b}
          </p>
        ))}
        {megaPrice != null && (
          <p className="font-bold text-primary text-xl mb-4">₹{megaPrice / 100}</p>
        )}
        <Link href={`/product/${data.megaSlug}`} className="btn-primary">
          {data.ctaText || "Buy Mega Bundle"}
        </Link>
      </div>
    </div>
  );
}
