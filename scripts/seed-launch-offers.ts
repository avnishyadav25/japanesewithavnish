// Seeds 3 draft marketing newsletters (launch announcement, first-50-users free month,
// top-3-leaderboard contest) and the FIRST50FREE coupon backing the second campaign.
// Run: npx tsx scripts/seed-launch-offers.ts
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required (.env / .env.local)");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

const MONTHLY_PLAN_ID = "cf8e19c3-d012-4477-bf63-a004122a0ef4"; // 30-Day Premium Pass / monthly-premium

const newsletters = [
  {
    slug: "launch-announcement",
    title: "Launch Announcement",
    subject: "Japanese with Avnish is live — your JLPT path from N5 to N1",
    body_html: `
      <h2>We're live 🎉</h2>
      <p>Japanese with Avnish is a structured JLPT learning platform built around one idea: you shouldn't have to stitch together five different apps to learn Japanese properly.</p>
      <p>Here's what's inside:</p>
      <ul>
        <li><strong>A full curriculum</strong> from N5 to N1 — Level → Module → Submodule → Lesson, with checkpoint quizzes and mock exams along the way.</li>
        <li><strong>Kanji practice</strong> with real stroke-order tracing, not just flashcards.</li>
        <li><strong>Vocabulary and grammar libraries</strong> tagged by JLPT level, searchable, with audio.</li>
        <li><strong>Nihongo Navi</strong> — an AI study partner you can ask anything, correct sentences with, or get quizzed by.</li>
        <li><strong>A dashboard</strong> that tracks your real progress — streaks, XP, and badges, not just a syllabus.</li>
      </ul>
      <p>Jump in and pick your level to get started.</p>
    `.trim(),
  },
  {
    slug: "first-50-users-free-month",
    title: "First 50 Users Free Month",
    subject: "The first 50 people get a free month of Premium — no catch",
    body_html: `
      <h2>First 50 users get a free month, on us</h2>
      <p>To celebrate launch, we're giving the first 50 people who use the code below a completely free month of Premium — every lesson, unlimited Nihongo Navi messages, the works.</p>
      <p style="font-size:20px; font-weight:bold; letter-spacing:1px; text-align:center; padding:16px; border:2px dashed #D0021B; border-radius:12px; margin:24px 0;">FIRST50FREE</p>
      <p>Just enter the code at checkout on the 30-Day Premium Pass. It's first-come, first-served — once the 50th person redeems it, the code stops working.</p>
      <p>No credit card tricks, no auto-renewal surprise — it's a genuinely free month to see if the structured path works for you.</p>
    `.trim(),
  },
  {
    slug: "top-3-leaderboard-contest",
    title: "Top 3 Leaderboard Contest",
    subject: "Top 3 learners each month win 30 days of Premium, free",
    body_html: `
      <h2>Every month, the top 3 most active learners win a free month</h2>
      <p>We track XP earned from completed lessons, practices, and quizzes. At the end of each month, whoever finishes in the top 3 on the XP leaderboard gets 30 days of Premium access, completely free.</p>
      <p>No entry required — just study consistently. Your streak and XP are already tracking on <a href="https://japanesewithavnish.com/learn/dashboard">your dashboard</a>.</p>
      <p>Want to see where you currently stand? Check the <a href="https://japanesewithavnish.com/scoreboard">live scoreboard</a> anytime.</p>
    `.trim(),
  },
];

async function main() {
  for (const n of newsletters) {
    await sql`
      INSERT INTO newsletters (slug, title, subject, body_html, status)
      VALUES (${n.slug}, ${n.title}, ${n.subject}, ${n.body_html}, 'draft')
      ON CONFLICT (slug) DO NOTHING
    `;
    console.log(`Newsletter seeded (or already existed): ${n.slug}`);
  }

  await sql`
    INSERT INTO coupons (code, discount_type, discount_value, product_ids, max_uses, expires_at)
    VALUES ('FIRST50FREE', 'percent', 100, ARRAY[${MONTHLY_PLAN_ID}]::uuid[], 50, NOW() + INTERVAL '30 days')
    ON CONFLICT (code) DO NOTHING
  `;
  console.log("Coupon seeded (or already existed): FIRST50FREE");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
