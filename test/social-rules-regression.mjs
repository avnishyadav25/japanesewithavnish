/**
 * Social engine rules regression test.
 *
 * Pure — no DB, no dev server, no API keys, no cost. It exercises the one part of the engine
 * that is both easy to get subtly wrong and impossible to notice when it is: the enforcement
 * that turns "the prompt asked for 280 characters" into "this is 280 characters".
 *
 * The bugs this exists to catch are all silent ones:
 *   - counting UTF-16 code units instead of graphemes, which makes every emoji cost four
 *     characters and quietly truncates a third off any caption that uses them
 *   - trimming through the middle of a URL, producing a dead link that still costs full length
 *   - hashtag stacks that exceed a platform's cap, or contain tags platforms won't linkify
 *   - a "clamp" that reports success while having changed nothing
 *
 * Run: npm run test:social-rules  (or: node test/social-rules-regression.mjs)
 */
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";
import path from "path";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

let passed = 0;
let failed = 0;

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    passed += 1;
    console.log(`  ok    ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}\n          expected ${JSON.stringify(expected)}\n          actual   ${JSON.stringify(actual)}`);
  }
}

function assert(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok    ${name}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? `\n          ${detail}` : ""}`);
  }
}

/**
 * The modules are TypeScript, so they run through tsx in a child process that prints JSON.
 * Keeps this file dependency-free and runnable with plain `node`.
 */
function evalInProject(source) {
  const out = execFileSync(
    path.join(root, "node_modules/.bin/tsx"),
    ["--eval", source],
    { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }
  );
  const line = out.trim().split("\n").filter(Boolean).pop();
  return JSON.parse(line);
}

console.log("\nSocial engine rules\n");

// ---------------------------------------------------------------------------
console.log("Grapheme counting");
const counts = evalInProject(`
  import { countChars } from "./src/lib/social/clamp";
  console.log(JSON.stringify({
    ascii: countChars("hello"),
    family: countChars("\\u{1F468}\\u200D\\u{1F469}\\u200D\\u{1F467}"),
    flag: countChars("\\u{1F1EF}\\u{1F1F5}"),
    kana: countChars("\\u3053\\u3093\\u306B\\u3061\\u306F"),
    devanagari: countChars("\\u0928\\u092E\\u0938\\u094D\\u0924\\u0947"),
    devanagariCodeUnits: "\\u0928\\u092E\\u0938\\u094D\\u0924\\u0947".length,
    empty: countChars(""),
  }));
`);
check("plain ascii", counts.ascii, 5);
// String.length is 8 here. Counting code units would burn 8 of a 280 budget on one emoji.
check("family emoji (ZWJ sequence) counts as 1", counts.family, 1);
check("flag emoji counts as 1", counts.flag, 1);
check("kana counts per character", counts.kana, 5);
// नमस्ते: 6 code points, but the virama binds स्ते into one conjunct cluster. The exact number
// depends on the Unicode version's conjunct rules, so assert the property that matters — that
// combining marks are folded in — rather than a count that a future ICU update could revise.
assert(
  "devanagari combining marks fold into their base",
  counts.devanagari < counts.devanagariCodeUnits && counts.devanagari > 0,
  `graphemes ${counts.devanagari} vs code units ${counts.devanagariCodeUnits}`
);
check("empty string", counts.empty, 0);

// ---------------------------------------------------------------------------
console.log("\nWord-boundary trimming");
const trims = evalInProject(`
  import { clampAtWord } from "./src/lib/social/clamp";
  const long = "Learn ten essential N5 words that you will genuinely use every single day in Japan";
  console.log(JSON.stringify({
    untouched: clampAtWord("short enough", 50),
    trimmed: clampAtWord(long, 40),
    trimmedLen: Array.from(clampAtWord(long, 40)).length,
    midUrl: clampAtWord("Read the full guide at https://japanesewithavnish.com/learn/n5-vocabulary now", 40),
  }));
`);
check("text under the limit is returned unchanged", trims.untouched, "short enough");
assert("trimmed text fits the limit", trims.trimmedLen <= 40, `got ${trims.trimmedLen} chars: ${trims.trimmed}`);
assert("trimmed text ends with an ellipsis", trims.trimmed.endsWith("…"), trims.trimmed);
assert("trimmed text does not end mid-word", !/\s\S{1,2}…$/.test(trims.trimmed), trims.trimmed);
// A half-URL is worse than no URL: it looks clickable, isn't, and still costs the characters.
assert(
  "a cut landing inside a URL drops the whole URL",
  !trims.midUrl.includes("japanesewithavnish.com/learn"),
  trims.midUrl
);

// ---------------------------------------------------------------------------
console.log("\nSurface enforcement");
const surface = evalInProject(`
  import { enforceSurface } from "./src/lib/social/clamp";
  const overlong = "x".repeat(400);
  const xPost = enforceSurface("x.post", "en", { content: { text: overlong }, hashtags: ["#JLPT"] });
  const ig = enforceSurface("instagram.reel", "en", {
    content: { hook: "Ten words", caption: "A normal caption", cta: "Link in bio" },
    hashtags: ["#JLPT", "#jlpt", "#a b", "#JLPTN5", "#LearnJapanese", "#Nihongo", "#Kanji", "#Extra", "#Toomany"],
  });
  const reddit = enforceSurface("reddit.post", "en", {
    content: { title: "A genuinely useful chart", body: "Body text" },
    hashtags: ["#JLPT"],
  });
  console.log(JSON.stringify({
    xRejected: xPost.rejected,
    xViolation: xPost.violations[0]?.action,
    igTagCount: ig.hashtags.length,
    igHasDuplicate: ig.hashtags.filter((t) => t.toLowerCase() === "#jlpt").length,
    igHasMalformed: ig.hashtags.some((t) => t.includes(" ")),
    redditTags: ig ? reddit.hashtags.length : -1,
    igCaptionKept: ig.content.caption,
  }));
`);
// x.post has overflow "reject": a truncated tweet is a broken thought, so it fails loudly.
check("an over-length X post is rejected, not silently trimmed", surface.xRejected, true);
check("the rejection is reported as such", surface.xViolation, "rejected");
check("hashtags are capped at the surface maximum", surface.igTagCount, 6);
check("case-insensitive duplicate tags are removed", surface.igHasDuplicate, 1);
check("tags containing whitespace are dropped", surface.igHasMalformed, false);
check("Reddit gets no hashtags at all", surface.redditTags, 0);
check("in-range fields are left alone", surface.igCaptionKept, "A normal caption");

// ---------------------------------------------------------------------------
console.log("\nUTM links");
const utm = evalInProject(`
  import { buildUtmLink } from "./src/lib/social/clamp";
  console.log(JSON.stringify({
    fromPath: buildUtmLink("/learn/n5-vocabulary", "instagram", "30day_n5vocab", "https://japanesewithavnish.com"),
    fromAbsolute: buildUtmLink("https://japanesewithavnish.com/blog/x", "x", null, "https://japanesewithavnish.com"),
    empty: buildUtmLink("", "x", null, "https://japanesewithavnish.com"),
  }));
`);
assert("utm_source is the platform", utm.fromPath.includes("utm_source=instagram"), utm.fromPath);
assert("utm_medium is social", utm.fromPath.includes("utm_medium=social"), utm.fromPath);
assert("campaign is applied when present", utm.fromPath.includes("utm_campaign=30day_n5vocab"), utm.fromPath);
assert("campaign is omitted when absent", !utm.fromAbsolute.includes("utm_campaign"), utm.fromAbsolute);
check("an empty link stays empty", utm.empty, "");

// ---------------------------------------------------------------------------
console.log("\nRules table integrity");
const rules = evalInProject(`
  import { PLATFORM_RULES, SURFACES, getRule } from "./src/lib/social/platforms";
  const problems = [];
  for (const id of SURFACES) {
    const r = getRule(id);
    if (r.id !== id) problems.push(id + ": id mismatch");
    if (!id.startsWith(r.platform + ".")) problems.push(id + ": surface id does not match its platform");
    if (r.fields.length === 0) problems.push(id + ": no fields");
    if (r.hashtags.min > r.hashtags.max) problems.push(id + ": hashtag min > max");
    if (!r.generation.promptKey) problems.push(id + ": no prompt key");
    if (!/^\\d{4}-\\d{2}$/.test(r.limitsVerifiedOn)) problems.push(id + ": limitsVerifiedOn is not YYYY-MM");
    for (const f of r.fields) {
      if (f.maxChars <= 0) problems.push(id + "." + f.key + ": non-positive maxChars");
      if (f.repeatable && f.repeatable.min > f.repeatable.max) problems.push(id + "." + f.key + ": repeatable min > max");
    }
  }
  const keys = SURFACES.map((s) => getRule(s).generation.promptKey);
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
  console.log(JSON.stringify({ problems, surfaceCount: SURFACES.length, dupes }));
`);
check("every surface is internally consistent", rules.problems, []);
check("no two surfaces share a prompt key", rules.dupes, []);
assert("all surfaces present", rules.surfaceCount === 15, `got ${rules.surfaceCount}`);

// Reddit auto-post must stay off by default. This is a deliberate safety decision, not an
// oversight, and a future edit that flips it should have to change this test on purpose.
const reddit = evalInProject(`
  import { getRule } from "./src/lib/social/platforms";
  const r = getRule("reddit.post");
  console.log(JSON.stringify({ defaultEnabled: r.autoPost.defaultEnabled, forbidsAdCopy: r.forbidden.includes("ad copy") }));
`);
check("Reddit auto-post ships disabled", reddit.defaultEnabled, false);
check("Reddit rules forbid ad copy", reddit.forbidsAdCopy, true);

// ---------------------------------------------------------------------------
console.log("\nContent plan skeleton");
const plan = evalInProject(`
  import { buildPlanSkeleton } from "./src/lib/social/contentPlan";
  const slots = buildPlanSkeleton("2026-08-17", 14);   // a Monday
  const perDay = {};
  for (const s of slots) perDay[s.date] = (perDay[s.date] ?? 0) + 1;
  const counts = Object.values(perDay);
  const linkedinWeekdays = [...new Set(
    slots.filter((s) => s.platform === "linkedin").map((s) => new Date(s.date + "T00:00:00Z").getUTCDay())
  )].sort();
  console.log(JSON.stringify({
    total: slots.length,
    days: Object.keys(perDay).length,
    min: Math.min(...counts),
    max: Math.max(...counts),
    linkedinWeekdays,
    linkedinPosts: slots.filter((s) => s.surface === "linkedin.post").length,
    blogSlots: slots.filter((s) => s.platform === "blog").length,
    firstDayCount: perDay["2026-08-17"],
  }));
`);
// The bug this catches: every surface starting its interval at day 0, which puts all fourteen on
// the first day and two on every other — the right weekly totals and an unusable calendar.
assert("slots are spread, not stacked on day one", plan.max - plan.min <= 6, `min ${plan.min}, max ${plan.max}`);
assert("every day in the window gets slots", plan.days === 14, `got ${plan.days}`);
check("LinkedIn only lands on Mon/Wed/Fri", plan.linkedinWeekdays, [1, 3, 5]);
// Placing ON preferred days rather than spacing-then-filtering: filtering silently dropped the
// misses, so a 3/week cadence quietly became one or two.
check("LinkedIn keeps its 3-a-week cadence", plan.linkedinPosts, 6);
check("the blog surface is not scheduled by the calendar", plan.blogSlots, 0);

// ---------------------------------------------------------------------------
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
