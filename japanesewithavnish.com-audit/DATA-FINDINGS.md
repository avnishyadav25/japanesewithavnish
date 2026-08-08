# Database-backed content findings (Neon, live query 2026-08-08)

## Content inventory (posts, by content_type / status)
| Type | Published | Draft | Notes |
|---|---|---|---|
| vocabulary | 5,229 | 263 | 78% of published site |
| kanji | 423 | **1,833** | huge draft backlog |
| grammar | 560 | 111 | |
| study_guide | 392 | 0 | routes to /blog/study_guide |
| reading | 47 | 0 | |
| listening | 16 | 29 | |
| sounds | 10 | 0 | |
| writing | 5 | 0 | |
| practice_test | 3 | 12 | content=0 (dynamic) |
| blog (editorial) | 21 | 10 | 6 categories |
| **Total learn_library** | 6,685 | ~2,250 | |

All published learn content is `access_policy = always_free` → fully crawlable (confirmed via curl too).

## SEO-field completeness (PUBLISHED, indexed pages)
| Type | Published | has seo_description | has og_image | has canonical_url |
|---|---|---|---|---|
| vocabulary | 5,229 | **363 (7%)** | 71 (1%) | 363 |
| grammar | 560 | 250 (45%) | 34 | 250 |
| kanji | 423 | 120 (28%) | 27 | 120 |
| study_guide | 392 | 99 (25%) | **0** | 99 |
| reading | 47 | 20 | 20 | 20 |
| blog | 21 | 21 (100%) | 21 | 16 |
| listening | 16 | 16 | 1 | 16 |
| sounds | 10 | 10 | 10 | 10 |
| writing | 5 | 5 | 5 | 5 |
- **author_name: 0 of 8,935 learn posts; 15 of 31 blog.** No author E-E-A-T on learn content.
- Note: canonical_url column is mostly empty but canonical is emitted at render from the route (path-based), so canonical tags DO exist — the column is just unused metadata.

## Content depth (published learn body = posts.content chars)
| Type | n | avg content chars | thin (<200) |
|---|---|---|---|
| vocabulary | 5,229 | 540 | 557 (but content mostly EMPTY; body = vocabulary+examples tables) |
| grammar | 560 | **145** | **303 (54%)** very thin |
| kanji | 423 | 845 | 0 (template-consistent) |
| study_guide | 392 | 1,451 | 233 (bimodal; rich ones use lesson_blocks) |
| reading | 47 | 221 | 40 |
| listening | 16 | 446 | 0 |
| sounds | 10 | 1,987 | 0 |
| writing | 5 | 1,712 | 0 |

Rich lesson/study-guide bodies live in **lesson_blocks (5,459 rows / 432 posts)** and content_blocks (211 rows / 84 posts), not posts.content.

## Example-sentence coverage (the real richness for vocab/kanji/grammar)
| Type | items | with examples | % | avg examples |
|---|---|---|---|---|
| vocabulary | 5,225 | 611 | **12%** | 6.0 |
| grammar | 548 | 366 | 67% | 6.1 |
| kanji | 2,186 | 117 | 5% | 6.0 |
- **Truly-thin published vocab: 4,613 of 5,224 (88%) have NO example sentences; 4,611 have no examples AND no notes.** These render as word + reading + meaning only (~50-80 words) = thin at massive scale.

## Curriculum
5 levels · 54 modules · 96 submodules · **432 lessons**. All have description; 142 have introduction (avg 214 chars); 0 have summary. Individual lessons (/learn/curriculum/lesson/[id]) are personalized/gated and NOT in sitemap → 432-lesson asset invisible to search.

## Guide
8 published sections (platform_guide_sections), avg body 935 chars, avg short_description 106 chars. These are the 8 /guide/* pages.

## Gamification / rewards
102 badges · 9 achievement_definitions · 2 leaderboard_reward_cycles · points_transactions, reward_events, user_badges, user_achievements tables. Rich in-app system; only public surface = 1 guide page (/guide/dashboard-xp-rewards).

## Root-cause pointers (from repo agents)
- Meta-desc fallback to title: `src/components/learn/LearnDetailContent.tsx:104` (`seo_description || rawTitle`); SELECT at :92-97 doesn't fetch meaning/reading to build a better fallback.
- No JSON-LD on any learn page (ArticleSchema exists in src/components/JsonLd.tsx:52 but only blog/[slug] uses it).
- study_guide emits no schema; no BreadcrumbList schema anywhere; ArticleSchema lacks dateModified.
- Kana subpages missing canonical; curriculum title missing brand; /learn/kana* + /learn/curriculum missing from sitemap.
- Category canonical includes default sort=newest (`[type]/page.tsx:82`).
- QUALITY GATE: FAQ rich results retired by Google May 7, 2026 — do NOT recommend FAQPage for SERP benefit (keep FAQ as on-page/GEO content only). Never recommend HowTo schema.
