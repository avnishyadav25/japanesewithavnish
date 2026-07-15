import { config } from "dotenv";
config({ path: ".env.local" });

type SeedSection = {
  slug: string;
  targetPath: string;
  body: string;
};

const SECTIONS: SeedSection[] = [
  {
    slug: "jlpt-curriculum",
    targetPath: "/learn/curriculum",
    body: `The curriculum is your main structured path from N5 to N1, organized as Level → Module → Submodule → Lesson.

1. Go to **Curriculum** in the top navigation, or click "Browse the Curriculum" below.
2. Pick your JLPT level (N5 through N1). If you're not sure where to start, take the placement quiz first.
3. Open a module, then a submodule, to see its list of lessons in order.
4. Complete lessons one at a time — each covers a specific grammar point, vocabulary theme, or kanji set, with examples, practice questions, and audio. Lessons unlock in sequence, so finishing one opens the next.
5. At the end of each module, take the checkpoint quiz to confirm what you've learned before moving on.
6. Finish each full level with a mock JLPT exam that mirrors the real test format.

Your progress is saved automatically after every lesson — close the tab anytime and pick up exactly where you left off from your dashboard.`,
  },
  {
    slug: "kanji-library-stroke-practice",
    targetPath: "/learn/kanji",
    body: `The Kanji library is both a reference and a hands-on practice tool.

1. Go to **Learn → Kanji**, or click "Browse Kanji" below.
2. Filter the list by JLPT level (N5-N1) to see only the kanji relevant to your current level.
3. Click any kanji character to open its detail view — meaning, on'yomi/kun'yomi readings, and example words that use it.
4. Open the stroke-order tracing tool from that detail view to practice writing the character by hand.
5. Draw each stroke with your mouse or finger, in order — the tool checks your strokes against the correct stroke order and tells you if you're on track.
6. Tap "Read aloud" to hear the character's pronunciation while you practice.

You'll also see kanji chips like this directly inside curriculum lessons — click any kanji character you encounter there to jump straight into practicing it, without leaving your lesson.`,
  },
  {
    slug: "vocabulary-library",
    targetPath: "/learn/vocabulary",
    body: `The Vocabulary library covers every word in the curriculum plus a broader searchable set, tagged by JLPT level.

1. Go to **Learn → Vocabulary**, or click "Browse Vocabulary" below.
2. Filter by JLPT level (N5-N1) to narrow the list to your current level.
3. Use the search box to look up a specific word directly, in Japanese, romaji, or English meaning.
4. Each entry shows the reading, romaji, meaning, and part of speech.
5. Click the speaker icon next to any word to hear it pronounced by native audio.

Vocabulary also appears directly inside curriculum lessons, grouped by everyday theme (family, food, travel, work, and more) — so you're always learning words in the context of a real lesson, not just an isolated list.`,
  },
  {
    slug: "grammar-reference",
    targetPath: "/learn/grammar",
    body: `The Grammar reference explains every JLPT grammar pattern with its structure, meaning, and example sentences.

1. Go to **Learn → Grammar**, or click "Browse Grammar" below.
2. Filter by JLPT level (N5-N1) to see the grammar points relevant to where you are.
3. Click any grammar pattern to see its full breakdown: structure, meaning, usage notes, and example sentences with translations.
4. Use the search box if you already know the pattern you're looking for (e.g. "たら" or "ばかり").

For deeper context, study grammar inside a curriculum lesson instead of in isolation — there, each pattern is paired with the specific vocabulary and kanji it's typically used with, which makes it easier to remember.`,
  },
  {
    slug: "nihongo-navi-your-ai-study-partner",
    targetPath: "/tutor",
    body: `Nihongo Navi is an AI tutor you can chat with whenever a lesson doesn't quite cover what you need.

1. Go to **Nihongo Navi** in the navigation, or click "Try Nihongo Navi" below.
2. Choose a mode depending on what you need help with:
   - **General Tutor** — open-ended Q&A about anything Japanese-related.
   - **Correct My Sentence** — paste a sentence you wrote and get corrections with explanations.
   - **Explain This Grammar** — ask about a specific grammar point in plain language.
   - **Quiz Me** — get quizzed on demand for extra review reps.
   - **Vocabulary Builder** — build and review a custom word list.
   - **Kanji Helper** — get help breaking down or remembering a specific kanji.
   - **Reading Sandbox** — paste real Japanese text and get help reading it.
   - **JLPT Coach** — get exam-focused study advice.
3. Type your question or paste your text, and Nihongo Navi responds directly in the chat.

Free accounts get 5 messages a day; Premium members get unlimited access. It's most useful for the specific moment a lesson leaves you stuck.`,
  },
  {
    slug: "blog",
    targetPath: "/blog",
    body: `The blog is where longer-form articles live — strategy guides, grammar deep-dives, and study tips that go beyond a single curriculum lesson.

1. Go to **Blog** in the navigation, or click "Read the Blog" below.
2. Filter by JLPT level if you only want posts relevant to where you currently are.
3. Use the search box to look for a specific topic (e.g. "kanji mistakes" or "N3 study plan").
4. Open any post to read the full article — most include practical examples and links to related lessons, vocabulary, or grammar you can study next.

New posts are added regularly, so it's worth checking back between lessons for extra context on tricky topics or exam-day advice.`,
  },
  {
    slug: "listening-reading-writing-practice",
    targetPath: "/learn",
    body: `Beyond the core curriculum, dedicated practice tools let you drill one specific skill at a time.

1. Go to **Learn** in the navigation, then choose **Listening**, **Reading**, or **Writing** from the hub.
2. **Listening** — pick a scenario, listen to the audio (at natural or slowed-down speed), and answer comprehension questions.
3. **Reading** — work through a passage at your level, with a built-in glossary you can tap for unfamiliar words or grammar.
4. **Writing** — practice guided writing exercises, from single sentences to short paragraphs.

These are most useful once you've already covered the core curriculum for a level and want focused extra reps in one skill before an exam, rather than a full structured lesson.`,
  },
  {
    slug: "dashboard-xp-rewards",
    targetPath: "/learn/dashboard",
    body: `Your dashboard is the home base for tracking real progress, not just a syllabus.

1. Go to **Learn → Dashboard**, or click "Go to My Dashboard" below.
2. See your current lesson and jump straight back into it with one click.
3. Check your daily streak — how many days in a row you've studied — and your longest streak on record.
4. Review completed lessons and badges you've earned along the way.
5. Track your points: earned for daily logins, completed lessons, practices, and quizzes, with streak milestones unlocking extra badges.

Free accounts get a limited number of lessons per day; Premium removes that daily limit entirely.`,
  },
];

async function captureScreenshot(baseUrl: string, targetPath: string): Promise<Buffer> {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${baseUrl}${targetPath}`, { waitUntil: "networkidle", timeout: 20000 });
    return (await page.screenshot({ fullPage: false, type: "png" })) as Buffer;
  } finally {
    await browser.close();
  }
}

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const { PutObjectCommand, S3Client } = await import("@aws-sdk/client-s3");

  const sql = neon(process.env.DATABASE_URL!);
  const r2 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  });
  const bucket = process.env.R2_BUCKET_NAME!;
  const bucketUrl = process.env.R2_BUCKET_URL!.replace(/\/$/, "");
  const baseUrl = process.env.SEED_BASE_URL || "http://localhost:3000";

  for (const section of SECTIONS) {
    console.log(`[${section.slug}] capturing screenshot of ${section.targetPath}...`);
    try {
      const buffer = await captureScreenshot(baseUrl, section.targetPath);
      const key = `guide-screenshots/${section.slug}-seed-${Date.now()}.png`;
      await r2.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: "image/png" }));
      const screenshotUrl = `${bucketUrl}/${key}`;

      const bodyWithScreenshot = `${section.body}\n\n![Screenshot of ${section.targetPath}](${screenshotUrl})`;

      await sql`
        UPDATE platform_guide_sections
        SET body = ${bodyWithScreenshot}, published = false, updated_at = NOW()
        WHERE slug = ${section.slug}
      `;
      console.log(`[${section.slug}] OK -> ${screenshotUrl}`);
    } catch (e) {
      console.error(`[${section.slug}] FAILED:`, e instanceof Error ? e.message : e);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
