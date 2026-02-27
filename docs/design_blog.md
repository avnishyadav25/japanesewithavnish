# Blog Pages Design Spec

**Site:** JapanesewithAvnish.com  
**Routes:** `/blog`, `/blog/[slug]`

---

## 1) Global Layout & Grid

- **Background:** `#FAF8F5` (same as homepage)
- **Max width:** `1100px`
- **Page padding:** 20px (mobile), 24px on ≥1024px
- **Card radius:** `10px`
- **Base shadow:** Subtle, same token as homepage
- **Typography:** Inter / Poppins

### `/blog` Container

- Single-column layout, centered
- Section spacing: `60px 20px` desktop, `40px 16px` mobile

### `/blog/[slug]` Container

- **Desktop (≥1024px):** 2-column grid  
  - Left (article): `minmax(0, 720px)`  
  - Right (rail): `340px`  
  - Column gap: `40px`
- **Tablet (768–1023px):** Single column (article first, then rail cards stacked)
- **Mobile (≤767px):** Single column + bottom sticky CTA bar

---

## 2) `/blog` — Listing Page

### 2.1 Hero

- **Title:** “Blog” or “Latest lessons & JLPT tips”
- **Subtext:** Short one-liner about lessons, study advice, and JLPT strategy
- Simple white card or soft highlight block; no heavy imagery

### 2.2 Filter Bar (`BlogFilterBar`)

- **Elements:**
  - Search input: “Search lessons, grammar, kanji…”
  - JLPT level pills: All, N5, N4, N3, N2, N1, Mega/All levels
  - Topic pills: All, Grammar, Vocabulary, Kanji, Reading, Listening, Roadmap/Tips
- **Behavior:**
  - Controlled via URL search params:
    - `?level=n5|n4|n3|n2|n1|mega`
    - `&type=grammar|vocabulary|kanji|reading|listening|tips|roadmap`
    - `&search=query`
  - Client keeps local input state in sync with URL (onChange + useEffect)
  - Clearing search removes `search` param from URL
- **UI:**
  - Search: full-width on mobile, compact on desktop
  - Pills: 28–32px height, soft borders `#EEEEEE`, active state with `#D0021B` bg/text

### 2.3 Featured Row

- Uses curated slugs from `site_settings.blog_featured_posts` (array of 0–2 slugs).
- If at least 1 matching post is available:
  - Render a **Featured row** above main grid:
    - First card: “large” featured card
    - Optional second: “medium” card
- If there are fewer than 2 posts after filters:
  - Skip the featured row and fall back to showing everything in main grid (no empty state).

### 2.4 Main Posts Grid

- Grid:
  - Desktop: 3 columns if enough posts, otherwise 2 or 1 as needed
  - Mobile: 1 column
- Cards rendered via `BlogPostCard`:
  - Thumbnail image (16:9, `img` with `object-cover`, rounded top)
  - Title (2 lines max)
  - Summary/excerpt (2–3 lines max)
  - Meta row:
    - Date
    - JLPT pill (N5–N1 or “All levels”)
    - Topic pill (Grammar, Vocab, etc.)
  - CTA: “Read →”

### 2.5 Pagination

- Simple **Previous / Next** pagination using `page` query param:
  - `?page=2`, `?page=3`, etc.
  - `Previous`:
    - If going back to page 1, drop the `page` param entirely (keep other filters).
  - `Next`:
    - Increments `page` while keeping `level`, `type`, `search`.
- Server-side pagination:
  - Fetch a reasonable slice (e.g. 24–30 posts) and slice per page.

### 2.6 Newsletter on Listing Page

- Newsletter block appears near the bottom of the listing page, before footer.
- Reuses global `NewsletterSection` patterns:
  - Headline: “Get JLPT tips + updates”
  - Copy: “No spam. Unsubscribe anytime.”
  - Email input + submit button
  - Hooked into `/api/subscribe` endpoint

---

## 3) `/blog/[slug]` — Detail Page

### 3.1 Top Breadcrumb + Meta Row

**BreadcrumbRow**

- Format: `Home / Blog / [N4] / [Short title]`
- Font: 13px, `#555555`
- Margin-bottom: 16px

**PostMetaRow**

- Left-aligned:
  - Published date
  - Calculated read time: e.g. “8 min read”
- Right-aligned:
  - JLPT level pill (`N5…N1` or “All levels” / “Roadmap”)
  - Topic pill (Grammar, Vocabulary, Kanji, Reading, Listening, Roadmap/Tips)
- Pills:
  - Height: 28px
  - Background: `#FFFFFF`
  - Border: `#EEEEEE`
  - Text: 13px
  - Optional accent border `#D0021B` for primary pill

### 3.2 Article Header (`PostHeader`)

- **H1:**
  - Size: 32–40px, weight 700, `#1A1A1A`
- **Subheading:**
  - 16px, `#555555`, max 2 lines
- Spacing:
  - H1 → subheading: 10px
  - Subheading → image: 20px

**PostHeroImage**

- Aspect ratio: 16:9
- Radius: 10px
- Subtle base shadow
- Uses `post.og_image_url` or safe default
- Alt text is required; derive from title if missing

### 3.3 Table of Contents (Inline) — `BlogTableOfContents`

- Title: “On this page”
- Lists all `h2` anchors (nested `h3` optional)
- Card style:
  - Background: `#FFFFFF`
  - Border: `#EEEEEE`
  - Radius: 10px
  - Padding: 16–18px
  - Margin: 24px top & bottom
- Mobile/tablet: collapsible accordion
- Uses heading IDs generated via `slugify` to ensure TOC links match `id` on `h2`/`h3`.

### 3.4 Article Body — `BlogArticleContent`

- Rendered with `react-markdown`.
- **Typography:**
  - Body: 16px, line-height 1.75, `#555555`
  - H2: 22–24px, weight 700, `#1A1A1A`, margin-top ~32px
  - H3: 18–20px, weight 700, margin-top ~24px
  - Lists: 8px spacing between items
  - Links: `#D0021B` with underline on hover
- **Heading IDs:**
  - `h2` and `h3` renderers compute text and apply `id={slugify(text)}`.
  - Enables hash-link navigation from TOC and URL fragments.
- **Supported Blocks (structured via markdown conventions):**
  - Callout boxes (e.g. `> **Note:** ...`)
  - Example boxes for grammar (e.g. headings + lists)
  - Simple vocab tables (markdown tables)
  - Inline CTA blocks (see below)

### 3.5 Inline CTA Blocks (Max 2)

**InlineCTA** (rendered via markdown + optional shortcodes or explicit insertion):

- CTA 1 (after ~25% of article):
  - “Want the full structured materials for [level]? Get the [Level] Bundle →”
- CTA 2 (near end of article):
  - “Not sure your level? Take the placement quiz →”
- Style:
  - White card with soft highlight background `#FAF8F5`
  - Red primary button or bold red link
  - Margin: 24–32px above/below

### 3.6 Right Sticky Rail (Desktop) — `BlogStickyCta`

- Sticky behavior:
  - Position sticky
  - Top offset: ~96px (below header/announcement)
  - Stack cards with 16px gap
- Card style (all rail cards):
  - Background: `#FFFFFF`
  - Radius: 10px
  - Padding: 16–18px
  - Border: `#EEEEEE`

#### Rail Card 1 — `RailBundleCard`

- **Title:** “Get the complete pack”
- **Copy:** “Worksheets, mock tests, audio drills, and structured material.”
- **Dynamic CTA (based on `jlpt_level`):**
  - N5 → `/product/japanese-n5-mastery-bundle`
  - N4 → `/product/japanese-n4-upgrade-bundle`
  - N3 → `/product/japanese-n3-power-bundle`
  - N2 → `/product/japanese-n2-pro-bundle`
  - N1 → `/product/japanese-n1-elite-bundle`
  - If topic is “All levels” / “Roadmap” → Mega CTA `/product/complete-japanese-n5-n1-mega-bundle`
- **Buttons/links:**
  - Primary: filled red button, full width, height 44px
  - Secondary link: “Compare all bundles → /store”
  - Text link: “Take placement quiz → /quiz”
- **Styling for N1/Mega:**
  - Thin gold badge or border using `#C8A35F`

#### Rail Card 2 — `RailQuizCard`

- **Title:** “Not sure your level?”
- **Copy:** “Take the 3–5 minute quiz.”
- **CTA link:** “Start Quiz → /quiz”

#### Rail Card 3 — `RailLeadMagnetCard`

- **Title:** “Free N5 Kana Pack”
- Email input + subscribe button
- Tiny note: “No spam. Unsubscribe anytime.”
- Uses the same newsletter/lead magnet plumbing as other pages.

#### Rail Card 4 (Optional) — TOC Mini

- Compact TOC list for long articles (same anchors as main TOC).

### 3.7 Below Article — Related + End CTA

**RelatedPostsGrid**

- Heading: “Recommended next reads”
- 3–6 cards:
  - Filter primarily by same `jlpt_level` and topic
  - Fallback: recent posts in same level or global recent

**EndCTA — `BlogNextStepCta`**

- Title: “What should you do next?”
- Actions:
  - Primary button: Take Quiz → `/quiz`
  - Secondary button: Browse Bundles → `/store`
  - Link: My Library → `/library`

### 3.8 Mobile Bottom Sticky CTA Bar

- Component: `BottomStickyCTA` (part of `BlogStickyCta`)
- Height: ~60px
- Appears after user scrolls ~20% of article
- Left: “Get [Level] Bundle”
- Right: “Quiz”
- Primary red button + secondary outline style
- Main content gets extra bottom padding to avoid overlap.

### 3.9 Newsletter on Detail Page

- Newsletter block appears **before** the site footer:
  - Either inline at the end of article column OR as part of right rail on desktop and full-width on mobile.
- Copy aligned with global newsletter:
  - “JLPT tips + updates. No spam.”

---

## 4) Content Model & Admin Fields

### 4.1 `posts` Table Fields (minimum)

- `id`
- `slug`
- `title`
- `summary` (used as card excerpt and intro paragraph)
- `content` (markdown)
- `og_image_url` (blog hero image)
- `jlpt_level`:
  - Stored as array or scalar; values like `["N4"]` or `["N5","N4"]`
- `tags` / `topic`:
  - Topic values: `grammar`, `vocabulary`, `kanji`, `reading`, `listening`, `roadmap`, `tips`
  - Additional freeform tags allowed
- `status` (`draft` / `published`)
- `published_at`
- Optional flags:
  - `featured` (used for homepage or future)
  - `recommended` (for pinned/curated per level if needed)

### 4.2 Admin Blog Form Alignment

- Ensure admin can set:
  - **JLPT level(s):** checkbox or multi-select for N5–N1, plus “All levels / Roadmap”
  - **Primary topic:** single-select for display pill
  - **Summary:** 2–3 sentence overview (used on cards and as intro)
  - **OG image URL / upload:** for hero image
  - **Optional inline CTAs / promo intent:** e.g. “bundle_focus_level” to let AI nudge the correct bundle.
- AI prompt for blog generation should:
  - Produce properly structured markdown with clear `##` / `###` headings.
  - Avoid embedding hard-coded CTAs or product URLs; instead describe where CTAs belong so UI can render them.
  - Include a concise summary and clear sections to power TOC.

### 4.3 Site Settings / JSONB (`site_settings`)

- `blog_featured_posts`: `string[]` of slugs for listing-page featured row.
- `lead_magnet_settings` (shared):
  - `{ title, description, cta_label, success_message }`
- `newsletter_copy` (optional):
  - `{ heading, subheading }`

---

## 5) URL & SEO Behavior

- `/blog`:
  - Supports `level`, `type`, `search`, `page` query params.
  - All states should be shareable/bookmarkable.
- `/blog/[slug]`:
  - Canonical URL per slug.
  - Heading IDs enable hash links (e.g. `/blog/n4-grammar-guide#past-tense`).
- Sitemap includes `/blog` and all published `posts.slug`.

