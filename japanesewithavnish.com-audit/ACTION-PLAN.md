# Action Plan — japanesewithavnish.com

Prioritized by impact. Phase 1 is where nearly all the value is — it's a single config change plus a redirect.

---

## 🔴 Phase 1 — Critical Fixes (Week 1)

### 1. Fix the site URL (one change fixes canonical + og:url + sitemap + robots + JSON-LD)
- In **Netlify → Site settings → Environment variables**, set:
  ```
  NEXT_PUBLIC_SITE_URL = https://japanesewithavnish.com
  ```
  It is currently set to `https://cosmic-blini-bc94d7.netlify.app`. The code already defaults to the correct domain (`src/lib/seo.ts:1`, `src/app/layout.tsx:47`, `src/app/sitemap.ts:4`, `src/app/robots.ts:3`) — the env var is overriding it.
- **Redeploy** (clear cache / trigger a fresh build so the new env value is baked in).

### 2. Redirect the Netlify subdomain to the primary domain
- The `*.netlify.app` host currently returns **HTTP 200** (a full live duplicate). Add a 301 to the primary domain, e.g. a host-based rule in `netlify.toml`:
  ```toml
  [[redirects]]
    from = "https://cosmic-blini-bc94d7.netlify.app/*"
    to = "https://japanesewithavnish.com/:splat"
    status = 301
    force = true
  ```

### 3. Verify
- Re-check canonical on `/`, `/pricing`, `/jlpt`, a `/learn/*` and a `/blog/*` page — all should read `https://japanesewithavnish.com/...`.
- Confirm `sitemap.xml` `<loc>` values and the robots `Sitemap:` line now use the primary domain.

### 4. Reconcile in Google Search Console
- Ensure `https://japanesewithavnish.com` is the verified property.
- Re-submit the corrected sitemap; use URL Inspection → Request Indexing on the homepage + top pages.
- Watch for the netlify.app subdomain to drop out of the index over the following weeks.

---

## 🟠 Phase 2 — High-Impact Improvements (Weeks 2–3)

### 5. Descriptive meta descriptions for programmatic pages
- Replace stubs like `"尻 - butt"` / `"ときどき"` with templated, data-driven descriptions, e.g.
  `Learn the JLPT N2 kanji 尻 ("butt"): on/kun readings, stroke order, example words and quick practice.`
- Applies to `/learn/vocabulary/*`, `/learn/kanji/*`, `/learn/grammar/*`, and `/blog/study_guide/*`.

### 6. Fix Open Graph / Twitter images
- Create a branded **1200×630** default OG image.
- Re-specify `openGraph.images` and `twitter.images` in page-level metadata (they're currently dropped because pages redefine `openGraph` without images). Best done via a shared `buildMetadata()` helper in `src/lib/seo.ts`.

### 7. Add structured data
- **BreadcrumbList** site-wide, **Article** on blog posts, **Product + Offer** on pricing bundles.
- Complete **Organization**: add `logo`, populate `sameAs` with the X / YouTube / Instagram URLs already in the footer.

### 8. Image alt text
- Add descriptive `alt` to content images (~20% currently missing); keep empty `alt` only for decorative images.

---

## 🟡 Phase 3 — Content & Authority (Month 2)

### 9. Expand thin pages
- `/quiz` (143w), `/free-n5-pack` (221w), `/learn` hub (294w), several `/guide/*` (~260w) — add supporting copy, sample content, and FAQs.

### 10. More schema
- **Course / EducationalOccupationalProgram** on JLPT level pages; **FAQPage** on guide + JLPT pages; **WebSite + SearchAction** on the homepage.

### 11. Reduce programmatic thin-content risk
- Strengthen internal linking between related lesson entries (same level / topic); consider consolidating the very thinnest single-item pages into topic hubs with anchors.

### 12. E-E-A-T
- Add a **Person/author** entity with credentials + `sameAs`, author bylines, and a substantive About page.

### 13. Ads on a paid product
- Reconsider AdSense + Monetag on subscription pages. If retained: reserve fixed ad-slot dimensions (protect CLS), lazy-load below-the-fold units.

---

## 🟢 Phase 4 — Monitoring & Iteration (Ongoing)

- Add a **PageSpeed Insights API key** and connect **GSC + GA4** for real CWV, indexation, and traffic data.
- Monitor indexation of the primary domain vs the netlify.app subdomain until the duplicate is gone.
- Track **INP/CLS** on lesson pages once field data accrues.
- **Re-run this audit after Phase 1 deploys** to confirm the canonical fix propagated (expected overall score ~75–80).

---

### Effort vs Impact snapshot
| Item | Effort | Impact |
|------|--------|--------|
| Phase 1 (env var + redirect) | **XS** | **Very High** |
| Meta descriptions at scale | M | High |
| OG images | S | Medium |
| Structured data | M | High |
| Thin-page expansion | L | Medium |
| CWV/GSC instrumentation | S | Medium (visibility) |
