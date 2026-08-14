import Link from "next/link";

interface HeroDarkProps {
  megaProduct: {
    slug: string;
    name: string;
    price_paise: number;
    compare_price_paise?: number;
  } | null;
  isAdmin?: boolean;
}

const MEGA_HIGHLIGHTS = [
  "All Kanji, Vocab & Grammar",
  "Mock tests at every level",
  "Audio drills + Roadmap",
  "Lifetime access via Library",
];

export function HeroDark({ megaProduct, isAdmin = false }: HeroDarkProps) {
  const price = megaProduct ? `₹${Math.round(megaProduct.price_paise / 100)}` : "₹899";
  const compare = megaProduct?.compare_price_paise
    ? `₹${Math.round(megaProduct.compare_price_paise / 100)}`
    : "₹3,599";
  const megaSlug = megaProduct?.slug ?? "complete-japanese-n5-n1-mega-bundle";

  return (
    <section
      className="relative overflow-hidden py-[72px] px-4 sm:px-6"
      style={{ background: "#1A1A1A" }}
    >
      {/* Decorative radial glow */}
      <div
        className="pointer-events-none absolute -top-16 right-0 w-[400px] h-[400px] rounded-full opacity-100"
        style={{ background: "radial-gradient(circle, rgba(208,2,27,.18) 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-20 left-24 w-[300px] h-[300px] rounded-full"
        style={{ background: "radial-gradient(circle, rgba(200,163,95,.08) 0%, transparent 70%)" }}
      />

      <div className="max-w-[1100px] mx-auto relative grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-12 items-center">
        {/* Left — headline + CTAs */}
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-[.06em] uppercase bg-white/15 text-white">
              ⭐ Growing community
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-[.06em] uppercase bg-white/15 text-white">
              JLPT N5 → N1
            </span>
          </div>

          <h1 className="font-serif text-[38px] sm:text-[52px] font-normal text-white leading-[1.12] mb-5">
            The structured path<br />
            to{" "}
            <em className="not-italic" style={{ color: "#ff6b6b" }}>
              Japanese fluency
            </em>
          </h1>

          <p className="text-white/70 text-[17px] leading-[1.75] mb-8 max-w-[480px]">
            A structured Premium Pass from N5 to N1, a placement quiz, AI tutor, and a clear
            day-by-day roadmap — everything in one place.
          </p>

          <div className="flex flex-wrap gap-3 mb-7">
            <Link
              href="/quiz"
              className="inline-flex items-center gap-2 bg-primary text-white font-bold rounded-lg px-6 py-3.5 text-[16px] hover:bg-primary/90 transition-colors"
            >
              Find my level → Quiz
            </Link>
            {isAdmin && (
              <Link
                href="/store"
                className="inline-flex items-center gap-2 font-bold rounded-lg px-6 py-3.5 text-[16px] transition-colors border-2 border-white/55 text-white hover:bg-white/10"
              >
                Browse bundles
              </Link>
            )}
          </div>

          <div className="flex flex-wrap gap-5 text-[13px] text-white/50">
            {["Learn online anytime", "Keep your progress", "Secure checkout"].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <span className="text-[#C8A35F]">✓</span> {t}
              </span>
            ))}
          </div>
        </div>

        {/* Right — Mega bundle card + Quiz card */}
        <div className="flex flex-col gap-4">
          {/* Mega bundle card */}
          {isAdmin && megaProduct && (
            <div
              className="rounded-2xl p-7 border-2 border-[#C8A35F] relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, #1e1e1e, #2a2a2a)" }}
            >
              <div className="flex justify-between items-start mb-4">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-[.06em] uppercase bg-[#fffdf0] text-[#92610a]">
                  ⭐ Best Value
                </span>
                <span className="text-[12px] text-white/40 font-semibold">Save 60%</span>
              </div>
              <div className="font-serif text-[20px] text-white mb-1.5 leading-snug">
                Complete N5→N1 Mega Bundle
              </div>
              <div className="text-[13px] text-white/50 mb-4">
                Everything from beginner to advanced in one pack
              </div>
              {MEGA_HIGHLIGHTS.map((f) => (
                <div
                  key={f}
                  className="text-[13px] text-white/70 py-[5px] border-b border-white/[.06] flex gap-2"
                >
                  <span className="text-[#C8A35F]">✓</span>
                  {f}
                </div>
              ))}
              <div className="mt-5 flex items-center justify-between">
                <div>
                  <span className="text-[28px] font-extrabold text-white">{price}</span>
                  <span className="text-[14px] text-white/30 line-through ml-2">{compare}</span>
                </div>
                <Link
                  href={`/product/${megaSlug}`}
                  className="inline-flex items-center gap-1 bg-primary text-white font-bold rounded-lg px-4 py-2 text-[13px] hover:bg-primary/90 transition-colors"
                >
                  Buy Mega →
                </Link>
              </div>
            </div>
          )}

          {/* Quiz card */}
          <div className="rounded-xl p-5 flex items-center justify-between border border-white/10 bg-white/5">
            <div>
              <div className="text-[13px] text-white/50 mb-1">Not sure your level?</div>
              <div className="text-[15px] text-white font-bold">Take the 3-minute quiz</div>
            </div>
            <Link
              href="/quiz"
              className="inline-flex items-center gap-1 font-bold rounded-lg px-4 py-2 text-[13px] transition-colors border-2 border-white/55 text-white hover:bg-white/10 whitespace-nowrap"
            >
              Start →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
