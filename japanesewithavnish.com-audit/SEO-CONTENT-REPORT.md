# SEO Content & E-E-A-T Report — japanesewithavnish.com

**Date:** 2026-08-08 · **Scope:** content quality, depth, uniqueness, E-E-A-T, and AI-citation readiness for every content type. Backed by direct database analysis of the real corpus (not just sampled pages).

E-E-A-T = **E**xperience, **E**xpertise, **A**uthoritativeness, **T**rust (Google's Quality Rater framework). This report grades each content type on those axes plus content depth and AI/GEO citability.

---

## Overall content assessment

**Strengths:** The site has real topical authority in a well-defined niche (JLPT N5–N1), a genuinely large corpus (~6,700 indexed pages, ~2,250 more in draft), authentic first-person blog content, and a capable page template that — *when the data is complete* — produces useful lesson pages. Everything is server-rendered and crawlable.

**The core content problem is depth distribution, not writing quality.** A small, high-quality core (blog, kanji, study guides, sounds) sits on top of a very large, very thin long tail (the vocabulary corpus that is 78% of the site). Two data facts define the content SEO ceiling:

1. **88% of vocabulary pages have no example sentences** (4,613 of 5,224) — they render as *word + reading + meaning* only.
2. **~90% of learn pages have no `seo_description` and no author** — the content-generation scripts never populate SEO metadata, so descriptions default to the page title.

Fixing these is a data/backfill problem more than a writing problem — the templates and the schema already support depth.

---

## E-E-A-T scorecard by content type

| Content type | Experience | Expertise | Authority | Trust | Notes |
|---|:--:|:--:|:--:|:--:|---|
| Blog (editorial) | ●●●● | ●●● | ●● | ●●● | First-person JLPT journey posts = strong Experience; has author byline + dates |
| Study guides | ●● | ●●● | ●● | ●● | Substantive, structured; but no author/date/schema packaging |
| Kanji | ● | ●●● | ●● | ●● | Accurate reference data (readings, stroke, frequency) |
| Grammar | ● | ●● | ● | ●● | Explanations too thin (avg 145 chars) to demonstrate expertise |
| Vocabulary | ● | ●● | ● | ● | 88% lack examples → little to demonstrate |
| Reading / Listening | ●● | ●● | ● | ●● | Practical practice content; low volume |
| Sounds / Kana | ● | ●●● | ●● | ●● | Good sounds bodies; kana pages thin in SSR |
| JLPT levels | ● | ●●● | ●●● | ●●● | Authoritative overview pages; high commercial intent |
| Curriculum | ● | ●●● | ●● | ●● | Strong structure, but gated/unindexed |
| Rewards / XP | — | — | ● | ●● | In-app only; no public content |

*Scale: ● weak → ●●●● strong.*

### The single biggest E-E-A-T gap: **authorship**
- **0 of 8,935 learn posts** carry an author (`author_name` null across all learn content).
- Blog is better (15/21 have an author) but the schema author is a bare `Person` (name only — no `url`, no `sameAs`, no credentials).
- The brand is literally named after a person ("Avnish"), yet there is **no author entity, bio, credentials, or `Person` schema** tying the expertise to a real, verifiable individual. For a JLPT education site — a "Your Money or Your Life"-adjacent topic where Google weights expertise heavily — this is the highest-value E-E-A-T investment.

**Fix:** Create one authoritative `Person` entity (Avnish + any contributors) with a real bio, JLPT credentials, and `sameAs` links; attach author bylines to blog and learn content; emit `Person`/`author` in schema with `url` → an `/about` or author page.

---

## Content depth & uniqueness (data-backed)

| Type | Avg body | Depth verdict | Uniqueness risk |
|---|---:|---|---|
| Sounds | ~1,987 chars | Strong | Low |
| Writing | ~1,712 chars | Strong (but 5 pages) | Low |
| Study guides | ~1,451 chars | Good | Low — genuinely distinct guides |
| Kanji | ~845 chars | Solid, template-consistent | Medium — templated but factually unique per kanji |
| Vocabulary | word+reading+meaning (+examples 12%) | **Thin for 88%** | **High** — 4,600+ near-identical thin pages |
| Grammar | ~145 chars | **Very thin** (54% under 200) | Medium |
| Reading | ~221 chars | Thin | Medium |

**Programmatic thin-content risk (the vocabulary corpus).** 5,229 templated pages where the majority carry only a dictionary headword is the classic pattern Google's thin/doorway systems demote. It is defensible *if* each page adds genuine value — which the 12% with 6 example sentences do. The path is **enrichment, not pruning**: bring example-sentence coverage from 12% toward ~100% (the `examples` table and template already support it), and the corpus flips from "thin doorway pages" to "useful dictionary + usage pages."

**Grammar depth.** Grammar is a high-intent JLPT search category ("〜てはいけない meaning", "JLPT N4 grammar list"), yet grammar bodies are the thinnest on the site. This is the best depth ROI after vocabulary examples — 560 pages, each deserving a real explanation, structure breakdown, nuance notes, and 3–6 examples (67% already have examples).

---

## Readability
- Lesson templates are clean and scannable (headings, tables, romaji + English gloss, "On this page" jump links). Good for both humans and AI extraction.
- Japanese content correctly pairs kana/kanji with romaji and English — strong for accessibility and for AI models parsing the page.
- Blog posts read naturally and conversationally (first-person). No keyword-stuffing observed.
- No readability red flags; the issue is *quantity* of substance on thin pages, not the *clarity* of what's there.

---

## AI-Search / GEO citation readiness (per type)

The site is **structurally well-positioned for AI search** (excellent `llms.txt`, AI answer-bots allowed in `robots.ts`, server-rendered content, clear Q&A-style guides). Per-type citability:

| Type | AI-citation readiness | Why |
|---|---|---|
| Study guides | **High** | Long, structured, question-oriented ("look-alike trap", "pro-tips") — ideal passage-level citation targets |
| Blog | High | Clear narrative + specific claims; add author/date to boost trust weighting |
| JLPT levels | High | Canonical "what is JLPT N3" answers — but need `Course`/definition framing |
| Kanji | Medium-High | Structured facts AI can lift (readings, stroke count) — would benefit from `DefinedTerm`/`LearningResource` |
| Grammar | Medium | Good intent match, but bodies too thin to be the best answer source |
| Vocabulary | Low-Medium | Thin pages rarely become the cited source; example sentences would change this |

**What's blocking stronger AI citation:**
1. **The canonical-domain bug** (site-wide) — AI engines reconciling canonical signals may attribute content to the netlify.app domain. Fix first.
2. **No structured data** to disambiguate entities (`DefinedTerm` for vocab/kanji, `Course` for JLPT/curriculum, `Article` for guides).
3. **Missing author/date signals** — AI answer engines increasingly weight authorship and freshness.

**GEO opportunity:** the study-guide corpus (392 pages) is the site's strongest AI-citation asset and is currently the *worst-packaged* (no schema, no OG, stub descriptions). Packaging it properly is a high-leverage GEO win.

---

## Trust signals (site-wide, content-relevant)
- ✅ Policy pages exist (`/policies/privacy|terms|refunds|cookies`).
- ✅ Clear pricing, "secure checkout" messaging, contact page.
- ⚠️ Display ads (AdSense + Monetag) on a paid learning product can *lower* perceived trust/quality — reconsider on content pages.
- ⚠️ No visible author/About/credentials page establishing who is behind the teaching.
- ⚠️ Empty `Organization.sameAs` (social profiles exist but aren't declared) weakens the brand entity AI and Google build.

---

## Content-quality priorities (ranked)
1. **Populate `seo_description` for the corpus** (backfill from structured fields) — fixes ~90% of learn pages' descriptions. *(Data fix; see action plan.)*
2. **Raise vocabulary example coverage** from 12% toward full — turns the site's 78% into genuine content.
3. **Establish authorship/E-E-A-T** — one real author entity + bylines + `/about` + `Person` schema.
4. **Deepen grammar explanations** — 560 high-intent pages currently too thin.
5. **Package study guides properly** — Article schema, OG images, real descriptions, author/date.
6. **Publish the kanji draft backlog** (1,833) with QA — 5× the kanji corpus.
