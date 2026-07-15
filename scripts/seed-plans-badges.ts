import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is required in .env");
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function run() {
  console.log("🌱 Seeding subscription plans and initial badges...");

  // 1. Seed Subscription Plans
  const plans = [
    {
      name: "Monthly Premium Pass",
      slug: "monthly-premium",
      billing_type: "monthly",
      price_inr: 9900, // ₹99.00 in paise
      price_usd: 299,  // $2.99 in cents
      currency_mode: "both",
      trial_days: 7,
      is_active: true,
      is_popular: false,
      sort_order: 10,
      features: ["30 Days Unlimited access", "Unlimited N5-N1 curriculum access", "Learn any lesson without waiting", "Unlimited practice drills", "Unlimited listening practice", "Unlimited Nihongo Navi", "Full progress and review tools", "Leaderboards, XP, badges and streaks"]
    },
    {
      name: "Yearly Premium Pass",
      slug: "yearly-premium",
      billing_type: "yearly",
      price_inr: 79900, // ₹799.00 in paise
      price_usd: 1999,  // $19.99 in cents
      currency_mode: "both",
      trial_days: 7,
      is_active: true,
      is_popular: true,
      sort_order: 20,
      features: ["365 Days Unlimited access", "Unlimited N5-N1 curriculum access", "Learn any lesson without waiting", "Unlimited practice drills", "Unlimited listening practice", "Unlimited Nihongo Navi", "Full progress and review tools", "Leaderboards, XP, badges and streaks"]
    },
    {
      name: "Lifetime Premium Pass",
      slug: "lifetime-premium",
      billing_type: "lifetime",
      price_inr: 399900, // ₹3999.00 in paise
      price_usd: 4900,   // $49.00 in cents
      currency_mode: "both",
      trial_days: 0,
      is_active: true,
      is_popular: false,
      sort_order: 30,
      features: ["Permanent Unlimited access", "Never pay again", "Unlimited N5-N1 curriculum access", "Learn any lesson without waiting", "Unlimited practice drills", "Unlimited listening practice", "Unlimited Nihongo Navi", "Full progress and review tools", "Leaderboards, XP, badges and streaks"]
    }
  ];

  console.log("Seeding subscription plans...");
  for (const plan of plans) {
    await sql`
      INSERT INTO subscription_plans (name, slug, billing_type, price_inr, price_usd, currency_mode, trial_days, is_active, is_popular, sort_order, features, updated_at)
      VALUES (
        ${plan.name}, 
        ${plan.slug}, 
        ${plan.billing_type}, 
        ${plan.price_inr}, 
        ${plan.price_usd}, 
        ${plan.currency_mode}, 
        ${plan.trial_days}, 
        ${plan.is_active}, 
        ${plan.is_popular}, 
        ${plan.sort_order}, 
        ${plan.features}, 
        NOW()
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        billing_type = EXCLUDED.billing_type,
        price_inr = EXCLUDED.price_inr,
        price_usd = EXCLUDED.price_usd,
        currency_mode = EXCLUDED.currency_mode,
        trial_days = EXCLUDED.trial_days,
        is_active = EXCLUDED.is_active,
        is_popular = EXCLUDED.is_popular,
        sort_order = EXCLUDED.sort_order,
        features = EXCLUDED.features,
        updated_at = NOW()
    `;
  }
  console.log("✅ Subscription plans seeded.");

  // 2. Seed Initial Badges
  const badges = [
    {
      name: "N5 Starter",
      slug: "n5-starter",
      description: "Complete your first N5 lesson",
      emoji: "🌱",
      color: "#4CAF50",
      icon_type: "emoji",
      category: "level",
      trigger_type: "automatic",
      condition: { type: "lesson_count", count: 1, level: "N5" }
    },
    {
      name: "N5 Finisher",
      slug: "n5-finisher",
      description: "Complete all N5 lessons",
      emoji: "🎓",
      color: "#2196F3",
      icon_type: "emoji",
      category: "level",
      trigger_type: "automatic",
      condition: { type: "level_complete", level: "N5" }
    },
    {
      name: "Kana Master",
      slug: "kana-master",
      description: "Complete all Hiragana & Katakana lessons",
      emoji: "🎌",
      color: "#D0021B",
      icon_type: "emoji",
      category: "skill",
      trigger_type: "automatic",
      condition: { type: "kana_complete" }
    },
    {
      name: "3-Day Spark",
      slug: "3-day-spark",
      description: "Maintain a 3-day learning streak",
      emoji: "🔥",
      color: "#FF9800",
      icon_type: "emoji",
      category: "streak",
      trigger_type: "automatic",
      condition: { type: "streak", days: 3 }
    },
    {
      name: "7-Day Streak",
      slug: "7-day-streak",
      description: "Maintain a 7-day learning streak",
      emoji: "⚡",
      color: "#FF5722",
      icon_type: "emoji",
      category: "streak",
      trigger_type: "automatic",
      condition: { type: "streak", days: 7 }
    }
  ];

  console.log("Seeding badges...");
  for (const b of badges) {
    await sql`
      INSERT INTO badges (name, slug, description, emoji, color, icon_type, category, trigger_type, condition, is_active)
      VALUES (
        ${b.name},
        ${b.slug},
        ${b.description},
        ${b.emoji},
        ${b.color},
        ${b.icon_type},
        ${b.category},
        ${b.trigger_type},
        ${JSON.stringify(b.condition)},
        true
      )
      ON CONFLICT (slug) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        emoji = EXCLUDED.emoji,
        color = EXCLUDED.color,
        icon_type = EXCLUDED.icon_type,
        category = EXCLUDED.category,
        trigger_type = EXCLUDED.trigger_type,
        condition = EXCLUDED.condition,
        is_active = EXCLUDED.is_active
    `;
  }
  console.log("✅ Initial badges seeded.");

  console.log("🎉 Seeding completed successfully!");
}

run().catch(console.error);
