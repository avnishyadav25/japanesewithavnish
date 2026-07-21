import Link from "next/link";
import { LearnBundleCta } from "@/components/learn/LearnBundleCta";
import { getWritingSetsForLevel } from "@/lib/learn/writing-sets";

export const metadata = {
  title: "Writing Practice | Japanese with Avnish",
  description: "Practice hiragana, katakana, and kanji with correct stroke order guides.",
};

export default async function LearnWritingPage({
  searchParams,
}: {
  searchParams?: Promise<{ level?: string; search?: string }>;
}) {
  const sp = await searchParams;
  const level = (sp?.level || "all").toLowerCase();
  const search = (sp?.search || "").toLowerCase().trim();

  // Kana rows + DB-driven kanji sets for the selected level
  const levelSets = await getWritingSetsForLevel(level);
  const filteredSets = levelSets.filter(
    (s) =>
      !search || s.title.toLowerCase().includes(search) || s.desc.toLowerCase().includes(search)
  );

  const levelsInfo = [
    { code: "all", title: "All", label: "Every level" },
    { code: "n5", title: "N5", label: "Beginner" },
    { code: "n4", title: "N4", label: "Elementary" },
    { code: "n3", title: "N3", label: "Intermediate" },
    { code: "n2", title: "N2", label: "Upper Intermediate" },
    { code: "n1", title: "N1", label: "Advanced" },
  ];

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6">
      <div className="max-w-[1200px] mx-auto space-y-10">
        
        {/* Header & Hero */}
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div>
            <h1 className="font-heading text-3xl sm:text-4xl font-bold text-charcoal mb-2">
              Writing Practice
            </h1>
            <p className="text-secondary text-sm">
              Practice hiragana, katakana, and kanji with correct stroke order.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto md:min-w-[280px]">
            <form className="flex gap-2 flex-1 sm:flex-initial">
              <input
                type="search"
                name="search"
                defaultValue={search}
                placeholder="Search writing practice..."
                className="flex-1 min-w-0 px-4 py-2.5 border border-[var(--divider)] rounded-md text-charcoal bg-white text-sm"
              />
              <button type="submit" className="btn-primary px-4 shrink-0">
                Search
              </button>
            </form>
            <div className="flex gap-4 text-sm shrink-0">
              <Link href="/quiz" className="text-primary font-medium hover:underline">
                Take the Quiz →
              </Link>
              <Link href="/jlpt" className="text-primary font-medium hover:underline">
                Explore JLPT Levels →
              </Link>
            </div>
          </div>
        </div>

        {/* Level Tabs */}
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {levelsInfo.map((l) => {
              const active = level === l.code;
              return (
                <Link
                  key={l.code}
                  href={`/learn/writing?level=${l.code}`}
                  className={`card p-6 text-center flex flex-col justify-center items-center hover:shadow-md transition border-2 hover:no-underline ${
                    active
                      ? "border-[#D0021B] bg-[#D0021B] text-white"
                      : "border-[#EEEEEE] bg-white hover:border-[#D0021B]/40 text-[#1A1A1A]"
                  }`}
                >
                  <span className="text-3xl font-bold font-heading">{l.title}</span>
                  <span className={`text-xs mt-1.5 font-medium ${active ? "text-white/80" : "text-secondary"}`}>
                    {l.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recommended Section */}
        {level === "n5" && !search && (
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-bold text-charcoal">Recommended writing practice</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {levelSets.slice(0, 3).map((item) => (
                <Link
                  key={item.slug}
                  href={`/learn/writing/${item.slug}`}
                  className="card bg-white border border-[var(--divider)] p-5 rounded-2xl flex flex-col justify-between hover:shadow-md transition hover:no-underline group"
                >
                  <div>
                    <span className="text-[10px] font-bold text-primary bg-[#FFF7F7] border border-primary/15 px-2.5 py-0.5 rounded-full uppercase">
                      {item.level} • Writing • {item.chars.length} {item.type === "kanji" ? "kanji" : "characters"}
                    </span>
                    <h3 className="font-heading text-base font-bold text-charcoal mt-3 group-hover:text-primary transition">{item.title}</h3>
                    <p className="text-secondary text-xs mt-1 leading-relaxed line-clamp-2">{item.desc}</p>
                  </div>
                  <span className="text-primary text-xs font-bold mt-4 inline-block group-hover:underline">
                    Practice stroke order →
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Main Content Grid: Writing Sets */}
        <div className="space-y-4">
          <h2 className="font-heading text-xl font-bold text-charcoal">
            Writing sets
          </h2>

          {filteredSets.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSets.map((item) => (
                <Link
                  key={item.slug}
                  href={`/learn/writing/${item.slug}`}
                  className="card bg-white border border-[var(--divider)] p-5 rounded-2xl flex flex-col justify-between hover:shadow-md transition hover:no-underline group"
                >
                  <div>
                    <span className="text-[10px] font-bold text-secondary bg-base border border-[var(--divider)] px-2.5 py-0.5 rounded-full uppercase">
                      {item.level} • Writing • {item.chars.length} {item.type === "kanji" ? "kanji" : "characters"}
                    </span>
                    <h3 className="font-heading text-base font-bold text-charcoal mt-3 group-hover:text-primary transition">{item.title}</h3>
                    <p className="text-secondary text-xs mt-1 leading-relaxed line-clamp-2">{item.desc}</p>
                  </div>
                  <span className="text-primary text-xs font-bold mt-4 inline-block group-hover:underline">
                    Practice writing →
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="card p-12 text-center bg-white border border-[var(--divider)] rounded-3xl">
              <p className="text-secondary text-xs">No {level.toUpperCase()} writing practice found yet. Try another level or browse all lessons.</p>
              <Link href="/learn/writing" className="text-primary font-bold mt-2 inline-block hover:underline">
                Clear filters →
              </Link>
            </div>
          )}
        </div>

        {/* Premium CTA */}
        <LearnBundleCta level={level} />

      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
