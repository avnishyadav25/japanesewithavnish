# Technical SEO — 45/100

## Critical
- **Canonical → wrong domain (site-wide).** Every page emits `<link rel="canonical" href="https://cosmic-blini-bc94d7.netlify.app/...">`. Verified: `/`, `/pricing`, `/start-here`, `/quiz`, `/jlpt`, `/blog`, `/learn/grammar`. Tells Google the netlify.app copy is authoritative.
- **netlify.app subdomain returns HTTP 200** (full live duplicate), not a redirect.

## High
- **Sitemap + robots use wrong domain.** All 6,733 `<loc>` and the robots `Sitemap:` line use netlify.app. Generated from `NEXT_PUBLIC_SITE_URL` (`src/app/sitemap.ts:4`, `src/app/robots.ts:3`).

## Medium
- **HTML `Cache-Control: private,no-cache,no-store,must-revalidate`** — public routes are uncacheable at edge/browser.

## Low
- No Content-Security-Policy header (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy are present).

## Passed
HTTP→HTTPS 301 · www→non-www 301 · proper 404 · robots.txt disallows (admin/api/account/checkout/login) · explicit AI-bot rules · complete sitemap · SSR · Netlify CDN + Brotli.

## Root cause
Code defaults to the correct domain; production `NEXT_PUBLIC_SITE_URL` is set to the netlify.app URL. Fix env var + redeploy.
