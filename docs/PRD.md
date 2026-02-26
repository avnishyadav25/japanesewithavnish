# PRD v1.0 — JapanesewithAvnish.com

## 1) Product Vision

Build a clean, premium, Japanese-inspired learning site that:

- grows via blogs/lessons + SEO
- converts via one-time digital bundle sales (N5→N1 + Mega)
- gives buyers a simple "My Library" to access purchases anytime
- stays extensible for subscriptions/membership + community later

## 2) Goals (MVP)

**Business goals**

- Sell bundles reliably (low payment failures)
- Instant, secure delivery after payment
- Convert blog traffic into email + purchases
- Placement test recommends correct bundle and increases conversions

**MVP success metrics**

- Product page → Paid order conversion %
- Razorpay payment success rate %
- Paid → Fulfilled success rate %
- Quiz completion % and quiz → purchase conversion %
- Email capture rate from quiz/blog CTAs

## 3) Scope

### MVP (Build now)

**A) Public Website** — Home, Start Here, JLPT hub pages (N5–N1), Blog, Store, Product pages, Quiz. Fast SEO structure (clean slugs, schema, sitemap).

**B) Blog / Lessons** — Admin-managed content publishing (draft/publish). Tags for JLPT level + topic. CTA blocks to bundles.

**C) Digital Store (6 bundles)** — Product listing + product detail pages. Bundle composition + included items list. Discount/offer badges (configurable). Coupon codes (recommended MVP).

**D) Checkout + Payments** — Razorpay hosted checkout (default India). Stripe hosted checkout (feature flag for later global). Webhook verification before fulfillment.

**E) Delivery + Access** — Secure downloads via Supabase Storage signed URLs. "My Library" page (requires magic link login). Email confirmation with library link.

**F) Admin Panel** — Manage blog posts/pages, products + assets, orders + payment status, quiz question bank + scoring thresholds. Export newsletter list.

**G) Placement Test (MVP)** — Quiz + scoring + recommended bundle. Optional email capture gate (recommended).

### Phase 2 (Later)

Membership/subscriptions, Courses/LMS + progress tracking, Community (Discord), Video library, Flashcards/SRS web app, Affiliates.

## 4) Product Catalog (MVP)

| Bundle | Price |
|--------|-------|
| N5 Mastery Bundle | ₹199 |
| N4 Upgrade Bundle | ₹299 |
| N3 Power Bundle | ₹399 |
| N2 Pro Bundle | ₹499 |
| N1 Elite Bundle | ₹599 |
| Complete N5–N1 Mega Bundle | ₹899 |

Each product page: Who it's for, What's included, Outcome, Preview/sample, FAQ, No refunds note.

## 5) User Journeys

**Journey A: Quiz → Recommendation → Purchase** — User visits /quiz, completes quiz, result recommends level + bundle, Buy Now → Razorpay, webhook confirms → entitlements granted, email receipt + My Library link.

**Journey B: Blog → CTA → Purchase** — User reads lesson, CTA suggests bundle, purchase → instant access.

**Journey C: Buyer → My Library** — Magic link login, sees purchases + download buttons.

## 6) Functional Requirements

### 6.1 Authentication (Magic Link)

- Email magic link only
- Purpose: access My Library + Orders
- No password storage
- Rate limiting

### 6.2 Store & Bundles

- Product list with filters (JLPT level)
- Product detail: included items, preview, FAQ, CTAs
- Coupons: % or fixed discount, optional expiry
- Mega Bundle visually highlighted

### 6.3 Checkout

- Collect: Name, Email, Phone only
- No address, GST, or invoice

### 6.4 Payments

- Razorpay (default ON), Stripe (toggle OFF)
- Order PAID only from webhook
- Idempotency for webhook retries
- States: created → pending_payment → paid → fulfilled / failed / cancelled

### 6.5 Fulfillment & Delivery

- Supabase Storage for assets
- Signed URLs (10–30 min expiry)
- Admin: upload to Supabase or paste Drive link → import (never expose Drive links)

### 6.6 My Library

- List owned bundles
- Download buttons → signed URLs only

### 6.7 Blog / Lessons CMS

- Blog Post, Lesson, JLPT Hub page, Landing page
- Fields: title, slug, summary, content (rich text), tags, SEO meta, CTA block

### 6.8 Placement Test

- 20–50 questions (admin editable), 10–15 per run
- Scoring → bundle recommendation
- Email gate (recommended)

### 6.9 Newsletter

- Capture forms: blog footer, quiz flow
- Admin export CSV

## 7) Admin Panel

- Content: create/edit/publish posts and pages
- Media uploads
- Products: create/edit, upload assets, badges, pricing, coupons
- Orders: view, filter, re-send access email
- Quiz: question bank, thresholds, analytics
- Newsletter: view/export

## 8) Non-Functional Requirements

- Performance: fast mobile LCP
- SEO: SSR/SSG, schema, sitemap
- Security: webhook verification, signed downloads, admin protected, rate limiting
- Reliability: idempotent webhooks, audit logs

## 9) Architecture

- Next.js (App Router) + TypeScript
- Supabase: Postgres, Storage, Auth
- Payload CMS for content
- Razorpay + Stripe (feature flagged)

## 10) Data Model

- users, products, product_assets, orders, payments, entitlements, coupons
- quiz_questions, quiz_attempts, subscribers

## 11) Sitemap

/, /start-here, /jlpt/n5…n1, /blog, /blog/[slug], /quiz, /quiz/result, /store, /product/[slug], /thank-you, /login, /library, /policies/*

## 12) Design System

- Primary: #D0021B (Crimson Red)
- Base: #FAF8F5 (Soft Japanese Paper White)
- Text: #1A1A1A, Secondary: #555555
- Premium: #C8A35F (Soft Gold)
- Font: Inter/Poppins/Helvetica
- Calm, structured, academic, Japanese-inspired, minimal, premium
