# Content-Type SEO Action Plan — japanesewithavnish.com

Prioritized, phased, per-content-type. Every item cites the exact **file:line** or **database action** to make it directly executable. Effort: XS (<1h) · S (hours) · M (1–2 days) · L (multi-day/ongoing).

> **Prerequisite (from the site-wide audit):** fix `NEXT_PUBLIC_SITE_URL` in Netlify → `https://japanesewithavnish.com` and redeploy, and 301 the `*.netlify.app` host. This corrects canonical/og/sitemap/schema domain for *all* content types and must land first. See [ACTION-PLAN.md](ACTION-PLAN.md).

---

## Phase 1 — High-leverage, low-effort code fixes (Week 1)

These are small code changes that improve thousands of pages at once.

### 1.1 Stop meta descriptions defaulting to the bare title *(XS, affects ~6,000 pages)*
`src/components/learn/LearnDetailContent.tsx:104`
```ts
// now:  const rawDescription = p.seo_description?.trim() || rawTitle;
// step 1 (immediate): add the summary fallback that blog already uses
const rawDescription = p.seo_description?.trim() || p.summary?.trim() || rawTitle;
```
Also widen the metadata SELECT (`LearnDetailContent.tsx:92-97`) to fetch `summary` (and, for a richer built description, the sidecar `meaning`/`reading`). This alone lifts descriptions from "尻" to "尻 (しり) — …". **Real fix in 2.1.**

### 1.2 Add `BreadcrumbList` schema everywhere *(S, affects all content pages)*
Visual breadcrumbs already exist but aren't marked up. Add a `BreadcrumbSchema` builder to `src/components/JsonLd.tsx` and render it at:
`LearnDetailContent.tsx:340-352` · `blog/[slug]/page.tsx:131-149` · `guide/[slug]/page.tsx:59-63` · `jlpt/page.tsx:79-85`. Highest single schema ROI (breadcrumb rich results on every content page).

### 1.3 Add `Article`/`LearningResource` schema to study guides & learn detail *(S)*
Study guides render through `LearnDetailContent` (return at `:335`) and emit **no** schema, unlike `/blog/[slug]`. Reuse the existing `ArticleSchema` (`src/components/JsonLd.tsx:52`) there; add `LearningResource`/`DefinedTerm` for vocab/kanji.

### 1.4 Add `dateModified` to Article schema *(XS)*
`src/components/JsonLd.tsx:75` accepts only `datePublished`. Add a `dateModified` prop and pass `post.updated_at` at `blog/[slug]/page.tsx:118-125` (already in scope). Freshness signal for search + AI.

### 1.5 Fix category canonical polluted by default sort *(XS)*
`src/app/(main)/learn/[type]/page.tsx:82`
```ts
// now:  if (sp.sort) qs.set("sort", sp.sort);
if (sp.sort && sp.sort !== "newest") qs.set("sort", sp.sort);
```

### 1.6 Add missing canonicals + brand titles *(XS)*
- Kana practice pages lack `alternates.canonical`: add to `kana/hiragana/page.tsx:4-7`, `kana/katakana/page.tsx:4-7`, `kana/kanji/page.tsx:7-10`.
- Curriculum title lacks brand: `learn/curriculum/page.tsx:6` → `"Curriculum | Japanese with Avnish"`.
- Clamp guide metadata (truncation risk): wrap `guide/[slug]/page.tsx:31-32` in `clampTitle`/`clampDescription`.

### 1.7 Fix sitemap coverage *(XS)*
`src/app/sitemap.ts:13-18` — add `/learn/kana`, `/learn/kana/hiragana|katakana|kanji`, `/learn/curriculum`, `/scoreboard`, and the JLPT `?level=n4…n1` variants.

---

## Phase 2 — The corpus fix: populate SEO metadata at scale (Weeks 2–4)

**Root cause (confirmed):** the content-generation scripts (`scripts/generate-*.ts`) insert `content_type, slug, title, content, summary, og_image_url, …` but **never `seo_title` or `seo_description`**. DB confirms: only 7% of vocab / 25% of study guides / 28% of kanji have `seo_description`.

### 2.1 Backfill `seo_description` (and `seo_title`) from structured fields *(M, affects ~6,000 pages)*
Write a one-off backfill script (mirror the pattern in `scripts/cleanup-japanese-data-priority.mjs`) that generates descriptive, unique meta descriptions per type from data you already have:
- **Vocabulary:** `Learn the JLPT {level} word {word} ({reading}) — "{meaning}". Example sentences, part of speech, and usage.`
- **Kanji:** `The JLPT {level} kanji {character} ("{meaning}"): on/kun readings, {stroke_count} strokes, stroke order and example words.`
- **Grammar:** `JLPT {level} grammar {pattern}: meaning, structure ({structure}), when to use it, and example sentences.`
- **Study guide / blog:** derive from first ~155 chars of body if `seo_description` empty.

Then update the generators (`generate-curriculum-content.ts:162`, `generate-level-lesson-payload.ts:233`, etc.) to set these columns for all future content so the gap doesn't reopen.

### 2.2 Generate OG images for content pages *(M)*
DB: `og_image_url` is null on 71/5,229 vocab, **0/392 study guides**. Create branded 1200×630 templates per type (word card, kanji card, guide hero) and backfill `posts.og_image_url`; fall back to a default in metadata so social/AI previews are never blank.

---

## Phase 3 — Depth: turn the thin long tail into real content (Month 2+)

### 3.1 Raise vocabulary example-sentence coverage *(L — biggest content ROI)*
**88% of vocab pages (4,613) have no example sentences.** The `examples` table + template already render 6 sentences beautifully for the 12% that have them. Generate/curate 3–6 example sentences (JA + romaji + EN) for the rest — this converts the site's 78% from thin dictionary stubs into genuine usage pages and is the highest-impact content investment available.

### 3.2 Deepen grammar explanations *(M/L)*
560 grammar pages average 145 chars of body. Expand each with a real explanation, structure breakdown, nuance/《when-to-use》notes (the `when_to_use` column exists), common mistakes, and examples. High-intent JLPT category.

### 3.3 Publish the kanji draft backlog *(M)*
**1,833 kanji sit in draft** (vs 423 live). QA and publish in batches — ~5× the kanji corpus. Ensure each gets `seo_description` (2.1) before publishing.

### 3.4 Establish authorship / E-E-A-T *(M — highest trust ROI)*
- Create an `/about` (or `/author/avnish`) page with real bio, JLPT credentials, and photo.
- Backfill `posts.author_name` (0/8,935 learn posts currently) and add bylines to blog + learn content.
- Emit `Person` author in schema with `url` → the author page and `sameAs` → social profiles.
- Populate `Organization.sameAs` + `logo` (`src/components/JsonLd.tsx` Organization block) using the X/YouTube/Instagram profiles already in the footer.

---

## Phase 4 — Content types with structural opportunities

### 4.1 JLPT level pages — add `Course` schema + sitemap the variants *(S)*
`jlpt/page.tsx:29-48` — add `Course`/`EducationalOccupationalProgram` (or `ItemList`) schema; sitemap N4–N1. These are the highest commercial-intent pages. **Note:** the on-page FAQ is good for users and AI, but do **not** add `FAQPage` schema expecting a rich result — Google retired FAQ rich results for all sites (May 2026). Keep the FAQ as on-page content; use `QAPage` only for genuine user Q&A.

### 4.2 Curriculum — decide indexation strategy *(M)*
432 lessons are gated and not in the sitemap; the hub is client-rendered and thin in SSR. Decide: expose a crawlable free-preview outline (server-render the level/module/lesson taxonomy + `Course` schema, sitemap it) vs. keep premium. Currently it's neither — a large asset earning nothing.

### 4.3 Rewards / XP — create indexable content from the gamification system *(S/M)*
The system is rich (102 badges, streaks, leaderboard) but locked in-app. Three surfaces:
1. **Publish the 8 guide sections.** They render from `platform_guide_sections` with full metadata/sitemap wiring and are currently live in production — but `scripts/seed-guide-content.ts:161` seeds them `published=false`, so **a re-seed would silently unpublish them**. Harden the seed to `published=true` (or guard against overwrite).
2. **Server-render `/scoreboard` top-N and add it to the sitemap.** It's public (privacy-guarded by the `show_on_scoreboard` opt-in) but currently a client-only empty shell absent from the sitemap — legitimate social-proof content.
3. **Build a public `/badges` catalog** rendering the 100-badge table server-side (name/description/category) — a natural programmatic-SEO + internal-linking surface into signup. Today the catalog only exists behind login.

### 4.4 Reading / Listening / Writing / Sounds *(S)*
Low volume but healthy. Add schema (`LearningResource`/`AudioObject` for listening), publish the 29 listening drafts, ensure kana practice pages have real server-rendered content (currently client-only). Grow these categories over time for topical coverage.

---

## Priority summary (impact × effort)

| Action | Type(s) | Effort | Impact |
|---|---|---|---|
| Site URL / canonical fix (prereq) | All | XS | **Critical** |
| 1.1 summary fallback for descriptions | All learn | XS | High |
| 2.1 backfill `seo_description` | ~6,000 pages | M | **High** |
| 3.1 vocab example sentences | Vocabulary (78%) | L | **Very High** |
| 1.2 BreadcrumbList schema | All | S | High |
| 1.3 Article/LearningResource schema | Study guide + learn | S | High |
| 3.4 authorship / E-E-A-T | All | M | **High (trust)** |
| 3.3 publish kanji backlog | Kanji (+1,833) | M | High |
| 3.2 deepen grammar | Grammar (560) | M/L | Medium-High |
| 2.2 OG images | All | M | Medium |
| 4.x JLPT schema / curriculum / rewards | Structural | S/M | Medium |

**If you do only three things:** (1) the site-URL fix, (2) backfill `seo_description` + add the `summary` fallback, (3) raise vocabulary example coverage. Those three touch ~100% of indexed pages and address the two problems that cap this site's content SEO.
