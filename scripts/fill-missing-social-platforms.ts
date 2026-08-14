// Fills in facebook/threads copy for social_content_packs where the full pack generation
// (scripts/generate-offer-social-packs.ts) omitted those keys — a known LLM reliability
// gap with large JSON schemas. Matches the exact shape SocialPrepareForm.tsx expects:
// payload.facebook.post.{text,cta_line}, payload.threads.post.text.
// Run: npx tsx scripts/fill-missing-social-platforms.ts
import "dotenv/config";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is required (.env / .env.local)");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const DEEPSEEK_API = "https://api.deepseek.com/v1/chat/completions";

const SYSTEM = `You are a social media copywriter for Japanese with Avnish (japanesewithavnish.com), a JLPT learning platform. Output ONLY valid JSON, no markdown, exactly this shape:
{"facebook":{"post":{"text":"","cta_line":""}},"threads":{"post":{"text":""}}}
Facebook post: 2-4 sentences, friendly and clear, professional tone (no hype/spam), include a short cta_line as a separate field (not repeated in text). Threads post: short and punchy, under 500 characters, conversational tone typical of Threads.`;

async function generate(title: string, summary: string, link: string) {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error("DEEPSEEK_API_KEY not configured");
  const userPrompt = `Title: ${title}. Summary: ${summary}. Link: ${link}. Generate the JSON.`;
  const res = await fetch(DEEPSEEK_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.6,
      max_tokens: 500,
    }),
  });
  if (!res.ok) throw new Error(`DeepSeek error: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = (data.choices?.[0]?.message?.content ?? "").trim();
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned) as { facebook: { post: { text: string; cta_line: string } }; threads: { post: { text: string } } };
}

async function main() {
  const packs = (await sql`
    SELECT id, slug, title, summary, link, payload
    FROM social_content_packs
    WHERE entity_type = 'newsletter'
      AND (payload->'facebook' IS NULL OR payload->'threads' IS NULL
           OR payload->'facebook'->'post'->>'text' IS NULL OR payload->'facebook'->'post'->>'text' = ''
           OR payload->'threads'->'post'->>'text' IS NULL OR payload->'threads'->'post'->>'text' = '')
  `) as { id: string; slug: string; title: string; summary: string | null; link: string | null; payload: Record<string, unknown> }[];

  console.log(`Found ${packs.length} pack(s) missing facebook/threads copy.`);

  for (const pack of packs) {
    console.log(`[${pack.slug}] generating facebook/threads copy...`);
    try {
      const fill = await generate(pack.title, pack.summary ?? "", pack.link ?? "");
      await sql`
        UPDATE social_content_packs
        SET payload = jsonb_set(jsonb_set(payload, '{facebook}', ${JSON.stringify(fill.facebook)}::jsonb), '{threads}', ${JSON.stringify(fill.threads)}::jsonb),
            updated_at = ${new Date().toISOString()}
        WHERE id = ${pack.id}
      `;
      console.log(`[${pack.slug}] OK.`);
    } catch (e) {
      console.error(`[${pack.slug}] FAILED:`, e instanceof Error ? e.message : e);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
