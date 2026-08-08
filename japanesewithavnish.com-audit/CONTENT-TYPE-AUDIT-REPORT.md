# Content-Type SEO Audit — japanesewithavnish.com

**Date:** 2026-08-08 · **Method:** live crawl + full source review (`src/app/(main)/**`) + direct Neon database queries (real content counts, SEO-field completeness, example-sentence coverage).

This report audits every content type individually: **blog, study guides, vocabulary, kanji, grammar, reading, listening, writing, sounds/kana, curriculum, JLPT level pages, and the rewards/XP system.** It complements the site-wide audit in [FULL-AUDIT-REPORT.md](FULL-AUDIT-REPORT.md); the site-wide **canonical-domain bug** (all URLs point to `cosmic-blini-bc94d7.netlify.app`) applies to every type below and is the #1 fix.

---

## Content inventory (live from database)

| Content type | Published (indexed) | Draft (backlog) | Share of indexed site |
|---|---:|---:|---:|
| **Vocabulary** | 5,229 | 263 | **78%** |
| Grammar | 560 | 111 | 8.4% |
| Kanji | 423 | **1,833** | 6.3% |
| Study guides | 392 | 0 | 5.9% |
| Reading | 47 | 0 | 0.7% |
| Blog (editorial) | 21 | 10 | 0.3% |
| Listening | 16 | 29 | 0.2% |
| Sounds | 10 | 0 | 0.1% |
| Writing | 5 | 0 | 0.1% |
| Practice test | 3 | 12 | — |
| **Total** | **~6,706** | **~2,250** | 100% |

**Two structural facts dominate content SEO:**
1. **The site is 78% vocabulary pages**, and 88% of those are thin (see below). The long tail *is* the site.
2. **~2,250 pages are written but sitting in draft** — notably **1,833 kanji** — a large, already-produced content asset not yet earning traffic. (Drafts are correctly excluded from the sitemap, so this is opportunity, not a bug.)

---

## Cross-cutting findings (apply to most content types)

| # | Finding | Severity | Evidence |
|---|---|---|---|
| C1 | **No structured data on any learn/study-guide/JLPT/curriculum page** — only the site-wide `Organization` block renders. `ArticleSchema` exists (`src/components/JsonLd.tsx:52`) but is used *only* by `/blog/[slug]`. | High | Live: vocab/kanji/study_guide/jlpt/curriculum all show `schema=['Organization']` only; blog shows `Article, Person, ImageObject`. |
| C2 | **Meta descriptions degrade to the bare title** when `seo_description` is null. | High | `LearnDetailContent.tsx:104` `p.seo_description?.trim() \|\| rawTitle`. Live: vocab desc=`ときどき`, kanji desc=`尻 - butt`, study_guide desc=`Katakana A–N Rows (Main Guide)`. DB: only **7%** of vocab, **25%** of study guides, **28%** of kanji have `seo_description`. |
| C3 | **No author attribution on any learn content** (E-E-A-T). | Medium | DB: `author_name` populated on **0 of 8,935** learn posts (15/31 blog). |
| C4 | **Almost no per-page social images.** | Medium | DB: `og_image_url` on 71/5,229 vocab, **0/392** study guides, 27/423 kanji. |
| C5 | **No `BreadcrumbList` schema** despite visual breadcrumbs on every detail page. | Medium | Breadcrumbs rendered at `LearnDetailContent.tsx:340-352`, `blog/[slug]:131-149`, `jlpt:79-85` — none marked up. |

---

## Per-content-type scorecard

| Content type | SEO score | Biggest issue | Biggest strength |
|---|---:|---|---|
| Blog (editorial) | 82 | Only 21 posts; no `dateModified` in schema | Full metadata + Article/Person schema + author + dates |
| JLPT levels | 60 | No `Course` schema; N4–N1 not in sitemap; client-rendered | Unique per-level titles + self-canonical + strong summaries |
| Listening | 60 | Tiny volume; 29 in draft | 100% have seo_description; audio content |
| Kanji | 58 | 72% missing seo_description; 1,833 stuck in draft | Template-consistent ~845-char bodies |
| Reading / Writing / Sounds | 57 | Very low volume; writing tool gated | Rich bodies (sounds avg ~2,000 chars) |
| Study guides | 55 | No schema, no OG image, stub descriptions | Genuinely rich content (avg 1,451 chars) |
| Grammar | 52 | Bodies avg **145 chars** (54% under 200) | 67% have example sentences; good category page |
| Curriculum | 48 | 432 lessons gated & not in sitemap; thin SSR; title lacks brand | Strong taxonomy (5 levels / 54 modules / 432 lessons) |
| **Vocabulary** | **42** | **88% have no example sentences → thin at 5,229-page scale** | Good internal linking + breadcrumbs |
| Rewards / XP | n/a | In-app only; not an indexable surface | Rich system (102 badges) — untapped content angle |

---

## 1. Vocabulary — 5,229 pages (78% of the site) — **Score 42**

The single most important content type by volume, and the weakest by depth.

- **Thin content at scale (High).** DB: **4,613 of 5,224 published vocab items (88%) have zero example sentences**, and 4,611 have no examples *and* no notes. Those pages render as just *word + reading + meaning* (~50–80 words). The 12% that do have examples average 6 good sentences — proving the template is capable; it's a data-coverage gap. `posts.content` is empty for vocab; the body is assembled from the `vocabulary` + `examples` tables.
- **Stub meta descriptions (High).** Only 363/5,229 (7%) have `seo_description`; the rest fall back to the word itself (`ときどき`).
- **No schema (High).** No `DefinedTerm`/`LearningResource`, no `BreadcrumbList`.
- **Strengths.** Fully crawlable (`always_free`), correct percent-encoded canonicals for Japanese slugs (`LearnDetailContent.tsx:106`), ISR (`revalidate=60`), excellent internal linking (breadcrumb + "Recommended next lessons" + curriculum-aware related grid).
- **Index-bloat risk (Medium).** 5,229 near-identical templated pages with thin bodies and duplicate-shaped descriptions is exactly the pattern Google's thin/doorway heuristics target. The fix is depth (examples + descriptions), not deletion.

## 2. Kanji — 423 published / **1,833 draft** — **Score 58**

- **Best-templated learn type.** Bodies are consistent (~845 chars, min 655) with readings, stroke count, frequency rank, grade, study tips, and stroke-order data (`stroke_data` jsonb).
- **Massive draft backlog (High opportunity).** 1,833 kanji written but unpublished — 4× the live count. Publishing these (with QA) roughly quintuples the kanji corpus.
- **Gaps.** 72% missing `seo_description`; only 5% have example sentences; no schema; no OG image.

## 3. Grammar — 560 published — **Score 52**

- **Thinnest bodies of any type.** DB: avg `posts.content` = **145 chars**, and **303/560 (54%) under 200 chars**. Some are rich (max 3,548) but the median grammar page is very light.
- **Strength.** 67% have example sentences (best coverage of the three structured types); category page has strong static metadata. 45% have `seo_description`.
- **Gaps.** No schema; thin explanations hurt both ranking and E-E-A-T for grammar queries (a high-intent JLPT search category).

## 4. Study guides — 392 published — **Score 55**

- **Genuinely good content** (avg 1,451 chars; richer ones stored in `lesson_blocks`), served at `/blog/study_guide/{slug}`.
- **But treated as second-class SEO:** renders through `LearnDetailContent` which emits **no Article schema** (unlike sibling `/blog/[slug]`), **0/392 have an OG image**, only 25% have `seo_description` (→ title-stub descriptions like `Katakana A–N Rows (Main Guide)`), and no author/date signals. This is the clearest "good content, broken packaging" case.

## 5. Blog (editorial) — 21 published — **Score 82**

- **The reference implementation.** Full `generateMetadata`, `Article` + `Person` + `ImageObject` schema (live-confirmed), author fallback (`author_name || "…Editorial Team"`), published/updated dates rendered, related posts, comments, `og:type=article`. All 21 have `seo_description`; 21 have OG images.
- **Gaps.** `dateModified` is not in the schema though `updated_at` exists (`JsonLd.tsx:75`); no `BreadcrumbList`; author `Person` is name-only (no `url`/`sameAs`). **Volume is the real issue — 21 posts across 6 categories.** This is the type most able to win informational/JLPT queries and deserves a content pipeline.

## 6. JLPT level pages — /jlpt?level=n5…n1 — **Score 60**

- **Handled well on-page:** unique title/description per level (`LEVEL_NAMES`/`LEVEL_SUMMARIES`), self-referencing canonical per level (bare `/jlpt` → `?level=n5`).
- **Gaps:** no `Course`/`ItemList` schema; the FAQ block on the page has no markup; content is client-rendered (`JLPTContent` is `"use client"`) so only the requested level's HTML is crawlable; **N4–N1 are not in the sitemap** (only bare `/jlpt`). These are among the highest commercial-intent pages on the site.

## 7. Reading / Listening / Writing / Sounds — 47 / 16 / 5 / 10 — **Score ~57**

- **Small but healthy.** Reading avg 221 chars; sounds avg ~2,000; listening has audio + transcripts + questions (SSR'd). Most have `seo_description`.
- **Gaps.** No schema on any; listening has 29 more in draft; writing's interactive canvas is login-gated (SEO-neutral — prose still SSR'd); very low volume limits topical coverage.

## 8. Sounds / Kana practice pages — **Score 55**

- `/learn/sounds` content (10 posts) is solid. But the kana *practice* pages (`/learn/kana/hiragana|katakana|kanji`) are **client-rendered** (thin server HTML), **missing `alternates.canonical`** (`kana/hiragana/page.tsx:4-7` etc.), and **absent from the sitemap** — so these evergreen, high-search-volume "learn hiragana/katakana" pages are under-optimized.

## 9. Curriculum — 432 lessons — **Score 48**

- **A large hidden asset.** DB: 5 levels, 54 modules, 96 submodules, **432 lessons** (all with descriptions). But individual lessons (`/learn/curriculum/lesson/[id]`) are personalized/gated and **not in the sitemap**, and the hub (`/learn/curriculum`) is client-rendered with thin SSR and a **title missing the brand suffix** (`"Curriculum"` only) and no `Course` schema.
- **Decision needed:** how much of the curriculum should be a crawlable, indexable free-preview vs. gated premium. Right now it's neither clearly indexed nor clearly gated.

## 10. Rewards / XP / Gamification — in-app only

- **Rich system** (102 badges, 9 achievements, points/streaks/leaderboard tables) but **no indexable surface** beyond the single `/guide/dashboard-xp-rewards` explainer.
- **Not a defect** — it's an engagement feature — but it's an **untapped content angle** (see action plan): a public "how our XP/streak system works," achievement showcases, or an anonymized public leaderboard can create shareable, linkable, brand-differentiating pages.

---

## Sitemap coverage gaps (by content type)
- **Missing:** `/learn/kana`, `/learn/kana/hiragana|katakana|kanji`, `/learn/curriculum`, JLPT `?level=n4…n1` variants (`src/app/sitemap.ts:13-18`).
- **Correctly excluded:** draft posts, personalized curriculum lessons, account/dashboard routes.

## Indexation & crawlability (verified)
- All published learn content is `access_policy = always_free` and server-renders its prose → **fully crawlable** (confirmed via anonymous fetch). No paywall blocks lesson text; only interactive *tools* (writing canvas, curriculum personalization) are gated, which is SEO-neutral.
