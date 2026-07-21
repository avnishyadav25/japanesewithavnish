import { headers } from "next/headers";
import { sql } from "@/lib/db";
import { HomeFaq } from "@/components/HomeFaq";
import { LeadMagnetForm } from "@/components/LeadMagnetForm";
import { RecentBlogSection } from "@/components/RecentBlogSection";
import { HomePricingSection } from "@/components/HomePricingSection";
import { OfferBannerBar } from "@/components/OfferBannerBar";
import { HomeHeroSlider } from "@/components/HomeHeroSlider";
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
      {/* Upgraded Premium Hero — slider: current hero + FIRST500FREE promo */}
      <HomeHeroSlider />

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
