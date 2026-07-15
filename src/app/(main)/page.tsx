import Link from "next/link";
import { headers } from "next/headers";
import { sql } from "@/lib/db";
import { HomeFaq } from "@/components/HomeFaq";
import { LeadMagnetForm } from "@/components/LeadMagnetForm";
import { RecentBlogSection } from "@/components/RecentBlogSection";
import { HomePricingSection } from "@/components/HomePricingSection";
import { OfferBannerBar } from "@/components/OfferBannerBar";
import {
  StepsSection,
  ExploreLearningSystemSection,
  NihongoNaviSection,
  QuizCTASection,
  WhyAvnishSection,
  PopularBeginnerLessonsSection,
  type PopularLesson,
} from "@/components/HomeSections";

// Curated, fixed picks — deliberately not a recency query, and restricted to
// content that isn't behind the daily-free-lesson gate so anonymous visitors
// can always open what they click.
const POPULAR_BEGINNER_LESSONS: PopularLesson[] = [
  { title: "Hiragana A–N Rows", href: "/learn/curriculum/lesson/n5-hiragana-an-rows", typeLabel: "Kana", level: "N5" },
  { title: "A は B です", href: "/learn/grammar/n5-grammar-a-b-5fs6s8", typeLabel: "Grammar", level: "N5" },
  { title: "Greetings and Introductions", href: "/learn/listening/n5-practice-listening-55a1277e-4216-4872-b272-d2c9f5c3265b", typeLabel: "Listening", level: "N5" },
  { title: "My Day", href: "/learn/reading/watashi-no-ichinichi", typeLabel: "Reading", level: "N5" },
  { title: "Numbers and Time", href: "/learn/curriculum/lesson/4425b37e-800d-4882-8b96-4b75d9adf63d", typeLabel: "Vocabulary", level: "N5" },
  { title: "Basic Kanji Numbers", href: "/learn/kanji/n5-kanji-9u8f3a", typeLabel: "Kanji", level: "N5" },
];

const isComingSoon = process.env.COMING_SOON === "true" || process.env.COMING_SOON === "1";

function ComingSoonView() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 bg-[#FAF8F5]">
      <div className="text-center max-w-lg">
        <p className="text-primary font-bold uppercase tracking-widest text-xs mb-4">日本語</p>
        <h1 className="font-heading text-4xl sm:text-5xl font-black text-charcoal mb-4">
          Something Great Is Coming
        </h1>
        <p className="text-secondary text-sm mb-8 leading-relaxed">
          We&apos;re building premium Japanese learning resources — interactive paths, daily streaks, quizzes, and premium passes. Stay tuned.
        </p>
        <p className="text-secondary text-xs">Coming soon</p>
      </div>
    </div>
  );
}

async function FullHomeView() {
  const headersList = await headers();
  const country = headersList.get("x-vercel-ip-country") || "IN";
  const defaultCurrency = country.toUpperCase() === "IN" ? "INR" : "USD";

  const settingsKeys = ["homepage_faq"];
  let plans: any[] = [];
  let settings: Record<string, unknown> = {};

  try {
    if (sql) {
      const [plansRows, settingsRows] = await Promise.all([
        sql`
          SELECT id, name, slug, billing_type, price_inr, price_usd, features, is_popular, sort_order
          FROM subscription_plans
          WHERE is_active = true
          ORDER BY sort_order
        `,
        sql`SELECT key, value FROM site_settings WHERE key = ANY(${settingsKeys})`,
      ]);
      plans = plansRows ?? [];
      (settingsRows as { key: string; value: unknown }[]).forEach((r) => { settings[r.key] = r.value; });
    }
  } catch (e) {
    console.error("Homepage queries failed:", e);
  }

  return (
    <div className="font-sans antialiased text-charcoal">
      <OfferBannerBar />
      {/* Upgraded Premium Hero */}
      <section className="relative overflow-hidden py-24 px-4 sm:px-6 bg-[#1A1A1A]">
        {/* Glow Effects */}
        <div
          className="pointer-events-none absolute -top-16 right-0 w-[400px] h-[400px] rounded-full opacity-60"
          style={{ background: "radial-gradient(circle, rgba(208,2,27,.2) 0%, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-20 left-24 w-[300px] h-[300px] rounded-full opacity-40"
          style={{ background: "radial-gradient(circle, rgba(200,163,95,.1) 0%, transparent 70%)" }}
        />

        <div className="max-w-5xl mx-auto relative grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-12 items-center">
          {/* Headline + Actions */}
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-white/10 text-white border border-white/5">
                🔥 Join a growing community
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase bg-[#D0021B]/20 text-[#FF6B6B] border border-[#D0021B]/10">
                JLPT N5 → N1
              </span>
            </div>

            <h1 className="font-heading text-4xl sm:text-5xl font-black text-white leading-tight">
              The structured path<br />
              to <span className="text-[#FF6B6B]">Japanese fluency</span>
            </h1>

            <p className="text-white/80 text-sm font-semibold tracking-wide">
              Structured Japanese Learning from N5 to N1.
            </p>

            <p className="text-white/70 text-sm leading-relaxed max-w-lg">
              Unlock unlimited Japanese learning with a premium pass. Get 150+ structured lessons from N5 to N1, interactive practice drills, community scoreboards, streaks, and badges.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link
                href="/quiz"
                className="btn-primary h-12 px-6 rounded-xl text-xs font-bold font-heading flex items-center justify-center shadow-md hover:bg-primary/95 transition-colors"
              >
                Find My Level → Quiz
              </Link>
              <a
                href="#pricing"
                className="h-12 px-6 rounded-xl text-xs font-bold font-heading flex items-center justify-center border-2 border-white/20 text-white hover:bg-white/5 transition-colors"
              >
                View Pricing Passes
              </a>
            </div>

            <div className="flex flex-wrap gap-5 text-[11px] font-medium text-white/50 pt-2">
              {["Fixed-duration passes", "Structured Pathways", "Secure checkout"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <span className="text-[#C8A35F]">✓</span> {t}
                </span>
              ))}
            </div>
          </div>

          {/* Right — Beautiful mock visual card of dashboard */}
          <div className="bg-white/5 border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden backdrop-blur-sm space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">Student Profile</span>
              </div>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[#C8A35F]/20 text-[#C8A35F] uppercase border border-[#C8A35F]/20">Active Pass</span>
            </div>

            {/* Simulated progress values */}
            <div className="space-y-3.5">
              <div>
                <span className="text-[10px] text-white/40 block">Course Target</span>
                <span className="text-xs font-black text-white block mt-0.5">JLPT N5 Pathway</span>
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between items-center text-[10px] mb-1">
                  <span className="text-white/40">Pathway Completion</span>
                  <span className="text-white/80 font-bold">42%</span>
                </div>
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="bg-[#D0021B] h-full w-[42%]" />
                </div>
              </div>

              {/* Badges preview */}
              <div>
                <span className="text-[10px] text-white/40 block mb-1">Recent Achievements</span>
                <div className="flex gap-1.5">
                  {["🔥", "🎓", "🗣️", "🏆"].map((emoji, idx) => (
                    <span key={idx} className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs">
                      {emoji}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works — 3 steps */}
      <StepsSection />

      {/* Explore the learning system */}
      <ExploreLearningSystemSection />

      {/* Nihongo Navi — dark section */}
      <NihongoNaviSection />

      {/* Quiz CTA */}
      <QuizCTASection />

      {/* Why Avnish */}
      <WhyAvnishSection />

      {/* Popular beginner lessons — curated, not recency-based */}
      <PopularBeginnerLessonsSection lessons={POPULAR_BEGINNER_LESSONS} />

      {/* Subscription Pricing Grid — after value props, before the ask */}
      <HomePricingSection plans={plans} defaultCurrency={defaultCurrency} />

      {/* Recent blog */}
      <RecentBlogSection />

      {/* FAQ */}
      <section className="py-20 px-4 sm:px-6 bg-white border-t border-[var(--divider)]">
        <div className="max-w-3xl mx-auto">
          <HomeFaq items={settings.homepage_faq as Parameters<typeof HomeFaq>[0]["items"]} />
        </div>
      </section>

      {/* Single lead-capture section — footer keeps its own small newsletter form */}
      <section id="free-pack" className="py-20 px-4 sm:px-6 bg-[#FAF8F5] border-t border-[var(--divider)]">
        <div className="max-w-md mx-auto">
          <LeadMagnetForm />
        </div>
      </section>
    </div>
  );
}

export default function HomePage() {
  return isComingSoon ? <ComingSoonView /> : <FullHomeView />;
}
export const dynamic = "force-dynamic";
