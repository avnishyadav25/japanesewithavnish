# Full SEO Audit — japanesewithavnish.com

**Audited:** 2026-08-08 · **Business type:** EdTech / SaaS — subscription Japanese-language learning (JLPT N5–N1)
**Stack:** Next.js (App Router, SSR) on Netlify · **Sitemap scope:** 6,733 URLs · **Sampled:** 49 pages across marketing, learn, blog, guide

## Executive Summary

### SEO Health Score: **58 / 100 — Fair**

The site is fundamentally well built — server-rendered content, clean URLs, correct HTTPS/www redirects, a complete sitemap, real and unique lesson content, a genuinely good `llms.txt`, and strong security headers. It is held back almost entirely by **one systemic configuration bug**: every canonical, `og:url`, JSON-LD `url`, and sitemap entry points to the default Netlify subdomain (`cosmic-blini-bc94d7.netlify.app`) instead of `japanesewithavnish.com` — and that subdomain serves a full live copy of the site. This actively tells Google the netlify.app copy is the real one, threatening the primary domain's ability to rank at all.

**The good news:** the single most damaging issue is a one-line environment-variable fix that cascades to nearly every critical finding.

### Top 5 Critical/High Issues
1. **Canonical URLs site-wide point to `cosmic-blini-bc94d7.netlify.app`** (Critical) — verified on `/`, `/pricing`, `/start-here`, `/quiz`, `/jlpt`, `/blog`, `/learn/grammar`.
2. **The netlify.app subdomain serves a live duplicate (HTTP 200), not a redirect** (Critical).
3. **robots.txt Sitemap directive + all 6,733 sitemap URLs use the wrong domain** (High).
4. **Auto-generated stub meta descriptions** on thousands of `/learn/*` and `/blog/study_guide/*` pages (High).
5. **Missing high-value schema** (Breadcrumb, Article, Product/Offer, Course, FAQ) despite being an education + commerce site (High).

### Top 5 Quick Wins
1. Set Netlify env `NEXT_PUBLIC_SITE_URL=https://japanesewithavnish.com` and redeploy — **fixes canonical, og:url, sitemap, robots and JSON-LD at once.**
2. Add a 301 from the `*.netlify.app` host to the primary domain.
3. Populate Organization `sameAs` (X/YouTube/Instagram are already linked in the footer) + add a logo.
4. Re-specify `openGraph.images` in page-level metadata so the default image stops being dropped.
5. Add a PageSpeed Insights API key to unlock real Core Web Vitals measurement.

---

## Root Cause Analysis (why one fix solves so much)

The dynamic metadata all resolves the base URL from one env var:

| File | Line | Code |
|------|------|------|
| `src/lib/seo.ts` | 1 | `export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL \|\| "https://japanesewithavnish.com";` |
| `src/app/layout.tsx` | 47 | `const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL \|\| "https://japanesewithavnish.com";` |
| `src/app/sitemap.ts` | 4 | `const BASE = process.env.NEXT_PUBLIC_SITE_URL \|\| "...";` |
| `src/app/robots.ts` | 3 | `const BASE = process.env.NEXT_PUBLIC_SITE_URL \|\| "...";` |

The **code default is correct** (`japanesewithavnish.com`). The production output is wrong, which means **`NEXT_PUBLIC_SITE_URL` is set to `https://cosmic-blini-bc94d7.netlify.app` in the Netlify environment.** This is confirmed by a tell-tale asymmetry: `public/llms.txt` is a **static file** with the domain hardcoded correctly — so it's right — while every *dynamically generated* URL is wrong. Change the env var, redeploy, and the whole class of issues disappears.

---

## Technical SEO — Score 45/100

**What works:** HTTP→HTTPS 301 · www→non-www 301 · proper 404s · robots.txt with sensible disallows and explicit AI-crawler rules · complete XML sitemap · server-side rendering · HSTS + X-Frame-Options + X-Content-Type-Options + Referrer-Policy + Permissions-Policy · Netlify CDN + Brotli.

| Severity | Finding | Fix |
|----------|---------|-----|
| **Critical** | Canonical points to netlify.app on every page | Set `NEXT_PUBLIC_SITE_URL` correctly + redeploy |
| **Critical** | netlify.app subdomain returns 200 (live duplicate) | 301 the `*.netlify.app` host → primary domain |
| **High** | Sitemap `<loc>` + robots `Sitemap:` use wrong domain | Same env fix (both generated from it); re-submit sitemap in GSC |
| **Medium** | HTML sent as `no-store` (uncacheable) | Cache public routes at edge with `s-maxage` + SWR; keep `no-store` only for auth routes |
| **Low** | No Content-Security-Policy | Add report-only CSP, then enforce |

**Redirect map verified:** `http://` → `https://` ✓ · `https://www` → `https://` (non-www) ✓ · unknown URL → 404 ✓.

---

## On-Page SEO — Score 52/100

**What works:** homepage title `Japanese with Avnish | JLPT N5–N1 Learning` (43 chars) · unique titles across the sample · exactly one H1 per page · clean URLs · strong marketing-page descriptions.

| Severity | Finding | Evidence / Fix |
|----------|---------|----------------|
| **Critical** | `og:url` + canonical on wrong domain | Resolved by the env fix |
| **High** | Stub meta descriptions at scale | `/learn/kanji/...` → `"尻 - butt"`, `/learn/vocabulary/...` → `"ときどき"`, many `/blog/study_guide/*` at 24–65 chars. Generate descriptive templated descriptions from existing data. |
| **Medium** | Missing `og:image`/`twitter:image` on most pages | Root layout sets `openGraph.images=['/logo.png']`, but page-level metadata redefines `openGraph` without images, so Next.js drops them. Re-specify images per page (or centralize a `buildMetadata()` helper). |
| **Low** | A few `/guide/*` titles > 60 chars | e.g. 77-char title truncates in SERP — trim the "— Site Guide" boilerplate. |

**Good sign:** JLPT level pages (`/jlpt?level=n5…n1`) each have a unique, descriptive title and a self-referencing canonical — correct handling of the query parameter (only the domain is wrong).

---

## Content Quality — Score 68/100

**What works:** lesson pages have real, unique content — vocabulary pages carry multiple example sentences with romaji + English (~380 words); kanji pages include readings, stroke count, frequency and study tips (~550 words); study guides run ~900 words. The blog shows first-hand **E-E-A-T** (`my-journey-from-n5-to-n3`, `mistakes-i-made-while-learning-japanese`). Tight topical authority around JLPT. Lesson detail pages are crawlable (not login-gated).

| Severity | Finding | Fix |
|----------|---------|-----|
| **Medium** | Thin conversion pages | `/quiz` 143w · `/free-n5-pack` 221w · `/learn` hub 294w · several `/guide/*` ~260w. Expand with supporting copy + FAQs. |
| **Medium** | Programmatic index-bloat risk | 5,230 vocab + 561 grammar + 424 kanji pages on one template. Strengthen internal linking, ensure unique above-the-fold content, consider consolidating the thinnest entries into topic hubs. |
| **Medium** | Weak explicit author/E-E-A-T signals | No Person/author schema or visible credentials for "Avnish". Add author entity + bylines + About page. |

---

## Schema / Structured Data — Score 50/100

**What works:** a valid `Organization` JSON-LD block is present in the initial HTML.

| Severity | Finding | Fix |
|----------|---------|-----|
| **High** | Missing high-value schema | Add BreadcrumbList (site-wide), Article (blog), Course/EducationalOccupationalProgram (JLPT levels), Product+Offer (pricing bundles), FAQPage (guide/JLPT), WebSite+SearchAction (homepage). |
| **Medium** | Organization schema minimal + wrong url | `url`=netlify.app, `sameAs`=[], no logo. Fix url via env, add logo + social profiles. |

---

## Performance (Core Web Vitals) — Score 60/100 *(heuristic — field data unavailable)*

**What works:** Netlify CDN + Brotli · font preloads · SSR · clean responsive mobile render.

| Severity | Finding | Fix |
|----------|---------|-----|
| **Info** | Field CWV could not be measured | PSI/CrUX rate-limited (no API key); domain likely below CrUX traffic threshold. Add a PSI key + connect GSC for real LCP/INP/CLS. |
| **Medium** | Ad scripts (AdSense + Monetag) + GTM | Ads are a common CLS/INP source and clash with a premium paid product. Reconsider on paid pages; if kept, reserve fixed slot sizes and lazy-load below the fold. |
| **Low** | ~131 KB HTML, 16 hydration chunks, 16 scripts | Audit client-component boundaries; watch INP on interactive lesson pages. |

---

## AI Search Readiness (GEO) — Score 78/100 *(strongest category)*

**What works:** an excellent, well-structured `/llms.txt` (correctly on the primary domain) · robots.txt explicitly allows `OAI-SearchBot` and `ChatGPT-User` · SSR content is fully readable by AI crawlers · citable, question-oriented guide content.

| Severity | Finding | Fix |
|----------|---------|-----|
| **Medium** | Domain confusion may fracture AI citations | llms.txt says japanesewithavnish.com but canonical/schema say netlify.app. Resolved by the env fix. |
| **Low** | Weak entity signals | Empty `sameAs`, no logo. Complete Organization + Person schema. |

---

## Images — Score 62/100

| Severity | Finding | Fix |
|----------|---------|-----|
| **Medium** | ~20% of sampled images missing alt text (26/128) | Add descriptive alt; empty alt only for decorative images. |
| **Medium** | No dedicated 1200×630 social image | Create a branded OG image + per-section variants. |
| **Low** | Assets on raw `*.r2.dev` hostname | Map a branded custom domain to the R2 bucket. |

---

## Scoring Breakdown

| Category | Weight | Score | Weighted |
|----------|--------|-------|----------|
| Content Quality | 23% | 68 | 15.6 |
| Technical SEO | 22% | 45 | 9.9 |
| On-Page SEO | 20% | 52 | 10.4 |
| Schema / Structured Data | 10% | 50 | 5.0 |
| Performance (CWV) | 10% | 60 | 6.0 |
| AI Search Readiness | 10% | 78 | 7.8 |
| Images | 5% | 62 | 3.1 |
| **Overall** | **100%** | — | **≈ 58** |

*Note: the Technical and On-Page scores are dragged down by a single root-cause config bug. Fixing Phase 1 alone should lift the overall score into the ~75–80 range once re-crawled.*

---
*Per-category detail in `findings/`. Screenshots (desktop/laptop/tablet/mobile) in `screenshots/`.*
