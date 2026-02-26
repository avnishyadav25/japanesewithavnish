# Japanese with Avnish

A premium Japanese learning site with digital bundles, placement quiz, and blog. Sell JLPT N5–N1 bundles with instant delivery via Supabase Storage.

## Tech Stack

- **Next.js 14** (App Router) + TypeScript
- **Supabase** — Postgres, Auth (magic link), Storage
- **Razorpay** — Payments (India)
- **Resend** — Email (magic links, receipts, quiz results)

## Features

- Public site: Home, Start Here, JLPT hubs, Blog, Store, Product pages
- Placement quiz with email gate and bundle recommendation
- Checkout with Razorpay (test mode supported)
- My Library — magic link login, secure signed downloads
- Admin panel for products, orders, quiz, newsletter
- Policies: Privacy, Terms, Refunds (no refunds)

## Local Setup

### Prerequisites

- Node.js 18+
- Supabase account
- Razorpay account (test mode)
- Resend account

### Install

```bash
npm install
cp .env.example .env
# Edit .env with your keys
npm run dev
```

### Env Vars

See `.env.example`. Required:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`, `EMAIL_FROM`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `ADMIN_EMAILS` — comma-separated admin emails
- `NEXT_PUBLIC_SITE_URL` — e.g. https://japanesewithavnish.com

### Database

1. Create a Supabase project
2. Run `supabase/migrations/001_initial_schema.sql` in SQL Editor
3. Run `scripts/seed-products.sql` to add the 6 bundles
4. Create a Storage bucket `bundle-assets` (private)
5. Configure Razorpay webhook: `https://yoursite.com/api/webhooks/razorpay`

## Security

- **Never expose bundle source links.** No Drive, Dropbox, or direct file URLs in frontend, API, or env. All assets live in Supabase Storage. Use signed URLs only (10–30 min expiry).
- Admin panel protected by `ADMIN_EMAILS`. Only listed emails can access `/admin`.

## Disclaimer

**Bundle assets (PDFs, audio, etc.) are NOT included in this repo.** Deployers supply their own content via:
- Admin upload to Supabase Storage
- Drive import (paste link → server fetches and uploads to Storage; link is never stored)

No creator links or sample bundles in the repo.

## License

MIT
