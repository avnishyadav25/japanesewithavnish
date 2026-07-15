// Generates real social content packs (LinkedIn, Facebook, Instagram, Twitter/X, Threads,
// Reddit, Pinterest, YouTube) for the two launch-offer newsletters seeded by
// scripts/seed-launch-offers.ts, reusing the exact same prompt/parsing logic as
// src/app/api/ai/social-pack/route.ts (that route requires an admin browser session,
// so this script replicates it directly for one-off backend seeding).
// Run: npx tsx scripts/generate-offer-social-packs.ts
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required (.env / .env.local)");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

const SOCIAL_PACK_SYSTEM = `You are an expert content creator for Japanese with Avnish (japanesewithavnish.com) — a premium JLPT learning site. Generate a complete multi-platform content pack for ONE topic (including a Japanese term like vocabulary/grammar/kanji, or a blog/product/newsletter topic).

RULES:
1) Output ONLY valid JSON. No markdown, no commentary, no trailing commas. Every string value must be in double quotes, including all hashtags (e.g. "hashtags": ["#JLPT", "#Japanese"], never unquoted #tag).
2) Use simple English for most copy (professional, calm, helpful). Use Hinglish ONLY in fields explicitly named "*_hinglish" (e.g. caption_hinglish, voiceover_hinglish).
3) Audience: people learning Japanese, JLPT aspirants (N5–N1).
4) Include CTA: visit the site, check the blog/product, or subscribe.
5) If the topic is a Japanese term (word/grammar/kanji), ensure the pack teaches it using this sequence:
   - Meaning (JP + romaji + EN), simple explanation/structure, mnemonic, 4 example sentences, mini conversation (Sakura 🌸 / Kenji 🐼), common beginner mistake, quick quiz, study tip, CTA.
   Reuse the SAME examples/quiz idea consistently across carousel, reel, post, and blog.
6) Visual brand rules for ALL image_prompt fields (carousel/reel/post/blog/social share):
   - Style: friendly educational flat-vector (NOT anime), minimal Japanese classroom aesthetic.
   - Background: off-white (#FAF8F5). Accent: red (#D0021B). Text: dark charcoal (#1A1A1A).
   - Clean composition, lots of white space, readable typography.
   - Negative prompt (apply to all): no clutter, no neon, no photorealism, no anime exaggeration, no scary faces.
7) Instagram carousel:
   - Exactly 10 slides; each slide body max 180 characters.
   - Slide map (follow this order):
     1 Hook & term (hero)
     2 Meaning (JP + romaji + EN)
     3 Simple structure / how to use
     4 Mnemonic / memory trick
     5–8 Examples (1 per slide)
     9 Quick quiz (A/B/C + answer)
     10 Study tip + CTA
   - Each slide must have title, body, and on_screen_caption.
   - on_screen_caption MUST be a DETAILED AI image prompt (2–3 sentences) describing the exact scene + the exact on-image text (term + key line). Every carousel image prompt MUST end with: "At the bottom of the image, display the text japanesewithavnish.com in clean, readable typography."
8) Instagram reel:
   - 8–12 shots. The shot sequence must teach the same concept: hook → meaning → structure → examples → mistake → quiz → CTA.
   - Each shot.visual MUST be a DETAILED AI image prompt (2–3 sentences) describing the exact scene + the on-image text to show.
   - Every reel shot.visual MUST end with: "At the bottom of the image, display the text japanesewithavnish.com in clean, readable typography."
9) Instagram post: caption_hinglish, hashtags, cta_line; add post.image_prompt as a single detailed educational prompt for one square (1:1) post image (include the term on-image; japanesewithavnish.com at the bottom).
10) Twitter and LinkedIn: post text plus image_prompt (one short but clear prompt for a single share image each, consistent with the brand rules).
11) Reddit: post with title, body, image_prompt. Pinterest: pin with title, description, image_prompt. All image_prompt fields are for AI image generation; keep them concise and visual.
12) validation: set is_valid_json true, carousel_slides_count 10, reel_has_8_to_12_shots true, safe_to_publish true.

Return this exact JSON shape (all keys; use "" or [] where empty):
{"meta":{"topic":"","content_angle":"","primary_pain":"","big_payoff":"","audience":"JLPT learners","cta_keyword":"","lead_magnet":""},"youtube":{"long":{"title":"","hook_1_line":"","outline_bullets":[],"script":"","description":"","chapters":[{"t":"0:00","label":""}],"tags":[],"pinned_comment":"","thumbnail":{"text_options":[],"visual_concept":"","composition_notes":""}},"short":{"title":"","script":"","on_screen_beats":[],"description":"","hashtags":[]}},"instagram":{"reel":{"duration_sec":40,"hook_text":"","shots":[{"t_start":"0:00","t_end":"0:03","visual":"","on_screen_text":"","voiceover_hinglish":"","sfx":""}],"caption_hinglish":"","hashtags":[],"cta_line":""},"post":{"caption_hinglish":"","hashtags":[],"cta_line":"","image_prompt":""},"carousel":{"cover":{"headline":"","subheadline":"","badge":""},"slides":[{"slide_no":1,"title":"","body":"","on_screen_caption":""},{"slide_no":2,"title":"","body":"","on_screen_caption":""},{"slide_no":3,"title":"","body":"","on_screen_caption":""},{"slide_no":4,"title":"","body":"","on_screen_caption":""},{"slide_no":5,"title":"","body":"","on_screen_caption":""},{"slide_no":6,"title":"","body":"","on_screen_caption":""},{"slide_no":7,"title":"","body":"","on_screen_caption":""},{"slide_no":8,"title":"","body":"","on_screen_caption":""},{"slide_no":9,"title":"","body":"","on_screen_caption":""},{"slide_no":10,"title":"","body":"","on_screen_caption":""}],"design":{"format":"1080x1350","style":"minimal","colors":{"bg":"#FAF8F5","text":"#1A1A1A","accent1":"#D0021B","accent2":"#111827"},"font_suggestions":["Inter"],"layout_rules":[]}},"facebook":{"post":{"text":"","cta_line":""}},"threads":{"post":{"text":""}},"twitter":{"post":{"text":""},"thread":{"tweets":[]},"image_prompt":""},"linkedin":{"post":{"text":"","cta_line":""},"article":{"title":"","hook":"","tldr":"","body":"","hashtags":[]},"image_prompt":""},"reddit":{"post":{"title":"","body":"","image_prompt":""}},"pinterest":{"pin":{"title":"","description":"","image_prompt":""}},"blog":{"title":"","slug":"","tldr":"","meta_title":"","meta_description":"","html_body":"","tags":[],"image_prompt":""},"assets":{"screen_recording_list":[],"broll_ideas":[],"thumbnail":{"text_options":[],"visual_concept":"","composition_notes":""}},"validation":{"is_valid_json":true,"carousel_slides_count":10,"reel_has_8_to_12_shots":true,"safe_to_publish":true,"warnings":[]}}`;

// Hardcoded, not read from NEXT_PUBLIC_SITE_URL — that env var is intentionally set to
// localhost for local dev, but this content is written for the real public site.
const SITE_URL = "https://japanesewithavnish.com";

const campaigns = [
  {
    newsletterSlug: "first-50-users-free-month",
    title: "First 50 Users Get a Free Month",
    summary:
      "The first 50 people to use code FIRST50FREE get a completely free month of Premium on Japanese with Avnish — first-come, first-served.",
    link: `${SITE_URL}/pricing`,
  },
  {
    newsletterSlug: "top-3-leaderboard-contest",
    title: "Top 3 Monthly Leaderboard Winners Get 30 Days Free",
    summary:
      "Every month, the top 3 most active learners by XP on Japanese with Avnish win 30 days of Premium access, completely free — no entry required, just study consistently.",
    link: `${SITE_URL}/scoreboard`,
  },
];

async function generatePack(title: string, summary: string, link: string) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY not configured");

  const userPrompt = `Content type: newsletter. Topic/Title: ${title}. Summary: ${summary}. Link: ${link}. Generate the full content pack JSON.`;

  const res = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: SOCIAL_PACK_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 8000,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`DeepSeek error: ${err.slice(0, 500)}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = data.choices?.[0]?.message?.content ?? "";

  let cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  const firstBrace = cleaned.indexOf("{");
  if (firstBrace !== -1) {
    const lastBrace = cleaned.lastIndexOf("}");
    if (lastBrace > firstBrace) cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }
  cleaned = cleaned.replace(/,(\s*[}\]])/g, "$1");
  cleaned = cleaned.replace(/,(\s*)#([a-zA-Z0-9_-]+)(?=\s*[,}\]])/g, '$1"#$2"');
  cleaned = cleaned.replace(/\[\s*#([a-zA-Z0-9_-]+)(?=\s*[,}\]])/g, '[ "#$1"');
  cleaned = cleaned.replace(/:(\s*)#([a-zA-Z0-9_-]+)(?=\s*[,}\]])/g, ':$1"#$2"');

  return JSON.parse(cleaned) as Record<string, unknown>;
}

async function main() {
  for (const c of campaigns) {
    console.log(`[${c.newsletterSlug}] looking up newsletter...`);
    const rows = (await sql`SELECT id FROM newsletters WHERE slug = ${c.newsletterSlug} LIMIT 1`) as { id: string }[];
    const newsletterId = rows[0]?.id ?? null;
    if (!newsletterId) {
      console.error(`[${c.newsletterSlug}] newsletter not found, skipping`);
      continue;
    }

    console.log(`[${c.newsletterSlug}] generating social pack via DeepSeek...`);
    try {
      const payload = await generatePack(c.title, c.summary, c.link);
      const packSlug = c.newsletterSlug;
      const existing = (await sql`
        SELECT id FROM social_content_packs WHERE entity_type = 'newsletter' AND slug = ${packSlug} LIMIT 1
      `) as { id: string }[];
      if (existing[0]) {
        await sql`
          UPDATE social_content_packs SET payload = ${JSON.stringify(payload)}::jsonb, updated_at = ${new Date().toISOString()}
          WHERE id = ${existing[0].id}
        `;
      } else {
        await sql`
          INSERT INTO social_content_packs (entity_type, entity_id, slug, title, description, summary, link, payload, updated_at)
          VALUES ('newsletter', ${newsletterId}, ${packSlug}, ${c.title}, NULL, ${c.summary}, ${c.link}, ${JSON.stringify(payload)}::jsonb, ${new Date().toISOString()})
        `;
      }
      console.log(`[${c.newsletterSlug}] OK — pack saved.`);
    } catch (e) {
      console.error(`[${c.newsletterSlug}] FAILED:`, e instanceof Error ? e.message : e);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
