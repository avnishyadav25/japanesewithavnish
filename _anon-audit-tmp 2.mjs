import { chromium } from "playwright";
import fs from "fs";

const BASE = process.env.BASE_URL || "http://localhost:3001";

// Each entry: { template: 'src/app/(main)/.../page.tsx', url: '/path', note: 'optional' }
const PAGES = [
  // ---- static pages (44) ----
  { template: "(main)/page.tsx", url: "/" },
  { template: "(main)/about/page.tsx", url: "/about" },
  { template: "(main)/access/page.tsx", url: "/access" },
  { template: "(main)/account/page.tsx", url: "/account" },
  { template: "(main)/badge/page.tsx", url: "/badge" },
  { template: "(main)/badges/page.tsx", url: "/badges" },
  { template: "(main)/billing/page.tsx", url: "/billing" },
  { template: "(main)/blog/page.tsx", url: "/blog" },
  { template: "(main)/checkout/page.tsx", url: "/checkout" },
  { template: "(main)/coming-soon/page.tsx", url: "/coming-soon" },
  { template: "(main)/contact/page.tsx", url: "/contact" },
  { template: "(main)/free-n5-pack/page.tsx", url: "/free-n5-pack" },
  { template: "(main)/guide/page.tsx", url: "/guide" },
  { template: "(main)/jlpt/page.tsx", url: "/jlpt" },
  { template: "(main)/learn/page.tsx", url: "/learn" },
  { template: "(main)/learn/analytics/page.tsx", url: "/learn/analytics" },
  { template: "(main)/learn/curriculum/page.tsx", url: "/learn/curriculum" },
  { template: "(main)/learn/dashboard/page.tsx", url: "/learn/dashboard" },
  { template: "(main)/learn/exam/page.tsx", url: "/learn/exam" },
  { template: "(main)/learn/grammar-drills/page.tsx", url: "/learn/grammar-drills" },
  { template: "(main)/learn/kana/page.tsx", url: "/learn/kana" },
  { template: "(main)/learn/kana/hiragana/page.tsx", url: "/learn/kana/hiragana" },
  { template: "(main)/learn/kana/kanji/page.tsx", url: "/learn/kana/kanji" },
  { template: "(main)/learn/kana/katakana/page.tsx", url: "/learn/kana/katakana" },
  { template: "(main)/learn/listening/page.tsx", url: "/learn/listening" },
  { template: "(main)/learn/onboarding/page.tsx", url: "/learn/onboarding" },
  { template: "(main)/learn/reading/sandbox/page.tsx", url: "/learn/reading/sandbox" },
  { template: "(main)/learn/shadowing/page.tsx", url: "/learn/shadowing" },
  { template: "(main)/learn/writing/page.tsx", url: "/learn/writing" },
  { template: "(main)/library/page.tsx", url: "/library" },
  { template: "(main)/login/page.tsx", url: "/login" },
  { template: "(main)/order/resend/page.tsx", url: "/order/resend" },
  { template: "(main)/payment-failed/page.tsx", url: "/payment-failed" },
  { template: "(main)/payment-pending/page.tsx", url: "/payment-pending" },
  { template: "(main)/pricing/page.tsx", url: "/pricing" },
  { template: "(main)/quiz/page.tsx", url: "/quiz" },
  { template: "(main)/quiz/result/page.tsx", url: "/quiz/result" },
  { template: "(main)/reset-password/page.tsx", url: "/reset-password" },
  { template: "(main)/review/page.tsx", url: "/review" },
  { template: "(main)/scoreboard/page.tsx", url: "/scoreboard" },
  { template: "(main)/start-here/page.tsx", url: "/start-here" },
  { template: "(main)/store/page.tsx", url: "/store", note: "expect 404 (feature-flagged, intentional)" },
  { template: "(main)/thank-you/page.tsx", url: "/thank-you" },
  { template: "(main)/tutor/page.tsx", url: "/tutor" },

  // ---- dynamic-segment pages (13 templates, 1-2 samples each) ----
  { template: "(main)/blog/[slug]/page.tsx", url: "/blog/building-japanese-with-avnish-as-a-learner" },
  { template: "(main)/blog/[slug]/page.tsx", url: "/blog/my-journey-from-n5-to-n3" },
  { template: "(main)/blog/[slug]/[postSlug]/page.tsx", url: "/blog/study_guide/n1-jlpt-n1-full-mock-exam-ex", note: "study_guide stays under /blog" },
  { template: "(main)/blog/[slug]/[postSlug]/page.tsx", url: "/blog/grammar/n3-grammar-v-ewu30k", note: "expect permanent redirect -> /learn/grammar/n3-grammar-v-ewu30k" },
  { template: "(main)/guide/[slug]/page.tsx", url: "/guide/dashboard-xp-rewards" },
  { template: "(main)/guide/[slug]/page.tsx", url: "/guide/listening-reading-writing-practice" },
  { template: "(main)/learn/[type]/page.tsx", url: "/learn/grammar" },
  { template: "(main)/learn/[type]/page.tsx", url: "/learn/vocabulary" },
  { template: "(main)/learn/[type]/[slug]/page.tsx", url: "/learn/grammar/n3-grammar-v-ewu30k" },
  { template: "(main)/learn/[type]/[slug]/page.tsx", url: "/learn/kanji/kanji-n1-6feb" },
  { template: "(main)/learn/curriculum/[level]/page.tsx", url: "/learn/curriculum/n5" },
  { template: "(main)/learn/curriculum/[level]/page.tsx", url: "/learn/curriculum/n3" },
  { template: "(main)/learn/curriculum/lesson/[id]/page.tsx", url: "/learn/curriculum/lesson/bbdb4313-bca0-42b0-88da-ad5af6c9a083" },
  { template: "(main)/learn/listening/[slug]/page.tsx", url: "/learn/listening/n5-practice-listening-b5a8cdc9-8c2b-4d96-8485-6fb617243c9d" },
  { template: "(main)/learn/writing/[slug]/page.tsx", url: "/learn/writing/introducing-myself" },
  { template: "(main)/order/[orderId]/page.tsx", url: "/order/00000000-0000-0000-0000-000000000000", note: "fake orderId, gated by email/token; expect graceful not-found, not a crash" },
  { template: "(main)/order/[orderId]/pay/page.tsx", url: "/order/00000000-0000-0000-0000-000000000000/pay", note: "fake orderId, gated; expect graceful not-found, not a crash" },
  { template: "(main)/policies/[slug]/page.tsx", url: "/policies/privacy" },
  { template: "(main)/policies/[slug]/page.tsx", url: "/policies/terms" },
  { template: "(main)/product/[slug]/page.tsx", url: "/product/anything", note: "expect 404 (feature-flagged, intentional)" },
];

function isHydrationWarning(text) {
  const t = text.toLowerCase();
  return (
    t.includes("hydration") ||
    t.includes("did not match") ||
    t.includes("text content does not match") ||
    t.includes("server rendered") ||
    (t.includes("expected server html") )
  );
}

async function checkPage(browser, entry) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  let httpStatus = null;
  let redirectedTo = null;

  const failedRequests = [];
  page.on("console", (msg) => {
    const type = msg.type();
    if (type === "error" || type === "warning") {
      consoleMessages.push({ type, text: msg.text() });
    }
  });
  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      failedRequests.push({ url: response.url(), status: response.status() });
    }
  });

  let navError = null;
  let res = null;
  try {
    res = await page.goto(BASE + entry.url, { waitUntil: "load", timeout: 20000 });
  } catch (e) {
    navError = String(e.message || e);
  }
  // let client-side fetches / hydration settle
  await page.waitForTimeout(2500);

  if (res) {
    httpStatus = res.status();
    const finalUrl = page.url();
    if (finalUrl !== BASE + entry.url) {
      redirectedTo = finalUrl.replace(BASE, "");
    }
  }

  await context.close();

  const hydrationWarnings = consoleMessages.filter((m) => isHydrationWarning(m.text));

  return {
    ...entry,
    httpStatus,
    navError,
    redirectedTo,
    consoleErrors: consoleMessages.filter((m) => m.type === "error"),
    consoleWarnings: consoleMessages.filter((m) => m.type === "warning"),
    pageErrors,
    hydrationWarnings,
    failedRequests,
  };
}

async function main() {
  const browser = await chromium.launch();
  const results = [];
  for (const entry of PAGES) {
    process.stderr.write(`Checking ${entry.url} ...\n`);
    try {
      const r = await checkPage(browser, entry);
      results.push(r);
    } catch (e) {
      results.push({ ...entry, httpStatus: null, navError: String(e.message || e), consoleErrors: [], consoleWarnings: [], pageErrors: [], hydrationWarnings: [] });
    }
  }
  await browser.close();
  fs.writeFileSync(
    "/private/tmp/claude-501/-Users-avnishyadav2561995gmail-com-Desktop-Workspace-avnishyadav25-japanesewithavnish/79c55ce0-72cf-4519-be7f-526a3ba21c73/scratchpad/anon-audit-results.json",
    JSON.stringify(results, null, 2)
  );
  console.log("DONE", results.length, "pages checked");
}

main().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
