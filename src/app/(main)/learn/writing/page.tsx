import Link from "next/link";
import { getSession } from "@/lib/auth/session";
import { LearnBundleCta } from "@/components/learn/LearnBundleCta";

const SETS = [
  {
    slug: "hiragana-a-row",
    title: "Hiragana A Row",
    level: "N5",
    charsCount: 5,
    desc: "Practice stroke order guides for vowels (あ, い, う, え, お).",
  },
  {
    slug: "hiragana-k-row",
    title: "Hiragana K Row",
    level: "N5",
    charsCount: 5,
    desc: "Practice KA, KI, KU, KE, KO character sequences.",
  },
  {
    slug: "hiragana-s-row",
    title: "Hiragana S Row",
    level: "N5",
    charsCount: 5,
    desc: "Practice SA, SHI, SU, SE, SO character sequences.",
  },
  {
    slug: "katakana-basics",
    title: "Katakana Basics",
    level: "N5",
    charsCount: 5,
    desc: "Brush stroke practices for vowels (ア, イ, ウ, エ, オ).",
  },
  {
    slug: "basic-kanji-numbers",
    title: "Basic Kanji Numbers",
    level: "N5",
    charsCount: 10,
    desc: "Learn tracing number characters (一 through 十).",
  },
];

export default async function LearnWritingPage({
  searchParams,
}: {
  searchParams?: Promise<{ level?: string; search?: string }>;
}) {
  const sp = await searchParams;
  const level = (sp?.level || "n5").toUpperCase();
  const search = (sp?.search || "").toLowerCase().trim();

  // Filter sets by level & search query
  const filteredSets = SETS.filter((s) => {
    const matchesLevel = s.level === level;
    const matchesSearch = !search || s.title.toLowerCase().includes(search) || s.desc.toLowerCase().includes(search);
    return matchesLevel && matchesSearch;
  });

  const levelsInfo = [
    { code: "N5", label: "Beginner" },
    { code: "N4", label: "Elementary" },
    { code: "N3", label: "Intermediate" },
    { code: "N2", label: "Upper Intermediate" },
    { code: "N1", label: "Advanced" },
  ];

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6 bg-[#FAF8F5]">
      <div className="max-w-[1200px] mx-auto space-y-10">
        
        {/* Header */}
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
            </div>
          </div>
        </div>

        {/* Level Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
          {levelsInfo.map((l) => {
            const active = level === l.code;
            return (
              <Link
                key={l.code}
                href={`/learn/writing?level=${l.code.toLowerCase()}`}
                className={`card p-6 text-center flex flex-col justify-center items-center hover:shadow-md transition border-2 ${
                  active
                    ? "border-primary bg-[#FFF7F7] ring-1 ring-primary/20"
                    : "border-[var(--divider)] bg-white hover:border-primary/50"
                }`}
              >
                <span className="text-3xl font-bold text-charcoal">{l.code}</span>
                <span className="text-secondary text-xs mt-1.5 font-medium">{l.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Recommended Sets */}
        {level === "N5" && !search && (
          <div className="space-y-4">
            <h2 className="font-heading text-xl font-bold text-charcoal">Recommended writing</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {SETS.slice(0, 3).map((item) => (
                <div key={item.slug} className="card bg-white border border-[var(--divider)] p-5 rounded-2xl flex flex-col justify-between hover:shadow-md transition">
                  <div>
                    <span className="text-[10px] font-bold text-primary bg-[#FFF7F7] border border-primary/15 px-2.5 py-0.5 rounded-full uppercase">
                      {item.level} • Writing
                    </span>
                    <h3 className="font-heading text-base font-bold text-charcoal mt-3">{item.title}</h3>
                    <p className="text-secondary text-xs mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                  <div className="mt-4 flex justify-between items-center text-xs">
                    <span className="text-secondary font-bold">{item.charsCount} characters</span>
                    <Link href={`/learn/writing/${item.slug}`} className="text-primary font-bold hover:underline">
                      Practice stroke order →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sets Grid */}
        <div className="space-y-4">
          <h2 className="font-heading text-xl font-bold text-charcoal">
            Practice Sets ({filteredSets.length})
          </h2>

          {filteredSets.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredSets.map((item) => (
                <div key={item.slug} className="card bg-white border border-[var(--divider)] p-5 rounded-2xl flex flex-col justify-between hover:shadow-md transition">
                  <div>
                    <span className="text-[10px] font-bold text-secondary bg-base border border-[var(--divider)] px-2.5 py-0.5 rounded-full uppercase">
                      {item.level} • {item.charsCount} Chars
                    </span>
                    <h3 className="font-heading text-base font-bold text-charcoal mt-3">{item.title}</h3>
                    <p className="text-secondary text-xs mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                  <div className="mt-4 flex justify-between items-center text-xs">
                    <span className="text-secondary font-bold">Set: {item.title}</span>
                    <Link href={`/learn/writing/${item.slug}`} className="text-primary font-bold hover:underline">
                      Practice writing →
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-12 text-center bg-white border border-[var(--divider)] rounded-3xl">
              <p className="text-secondary text-xs">No writing sets found for this level yet.</p>
            </div>
          )}
        </div>

        {/* Subscription Pass Cta */}
        <LearnBundleCta level={level.toLowerCase() as any} />

      </div>
    </div>
  );
}
export const dynamic = "force-dynamic";
